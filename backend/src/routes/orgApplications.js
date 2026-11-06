const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const OrgApplication = require("../models/OrgApplication");
const OrgDocument = require("../models/OrgDocument");
const AuditLog = require("../models/AuditLog");
const { authenticate } = require("../middleware/auth");
const { requireIdempotency } = require("../middleware/idempotency");
const { sendEmail, escapeHtml } = require("../services/email");
const { encryptBuffer, sha256Hex, sniffMime } = require("../utils/documentVault");
const { uploadToPinata } = require("../utils/pinata");
const requirements = require("../config/orgVerificationRequirements");
const service = require("../services/orgApplicationService");

const router = express.Router();

const MAX_OPEN_APPLICATIONS_PER_USER = 3;
const OTP_SELECT =
  "+contact.otpHash +contact.otpExpiresAt +contact.otpAttempts +contact.otpSentAt +contact.otpSentCount +contact.otpWindowStart";

// ── Rate limits (per authenticated user) ─────────────────────────────────────
const perUser = (req) => req.user?._id?.toString() || req.ip;
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: perUser,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: perUser,
  message: { error: "Too many uploads. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Upload handling: memory only, 5 MB, images + PDF ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    // Message starts with "Only" so the global error handler maps it to HTTP 400
    return cb(new Error("Only JPEG, PNG, WebP images and PDFs are allowed"), false);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function audit(req, action, application, details) {
  // Fire and forget: auditing must never break the request
  Promise.resolve(
    AuditLog.create({
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action,
      targetType: "OrgApplication",
      targetId: application._id,
      details,
      ipAddress: req.ip,
    })
  ).catch((err) => console.warn("[orgApplications] audit failed:", err.message));
}

function pushHistory(app, req, action, note) {
  app.history.push({ at: new Date(), actor: req.user._id, action, note });
}

/** Loads an application owned by the caller. Others get 404 (no existence leak). */
async function loadOwned(req, res, { select } = {}) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ error: "Application not found" });
    return null;
  }
  let query = OrgApplication.findOne({ _id: id, applicant: req.user._id });
  if (select) query = query.select(select);
  const app = await query;
  if (!app) {
    res.status(404).json({ error: "Application not found" });
    return null;
  }
  return app;
}

function rejectIfLocked(app, res) {
  if (!service.isEditable(app.status)) {
    res.status(409).json({
      error: `This application is ${app.status.replace("_", " ")} and can no longer be edited`,
      status: app.status,
    });
    return true;
  }
  return false;
}

