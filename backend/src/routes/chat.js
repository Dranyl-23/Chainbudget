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

    const user = await User.findById(req.user.id).select("memberships displayName").lean();
    if (!user) return res.status(404).json({ error: "User not found" });

    const membership = user.memberships?.find(
      (m) => m.organization.toString() === orgId && m.isActive !== false
    );

    if (!membership) {
      return res.status(403).json({ error: "Access denied. You are not an active member of this organization." });
    }

    req.membership = membership;
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
      replyTo: replyTo || null,
    });

    await message.save();
    await message.populate("sender", "displayName avatarUrl walletAddress email");
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
        const senderName = req.user.displayName || "A member";
        const preview = content.length > 80 ? `${content.substring(0, 77)}...` : content;

        sendPushNotifications(
          recipientIds,
          `${orgName}`,
          `${senderName}: ${preview}`,
          { orgId, screen: "OrgChat", channelId: "chainbudget-default" }
        );
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
