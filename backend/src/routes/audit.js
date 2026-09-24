const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { authenticate, requireRole } = require("../middleware/auth");

/// GET /api/audit?orgId=xxx — Paginated audit trail with action & date filtering (Level 1 and 2)
router.get("/", authenticate, requireRole(2), async (req, res) => {
  try {
    const { orgId, page = 1, limit = 50, action, range } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const query = { organization: orgId };

    if (action && action !== "all") {
      query.action = { $regex: action, $options: "i" };
    }

    if (range && range !== "all") {
      const now = new Date();
      let since = new Date();
      if (range === "24h" || range === "today") since.setDate(now.getDate() - 1);
      else if (range === "7d") since.setDate(now.getDate() - 7);
      else if (range === "30d" || range === "1month") since.setDate(now.getDate() - 30);
      else if (range === "90d" || range === "3months") since.setDate(now.getDate() - 90);
      else if (range === "1year") since.setFullYear(now.getFullYear() - 1);
      query.createdAt = { $gte: since };
    }

    const logs = await AuditLog.find(query)
      .populate("actor", "walletAddress displayName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(query);
    res.json({ logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
