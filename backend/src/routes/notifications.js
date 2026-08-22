const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");

// Get all notifications for an org or across all user's orgs (limit to latest 50)
router.get("/", authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    let filter = {};

    if (orgId && orgId !== "all") {
      filter.organization = orgId;
    } else {
      const user = await User.findById(req.user.id).select("memberships").lean();
      const activeOrgIds = (user?.memberships || [])
        .filter((m) => m.isActive !== false)
        .map((m) => m.organization);

      filter.organization = { $in: activeOrgIds };
    }

    const notifications = await Notification.find(filter)
      .populate("organization", "name logo")
      .sort({ createdAt: -1 })
      .limit(50);

    // Format for frontend (checking if the calling user has read it)
    const formatted = notifications.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      timestamp: n.createdAt,
      isRead: n.readBy && n.readBy.some((uid) => uid.toString() === req.user.id.toString()),
      orgId: n.organization?._id?.toString() || (n.organization ? n.organization.toString() : null),
      orgName: n.organization?.name || "Organization",
    }));

    res.json({ notifications: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark single notification as read
router.post("/:id/read", authenticate, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ error: "Not found" });

    const alreadyRead = notif.readBy.some((uid) => uid.toString() === req.user.id.toString());
    if (!alreadyRead) {
      notif.readBy.push(req.user.id);
      await notif.save();
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Mark all as read for an org or across user's orgs
router.post("/read-all", authenticate, async (req, res) => {
  try {
    const { orgId } = req.body;
    let filter = {};

    if (orgId && orgId !== "all") {
      filter.organization = orgId;
    } else {
      const user = await User.findById(req.user.id).select("memberships").lean();
      const activeOrgIds = (user?.memberships || [])
        .filter((m) => m.isActive !== false)
        .map((m) => m.organization);

      filter.organization = { $in: activeOrgIds };
    }

    // Update all notifications where readBy doesn't include the user
    await Notification.updateMany(
      { ...filter, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

module.exports = router;
