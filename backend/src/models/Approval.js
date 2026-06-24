const mongoose = require("mongoose");

const ApprovalSchema = new mongoose.Schema(
  {
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ["approved", "rejected"],
    },
    comment: { type: String, trim: true },
    // On-chain reference for this specific approval action
    blockchainTxHash: { type: String },
    walletAddress: { type: String, lowercase: true },
  },
  { timestamps: true }
);

// Prevent duplicate votes
ApprovalSchema.index({ transaction: 1, approver: 1 }, { unique: true });

module.exports = mongoose.model("Approval", ApprovalSchema);
