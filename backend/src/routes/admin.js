const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Organization = require("../models/Organization");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const { authenticate, requireSuperAdmin } = require("../middleware/auth");

/// All admin routes require authentication + super admin status
router.use(authenticate, requireSuperAdmin);

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/stats — Platform-wide overview numbers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [
      totalOrgs,
      activeOrgs,
      totalUsers,
      totalTransactions,
      pendingTransactions,
      totalAuditLogs,
    ] = await Promise.all([
      Organization.countDocuments({}),
      Organization.countDocuments({ isActive: true }),
      User.countDocuments({}),
      Transaction.countDocuments({}),
      Transaction.countDocuments({ status: "pending_approval" }),
      AuditLog.countDocuments({}),
    ]);

    res.json({
      totalOrgs,
      activeOrgs,
      suspendedOrgs: totalOrgs - activeOrgs,
      totalUsers,
      totalTransactions,
      pendingTransactions,
      totalAuditLogs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/organizations — All organizations with member + tx counts
// ─────────────────────────────────────────────────────────────────────────────
router.get("/organizations", async (req, res) => {
  try {
    const { search = "", status = "all", page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status === "active") filter.isActive = true;
    if (status === "suspended") filter.isActive = false;
    if (search) filter.name = { $regex: search, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);

    const [orgs, total] = await Promise.all([
      Organization.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "walletAddress displayName")
        .lean(),
      Organization.countDocuments(filter),
    ]);

    // Enrich each org with member + transaction counts
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        const [memberCount, txCount, pendingCount] = await Promise.all([
          User.countDocuments({
            "memberships.organization": org._id,
            "memberships.isActive": true,
          }),
          Transaction.countDocuments({ organization: org._id }),
          Transaction.countDocuments({
            organization: org._id,
            status: "pending_approval",
          }),
        ]);
        return { ...org, memberCount, txCount, pendingCount };
      })
    );

    res.json({ organizations: enriched, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// PATCH /api/admin/organizations/:orgId/suspend — Toggle active/suspended
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/organizations/:orgId/suspend", async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    org.isActive = !org.isActive;
    await org.save();

    await AuditLog.create({
      organization: org._id,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: org.isActive ? "admin.org_activated" : "admin.org_suspended",
      targetType: "Organization",
      targetId: org._id,
      details: { orgName: org.name, newStatus: org.isActive ? "active" : "suspended" },
    });

    res.json({ organization: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/users — All platform users with org membership summary
// ─────────────────────────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { walletAddress: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-nonce")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("memberships.organization", "name type isActive")
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/activity — Recent platform-wide audit logs (last 50)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/activity", async (req, res) => {
  try {
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("actor", "walletAddress displayName")
      .populate("organization", "name")
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
