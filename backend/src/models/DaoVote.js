const mongoose = require("mongoose");

const daoVoteSchema = new mongoose.Schema({
  proposal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Proposal",
    required: true,
  },
  voter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  support: {
    type: Boolean,
    required: true, // true = Yes, false = No
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// A user can only vote once per proposal
daoVoteSchema.index({ proposal: 1, voter: 1 }, { unique: true });

module.exports = mongoose.model("DaoVote", daoVoteSchema);
