const mongoose = require("mongoose");
const { ORG_TYPES, REQUIREMENTS_VERSION } = require("../config/orgVerificationRequirements");

/**
 * OrgApplication
 *
 * A server-side draft + evidence bundle for registering an organization.
 * The Organization document is only created when an application is approved
 * (Phase 3), so unreviewed organizations never appear in lists or on-chain.
 *
 * Sensitive file contents live in OrgDocument (encrypted), never here.
 */

// Open = still being worked on or awaiting a decision. A user may hold one open
// application per organization type.
const OPEN_STATUSES = ["draft", "submitted", "under_review", "needs_info"];
const ALL_STATUSES = [...OPEN_STATUSES, "approved", "rejected", "revoked"];

const DocumentRefSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: "OrgDocument", required: true },
    kind: { type: String, required: true },
    originalName: { type: String, maxlength: 200 },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true },
    ipfsCid: { type: String, default: null },
    ipfsUrl: { type: String, default: null },
    uploadedAt: { type: Date, default: Date.now },
    // Reviewer verdict per file (used from Phase 3)
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    reviewerNote: { type: String, maxlength: 500 },
  },
  { _id: true }
);

const HistorySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    note: { type: String, maxlength: 1000 },
  },
  { _id: false }
);

const OfficerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, maxlength: 200 },
    roleLabel: { type: String, maxlength: 80 },
    roleLevel: { type: Number, enum: [1, 2, 3], default: 2 },
  },
  { _id: false }
);

const OrgApplicationSchema = new mongoose.Schema(
  {
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Set when the application is approved and the Organization is created
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },

    status: { type: String, enum: ALL_STATUSES, default: "draft" },
    revision: { type: Number, default: 1 }, // increments each time the applicant resubmits
    requirementsVersion: { type: String, default: REQUIREMENTS_VERSION },
    currentStep: { type: String, default: "details" },
    completedSteps: { type: [String], default: [] },

    basics: {
      type: { type: String, enum: ORG_TYPES, required: true },
      displayName: { type: String, trim: true, maxlength: 120 },
      legalName: { type: String, trim: true, maxlength: 200 },
      registrationNumber: { type: String, trim: true, maxlength: 64 },
      // Normalized registration number, used to detect duplicate registrations
      registrationKey: { type: String, index: true },
      yearEstablished: { type: Number },
      mission: { type: String, maxlength: 2000 },
      intendedUse: { type: String, maxlength: 1000 },
      logoUrl: { type: String },
      extras: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    address: {
      region: String,
      province: String,
      city: String,
      barangay: String,
      street: String,
      postalCode: String,
    },
    contact: {
      email: { type: String, lowercase: true, trim: true },
      phone: String,
      emailVerifiedAt: { type: Date, default: null },
      // One-time code state (the code itself is never stored, only an HMAC)
      otpHash: { type: String, select: false },
      otpExpiresAt: { type: Date, select: false },
      otpAttempts: { type: Number, default: 0, select: false },
      otpSentAt: { type: Date, select: false },
      otpSentCount: { type: Number, default: 0, select: false },
      otpWindowStart: { type: Date, select: false },
    },
    representative: {
      fullName: String,
      position: String,
      idType: String,
      idLast4: String, // the full ID number is never stored
    },
    governance: {
      requiredApprovals: { type: Number },
      highValueThreshold: { type: Number },
      isPrivate: { type: Boolean, default: false },
      officers: { type: [OfficerSchema], default: [] },
    },
    documents: { type: [DocumentRefSchema], default: [] },
    consents: {
      termsAt: Date,
      privacyAt: Date,
      accuracyAt: Date,
      ip: String,
      userAgent: String,
    },

    // Reviewer data — never returned to the applicant except applicantMessage
    review: {
      reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reviewedAt: Date,
      decision: { type: String, enum: ["approve", "reject", "needs_info"] },
      internalNotes: { type: String, maxlength: 4000 },
      applicantMessage: { type: String, maxlength: 2000 },
      checklist: { type: mongoose.Schema.Types.Mixed },
    },
    // Duplicate / risk signals computed at submit time, for the reviewer only
    flags: [{ _id: false, code: String, detail: String }],

    submittedAt: Date,
    history: { type: [HistorySchema], default: [] },

    // Salted commitment of the dossier (anchored on-chain in Phase 4). The salt is
    // random and server-side so low-entropy personal data cannot be brute-forced
    // from the public hash.
    dossierSalt: { type: String, select: false },
    dossierHash: { type: String },
    anchor: {
      status: { type: String, enum: ["none", "pending", "confirmed", "failed"], default: "none" },
      txHash: String,
      blockNumber: Number,
      attempts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

OrgApplicationSchema.index({ applicant: 1, status: 1 });
OrgApplicationSchema.index({ status: 1, createdAt: -1 });
OrgApplicationSchema.index({ "documents.sha256": 1 });

OrgApplicationSchema.statics.OPEN_STATUSES = OPEN_STATUSES;
OrgApplicationSchema.statics.ALL_STATUSES = ALL_STATUSES;

module.exports = mongoose.model("OrgApplication", OrgApplicationSchema);
