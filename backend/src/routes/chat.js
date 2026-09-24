const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ChatMessage = require("../models/ChatMessage");
const Organization = require("../models/Organization");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const { sendPushNotifications } = require("./users");

// Middleware to verify user is an active member of the target organization
async function requireOrgMembership(req, res, next) {
  try {
    const { orgId } = req.params;
    if (!orgId) return res.status(400).json({ error: "orgId is required" });

    const currentUserId = (req.user?._id || req.user?.id || req.user?.sub || req.auth?.sub || "").toString();
    if (!currentUserId) return res.status(401).json({ error: "Authentication required" });

    const user = await User.findById(currentUserId).select("memberships displayName avatarUrl").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const membership = user.memberships?.find(
      (m) => (m.organization?._id || m.organization || "").toString() === orgId && m.isActive !== false
    );

    if (!membership) {
      return res.status(403).json({ error: "Access denied. You are not an active member of this organization." });
    }

    req.membership = membership;
    req.fullUser = user;
    next();
  } catch (err) {
    console.error("[chat middleware]", err);
    res.status(500).json({ error: "Failed to verify organization membership" });
  }
}

/**
 * @route   GET /api/chat/conversations
 * @desc    Fetch all organization conversations for the current user with last message preview, unread count & online count
 * @access  Private
 */
router.get("/conversations", authenticate, async (req, res) => {
  try {
    const currentUserId = (req.user?._id || req.user?.id || req.user?.sub || req.auth?.sub || "").toString();
    if (!currentUserId) return res.status(401).json({ error: "Authentication required" });

    const user = await User.findById(currentUserId).select("memberships").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const activeMemberships = (user.memberships || []).filter((m) => m.isActive !== false);
    const orgIds = activeMemberships
      .map((m) => (m.organization?._id || m.organization || "").toString())
      .filter(Boolean);

    if (orgIds.length === 0) {
      return res.json({ conversations: [] });
    }

    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select("_id name logo logoUrl category memberCount")
      .lean();

    const getOrgOnlineUsers = req.app.get("getOrgOnlineUsers");

    const conversations = await Promise.all(
      orgs.map(async (org) => {
        const orgIdStr = org._id.toString();
        const lastMsg = await ChatMessage.findOne({ organization: org._id })
          .sort({ createdAt: -1 })
          .populate("sender", "displayName avatarUrl")
          .lean();

        const unreadCount = await ChatMessage.countDocuments({
          organization: org._id,
          sender: { $ne: currentUserId },
          seenBy: { $ne: currentUserId },
        });

        const onlineUserIds = getOrgOnlineUsers ? getOrgOnlineUsers(orgIdStr) : [];

        return {
          organization: {
            _id: org._id,
            name: org.name,
            logo: org.logoUrl || org.logo,
            category: org.category,
            memberCount: org.memberCount || 1,
          },
          lastMessage: lastMsg
            ? {
                _id: lastMsg._id,
                content: lastMsg.content,
                messageType: lastMsg.messageType,
                createdAt: lastMsg.createdAt,
                sender: lastMsg.sender,
              }
            : null,
          unreadCount,
          onlineCount: onlineUserIds.length,
          onlineUserIds,
        };
      })
    );

    // Sort conversations: most recent message first, then alphabetical by org name
    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.organization.name.localeCompare(b.organization.name);
    });

    res.json({ conversations });
  } catch (err) {
    console.error("[chat:conversations]", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * @route   GET /api/chat/:orgId/bootstrap
 * @desc    Consolidated chat initialization endpoint: returns messages, pinned announcements,
 *          organization profile, and online members in a single low-latency roundtrip.
 * @access  Private (Org Members)
 */
router.get("/:orgId/bootstrap", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const { before, since } = req.query;

    const filter = { organization: orgId };
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    } else if (since) {
      filter.createdAt = { $gt: new Date(since) };
    }

    const getOrgOnlineUsers = req.app.get("getOrgOnlineUsers");
    const getOrgOnlineUsersAsync = req.app.get("getOrgOnlineUsersAsync");
    const redisService = req.app.get("redisService");

    // 1. Check Redis L1 Sorted Set message cache (bypasses DB query if hit)
    let cachedMessages = null;
    if (redisService && !since) {
      cachedMessages = await redisService.getCachedMessages(orgId, limit, before);
    }

    let org;
    let messages;
    let pinned;

    if (cachedMessages && cachedMessages.length > 0) {
      // Fast path (<2ms): Cached messages in Redis
      [org, pinned] = await Promise.all([
        Organization.findById(orgId)
          .select("_id name logo logoUrl category memberCount treasuryWallet walletAddress highValueThreshold requiredApprovals description")
          .lean(),
        ChatMessage.find({ organization: orgId, isPinned: true })
          .sort({ pinnedAt: -1 })
          .limit(10)
          .populate("sender", "displayName avatarUrl walletAddress")
          .populate("pinnedBy", "displayName")
          .lean(),
      ]);
      messages = cachedMessages;
    } else {
      // Slow path: MongoDB collection query & lean populate
      const [dbOrg, dbMessages, dbPinned] = await Promise.all([
        Organization.findById(orgId)
          .select("_id name logo logoUrl category memberCount treasuryWallet walletAddress highValueThreshold requiredApprovals description")
          .lean(),
        ChatMessage.find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate("sender", "displayName avatarUrl walletAddress email")
          .populate("seenBy", "displayName avatarUrl")
          .populate({
            path: "replyTo",
            select: "content sender createdAt roleLabel messageType",
            populate: { path: "sender", select: "displayName avatarUrl walletAddress" },
          })
          .lean(),
        ChatMessage.find({ organization: orgId, isPinned: true })
          .sort({ pinnedAt: -1 })
          .limit(10)
          .populate("sender", "displayName avatarUrl walletAddress")
          .populate("pinnedBy", "displayName")
          .lean(),
      ]);

      org = dbOrg;
      pinned = dbPinned;

      const formattedMessages = dbMessages.map((m) => ({
        ...m,
        deliveredTo: (m.deliveredTo || []).map((u) =>
          typeof u === "object" && u?._id ? u : { _id: (u || "").toString() }
        ),
      }));

      messages = formattedMessages.reverse();

      // Prime Redis cache with retrieved messages
      if (redisService && messages.length > 0 && !before && !since) {
        void redisService.cacheMessageBatch(orgId, messages);
      }
    }

    let onlineUserIds = [];
    if (getOrgOnlineUsersAsync) {
      onlineUserIds = await getOrgOnlineUsersAsync(orgId);
    } else if (getOrgOnlineUsers) {
      onlineUserIds = getOrgOnlineUsers(orgId);
    }

    res.json({
      organization: org,
      messages,
      pinned,
      onlineUserIds: Array.isArray(onlineUserIds) ? onlineUserIds : [],
      hasMore: messages.length === limit,
      serverTime: new Date().toISOString(),
      fromCache: Boolean(cachedMessages && cachedMessages.length > 0),
    });
  } catch (err) {
    console.error("[chat:bootstrap]", err);
    res.status(500).json({ error: "Failed to bootstrap chat" });
  }
});

