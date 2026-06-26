const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["income", "expense"], required: true },
    isHighValue: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false }, // Level 1/2 DAO approvals
    approvalCount: { type: Number, default: 0 },
    executed: { type: Boolean, default: false },   // Transferred on-chain
    isEscrow: { type: Boolean, default: false },   // Is it a smart contract escrow?
    escrowStatus: { type: String, enum: ["none", "locked", "released"], default: "none" },
    payerApproved: { type: Boolean, default: false },
    payeeApproved: { type: Boolean, default: false },
    approvals: [{ type: String, trim: true }],
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PHP" },
    description: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    // Document / receipt metadata
    documentUrl: { type: String },
    documentHash: { type: String }, // Hash of uploaded document

    // Approval state
    isHighValue: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["requested", "pending_approval", "approved", "rejected", "cancelled"],
      default: "pending_approval",
    },
    urgency: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
    },

    // Blockchain references (populated after on-chain recording)
    onChainTxId: { type: Number },          // Smart contract transaction ID
    blockchainTxHash: { type: String },     // Ethereum transaction hash
    dataHash: { type: String },             // keccak256 of payload sent to contract
    isRecordedOnChain: { type: Boolean, default: false },

    // Budget period / allocation link
    budgetCategory: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", TransactionSchema);
