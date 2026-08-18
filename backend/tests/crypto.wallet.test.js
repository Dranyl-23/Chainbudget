const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

// Ensure test encryption secret is configured
process.env.ENCRYPTION_SECRET = "chainbudget-test-encryption-key-32chars!";

const { encrypt, decrypt, getMasterKey } = require("../src/utils/crypto");

describe("Wallet Cryptographic Engine (AES-256-GCM & Backward Compatibility)", () => {
  const samplePrivateKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
  const sampleMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  test("getMasterKey returns a 32-byte Buffer from configured secret", () => {
    const key = getMasterKey();
    assert.ok(Buffer.isBuffer(key), "Key must be a Buffer");
    assert.equal(key.length, 32, "Key must be exactly 32 bytes (256-bit)");
  });

  test("getMasterKey throws fatal error when secret is missing or empty", () => {
    assert.throws(
      () => getMasterKey(""),
      /FATAL: ENCRYPTION_SECRET must be a non-empty string/
    );
  });

  test("encrypt produces versioned v2 format (v2:iv:authTag:ciphertext)", () => {
    const encrypted = encrypt(samplePrivateKey);
    assert.ok(typeof encrypted === "string", "Ciphertext must be a string");
    
    const parts = encrypted.split(":");
    assert.equal(parts.length, 4, "Must contain 4 colon-separated parts");
    assert.equal(parts[0], "v2", "Version prefix must be 'v2'");
    assert.equal(parts[1].length, 24, "IV must be 12 bytes (24 hex characters)");
    assert.equal(parts[2].length, 32, "Auth tag must be 16 bytes (32 hex characters)");
    assert.ok(parts[3].length > 0, "Ciphertext payload must be non-empty");
  });

  test("roundtrip encryption and decryption for private keys", () => {
    const encrypted = encrypt(samplePrivateKey);
    const decrypted = decrypt(encrypted);
    assert.equal(decrypted, samplePrivateKey, "Decrypted private key must match original exactly");
  });

  test("roundtrip encryption and decryption for 12-word recovery phrases", () => {
    const encrypted = encrypt(sampleMnemonic);
    const decrypted = decrypt(encrypted);
    assert.equal(decrypted, sampleMnemonic, "Decrypted mnemonic must match original exactly");
  });

  test("encrypting the same plaintext twice produces different ciphertexts (random IVs)", () => {
    const enc1 = encrypt(samplePrivateKey);
    const enc2 = encrypt(samplePrivateKey);
    assert.notEqual(enc1, enc2, "Each encryption must use a unique random IV");
    assert.equal(decrypt(enc1), decrypt(enc2), "Both ciphertexts decrypt to the same plaintext");
  });

  test("AEAD tampering resistance: modified ciphertext fails authentication", () => {
    const encrypted = encrypt(samplePrivateKey);
    const parts = encrypted.split(":");
    
    // Tamper with the last byte of the ciphertext hex
    const lastChar = parts[3].slice(-1);
    const tamperedChar = lastChar === "a" ? "b" : "a";
    parts[3] = parts[3].slice(0, -1) + tamperedChar;
    const tampered = parts.join(":");

    assert.throws(
      () => decrypt(tampered),
      /Unsupported state or unable to authenticate data|authentication tag/i,
      "Tampered ciphertext must fail AEAD authentication"
    );
  });

  test("AEAD tampering resistance: modified auth tag fails authentication", () => {
    const encrypted = encrypt(samplePrivateKey);
    const parts = encrypted.split(":");
    
    // Invert the first character of auth tag
    const firstChar = parts[2][0];
    parts[2] = (firstChar === "0" ? "1" : "0") + parts[2].slice(1);
    const tampered = parts.join(":");

    assert.throws(
      () => decrypt(tampered),
      /Unsupported state or unable to authenticate data|authentication tag/i,
      "Tampered auth tag must fail AEAD authentication"
    );
  });

  test("wrong key failure: decrypting with a different secret fails authentication", () => {
    const encrypted = encrypt(samplePrivateKey, "original-secret-key-1234567890123");
    assert.throws(
      () => decrypt(encrypted, "different-wrong-secret-key-999999"),
      /Unsupported state or unable to authenticate data|authentication tag/i,
      "Decryption with incorrect secret must fail authentication"
    );
  });

  test("backward compatibility: decrypts legacy v1 (CBC 3-part salt:iv:ciphertext)", () => {
    // Generate a legacy v1 ciphertext using CBC and scrypt
    const testSecret = process.env.ENCRYPTION_SECRET;
    const salt = "a1b2c3d4e5f60718";
    const key = crypto.scryptSync(testSecret, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let legacyEncrypted = cipher.update(samplePrivateKey, "utf8", "hex");
    legacyEncrypted += cipher.final("hex");
    const legacyPayload = `${salt}:${iv.toString("hex")}:${legacyEncrypted}`;

    const decrypted = decrypt(legacyPayload);
    assert.equal(decrypted, samplePrivateKey, "Legacy v1 CBC format must decrypt successfully");
  });

  test("backward compatibility: decrypts legacy v0 (CBC 2-part iv:ciphertext)", () => {
    // Generate a legacy v0 ciphertext using CBC and static salt
    const testSecret = process.env.ENCRYPTION_SECRET;
    const key = crypto.scryptSync(testSecret, "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let legacyEncrypted = cipher.update(sampleMnemonic, "utf8", "hex");
    legacyEncrypted += cipher.final("hex");
    const legacyPayload = `${iv.toString("hex")}:${legacyEncrypted}`;

    const decrypted = decrypt(legacyPayload);
    assert.equal(decrypted, sampleMnemonic, "Legacy v0 static-salt format must decrypt successfully");
  });

  test("handles null or undefined input gracefully", () => {
    assert.equal(encrypt(null), null);
    assert.equal(decrypt(null), null);
  });

  test("rejects malformed string format", () => {
    assert.throws(
      () => decrypt("not-a-valid-encrypted-string"),
      /Unsupported or corrupted ciphertext format/
    );
  });
});
