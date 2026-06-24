const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { authenticate, requireRole, requireSuperAdmin } = require("../middleware/auth");

/// GET /api/users/me — Current user profile
router.get("/me", authenticate, async (req, res) => {
  res.json(req.user);
});

/// GET /api/users/:orgId/members — List members of an org (Level 1+)
router.get("/:orgId/members", authenticate, requireRole(4), async (req, res) => {
  try {
    const users = await User.find({
      "memberships.organization": req.params.orgId,
      "memberships.isActive": true,
    }).select("-nonce");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/users/:orgId/invite — Invite/add a member (Level 1 only)
router.post("/:orgId/invite", authenticate, requireRole(1), async (req, res) => {
  try {
    const { walletAddress, roleLevel, roleLabel } = req.body;
    if (!walletAddress || !roleLevel) {
      return res.status(400).json({ error: "walletAddress and roleLevel required" });
    }

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      user = new User({ walletAddress: walletAddress.toLowerCase() });
    }

    // Check for existing membership
    const existing = user.memberships.find(
      (m) => m.organization.toString() === req.params.orgId
    );

    if (existing) {
      existing.roleLevel = roleLevel;
      existing.roleLabel = roleLabel;
      existing.isActive = true;
    } else {
      user.memberships.push({
        organization: req.params.orgId,
        roleLevel,
        roleLabel,
      });
    }

    await user.save();
    res.status(201).json({ message: "Member added/updated", user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/// DELETE /api/users/:orgId/members/:userId — Remove member (Level 1 only)
router.delete(
  "/:orgId/members/:userId",
  authenticate,
  requireRole(1),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const membership = user.memberships.find(
        (m) => m.organization.toString() === req.params.orgId
      );
      if (membership) membership.isActive = false;
      await user.save();

      res.json({ message: "Member removed" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