/**
 * @route   GET /api/chat/:orgId/messages
 * @desc    Fetch paginated chat messages for an organization
 * @access  Private (Org Members)
 */
router.get("/:orgId/messages", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const { before } = req.query;

    // Check Redis L1 cache first
    const redisService = req.app.get("redisService");
    if (redisService) {
      const cached = await redisService.getCachedMessages(orgId, limit, before);
      if (cached && cached.length > 0) {
        return res.json({
          messages: cached,
          hasMore: cached.length === limit,
          fromCache: true,
        });
      }
    }

    const filter = { organization: orgId };
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "displayName avatarUrl walletAddress email")
      .populate("seenBy", "displayName avatarUrl")
      .populate({
        path: "replyTo",
        select: "content sender createdAt roleLabel messageType",
        populate: { path: "sender", select: "displayName avatarUrl walletAddress" },
      })
      .lean();

    // Map deliveredTo to uniform { _id: string } format without incurring Mongoose populate queries
    const formattedMessages = messages.map((m) => ({
      ...m,
      deliveredTo: (m.deliveredTo || []).map((u) =>
        typeof u === "object" && u?._id ? u : { _id: (u || "").toString() }
      ),
    }));

    // Reverse to send chronological order (oldest -> newest for easy chat rendering)
    const chronologicalMessages = formattedMessages.reverse();

    // Prime Redis cache with retrieved messages
    if (redisService && chronologicalMessages.length > 0 && !before) {
      void redisService.cacheMessageBatch(orgId, chronologicalMessages);
    }

    res.json({
      messages: chronologicalMessages,
      hasMore: messages.length === limit,
    });
  } catch (err) {
    console.error("[chat:get-messages]", err);
    res.status(500).json({ error: "Failed to fetch chat messages" });
  }
});

/**
 * @route   GET /api/chat/:orgId/pinned
 * @desc    Fetch pinned announcements for an organization
 * @access  Private (Org Members)
 */
