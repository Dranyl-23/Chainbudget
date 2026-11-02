/**
 * orgApplicationService.js
 *
 * Business rules for organization verification applications. Deliberately free of
 * Express and (mostly) of database access so the rules can be unit-tested directly.
 */

"use strict";

const crypto = require("crypto");
const { ethers } = require("ethers");
const { getMasterKey } = require("../utils/crypto");
const requirements = require("../config/orgVerificationRequirements");

// ── State machine ────────────────────────────────────────────────────────────
// approve / reject / needs_info / revoke transitions are exercised by the admin
// review endpoints (Phase 3); they are defined here so the rules live in one place.
const TRANSITIONS = {
  draft: ["submitted"],
  submitted: ["under_review", "needs_info", "approved", "rejected"],
  under_review: ["needs_info", "approved", "rejected"],
  needs_info: ["submitted"],
  approved: ["revoked"],
  rejected: [],
  revoked: [],
};

const EDITABLE_STATUSES = ["draft", "needs_info"];

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

function isEditable(status) {
  return EDITABLE_STATUSES.includes(status);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a mongoose document (or plain object) into a plain object. */
function plain(doc) {
  if (!doc) return doc;
  return typeof doc.toObject === "function" ? doc.toObject({ depopulate: true }) : doc;
}

function addStep(completed, step) {
  return completed.includes(step) ? [...completed] : [...completed, step];
}

function removeStep(completed, step) {
  return completed.filter((s) => s !== step);
}

/**
 * Validates a step and, if valid, returns the patch to apply to the application.
 * @param {object} app - application (plain or mongoose doc)
 * @param {string} step
 * @param {object} payload
 * @returns {{ok:boolean, errors:object, patch?:object}}
 */
function applyStep(app, step, payload) {
  const a = plain(app);
  const type = a.basics && a.basics.type;
  const founderEmail = (a.contact && a.contact.email) || null;

  const result = requirements.validateStep(step, payload, { type, founderEmail: step === "governance" ? founderEmail : null });
  if (!result.ok) return { ok: false, errors: result.errors };

  let completed = a.completedSteps || [];
  const patch = {};

  if (step === "details") {
    const { basics, address } = result.value;
    patch.basics = {
      ...(a.basics || {}),
      ...basics,
      type,
      registrationKey: requirements.normalizeKey(basics.registrationNumber),
    };
    patch.address = address;
  } else if (step === "representative") {
    const { representative, contact } = result.value;
    const prev = a.contact || {};
    const sameEmail = prev.email && prev.email === contact.email;
    patch.representative = representative;
    patch.contact = {
      email: contact.email,
      phone: contact.phone,
      // A changed email must be verified again
      emailVerifiedAt: sameEmail ? prev.emailVerifiedAt || null : null,
    };
  } else if (step === "governance") {
    patch.governance = result.value.governance;
  } else if (step === "review") {
    const now = new Date();
    patch.consents = { termsAt: now, privacyAt: now, accuracyAt: now };
  }

  // Any substantive edit invalidates the final confirmation.
  if (step !== "review") completed = removeStep(completed, "review");
  completed = addStep(completed, step);
  patch.completedSteps = completed;
  patch.currentStep = nextStep(step);
  return { ok: true, errors: {}, patch };
}

function nextStep(step) {
  const i = requirements.STEP_KEYS.indexOf(step);
  return requirements.STEP_KEYS[Math.min(i + 1, requirements.STEP_KEYS.length - 1)];
}

/**
 * Assigns a patch to a document key-by-key, so sibling fields inside a nested path
 * (e.g. the OTP counters under `contact`) survive an edit of the same path. Replacing
 * the whole nested object would silently reset them — and with them the OTP rate limits.
 */
function applyPatch(doc, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      if (!doc[key]) doc[key] = {};
      for (const [k, v] of Object.entries(value)) doc[key][k] = v;
    } else {
      doc[key] = value;
    }
  }
}

/** Recomputes whether the "documents" step is complete after an upload / delete. */
function documentsCompletion(app) {
  const a = plain(app);
  const type = a.basics && a.basics.type;
  const evaluation = requirements.evaluateDocuments(type, a.documents || []);
  let completed = a.completedSteps || [];
  completed = evaluation.complete ? addStep(completed, "documents") : removeStep(completed, "documents");
  completed = removeStep(completed, "review");
  return { completedSteps: completed, evaluation };
}

