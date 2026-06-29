const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { verifyToken } = require("../middleware/auth");

// Get all notifications for an org (limit to latest 50)
router.get("/", verifyToken, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "Missing orgId" });

    const notifications = await Notification.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .limit(50);

    // Format for frontend (checking if the calling user has read it)
    const formatted = notifications.map(n => ({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      timestamp: n.createdAt,
      isRead: n.readBy.includes(req.user.id)
    }));

    res.json({ notifications: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark single notification as read
router.post("/:id/read", verifyToken, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ error: "Not found" });

    if (!notif.readBy.includes(req.user.id)) {
      notif.readBy.push(req.user.id);
      await notif.save();
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Mark all as read for an org
router.post("/read-all", verifyToken, async (req, res) => {
  try {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: "Missing orgId" });

    // Update all notifications in this org where readBy doesn't include the user
    await Notification.updateMany(
      { organization: orgId, readBy: { $ne: req.user.id } },
      { $addToSet: { readBy: req.user.id } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

module.exports = router;
