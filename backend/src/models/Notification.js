const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["urgent", "blockchain", "system", "info"],
      default: "info",
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = all org members, non-null = targeted to specific user
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],
  },
  { timestamps: true }
);

// Indexes for fast per-org notification retrieval and unread filtering
notificationSchema.index({ organization: 1, createdAt: -1 });
notificationSchema.index({ organization: 1, recipientUser: 1, createdAt: -1 });
notificationSchema.index({ recipientUser: 1, createdAt: -1 });
notificationSchema.index({ organization: 1, readBy: 1 });
notificationSchema.index({ organization: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
