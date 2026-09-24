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
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    clientMessageId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast chronological pagination by organization
chatMessageSchema.index({ organization: 1, createdAt: -1 });
chatMessageSchema.index({ organization: 1, isPinned: 1, pinnedAt: -1 });
// Compound index for idempotency duplicate prevention
chatMessageSchema.index({ organization: 1, clientMessageId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
