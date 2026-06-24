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
    type: {
      type: String,
      required: true,
      enum: ["income", "expense"],
    },
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
      enum: ["pending_approval", "approved", "rejected", "cancelled"],
      default: "pending_approval",
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