function maskEmail(email) {
  const [user, domain] = String(email).split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function safeFileName(name) {
  const base = path.basename(String(name || "document")).replace(/[^\w.\- ]/g, "_");
  return base.slice(0, 100) || "document";
}

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/org-applications/requirements[?type=ngo]
/// Server-driven steps, fields and document checklist (shared by web + mobile).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/requirements", authenticate, (req, res) => {
  const { type } = req.query;
  if (type === undefined) {
    return res.json({
      version: requirements.REQUIREMENTS_VERSION,
      steps: requirements.STEPS,
      types: requirements.listTypes(),
    });
  }
  if (!requirements.isValidType(type)) {
    return res.status(400).json({ error: "Unknown organization type" });
  }
  return res.json(requirements.getRequirements(type));
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/org-applications/mine — The caller's applications (newest first)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/mine", authenticate, async (req, res) => {
  try {
    const apps = await OrgApplication.find({ applicant: req.user._id }).sort({ updatedAt: -1 }).limit(20);
    res.json(
      apps.map((a) => {
        const v = service.toApplicantView(a);
        return {
          id: v.id,
          type: v.type,
          displayName: v.basics.displayName || "",
          status: v.status,
          currentStep: v.currentStep,
          completedSteps: v.completedSteps,
          revision: v.revision,
          applicantMessage: v.review.applicantMessage,
          organization: v.organization,
          submittedAt: v.submittedAt,
          updatedAt: v.updatedAt,
        };
      })
    );
  } catch (err) {
    console.error("[orgApplications] list error:", err);
    res.status(500).json({ error: "Failed to load applications" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/org-applications — Create a draft ("step 0": choose the org type)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", authenticate, writeLimiter, requireIdempotency, async (req, res) => {
  try {
    const type = (req.body?.type || req.body?.orgType)?.trim?.() || (req.body?.type || req.body?.orgType);
    if (!requirements.isValidType(type)) {
      return res.status(400).json({ error: "A valid organization type is required" });
    }
    if (!req.user.walletAddress) {
      return res.status(400).json({ error: "You must link a wallet before registering an organization." });
    }

    const open = await OrgApplication.find({
      applicant: req.user._id,
      status: { $in: OrgApplication.OPEN_STATUSES },
    }).select("_id basics.type");

    const sameType = open.find((a) => a.basics && a.basics.type === type);
    if (sameType) {
      return res.status(409).json({
        error: "You already have an open application for this organization type",
        applicationId: String(sameType._id),
      });
    }
    if (open.length >= MAX_OPEN_APPLICATIONS_PER_USER) {
      return res.status(409).json({
        error: `You can have at most ${MAX_OPEN_APPLICATIONS_PER_USER} open applications. Finish or discard one first.`,
      });
    }

    const app = new OrgApplication({
      applicant: req.user._id,
      basics: { type },
      dossierSalt: crypto.randomBytes(16).toString("hex"),
      history: [{ at: new Date(), actor: req.user._id, action: "created" }],
    });
    await app.save();
    audit(req, "org_application.created", app, { type });

    res.status(201).json(service.toApplicantView(app));
  } catch (err) {
    console.error("[orgApplications] create error:", err);
    res.status(500).json({ error: "Failed to create application" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// GET /api/org-applications/:id — Resume an application (owner only)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", authenticate, async (req, res) => {
  try {
    const app = await loadOwned(req, res);
    if (!app) return;
    res.json(service.toApplicantView(app));
  } catch (err) {
    console.error("[orgApplications] get error:", err);
    res.status(500).json({ error: "Failed to load application" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// PATCH /api/org-applications/:id/steps/:step — Validate and save one step
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/steps/:step", authenticate, writeLimiter, async (req, res) => {
  try {
    const { step } = req.params;
    if (!requirements.isValidStep(step)) {
      return res.status(404).json({ error: "Unknown step" });
    }
    if (step === "documents") {
      return res.status(400).json({ error: "Documents are managed through the /documents endpoints" });
    }

    const app = await loadOwned(req, res);
    if (!app) return;
    if (rejectIfLocked(app, res)) return;

    const result = service.applyStep(app, step, req.body || {});
    if (!result.ok) {
      return res.status(422).json({ error: "Validation failed", fields: result.errors });
    }

    service.applyPatch(app, result.patch);
    if (step === "review") {
      app.consents.ip = req.ip;
      app.consents.userAgent = String(req.get("user-agent") || "").slice(0, 300);
    }
    await app.save();
    audit(req, "org_application.step_saved", app, { step });

    res.json(service.toApplicantView(app));
  } catch (err) {
    console.error("[orgApplications] step error:", err);
    res.status(500).json({ error: "Failed to save step" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/org-applications/:id/contact/email/send — Email a 6-digit code
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/contact/email/send", authenticate, writeLimiter, async (req, res) => {
  try {
    const app = await loadOwned(req, res, { select: OTP_SELECT });
    if (!app) return;
    if (rejectIfLocked(app, res)) return;

    const email = app.contact && app.contact.email;
    if (!email) {
      return res.status(400).json({ error: "Save the 'Your identity' step with a contact email first" });
    }
    if (app.contact.emailVerifiedAt) {
      return res.json({ alreadyVerified: true });
    }

    const decision = service.evaluateOtpSend(app.contact);
    if (!decision.allowed) {
      res.set("Retry-After", String(decision.retryAfterSec));
      return res.status(429).json({
        error: "Please wait before requesting another code",
        retryAfterSec: decision.retryAfterSec,
      });
    }

    const code = service.generateOtp();
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <h2>Verify your organization email</h2>
        <p>Use this code to verify <b>${escapeHtml(email)}</b> for your ChainBudget organization application:</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:bold">${escapeHtml(code)}</p>
        <p>It expires in ${service.OTP_TTL_MS / 60000} minutes. If you did not request this, you can ignore this email.</p>
      </div>`;
    const sent = await sendEmail(email, "ChainBudget — verify your organization email", html);

    if (!sent) {
      if (process.env.NODE_ENV !== "production") {
        // Local development without SMTP: surface the code in the server log only
        console.warn(`[orgApplications] DEV ONLY — email code for application ${app._id}: ${code}`);
      } else {
        return res.status(502).json({ error: "We could not send the verification email. Please try again shortly." });
      }
    }

    const now = new Date();
    app.contact.otpHash = service.hashOtp(String(app._id), email, code);
    app.contact.otpExpiresAt = new Date(now.getTime() + service.OTP_TTL_MS);
    app.contact.otpAttempts = 0;
    app.contact.otpSentAt = now;
    app.contact.otpSentCount = decision.sentCount + 1;
    app.contact.otpWindowStart = decision.windowStart;
    await app.save();

    res.json({
      sent: true,
      to: maskEmail(email),
      expiresInSec: service.OTP_TTL_MS / 1000,
      resendAfterSec: service.OTP_RESEND_MIN_MS / 1000,
    });
  } catch (err) {
    console.error("[orgApplications] otp send error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/org-applications/:id/contact/email/confirm — Check the code
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/contact/email/confirm", authenticate, writeLimiter, async (req, res) => {
  try {
    const app = await loadOwned(req, res, { select: OTP_SELECT });
    if (!app) return;
    if (rejectIfLocked(app, res)) return;

    const email = app.contact && app.contact.email;
    if (app.contact && app.contact.emailVerifiedAt) return res.json({ verified: true });
    if (!email || !app.contact.otpHash) {
      return res.status(400).json({ error: "Request a verification code first" });
    }
    if (!app.contact.otpExpiresAt || new Date(app.contact.otpExpiresAt) < new Date()) {
      return res.status(400).json({ error: "This code has expired. Request a new one." });
    }
    if ((app.contact.otpAttempts || 0) >= service.OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: "Too many incorrect attempts. Request a new code." });
    }

    const code = String((req.body && req.body.code) || "").trim();
    if (!service.otpMatches(String(app._id), email, code, app.contact.otpHash)) {
      app.contact.otpAttempts = (app.contact.otpAttempts || 0) + 1;
      await app.save();
      return res.status(400).json({
        error: "Incorrect code",
        attemptsLeft: Math.max(0, service.OTP_MAX_ATTEMPTS - app.contact.otpAttempts),
      });
    }

    app.contact.emailVerifiedAt = new Date();
    app.contact.otpHash = undefined;
    app.contact.otpExpiresAt = undefined;
    app.contact.otpAttempts = 0;
    pushHistory(app, req, "contact_email_verified");
    await app.save();
    audit(req, "org_application.email_verified", app, {});

    res.json({ verified: true });
  } catch (err) {
    console.error("[orgApplications] otp confirm error:", err);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/org-applications/:id/documents — Upload one evidence file (private)
/// multipart/form-data: file=<binary>, kind=<document kind>
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/documents", authenticate, uploadLimiter, upload.single("file"), async (req, res) => {
  let storedDocId = null;
  try {
    const app = await loadOwned(req, res);
    if (!app) return;
    if (rejectIfLocked(app, res)) return;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const type = app.basics.type;
    const kind = String((req.body && req.body.kind) || "");
    if (!requirements.getAllowedDocumentKinds(type).includes(kind)) {
      return res.status(400).json({ error: "This document type is not accepted for your organization type" });
    }

    // Trust the file's bytes, not the client-declared MIME type
    const realMime = sniffMime(req.file.buffer);
    const kindSpec = requirements.DOCUMENT_KINDS[kind];
    if (!realMime || !kindSpec.mimes.includes(realMime)) {
      return res.status(400).json({
        error: `This document must be one of: ${kindSpec.mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}`,
      });
    }

    const sha256 = sha256Hex(req.file.buffer);
    if (app.documents.some((d) => d.sha256 === sha256)) {
      return res.status(409).json({ error: "This exact file is already attached to the application" });
    }

    const sameKind = app.documents.filter((d) => d.kind === kind);
    if (kindSpec.maxPerKind === 1 && sameKind.length === 1) {
      // Single-file kinds are replaced on re-upload
      const old = sameKind[0];
      app.documents = app.documents.filter((d) => String(d._id) !== String(old._id));
      await OrgDocument.deleteOne({ _id: old.document, application: app._id });
    } else if (sameKind.length >= kindSpec.maxPerKind) {
      return res.status(409).json({ error: `You can attach at most ${kindSpec.maxPerKind} file(s) of this type` });
    }
    if (app.documents.length >= requirements.MAX_DOCUMENTS_PER_APPLICATION) {
      return res.status(409).json({ error: "Too many documents attached to this application" });
    }

    // Optional Pinata IPFS pinning (for public / administrative CID provenance)
    let ipfsCid = null;
    let ipfsUrl = null;
    if (process.env.PINATA_JWT) {
      try {
        const pinRes = await uploadToPinata(req.file.buffer, safeFileName(req.file.originalname));
        if (pinRes && pinRes.cid) {
          ipfsCid = pinRes.cid;
          ipfsUrl = pinRes.url;
        }
      } catch (pinErr) {
        console.warn("[orgApplications] Pinata IPFS pinning non-blocking warning:", pinErr.message);
      }
    }

    const blob = encryptBuffer(req.file.buffer, String(app._id));
    const doc = await OrgDocument.create({
      application: app._id,
      owner: req.user._id,
      kind,
      mime: realMime,
      size: req.file.size,
      sha256,
      iv: blob.iv,
      authTag: blob.authTag,
      data: blob.data,
      ipfsCid,
      ipfsUrl,
    });
    storedDocId = doc._id;

    app.documents.push({
      document: doc._id,
      kind,
      originalName: safeFileName(req.file.originalname),
      mime: realMime,
      size: req.file.size,
      sha256,
      ipfsCid,
      ipfsUrl,
    });
    app.completedSteps = service.documentsCompletion(app).completedSteps;
    await app.save();
    storedDocId = null; // committed
    audit(req, "org_application.document_uploaded", app, { kind, sha256, size: req.file.size });

    res.status(201).json(service.toApplicantView(app));
  } catch (err) {
    if (storedDocId) await OrgDocument.deleteOne({ _id: storedDocId }).catch(() => {});
    console.error("[orgApplications] upload error:", err);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// DELETE /api/org-applications/:id/documents/:docId — Remove an attached file
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id/documents/:docId", authenticate, writeLimiter, async (req, res) => {
  try {
    const app = await loadOwned(req, res);
    if (!app) return;
    if (rejectIfLocked(app, res)) return;

    const ref = app.documents.find((d) => String(d._id) === String(req.params.docId));
    if (!ref) return res.status(404).json({ error: "Document not found" });

    app.documents = app.documents.filter((d) => String(d._id) !== String(ref._id));
    app.completedSteps = service.documentsCompletion(app).completedSteps;
    await app.save();
    await OrgDocument.deleteOne({ _id: ref.document, application: app._id });
    audit(req, "org_application.document_deleted", app, { kind: ref.kind });

    res.json(service.toApplicantView(app));
  } catch (err) {
    console.error("[orgApplications] delete document error:", err);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// DELETE /api/org-applications/:id — Discard a draft (and its files)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", authenticate, writeLimiter, async (req, res) => {
  try {
    const app = await loadOwned(req, res);
    if (!app) return;
    if (app.status !== "draft") {
      return res.status(409).json({ error: "Only drafts can be discarded", status: app.status });
    }
    await OrgDocument.deleteMany({ application: app._id });
    await OrgApplication.deleteOne({ _id: app._id });
    audit(req, "org_application.discarded", app, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[orgApplications] discard error:", err);
    res.status(500).json({ error: "Failed to discard application" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
/// POST /api/org-applications/:id/submit — Send for review
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/submit", authenticate, writeLimiter, requireIdempotency, async (req, res) => {
  try {
    const app = await loadOwned(req, res, { select: "+dossierSalt" });
    if (!app) return;
    if (rejectIfLocked(app, res)) return;

    const missing = service.missingForSubmit(app);
    if (missing.length > 0) {
      return res.status(422).json({ error: "The application is not complete", missing });
    }

    const wasResubmission = app.status === "needs_info";
    app.flags = await service.detectFlags(service.plain(app), {
      OrgApplication,
      Organization: require("../models/Organization"),
    });
    const { hash } = service.computeDossierHash(app, app.dossierSalt);
    app.dossierHash = hash;
    app.status = "submitted";
    app.submittedAt = new Date();
    if (wasResubmission) app.revision = (app.revision || 1) + 1;
    pushHistory(app, req, wasResubmission ? "resubmitted" : "submitted");
    await app.save();
    audit(req, "org_application.submitted", app, { revision: app.revision, dossierHash: hash });

    res.json(service.toApplicantView(app));
  } catch (err) {
    console.error("[orgApplications] submit error:", err);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

module.exports = router;