router.get("/:orgId/pinned", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;

    const pinnedMessages = await ChatMessage.find({ organization: orgId, isPinned: true })
      .sort({ pinnedAt: -1 })
      .limit(10)
      .populate("sender", "displayName avatarUrl walletAddress")
      .populate("pinnedBy", "displayName")
      .lean();

    res.json({ pinned: pinnedMessages });
  } catch (err) {
    console.error("[chat:get-pinned]", err);
    res.status(500).json({ error: "Failed to fetch pinned messages" });
  }
});

/**
 * @route   GET /api/chat/:orgId/search
 * @desc    Search past messages within an organization chat
 * @access  Private (Org Members)
 */
router.get("/:orgId/search", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { q, limit = 30 } = req.query;

    if (!q || !q.trim()) {
      return res.json({ results: [] });
    }

    const queryRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const messages = await ChatMessage.find({
      organization: orgId,
      content: { $regex: queryRegex },
    })
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 30, 100))
      .populate("sender", "displayName avatarUrl walletAddress email")
      .populate("seenBy", "displayName avatarUrl")
      .populate({
        path: "replyTo",
        select: "content sender createdAt roleLabel messageType",
        populate: { path: "sender", select: "displayName avatarUrl walletAddress" },
      })
      .lean();

    const formattedMessages = messages.map((m) => ({
      ...m,
      deliveredTo: (m.deliveredTo || []).map((u) =>
        typeof u === "object" && u?._id ? u : { _id: (u || "").toString() }
      ),
    }));

    res.json({ results: formattedMessages });
  } catch (err) {
    console.error("[chat:search]", err);
    res.status(500).json({ error: "Failed to search messages" });
  }
});

/**
 * @route   POST /api/chat/:orgId/messages
 * @desc    Send a new chat message in the organization room
 * @access  Private (Org Members)
 */
