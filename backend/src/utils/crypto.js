const crypto = require("crypto");
require("dotenv").config();

const GCM_ALGORITHM = "aes-256-gcm";
const CBC_ALGORITHM = "aes-256-cbc";

// ── Key Derivation ─────────────────────────────────────────────────────────────
/**
 * Derives a deterministic 32-byte (256-bit) encryption key from the provided secret.
 * @param {string} [customSecret]
 * @returns {Buffer} 32-byte derived key
 */
function getMasterKey(customSecret) {
  const secret = customSecret !== undefined ? customSecret : process.env.ENCRYPTION_SECRET;
  if (!secret || typeof secret !== "string" || secret.trim().length === 0) {
    throw new Error(
      "FATAL: ENCRYPTION_SECRET must be a non-empty string."
    );
  }
  // Normalize secret to a 32-byte key via SHA-256
  return crypto.createHash("sha256").update(secret.trim()).digest();
}

/**
 * Derives a legacy CBC key using scrypt and salt.
 * @param {string} secret
 * @param {string} salt
 * @returns {Buffer}
 */
function deriveLegacyKey(secret, salt) {
  return crypto.scryptSync(secret, salt, 32);
}

// ── Encryption ─────────────────────────────────────────────────────────────────
/**
 * Encrypts sensitive text using authenticated AES-256-GCM (v2 format).
 * Produces format: `v2:ivHex:authTagHex:encryptedHex`
 *
 * @param {string} text - Plain text to encrypt (e.g. private key, mnemonic)
 * @param {string} [customSecret] - Optional secret override (for tests/migration)
 * @returns {string|null} Versioned ciphertext string
 */
function encrypt(text, customSecret) {
  if (!text) return null;
  if (typeof text !== "string") {
    text = String(text);
  }

  const key = getMasterKey(customSecret);
  // Standard 96-bit (12-byte) IV for AES-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `v2:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// ── Decryption ─────────────────────────────────────────────────────────────────
/**
 * Decrypts ciphertext, supporting modern AES-256-GCM (v2) and legacy AES-256-CBC (v1, v0).
 * Decryption is strictly authenticated and will fail-fast without guess-based key fallback.
 *
 * Supported formats:
 * - `v2:ivHex:authTagHex:encryptedHex` (AES-256-GCM authenticated)
 * - `saltHex:ivHex:encryptedHex`      (v1 legacy AES-256-CBC with scrypt salt)
 * - `ivHex:encryptedHex`              (v0 legacy AES-256-CBC with static salt)
 *
 * @param {string} cipherText - Ciphertext string
 * @param {string} [customSecret] - Optional secret override (for tests/migration)
 * @returns {string|null} Decrypted plain text
 */
function decrypt(cipherText, customSecret) {
  if (!cipherText) return null;
  if (typeof cipherText !== "string") {
    throw new Error("Invalid ciphertext: must be a string");
  }

  const secret = customSecret !== undefined ? customSecret : process.env.ENCRYPTION_SECRET;
  if (!secret || typeof secret !== "string" || secret.trim().length === 0) {
    throw new Error("FATAL: ENCRYPTION_SECRET environment variable is not set.");
  }

  const parts = cipherText.split(":");

  // ── Format A: Modern AES-256-GCM (`v2:iv:authTag:ciphertext`) ───────────────
  if (parts.length === 4 && parts[0] === "v2") {
    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");

    const key = getMasterKey(customSecret);
    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  // ── Format B: Legacy 3-part (`salt:iv:ciphertext` - AES-256-CBC) ───────────
  if (parts.length === 3) {
    const [salt, ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");

    // Strategy 1: scryptSync with configured secret string and salt string
    try {
      const key1 = deriveLegacyKey(secret, salt);
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key1, iv);
      let decrypted = decipher.update(encryptedText, undefined, "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) return decrypted;
    } catch (e1) {}

    // Strategy 2: SHA256 derived key with configured secret
    try {
      const key2 = getMasterKey(customSecret);
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key2, iv);
      let decrypted = decipher.update(encryptedText, undefined, "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) return decrypted;
    } catch (e2) {}

    throw new Error("Unable to decrypt legacy ciphertext: key mismatch or corrupted data");
  }

  // ── Format C: Legacy 2-part (`iv:ciphertext` - AES-256-CBC static salt) ────
  if (parts.length === 2) {
    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const encryptedText = Buffer.from(encryptedHex, "hex");

    // Strategy 1: scryptSync with configured secret string and static salt
    try {
      const key1 = deriveLegacyKey(secret, "salt");
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key1, iv);
      let decrypted = decipher.update(encryptedText, undefined, "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) return decrypted;
    } catch (e1) {}

    // Strategy 2: SHA256 derived key with configured secret
    try {
      const key2 = getMasterKey(customSecret);
      const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key2, iv);
      let decrypted = decipher.update(encryptedText, undefined, "utf8");
      decrypted += decipher.final("utf8");
      if (decrypted) return decrypted;
    } catch (e2) {}

    throw new Error("Unable to decrypt legacy ciphertext: key mismatch or corrupted data");
  }

  throw new Error("Unsupported or corrupted ciphertext format");
}

module.exports = {
  encrypt,
  decrypt,
  getMasterKey,
};
