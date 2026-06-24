const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorWallet: { type: String, lowercase: true },
    action: {
      type: String,
      required: true,
      // Examples: "transaction.created", "transaction.approved", "user.invited"
    },
    targetType: { type: String },  // "Transaction", "User", "Organization"
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed }, // Extra context
    ipAddress: { type: String },
    // Blockchain reference if this action triggered an on-chain write
    blockchainTxHash: { type: String },
    onChainTxId: { type: Number },
  },
  { timestamps: true }
);

AuditLogSchema.index({ organization: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
