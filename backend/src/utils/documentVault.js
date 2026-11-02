/**
 * documentVault.js
 *
 * Helpers for storing verification evidence (IDs, legal documents) privately.
 *
 *  - AES-256-GCM over raw Buffers (no hex/base64 inflation).
 *  - Per-purpose key derived from the master secret with HKDF, so the document key is
 *    distinct from the key used for wallet secrets in utils/crypto.js.
 *  - The owning application id is bound in as AAD, so a ciphertext blob cannot be
 *    swapped onto another application without failing authentication.
 *  - Magic-byte sniffing so the declared MIME type cannot be spoofed.
 *
 * Verification evidence must NEVER be sent to public IPFS / public URLs.
 */

"use strict";

const crypto = require("crypto");
const { getMasterKey } = require("./crypto");

const ALGORITHM = "aes-256-gcm";
const HKDF_INFO = "chainbudget:org-verification-docs:v1";

function deriveDocumentKey(customSecret) {
  const master = getMasterKey(customSecret);
  return Buffer.from(crypto.hkdfSync("sha256", master, Buffer.alloc(0), HKDF_INFO, 32));
}

/**
 * @param {Buffer} plain
 * @param {string} aad - Owning application id
 * @param {string} [customSecret] - test/migration override
 * @returns {{iv:string, authTag:string, data:Buffer}}
 */
function encryptBuffer(plain, aad, customSecret) {
  if (!Buffer.isBuffer(plain)) throw new TypeError("encryptBuffer expects a Buffer");
  const key = deriveDocumentKey(customSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(String(aad), "utf8"));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { iv: iv.toString("hex"), authTag: cipher.getAuthTag().toString("hex"), data };
}

/**
 * @param {{iv:string, authTag:string, data:Buffer}} blob
 * @param {string} aad
 * @param {string} [customSecret]
 * @returns {Buffer}
 */
function decryptBuffer(blob, aad, customSecret) {
  const key = deriveDocumentKey(customSecret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(blob.iv, "hex"));
  decipher.setAAD(Buffer.from(String(aad), "utf8"));
  decipher.setAuthTag(Buffer.from(blob.authTag, "hex"));
  return Buffer.concat([decipher.update(blob.data), decipher.final()]);
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Detects the real file type from its leading bytes.
 * @param {Buffer} buf
 * @returns {"application/pdf"|"image/png"|"image/jpeg"|"image/webp"|null}
 */
function sniffMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.slice(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0x89 && buf.slice(1, 4).toString("latin1") === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}

module.exports = { encryptBuffer, decryptBuffer, sha256Hex, sniffMime };
