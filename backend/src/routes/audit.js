const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { authenticate, requireRole } = require("../middleware/auth");

/// GET /api/audit?orgId=xxx — Paginated audit trail (Level 1+)
router.get("/", authenticate, requireRole(1), async (req, res) => {
  try {
    const { orgId, page = 1, limit = 50 } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const logs = await AuditLog.find({ organization: orgId })
      .populate("actor", "walletAddress displayName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AuditLog.countDocuments({ organization: orgId });
    res.json({ logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
