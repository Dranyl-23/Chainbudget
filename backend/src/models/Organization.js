const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
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
    logoUrl: { type: String, trim: true },
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
    subsidyAmount: { type: Number, default: 50000 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Organization", OrganizationSchema);
