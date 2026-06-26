const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "passed", "rejected", "executed"],
    default: "active",
  },
  blockchainProposalId: {
    type: Number, // Maps to the Proposal ID in ChainBudgetDAO.sol
  },
  dataHash: {
    type: String,
  },
  durationSeconds: {
    type: Number,
    default: 604800, // 7 days by default
  },
  endTime: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Proposal", proposalSchema);