/**
 * Lists everything still missing before an application can be submitted.
 * @returns {Array<{step:string, message:string}>}
 */
function missingForSubmit(app) {
  const a = plain(app);
  const missing = [];
  const completed = a.completedSteps || [];
  for (const step of ["details", "representative", "governance"]) {
    if (!completed.includes(step)) missing.push({ step, message: `Complete the "${step}" step` });
  }
  const evaluation = requirements.evaluateDocuments(a.basics && a.basics.type, a.documents || []);
  for (const g of evaluation.missing) {
    missing.push({ step: "documents", message: `Missing document: ${g.label}` });
  }
  if (!(a.contact && a.contact.emailVerifiedAt)) {
    missing.push({ step: "representative", message: "Verify your official contact email" });
  }
  const c = a.consents || {};
  // The "review" step is removed from completedSteps by any later edit, so requiring it
  // here forces the applicant to re-confirm after changing anything.
  const confirmed = completed.includes("review") && c.termsAt && c.privacyAt && c.accuracyAt;
  if (!confirmed) {
    missing.push({ step: "review", message: "Accept the terms, privacy notice and accuracy declaration" });
  }
  return missing;
}

// ── Duplicate / risk signals (reviewer only) ─────────────────────────────────

/**
 * @param {object} app - plain application
 * @param {{OrgApplication:object, Organization:object}} models
 * @returns {Promise<Array<{code:string, detail:string}>>}
 */
async function detectFlags(app, models) {
  const a = plain(app);
  const flags = [];
  const { OrgApplication, Organization } = models;
  const regKey = a.basics && a.basics.registrationKey;

  if (regKey) {
    const dupApp = await OrgApplication.countDocuments({
      _id: { $ne: a._id },
      "basics.registrationKey": regKey,
      status: { $in: ["submitted", "under_review", "needs_info", "approved"] },
    });
    if (dupApp > 0) {
      flags.push({ code: "DUPLICATE_REGISTRATION_NUMBER", detail: `Registration number is used by ${dupApp} other application(s)` });
    }
  }

  const hashes = (a.documents || []).map((d) => d.sha256);
  if (hashes.length > 0) {
    const reused = await OrgApplication.countDocuments({
      _id: { $ne: a._id },
      applicant: { $ne: a.applicant },
      "documents.sha256": { $in: hashes },
    });
    if (reused > 0) {
      flags.push({ code: "DOCUMENT_REUSED", detail: `${reused} application(s) from other users contain an identical file` });
    }
  }

  const name = a.basics && a.basics.displayName;
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dupOrg = await Organization.countDocuments({ name: { $regex: `^${escaped}$`, $options: "i" } });
    if (dupOrg > 0) {
      flags.push({ code: "SIMILAR_ORG_NAME", detail: `An organization named "${name}" already exists` });
    }
  }
  return flags;
}

// ── Dossier hash ─────────────────────────────────────────────────────────────

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** Deterministic description of what the applicant submitted. */
function buildDossier(app) {
  const a = plain(app);
  const b = a.basics || {};
  const rep = a.representative || {};
  const gov = a.governance || {};
  return {
    v: 1,
    applicationId: String(a._id),
    revision: a.revision,
    requirementsVersion: a.requirementsVersion,
    type: b.type,
    basics: {
      displayName: b.displayName,
      legalName: b.legalName,
      registrationNumber: b.registrationNumber || "",
      yearEstablished: b.yearEstablished,
      mission: b.mission,
      intendedUse: b.intendedUse,
      extras: b.extras || {},
    },
    address: a.address ? { ...a.address } : {},
    representative: { fullName: rep.fullName, position: rep.position, idType: rep.idType, idLast4: rep.idLast4 },
    contactEmail: a.contact && a.contact.email,
    governance: {
      requiredApprovals: gov.requiredApprovals,
      highValueThreshold: gov.highValueThreshold,
      isPrivate: Boolean(gov.isPrivate),
      officers: [...(gov.officers || [])]
        .map((o) => ({ name: o.name, email: o.email, roleLabel: o.roleLabel || "", roleLevel: o.roleLevel }))
        .sort((x, y) => x.email.localeCompare(y.email)),
    },
    documents: (a.documents || [])
      .map((d) => ({ kind: d.kind, sha256: d.sha256 }))
      .sort((x, y) => (x.kind + x.sha256).localeCompare(y.kind + y.sha256)),
  };
}

