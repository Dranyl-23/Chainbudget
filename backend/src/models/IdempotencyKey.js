/**
 * IdempotencyKey.js
 *
 * Prevents double-spend and duplicate transaction/approval submissions.
 * Stores response payloads indexed by client-supplied idempotency keys with a 2-minute TTL.
 */

const mongoose = require("mongoose");

const IdempotencyKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  responseStatus: {
    type: Number,
    required: true,
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 120, // Automatically purged from MongoDB after 2 minutes (120 seconds)
  },
});

IdempotencyKeySchema.index({ key: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("IdempotencyKey", IdempotencyKeySchema);
