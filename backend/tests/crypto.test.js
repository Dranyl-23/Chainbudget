const { test, describe, before } = require("node:test");
const assert = require("node:assert");

// Set ENCRYPTION_SECRET for testing
process.env.ENCRYPTION_SECRET = "0123456789abcdef0123456789abcdef";

const { encrypt, decrypt } = require("../src/utils/crypto");

describe("Crypto Utils — AES-256-GCM v2 Suite", () => {
  test("encrypts and decrypts a standard EVM private key correctly", () => {
    const rawPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const encrypted = encrypt(rawPrivateKey);

    assert.ok(encrypted.startsWith("v2:"), "Encrypted string should use v2 prefix");
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, rawPrivateKey, "Decrypted text must match original plaintext");
  });

  test("encrypts and decrypts a 12-word BIP-39 mnemonic phrase correctly", () => {
    const mnemonic = "test test test test test test test test test test test junk";
    const encrypted = encrypt(mnemonic);

    assert.ok(encrypted.startsWith("v2:"), "Encrypted string should use v2 prefix");
    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, mnemonic, "Decrypted mnemonic must match original phrase");
  });

  test("produces different ciphertexts for the same plaintext due to random IV", () => {
    const secret = "super_secret_payload_123";
    const enc1 = encrypt(secret);
    const enc2 = encrypt(secret);

    assert.notStrictEqual(enc1, enc2, "Ciphertexts must differ due to unique IVs");
    assert.strictEqual(decrypt(enc1), secret);
    assert.strictEqual(decrypt(enc2), secret);
  });

  test("rejects tampered ciphertext with an authentication error", () => {
    const secret = "sensitive_private_key";
    const encrypted = encrypt(secret);
    const parts = encrypted.split(":");
    // Tamper with the ciphertext byte
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("aa") ? "bb" : "aa");
    const tampered = parts.join(":");

    assert.throws(() => {
      decrypt(tampered);
    });
  });

  test("returns empty string or null when attempting to decrypt null or empty input", () => {
    assert.ok(!decrypt("") || decrypt("") === "");
    assert.ok(!decrypt(null) || decrypt(null) === "");
  });
});
