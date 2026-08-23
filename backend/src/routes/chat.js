const express = require("express");
const router = express.Router();
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

    const user = await User.findById(req.user.id).select("memberships displayName avatarUrl").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const membership = user.memberships?.find(
      (m) => m.organization.toString() === orgId && m.isActive !== false
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
 * @route   GET /api/chat/:orgId/messages
 * @desc    Fetch paginated chat messages for an organization
 * @access  Private (Org Members)
 */
router.get("/:orgId/messages", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const { before } = req.query;

    const filter = { organization: orgId };
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("sender", "displayName avatarUrl walletAddress email")
      .populate("seenBy", "displayName avatarUrl")
      .populate("reactions.users", "displayName avatarUrl")
      .populate("replyTo", "content sender createdAt roleLabel")
      .lean();

    // Reverse to send chronological order (oldest -> newest for easy chat rendering)
    const chronologicalMessages = messages.reverse();

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
      .populate("reactions.users", "displayName avatarUrl")
      .populate("replyTo", "content sender createdAt roleLabel")
      .lean();

    res.json({ results: messages });
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
    const { content, messageType = "text", replyTo } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
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
    });

    await message.save();
    await message.populate("sender", "displayName avatarUrl walletAddress email");
    await message.populate("seenBy", "displayName avatarUrl");
    if (replyTo) {
      await message.populate("replyTo", "content sender createdAt roleLabel");
    }

    // 1. Emit live WebSocket event to the organization room
    const io = req.app.get("io");
    if (io) {
      io.to(`org:${orgId}`).emit("new_org_message", {
        orgId,
        message: message.toObject(),
      });
    }

    // 2. Dispatch push notifications to other active members of the organization (fire-and-forget)
    try {
      const org = await Organization.findById(orgId).select("name").lean();
      const orgName = org ? org.name : "Organization Chat";

      const orgUsers = await User.find({
        memberships: {
          $elemMatch: { organization: orgId, isActive: true },
        },
      }).select("_id").lean();

      const recipientIds = orgUsers
        .map((u) => u._id.toString())
        .filter((id) => id !== req.user.id.toString());

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

    res.status(201).json({ message });
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

    const message = await ChatMessage.findOne({ _id: messageId, organization: orgId });
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (!Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    const currentUserId = (req.user.id || req.user._id || "").toString();

    let reactionGroup = message.reactions.find((r) => r.emoji === emoji);
    if (!reactionGroup) {
      message.reactions.push({ emoji, users: [currentUserId] });
    } else {
      if (!Array.isArray(reactionGroup.users)) {
        reactionGroup.users = [];
      }
      const userIndex = reactionGroup.users.findIndex((u) => u.toString() === currentUserId);
      if (userIndex > -1) {
        // Toggle OFF (remove user reaction)
        reactionGroup.users.splice(userIndex, 1);
        if (reactionGroup.users.length === 0) {
          message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
        }
      } else {
        // Toggle ON
        reactionGroup.users.push(currentUserId);
      }
    }

    message.markModified("reactions");
    await message.save();
    await message.populate("reactions.users", "displayName avatarUrl");

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
    res.status(500).json({ error: "Failed to react to message" });
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
 * @route   POST /api/chat/:orgId/messages/:messageId/pin
 * @desc    Pin or unpin a message (Admins/Auditors only)
 * @access  Private (Level 1 or 2)
 */
router.post("/:orgId/messages/:messageId/pin", authenticate, requireOrgMembership, async (req, res) => {
  try {
    const { orgId, messageId } = req.params;
    const roleLevel = req.membership.roleLevel || 4;

    // Only Level 1 & 2 can pin messages
    if (roleLevel > 2) {
      return res.status(403).json({ error: "Only Organization Executives/Auditors can pin messages" });
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

module.exports = router;
