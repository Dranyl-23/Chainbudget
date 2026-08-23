const { test, describe } = require("node:test");
const assert = require("node:assert");

process.env.CSRF_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const { generateCSRFToken, validateCSRFToken } = require("../src/middleware/security");

describe("Security Middleware — CSRF & Token Suite", () => {
  test("generates and verifies a valid CSRF token", () => {
    const token = generateCSRFToken();

    assert.ok(typeof token === "string" && token.length > 20, "CSRF token must be a non-empty string");
    const isValid = validateCSRFToken(token);
    assert.strictEqual(isValid, true, "Valid CSRF token must verify successfully");
  });

  test("rejects malformed or forged CSRF tokens", () => {
    assert.strictEqual(validateCSRFToken("forged.token.here"), false);
    assert.strictEqual(validateCSRFToken(""), false);
    assert.strictEqual(validateCSRFToken(null), false);
    assert.strictEqual(validateCSRFToken(undefined), false);
  });
});

