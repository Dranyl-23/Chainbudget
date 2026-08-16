const crypto = require("crypto");
require("dotenv").config();

const algorithm = "aes-256-cbc";

// SECURITY: No hardcoded fallback — ENCRYPTION_SECRET must be set in .env
const secret = process.env.ENCRYPTION_SECRET;
if (!secret) {
  throw new Error("FATAL: ENCRYPTION_SECRET environment variable is not set. Cannot start server without encryption key.");
}

/**
 * Derives an encryption key from the secret using a random salt.
 * @param {string} salt - Hex string salt
 * @returns {Buffer} 32-byte derived key
 */
function deriveKey(salt) {
  return crypto.scryptSync(secret, salt, 32);
}

/**
 * Encrypts a plain text string with per-encryption random salt.
 * @param {string} text
 * @returns {string} Format: salt:iv:encryptedData (all hex)
 */
function encrypt(text) {
  if (!text) return null;
  const salt = crypto.randomBytes(16).toString("hex");
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${salt}:${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a cipher text string.
 * Supports both new format (salt:iv:data) and legacy format (iv:data with static salt).
 * @param {string} cipherText
 * @returns {string} Decrypted plain text
 */
function decrypt(cipherText) {
  if (!cipherText) return null;
  const parts = cipherText.split(":");
  
  let salt, ivHex, encryptedHex;
  
  if (parts.length === 3) {
    // New format: salt:iv:encryptedData
    [salt, ivHex, encryptedHex] = parts;
  } else if (parts.length === 2) {
    // Legacy format: iv:encryptedData (uses static salt for backward compatibility)
    salt = "salt";
    [ivHex, encryptedHex] = parts;
  } else {
    throw new Error("Invalid cipher text format");
  }
  
  const key = deriveKey(salt);
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
};
