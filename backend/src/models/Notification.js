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
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
