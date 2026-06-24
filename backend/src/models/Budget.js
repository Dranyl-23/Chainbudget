const mongoose = require("mongoose");

const BudgetSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    allocated: {
      type: Number,
      required: true,
      min: 0,
    },
    color: {
      type: String,
      default: "#6B55D9",
    },
  },
  { timestamps: true }
);

// Ensure budget category names are unique per organization
BudgetSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Budget", BudgetSchema);