/**
 * keccak256(salt | canonicalDossier). The salt stays on the server so the public
 * hash cannot be used to brute-force the personal data it commits to.
 * @returns {{hash:string, canonical:string}}
 */
function computeDossierHash(app, salt) {
  const canonical = stableStringify(buildDossier(app));
  const hash = ethers.keccak256(ethers.toUtf8Bytes(`${salt}|${canonical}`));
  return { hash, canonical };
}

// ── Email OTP ────────────────────────────────────────────────────────────────

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MIN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_SENDS_PER_HOUR = 5;

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashOtp(applicationId, email, code) {
  return crypto
    .createHmac("sha256", getMasterKey())
    .update(`${applicationId}:${String(email).toLowerCase()}:${code}`)
    .digest("hex");
}

function otpMatches(applicationId, email, code, storedHash) {
  if (!storedHash || typeof code !== "string" || !/^\d{6}$/.test(code)) return false;
  const a = Buffer.from(hashOtp(applicationId, email, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Decides whether a new code may be sent right now.
 * @returns {{allowed:boolean, retryAfterSec?:number, windowStart:Date, sentCount:number}}
 */
function evaluateOtpSend(contact, now = new Date()) {
  const c = contact || {};
  if (c.otpSentAt && now - new Date(c.otpSentAt) < OTP_RESEND_MIN_MS) {
    const retryAfterSec = Math.ceil((OTP_RESEND_MIN_MS - (now - new Date(c.otpSentAt))) / 1000);
    return { allowed: false, retryAfterSec, windowStart: c.otpWindowStart || now, sentCount: c.otpSentCount || 0 };
  }
  let windowStart = c.otpWindowStart ? new Date(c.otpWindowStart) : now;
  let sentCount = c.otpSentCount || 0;
  if (now - windowStart >= 60 * 60 * 1000) {
    windowStart = now;
    sentCount = 0;
  }
  if (sentCount >= OTP_MAX_SENDS_PER_HOUR) {
    const retryAfterSec = Math.ceil((60 * 60 * 1000 - (now - windowStart)) / 1000);
    return { allowed: false, retryAfterSec, windowStart, sentCount };
  }
  return { allowed: true, windowStart, sentCount };
}

// ── Applicant-facing view ────────────────────────────────────────────────────

/** Strips reviewer-only and secret fields from an application. */
function toApplicantView(app) {
  const a = plain(app);
  if (!a) return null;
  const contact = a.contact || {};
  const consents = a.consents || {};
  const review = a.review || {};
  const type = a.basics && a.basics.type;
  const evaluation = requirements.evaluateDocuments(type, a.documents || []);
  const profile = requirements.TYPE_PROFILES[type];

  return {
    id: String(a._id),
    status: a.status,
    revision: a.revision,
    requirementsVersion: a.requirementsVersion,
    type,
    tier: profile ? profile.tier : undefined,
    currentStep: a.currentStep,
    completedSteps: a.completedSteps || [],
    basics: a.basics || {},
    address: a.address || {},
    contact: {
      email: contact.email || "",
      phone: contact.phone || "",
      emailVerified: Boolean(contact.emailVerifiedAt),
    },
    representative: a.representative || {},
    governance: a.governance || {},
    documents: (a.documents || []).map((d) => ({
      id: String(d._id),
      kind: d.kind,
      originalName: d.originalName,
      mime: d.mime,
      size: d.size,
      sha256: d.sha256,
      ipfsCid: d.ipfsCid || null,
      ipfsUrl: d.ipfsUrl || null,
      uploadedAt: d.uploadedAt,
      status: d.status,
      reviewerNote: d.reviewerNote,
    })),
    documentChecklist: evaluation.groups,
    consentsAccepted: Boolean(consents.termsAt && consents.privacyAt && consents.accuracyAt),
    review: {
      decision: review.decision,
      reviewedAt: review.reviewedAt,
      applicantMessage: review.applicantMessage,
    },
    anchor: a.anchor ? {
      status: a.anchor.status,
      txHash: a.anchor.txHash,
      anchoredAt: a.anchor.anchoredAt,
    } : null,
    organization: a.organization ? String(a.organization) : null,
    submittedAt: a.submittedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

// ── Admin review helpers (Phase 3) ───────────────────────────────────────────

const DECISION_TO_STATUS = {
  approve: "approved",
  reject: "rejected",
  needs_info: "needs_info",
};

/**
 * Validates a reviewer decision payload against the application's current state.
 * @param {object} app
 * @param {object} payload - { decision, applicantMessage, internalNotes, checklist, documentVerdicts }
 * @returns {{ok:boolean, error?:string, statusCode?:number, targetStatus?:string, review?:object, documentVerdicts?:object}}
 */
function validateReviewDecision(app, payload) {
  const a = plain(app);
  const p = payload || {};
  const decision = p.decision;

  if (!Object.prototype.hasOwnProperty.call(DECISION_TO_STATUS, decision)) {
    return {
      ok: false,
      statusCode: 400,
      error: "decision must be one of: approve, reject, needs_info",
    };
  }

  const targetStatus = DECISION_TO_STATUS[decision];
  if (!canTransition(a.status, targetStatus)) {
    return {
      ok: false,
      statusCode: 409,
      error: `Cannot transition application from "${a.status}" to "${targetStatus}"`,
    };
  }

  const applicantMessage = requirements.cleanStr(p.applicantMessage);
  const internalNotes = requirements.cleanStr(p.internalNotes);

  if (
    (decision === "reject" || decision === "needs_info") &&
    applicantMessage.length < 10
  ) {
    return {
      ok: false,
      statusCode: 422,
      error:
        "Please provide an explanation of at least 10 characters for the applicant when rejecting or requesting more info.",
    };
  }

  const verdictsIn =
    p.documentVerdicts && typeof p.documentVerdicts === "object"
      ? p.documentVerdicts
      : {};
  const documentVerdicts = {};
  for (const [docId, v] of Object.entries(verdictsIn)) {
    if (!v || typeof v !== "object") continue;
    const status = ["pending", "accepted", "rejected"].includes(v.status)
      ? v.status
      : "pending";
    const reviewerNote = requirements.cleanStr(v.reviewerNote).slice(0, 500);
    documentVerdicts[docId] = { status, reviewerNote };
  }

  return {
    ok: true,
    targetStatus,
    review: {
      decision,
      applicantMessage: applicantMessage.slice(0, 2000),
      internalNotes: internalNotes.slice(0, 4000),
      checklist: p.checklist && typeof p.checklist === "object" ? p.checklist : {},
    },
    documentVerdicts,
  };
}

/**
 * Full reviewer-facing view of an application, including risk flags, internal notes,
 * history, and authenticated document download paths. Never includes OTP secrets or salt.
 */
function toAdminView(app, applicantUser = null) {
  const base = toApplicantView(app);
  if (!base) return null;
  const a = plain(app);
  const review = a.review || {};
  const type = a.basics && a.basics.type;
  const profile = requirements.TYPE_PROFILES[type];

  return {
    ...base,
    typeLabel: profile ? profile.label : type,
    applicant: applicantUser
      ? {
          id: String(applicantUser._id || applicantUser.id),
          displayName: applicantUser.displayName || "",
          walletAddress: applicantUser.walletAddress || "",
          email: applicantUser.email || "",
        }
      : { id: String(a.applicant) },
    documents: base.documents.map((d) => ({
      ...d,
      label:
        (requirements.DOCUMENT_KINDS[d.kind] &&
          requirements.DOCUMENT_KINDS[d.kind].label) ||
        d.kind,
      downloadPath: `/admin/org-applications/${base.id}/documents/${d.id}/file`,
    })),
    flags: a.flags || [],
    dossierHash: a.dossierHash || null,
    anchor: a.anchor || { status: "none", attempts: 0 },
    review: {
      reviewer: review.reviewer ? String(review.reviewer) : null,
      decision: review.decision,
      reviewedAt: review.reviewedAt,
      applicantMessage: review.applicantMessage || "",
      internalNotes: review.internalNotes || "",
      checklist: review.checklist || {},
    },
    history: (a.history || []).map((h) => ({
      at: h.at,
      actor: h.actor ? String(h.actor) : null,
      action: h.action,
      note: h.note || "",
    })),
  };
}

module.exports = {
  TRANSITIONS,
  EDITABLE_STATUSES,
  DECISION_TO_STATUS,
  OTP_TTL_MS,
  OTP_RESEND_MIN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_SENDS_PER_HOUR,
  canTransition,
  isEditable,
  plain,
  applyStep,
  applyPatch,
  documentsCompletion,
  missingForSubmit,
  detectFlags,
  stableStringify,
  buildDossier,
  computeDossierHash,
  generateOtp,
  hashOtp,
  otpMatches,
  evaluateOtpSend,
  toApplicantView,
  validateReviewDecision,
  toAdminView,
};
