const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    yearEstablished: { type: Number },
    type: {
      type: String,
      required: true,
      enum: [
        "student_org",
        "barangay",
        "homeowners_association",
        "ngo",
        "cooperative",
        "church",
        "sports_club",
        "startup",
        "family",
        "fundraising",
      ],
    },
    description: { type: String, trim: true },
    intendedUse: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    address: {
      region: { type: String, trim: true },
      province: { type: String, trim: true },
      city: { type: String, trim: true },
      barangay: { type: String, trim: true },
      street: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    // High-value threshold in smallest currency unit
    highValueThreshold: { type: Number, required: true, default: 10000 },
    // Minimum required approvals for high-value transactions
    requiredApprovals: { type: Number, required: true, default: 2 },
    // Smart contract address associated with this org (set after deployment)
    contractAddress: { type: String, trim: true },
    // Liquidation status for budget replenishment
    liquidationStatus: {
      type: String,
      enum: ["none", "pending", "approved"],
      default: "none",
    },
    // The amount to be automatically subsidized on approval (in PHP/smallest unit)
    subsidyAmount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Legitimacy verification & on-chain attestation state
    verification: {
      status: {
        type: String,
        enum: ["legacy_unverified", "pending", "verified", "revoked"],
        default: "legacy_unverified",
      },
      tier: {
        type: String,
        enum: ["standard", "light"],
        default: "standard",
      },
      verifiedAt: { type: Date },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OrgApplication",
      },
      dossierHash: { type: String, trim: true },
      attestationTxHash: { type: String, trim: true },
      revokedAt: { type: Date },
      revocationReason: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

// Performance indexes for public directories and admin lookups
OrganizationSchema.index({ isActive: 1, isPrivate: 1, createdAt: -1 });
OrganizationSchema.index({ "verification.status": 1, isActive: 1, isPrivate: 1 });
OrganizationSchema.index({ createdBy: 1 });

module.exports = mongoose.model("Organization", OrganizationSchema);
