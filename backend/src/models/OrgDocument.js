const mongoose = require("mongoose");

/**
 * OrgDocument
 *
 * Encrypted verification evidence. The file bytes are AES-256-GCM encrypted
 * (utils/documentVault.js) and are excluded from queries by default (select:false),
 * so they can only be read by code that explicitly asks for `+data`.
 *
 * This is deliberately a separate collection so the storage backend can later be
 * swapped for a private object store without touching OrgApplication.
 */
const OrgDocumentSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: "OrgApplication", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true }, // plaintext size in bytes
    sha256: { type: String, required: true }, // hash of the plaintext
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    data: { type: Buffer, required: true, select: false },
    // IPFS Pinata Attestation
    ipfsCid: { type: String, default: null },
    ipfsUrl: { type: String, default: null },
    // Retention: when set, MongoDB removes the document automatically (Phase 3/6)
    purgeAt: { type: Date },
  },
  { timestamps: true }
);

// TTL index: documents without purgeAt are never expired
OrgDocumentSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("OrgDocument", OrgDocumentSchema);
