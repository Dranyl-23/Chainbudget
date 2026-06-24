const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const { authenticate, requireRole } = require("../middleware/auth");

/// POST /api/organizations — Create organization (any authenticated user)
router.post("/", authenticate, async (req, res) => {
  try {
    const org = new Organization({ ...req.body, createdBy: req.user._id });
    await org.save();

    // Add creator to organization as Level 1
    req.user.memberships.push({
      organization: org._id,
      roleLevel: 1,
      roleLabel: "Founder",
    });
    await req.user.save();

    res.status(201).json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/// GET /api/organizations — List organizations the user belongs to
router.get("/", authenticate, async (req, res) => {
  try {
    const orgIds = req.user.memberships
      .filter((m) => m.isActive)
      .map((m) => m.organization);

    const orgs = await Organization.find({ _id: { $in: orgIds }, isActive: true });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/organizations/:orgId — Get single organization details
router.get("/:orgId", authenticate, requireRole(4), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// PATCH /api/organizations/:orgId — Update (Level 1 only)
router.patch("/:orgId", authenticate, requireRole(1), async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params.orgId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