router.post("/:orgId/messages", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { content, messageType = "text", replyTo, clientMessageId } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    // Idempotency check: if clientMessageId already exists for this org, return existing message
    if (clientMessageId) {
      const existing = await ChatMessage.findOne({
        organization: orgId,
        clientMessageId,
      })
        .populate("sender", "displayName avatarUrl walletAddress email")
        .populate("seenBy", "displayName avatarUrl")
        .populate({
          path: "replyTo",
          select: "content sender createdAt roleLabel messageType",
          populate: { path: "sender", select: "displayName avatarUrl walletAddress" },
        })
        .lean();

      if (existing) {
        const formatted = {
          ...existing,
          deliveredTo: (existing.deliveredTo || []).map((u) =>
            typeof u === "object" && u?._id ? u : { _id: (u || "").toString() }
          ),
        };
        return res.json({ message: formatted, isDuplicate: true });
      }
    }

    const roleLevel = req.membership.roleLevel || 4;
    const roleLabel =
      req.membership.roleLabel ||
      (roleLevel === 1 ? "President" : roleLevel === 2 ? "Auditor" : roleLevel === 3 ? "Treasurer" : "Member");

    const message = new ChatMessage({
      organization: orgId,
      sender: req.user.id,
      content: content.trim(),
      messageType,
      roleLevel,
      roleLabel,
      seenBy: [req.user.id],
      replyTo: replyTo || null,
      clientMessageId: clientMessageId || null,
    });

    try {
      await message.save();
    } catch (saveErr) {
      if (saveErr.code === 11000 && clientMessageId) {
        // Race condition: concurrent retry saved first
        const racedExisting = await ChatMessage.findOne({ organization: orgId, clientMessageId })
          .populate("sender", "displayName avatarUrl walletAddress email")
          .populate("seenBy", "displayName avatarUrl")
          .lean();
        if (racedExisting) {
          return res.json({ message: racedExisting, isDuplicate: true });
        }
      }
      throw saveErr;
    }

    await message.populate("sender", "displayName avatarUrl walletAddress email");
    await message.populate("seenBy", "displayName avatarUrl");
    if (replyTo) {
      await message.populate({
        path: "replyTo",
        select: "content sender createdAt roleLabel messageType",
        populate: { path: "sender", select: "displayName avatarUrl walletAddress" },
      });
    }

    const formattedNewMessage = {
      ...message.toObject(),
      deliveredTo: (message.deliveredTo || []).map((u) =>
        typeof u === "object" && u?._id ? u : { _id: (u || "").toString() }
      ),
    };

    // 1. Cache new message in Redis L1 Sorted Set
    const redisService = req.app.get("redisService");
    if (redisService) {
      void redisService.cacheMessage(orgId, formattedNewMessage);
    }

    // 2. Emit live WebSocket event to the organization room
    const io = req.app.get("io");
    if (io) {
      io.to(`org:${orgId}`).emit("new_org_message", {
        orgId,
        message: formattedNewMessage,
      });
    }

    // 3. Presence-Gated Push Notifications: only alert offline/background members
    try {
      const org = await Organization.findById(orgId).select("name").lean();
      const orgName = org ? org.name : "Organization Chat";

      const orgUsers = await User.find({
        memberships: {
          $elemMatch: { organization: orgId, isActive: true },
        },
      }).select("_id").lean();

      // Retrieve members currently connected to the org chat room
      const getOrgOnlineUsersAsync = req.app.get("getOrgOnlineUsersAsync");
      const getOrgOnlineUsersSync = req.app.get("getOrgOnlineUsers");
      let onlineUserIds = [];
      if (getOrgOnlineUsersAsync) {
        onlineUserIds = await getOrgOnlineUsersAsync(orgId);
      } else if (getOrgOnlineUsersSync) {
        onlineUserIds = getOrgOnlineUsersSync(orgId);
      }
      const onlineSet = new Set((onlineUserIds || []).map((id) => id.toString()));

      // Exclude sender and exclude members actively online in room
      const recipientIds = orgUsers
        .map((u) => u._id.toString())
        .filter((id) => id !== req.user.id.toString() && !onlineSet.has(id));

      if (recipientIds.length > 0) {
        const NotificationService = require("../services/notificationService");
        NotificationService.notifyChatMessage({
          orgId,
          orgName,
          sender: req.user,
          content,
          recipientUserIds: recipientIds,
        });
      }
    } catch (pushErr) {
      console.warn("[chat:push-notification warning]", pushErr.message);
    }

    res.status(201).json({ message: formattedNewMessage });
  } catch (err) {
    console.error("[chat:send-message]", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * @route   POST /api/chat/:orgId/messages/:messageId/react
 * @desc    Add or toggle reaction emoji on a message
 * @access  Private (Org Members)
 */
router.post("/:orgId/messages/:messageId/react", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId, messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== "string") {
      return res.status(400).json({ error: "Valid emoji string is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(messageId) || !mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ error: "Invalid message or organization ID" });
    }

    const message = await ChatMessage.findOne({ _id: messageId, organization: orgId });
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (!Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    const currentUserId = (req.user?._id || req.user?.id || req.user?.sub || req.auth?.sub || "").toString();
    if (!currentUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userObjId = new mongoose.Types.ObjectId(currentUserId);

    let reactionGroup = message.reactions.find((r) => r.emoji === emoji);
    if (!reactionGroup) {
      message.reactions.push({ emoji, users: [userObjId] });
    } else {
      if (!Array.isArray(reactionGroup.users)) {
        reactionGroup.users = [];
      }
      const userIndex = reactionGroup.users.findIndex((u) => {
        const uid = (u && u._id ? u._id : u || "").toString();
        return uid === currentUserId;
      });
      if (userIndex > -1) {
        // Toggle OFF (remove user reaction)
        reactionGroup.users.splice(userIndex, 1);
        if (reactionGroup.users.length === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        // Toggle ON
        reactionGroup.users.push(userObjId);
      }
    }

    message.markModified("reactions");
    await message.save();
    await message.populate({ path: "reactions.users", select: "displayName avatarUrl" });

    const io = req.app.get("io");
    if (io) {
      io.to(`org:${orgId}`).emit("org_message_reacted", {
        orgId,
        messageId,
        reactions: message.reactions,
      });
    }

    res.json({ reactions: message.reactions });
  } catch (err) {
    console.error("[chat:react]", err);
    res.status(500).json({ error: err?.message || "Failed to react to message" });
  }
});

/**
 * @route   POST /api/chat/:orgId/seen
 * @desc    Mark chat messages as seen by current user (Messenger read-receipt)
 * @access  Private (Org Members)
 */
router.post("/:orgId/seen", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { messageIds } = req.body;

    const filter = {
      organization: orgId,
      sender: { $ne: req.user.id },
      seenBy: { $ne: req.user.id },
    };

    if (Array.isArray(messageIds) && messageIds.length > 0) {
      filter._id = { $in: messageIds };
    }

    await ChatMessage.updateMany(filter, {
      $addToSet: { seenBy: req.user.id },
    });

    const io = req.app.get("io");
    if (io) {
      io.to(`org:${orgId}`).emit("org_messages_seen", {
        orgId,
        userId: req.user.id,
        user: {
          _id: req.user.id,
          displayName: req.fullUser?.displayName || req.user.displayName || "Member",
          avatarUrl: req.fullUser?.avatarUrl || null,
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[chat:seen]", err);
    res.status(500).json({ error: "Failed to mark seen" });
  }
});

/**
 * @route   POST /api/chat/:orgId/messages/:messageId/delivered
 * @desc    Mark a single message as delivered to the current user's device.
 *          Called automatically by the client when it receives a new_org_message
 *          socket event from another sender. Powers the grey double-tick state.
 * @access  Private (Org Members)
 */
router.post("/:orgId/messages/:messageId/delivered", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId, messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: "Invalid message ID" });
    }

    const currentUserId = (req.user?._id || req.user?.id || req.user?.sub || req.auth?.sub || "").toString();
    if (!currentUserId) return res.status(401).json({ error: "Authentication required" });

    // Only mark delivery for messages not sent by this user
    const message = await ChatMessage.findOne({ _id: messageId, organization: orgId });
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Skip if sender is marking their own message (no-op)
    if (message.sender.toString() === currentUserId) {
      return res.json({ success: true, skipped: true });
    }

    // Idempotent: only add if not already in deliveredTo
    const alreadyDelivered = message.deliveredTo?.some(
      (uid) => uid.toString() === currentUserId
    );

    if (!alreadyDelivered) {
      await ChatMessage.updateOne(
        { _id: messageId },
        { $addToSet: { deliveredTo: currentUserId } }
      );

      const io = req.app.get("io");
      if (io) {
        io.to(`org:${orgId}`).emit("org_message_delivered", {
          orgId,
          messageId,
          user: {
            _id: currentUserId,
            displayName: req.fullUser?.displayName || req.user.displayName || "Member",
            avatarUrl: req.fullUser?.avatarUrl || null,
          },
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[chat:delivered]", err);
    res.status(500).json({ error: "Failed to mark delivered" });
  }
});

/**
 * @route   POST /api/chat/:orgId/messages/:messageId/pin
 * @desc    Pin or unpin a message (Admins/Auditors only)
 * @access  Private (Level 1 or 2)
 */
router.post("/:orgId/messages/:messageId/pin", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId, messageId } = req.params;
    const roleLevel = req.membership.roleLevel || 4;

    // Level 1, 2, and 3 members can pin messages (Viewers Level 4 cannot)
    if (roleLevel > 3) {
      return res.status(403).json({ error: "Only active Organization members can pin messages" });
    }

    const message = await ChatMessage.findOne({ _id: messageId, organization: orgId });
    if (!message) return res.status(404).json({ error: "Message not found" });

    message.isPinned = !message.isPinned;
    message.pinnedBy = message.isPinned ? req.user.id : null;
    message.pinnedAt = message.isPinned ? new Date() : null;

    await message.save();
    await message.populate("sender", "displayName avatarUrl walletAddress");
    if (message.pinnedBy) {
      await message.populate("pinnedBy", "displayName");
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`org:${orgId}`).emit("org_message_pinned", {
        orgId,
        message: message.toObject(),
      });
    }

    res.json({ message });
  } catch (err) {
    console.error("[chat:pin-message]", err);
    res.status(500).json({ error: "Failed to update pinned state" });
  }
});

/**
 * @route   DELETE /api/chat/:orgId/messages/:messageId
 * @desc    Delete a message (Sender or Level 1 Admin)
 * @access  Private
 */
router.delete("/:orgId/messages/:messageId", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId, messageId } = req.params;
    const roleLevel = req.membership.roleLevel || 4;

    const message = await ChatMessage.findOne({ _id: messageId, organization: orgId });
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Allowed if user is the sender OR an Admin (Level 1)
    if (message.sender.toString() !== req.user.id && roleLevel > 1) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }

    await ChatMessage.deleteOne({ _id: messageId });

    const io = req.app.get("io");
    if (io) {
      io.to(`org:${orgId}`).emit("org_message_deleted", {
        orgId,
        messageId,
      });
    }

    res.json({ success: true, messageId });
  } catch (err) {
    console.error("[chat:delete-message]", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

/**
 * @route   GET /api/chat/:orgId/online
 * @desc    Fetch list of currently online user IDs in an organization
 * @access  Private (Org Members)
 */
router.get("/:orgId/online", authenticate, requireOrgMembership, (req, res) => {
  try {
    const { orgId } = req.params;
    const getOrgOnlineUsers = req.app.get("getOrgOnlineUsers");
    const onlineUserIds = getOrgOnlineUsers ? getOrgOnlineUsers(orgId) : [];
    res.json({ orgId, onlineUserIds });
  } catch (err) {
    console.error("[chat:get-online]", err);
    res.status(500).json({ error: "Failed to fetch online users" });
  }
});

module.exports = router;
