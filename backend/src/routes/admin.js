const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const Organization = require("../models/Organization");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const OrgApplication = require("../models/OrgApplication");
const OrgDocument = require("../models/OrgDocument");
const { authenticate, requireSuperAdmin } = require("../middleware/auth");
const { decryptBuffer } = require("../utils/documentVault");
const { mintSBT } = require("../utils/sbtMinter");
const { sendEmail, escapeHtml } = require("../services/email");
const NotificationService = require("../services/notificationService");
const requirements = require("../config/orgVerificationRequirements");
const orgApplicationService = require("../services/orgApplicationService");

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
      pendingOrgApplications,
    ] = await Promise.all([
      Organization.countDocuments({}),
      Organization.countDocuments({ isActive: true }),
      User.countDocuments({}),
      Transaction.countDocuments({}),
      Transaction.countDocuments({ status: "pending_approval" }),
      AuditLog.countDocuments({}),
      OrgApplication.countDocuments({
        status: { $in: ["submitted", "under_review"] },
      }),
    ]);

    res.json({
      totalOrgs,
      activeOrgs,
      suspendedOrgs: totalOrgs - activeOrgs,
      totalUsers,
      totalTransactions,
      pendingTransactions,
      totalAuditLogs,
      pendingOrgApplications,
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
    if (search) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = { $regex: escapedSearch, $options: "i" };
    }

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

    // High-performance batch aggregation: replaces 3N queries with 2 single batch queries
    const orgIds = orgs.map((o) => o._id);

    const [memberCounts, txStats] = await Promise.all([
      User.aggregate([
        { $unwind: "$memberships" },
        {
          $match: {
            "memberships.organization": { $in: orgIds },
            "memberships.isActive": true,
          },
        },
        {
          $group: {
            _id: "$memberships.organization",
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            organization: { $in: orgIds },
          },
        },
        {
          $group: {
            _id: "$organization",
            txCount: { $sum: 1 },
            pendingCount: {
              $sum: { $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const memberMap = new Map(memberCounts.map((m) => [m._id.toString(), m.count]));
    const txMap = new Map(txStats.map((t) => [t._id.toString(), t]));

    const enriched = orgs.map((org) => {
      const orgIdStr = org._id.toString();
      const stats = txMap.get(orgIdStr) || { txCount: 0, pendingCount: 0 };
      return {
        ...org,
        memberCount: memberMap.get(orgIdStr) || 0,
        txCount: stats.txCount,
        pendingCount: stats.pendingCount,
      };
    });

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
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { walletAddress: { $regex: escapedSearch, $options: "i" } },
        { displayName: { $regex: escapedSearch, $options: "i" } },
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

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/org-applications — Verification review queue (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/org-applications", async (req, res) => {
  try {
    const { status = "queue", search = "", page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status === "queue") {
      filter.status = { $in: ["submitted", "under_review"] };
    } else if (status && status !== "all") {
      filter.status = String(status);
    } else {
      // Exclude unsubmitted drafts from the admin queue unless explicitly requested
      filter.status = { $ne: "draft" };
    }

    if (search && String(search).trim()) {
      const escaped = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { "basics.displayName": { $regex: escaped, $options: "i" } },
        { "basics.legalName": { $regex: escaped, $options: "i" } },
        { "basics.registrationNumber": { $regex: escaped, $options: "i" } },
        { "contact.email": { $regex: escaped, $options: "i" } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [apps, total] = await Promise.all([
      OrgApplication.find(filter)
        .sort({ submittedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("applicant", "displayName walletAddress email")
        .lean(),
      OrgApplication.countDocuments(filter),
    ]);

    const items = apps.map((a) =>
      orgApplicationService.toAdminView(a, a.applicant)
    );

    res.json({
      applications: items,
      total,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/org-applications/:id — Inspect single application
// ─────────────────────────────────────────────────────────────────────────────
router.get("/org-applications/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Application not found" });
    }

    const app = await OrgApplication.findById(req.params.id).populate(
      "applicant",
      "displayName walletAddress email"
    );
    if (!app) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Opening a submitted application transitions it to under_review
    if (app.status === "submitted") {
      app.status = "under_review";
      app.history.push({
        at: new Date(),
        actor: req.user._id,
        action: "under_review",
      });
      await app.save();
    }

    await AuditLog.create({
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "admin.org_application_viewed",
      targetType: "OrgApplication",
      targetId: app._id,
      details: {
        status: app.status,
        displayName: app.basics && app.basics.displayName,
      },
      ipAddress: req.ip,
    });

    res.json(orgApplicationService.toAdminView(app, app.applicant));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/admin/org-applications/:id/documents/:docId/file — Stream decrypted evidence
// ─────────────────────────────────────────────────────────────────────────────
router.get("/org-applications/:id/documents/:docId/file", async (req, res) => {
  try {
    const { id, docId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(docId)) {
      return res.status(404).json({ error: "Document not found" });
    }

    const app = await OrgApplication.findById(id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    const ref = (app.documents || []).find(
      (d) => String(d._id) === String(docId)
    );
    if (!ref) return res.status(404).json({ error: "Document not found" });

    const doc = await OrgDocument.findOne({
      _id: ref.document,
      application: app._id,
    }).select("+data");
    if (!doc || !doc.data) {
      return res.status(404).json({ error: "Encrypted document blob not found" });
    }

    const plainBuffer = decryptBuffer(
      { iv: doc.iv, authTag: doc.authTag, data: doc.data },
      String(app._id)
    );

    await AuditLog.create({
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "admin.org_document_viewed",
      targetType: "OrgApplication",
      targetId: app._id,
      details: {
        documentRefId: String(ref._id),
        kind: ref.kind,
        sha256: ref.sha256,
      },
      ipAddress: req.ip,
    });

    const safeName = String(ref.originalName || `${ref.kind}`).replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );
    res.set("Content-Type", doc.mime);
    res.set("Content-Length", String(plainBuffer.length));
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.set("Content-Disposition", `inline; filename="${safeName}"`);
    return res.send(plainBuffer);
  } catch (err) {
    console.error("[admin] document decrypt error:", err.message);
    return res.status(500).json({ error: "Failed to decrypt document" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/admin/org-applications/:id/review — Approve, reject, or request info
// ─────────────────────────────────────────────────────────────────────────────
router.post("/org-applications/:id/review", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Application not found" });
    }

    const app = await OrgApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    const validation = orgApplicationService.validateReviewDecision(
      app,
      req.body || {}
    );
    if (!validation.ok) {
      return res
        .status(validation.statusCode || 400)
        .json({ error: validation.error });
    }

    const { targetStatus, review, documentVerdicts } = validation;
    const now = new Date();
    const applicantId = app.applicant?._id || app.applicant;

    // Update per-document verdicts if supplied
    if (documentVerdicts && Array.isArray(app.documents)) {
      for (const d of app.documents) {
        const verdict = documentVerdicts[String(d._id)];
        if (verdict) {
          d.status = verdict.status;
          d.reviewerNote = verdict.reviewerNote;
        } else if (review.decision === "approve") {
          d.status = "accepted";
        }
      }
    }

    app.review = {
      reviewer: req.user._id,
      reviewedAt: now,
      decision: review.decision,
      applicantMessage: review.applicantMessage,
      internalNotes: review.internalNotes,
      checklist: review.checklist,
    };
    app.status = targetStatus;
    app.history.push({
      at: now,
      actor: req.user._id,
      action: targetStatus,
      note: review.applicantMessage || undefined,
    });

    let createdOrg = null;

    if (review.decision === "approve") {
      const type = app.basics && app.basics.type;
      const profile = requirements.TYPE_PROFILES[type] || { tier: "standard" };

      createdOrg = new Organization({
        name: app.basics.displayName,
        legalName: app.basics.legalName,
        registrationNumber: app.basics.registrationNumber || "",
        yearEstablished: app.basics.yearEstablished,
        type,
        description: app.basics.mission || "",
        intendedUse: app.basics.intendedUse || "",
        logoUrl: app.basics.logoUrl || "",
        address: app.address || {},
        highValueThreshold:
          (app.governance && app.governance.highValueThreshold) || 10000,
        requiredApprovals:
          (app.governance && app.governance.requiredApprovals) || 2,
        isPrivate: Boolean(app.governance && app.governance.isPrivate),
        createdBy: applicantId,
        verification: {
          status: "verified",
          tier: profile.tier,
          verifiedAt: now,
          verifiedBy: req.user._id,
          applicationId: app._id,
          dossierHash: app.dossierHash,
        },
      });
      await createdOrg.save();

      app.organization = createdOrg._id;
      app.anchor = {
        status: "pending",
        attempts: 0,
      };

      // Assign Founder membership to the applicant
      const founder = await User.findById(applicantId);
      if (founder) {
        const alreadyMember = (founder.memberships || []).some(
          (m) => String(m.organization) === String(createdOrg._id)
        );
        if (!alreadyMember) {
          founder.memberships.push({
            organization: createdOrg._id,
            roleLevel: 1,
            roleLabel:
              (app.representative && app.representative.position) || "Founder",
            isActive: true,
          });
          await founder.save();
        }

        // Non-blocking Founder SBT minting
        if (founder.walletAddress) {
          setImmediate(async () => {
            try {
              const tokenId = await mintSBT(
                founder.walletAddress,
                createdOrg._id.toString()
              );
              if (tokenId) {
                await User.updateOne(
                  {
                    _id: founder._id,
                    "memberships.organization": createdOrg._id,
                  },
                  {
                    $set: {
                      "memberships.$.hasSBT": true,
                      "memberships.$.sbtTokenId": tokenId,
                    },
                  }
                );
              }
            } catch (sbtErr) {
              console.warn("[admin:approve] Founder SBT mint failed:", sbtErr.message);
            }
          });
        }
      }

      // Seed default template budget categories
      const templateBudgets = [
        { name: "Events & Activities", allocated: 0, color: "#6B55D9" },
        { name: "Operations & Supplies", allocated: 0, color: "#10B981" },
        { name: "Marketing", allocated: 0, color: "#F59E0B" },
        { name: "Emergency Fund", allocated: 0, color: "#E05C5C" },
      ];
      for (const b of templateBudgets) {
        const budget = new Budget({
          organization: createdOrg._id,
          name: b.name,
          allocated: b.allocated,
          color: b.color,
        });
        await budget.save();
      }

      // Auto-attach or invite listed initial co-officers
      const officers = (app.governance && app.governance.officers) || [];
      for (const officer of officers) {
        if (!officer || !officer.email) continue;
        try {
          const existingOfficer = await User.findOne({
            email: officer.email.toLowerCase(),
          });
          if (existingOfficer) {
            const hasOrg = (existingOfficer.memberships || []).some(
              (m) => String(m.organization) === String(createdOrg._id)
            );
            if (!hasOrg) {
              existingOfficer.memberships.push({
                organization: createdOrg._id,
                roleLevel: officer.roleLevel || 2,
                roleLabel: officer.roleLabel || "Officer",
                isActive: true,
              });
              await existingOfficer.save();
            }
          }
          await sendEmail(
            officer.email,
            `ChainBudget — You have been added to ${createdOrg.name}`,
            `<p>Hello ${escapeHtml(officer.name || "Officer")},</p>
             <p><b>${escapeHtml(createdOrg.name)}</b> has been verified on ChainBudget, and you were listed as an initial officer (${escapeHtml(
               officer.roleLabel || `Level ${officer.roleLevel || 2}`
             )}).</p>`
          );
        } catch (officerErr) {
          console.warn("[admin:approve] officer invite warning:", officerErr.message);
        }
      }

      // Trigger asynchronous on-chain attestation if the Phase 4 service is present
      try {
        const { triggerAsyncOrgAttestation } = require("../services/orgAttestation");
        if (typeof triggerAsyncOrgAttestation === "function") {
          triggerAsyncOrgAttestation(app, createdOrg, req.app.get("io"));
        }
      } catch {
        // Phase 4 service not yet loaded or configured; anchor remains pending
      }
    }

    await app.save();

    await AuditLog.create({
      organization: createdOrg ? createdOrg._id : app.organization || undefined,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: `admin.org_application_${targetStatus}`,
      targetType: "OrgApplication",
      targetId: app._id,
      details: {
        decision: review.decision,
        displayName: app.basics && app.basics.displayName,
        organizationId: createdOrg ? String(createdOrg._id) : null,
      },
      ipAddress: req.ip,
    });

    const io = req.app && typeof req.app.get === "function" ? req.app.get("io") : null;
    NotificationService.notifyOrgApplicationDecision({
      application: app,
      organization: createdOrg,
      decision: review.decision,
      applicantMessage: review.applicantMessage,
      io,
    });

    const applicantUser = await User.findById(applicantId)
      .select("displayName walletAddress email")
      .lean();

    return res.json(orgApplicationService.toAdminView(app, applicantUser));
  } catch (err) {
    console.error("[admin] review error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/admin/organizations/:orgId/revoke-verification — Revoke verified org
// ─────────────────────────────────────────────────────────────────────────────
router.post("/organizations/:orgId/revoke-verification", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orgId)) {
      return res.status(404).json({ error: "Organization not found" });
    }
    const reason = String((req.body && req.body.reason) || "").trim();
    if (reason.length < 5) {
      return res
        .status(422)
        .json({ error: "A revocation reason of at least 5 characters is required" });
    }

    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const now = new Date();
    org.verification = {
      ...(org.verification ? org.verification.toObject?.() || org.verification : {}),
      status: "revoked",
      revokedAt: now,
      revocationReason: reason.slice(0, 500),
    };
    await org.save();

    if (org.verification.applicationId) {
      const app = await OrgApplication.findById(org.verification.applicationId);
      if (app && orgApplicationService.canTransition(app.status, "revoked")) {
        app.status = "revoked";
        app.history.push({
          at: now,
          actor: req.user._id,
          action: "revoked",
          note: reason,
        });
        await app.save();
      }
    }

    try {
      const { triggerAsyncOrgRevocation } = require("../services/orgAttestation");
      if (typeof triggerAsyncOrgRevocation === "function") {
        triggerAsyncOrgRevocation(org, reason, req.app.get("io"));
      }
    } catch {}

    await AuditLog.create({
      organization: org._id,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "admin.org_verification_revoked",
      targetType: "Organization",
      targetId: org._id,
      details: { orgName: org.name, reason },
      ipAddress: req.ip,
    });

    return res.json({ organization: org });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
