const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "system"],
      default: "text",
    },
    roleLevel: {
      type: Number,
      default: 4,
    },
    roleLabel: {
      type: String,
      default: "Member",
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast chronological pagination by organization
chatMessageSchema.index({ organization: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
