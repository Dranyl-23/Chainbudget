const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    type: {
      type: String,
      enum: ["bug", "suggestion", "usability", "general"],
      default: "general",
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    screenshotUrl: {
      type: String,
      default: null,
    },
    deviceInfo: {
      platform: { type: String, default: "Android" },
      osVersion: { type: String, default: "" },
      appVersion: { type: String, default: "1.1.7" },
      deviceModel: { type: String, default: "" },
      brand: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved", "closed"],
      default: "open",
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
