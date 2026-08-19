/**
 * Tests: CSRF Security Middleware (Fix 3 — MEDIUM)
 *
 * Verifies that:
 *  - The module throws at startup when CSRF_SECRET is missing or too short.
 *  - CSRF token generation and validation work correctly with a configured secret.
 *  - The hardcoded fallback key no longer exists.
 *
 * Run: node --test tests/csrf.security.test.js
 */

"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SECURITY_MODULE_PATH = path.resolve(__dirname, "../src/middleware/security");

/**
 * Load a fresh copy of the security module with the given env vars.
 * Returns the module exports or the thrown error.
 */
function loadSecurityModule(envOverrides = {}) {
  // Purge the module cache so we load a fresh instance with new env vars
  delete require.cache[SECURITY_MODULE_PATH];

  const originalEnv = { ...process.env };

  // Remove any existing CSRF_SECRET before applying overrides
  delete process.env.CSRF_SECRET;
  Object.assign(process.env, envOverrides);

  let result = null;
  let error = null;
  try {
    result = require(SECURITY_MODULE_PATH);
  } catch (err) {
    error = err;
  } finally {
    // Restore env
    Object.keys(envOverrides).forEach((k) => delete process.env[k]);
    Object.assign(process.env, originalEnv);

    // Clean up the (potentially broken) module cache entry
    delete require.cache[SECURITY_MODULE_PATH];
  }

  return { result, error };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CSRF Security Middleware — Fix 3: No Hardcoded Fallback Secret", () => {

  it("throws FATAL error when CSRF_SECRET is not set", () => {
    const { result, error } = loadSecurityModule(); // no CSRF_SECRET
    assert.ok(error, "Should throw when CSRF_SECRET is missing");
    assert.match(error.message, /CSRF_SECRET/, "Error must mention CSRF_SECRET");
    assert.match(error.message, /FATAL/, "Error must be marked FATAL");
    assert.equal(result, null, "Module must not load without CSRF_SECRET");
  });

  it("throws FATAL error when CSRF_SECRET is shorter than 32 characters", () => {
    const { result, error } = loadSecurityModule({ CSRF_SECRET: "tooshort" });
    assert.ok(error, "Should throw for short CSRF_SECRET");
    assert.match(error.message, /too short|32 char/i, "Error must mention minimum length");
    assert.equal(result, null);
  });

  it("loads successfully with a CSRF_SECRET of exactly 32+ characters", () => {
    const strongSecret = "a".repeat(32); // exactly 32 chars
    const { result, error } = loadSecurityModule({ CSRF_SECRET: strongSecret });
    assert.equal(error, null, `Should not throw: ${error?.message}`);
    assert.ok(result, "Module must export successfully");
  });

  it("loads successfully with a hex-encoded 64-char secret", () => {
    const { randomBytes } = require("crypto");
    const hexSecret = randomBytes(32).toString("hex"); // 64 chars
    const { result, error } = loadSecurityModule({ CSRF_SECRET: hexSecret });
    assert.equal(error, null);
    assert.ok(result?.generateCSRFToken, "Should export generateCSRFToken");
    assert.ok(result?.validateCSRFToken, "Should export validateCSRFToken");
  });

  it("does NOT contain the hardcoded fallback key anywhere in source", () => {
    const fs = require("fs");
    const source = fs.readFileSync(SECURITY_MODULE_PATH + ".js", "utf8");
    assert.ok(
      !source.includes("cb_csrf_secure_fallback_key_2026"),
      "Hardcoded fallback key must be removed from source"
    );
  });

  describe("CSRF Token Generation and Validation with configured secret", () => {
    let csrfMod;

    before(() => {
      const { randomBytes } = require("crypto");
      const secret = randomBytes(32).toString("hex");
      const { result } = loadSecurityModule({ CSRF_SECRET: secret });
      csrfMod = result;
    });

    it("generateCSRFToken returns a non-empty string", () => {
      const token = csrfMod.generateCSRFToken();
      assert.ok(typeof token === "string" && token.length > 0);
    });

    it("generateCSRFToken returns tokens with base64url.hexsig format", () => {
      const token = csrfMod.generateCSRFToken();
      const parts = token.split(".");
      assert.equal(parts.length, 2, "Token must have exactly 2 parts separated by '.'");
      assert.ok(parts[0].length > 0, "Payload part must not be empty");
      assert.ok(parts[1].length > 0, "Signature part must not be empty");
    });

    it("validateCSRFToken returns true for a freshly generated token", () => {
      const token = csrfMod.generateCSRFToken();
      assert.equal(csrfMod.validateCSRFToken(token), true);
    });

    it("validateCSRFToken returns false for a tampered token (signature changed)", () => {
      const token = csrfMod.generateCSRFToken();
      const [payload] = token.split(".");
      const tampered = `${payload}.0000000000000000000000000000000000000000000000000000000000000000`;
      assert.equal(csrfMod.validateCSRFToken(tampered), false);
    });

    it("validateCSRFToken returns false for a token with a tampered payload", () => {
      const token = csrfMod.generateCSRFToken();
      const [, sig] = token.split(".");
      const forgedPayload = Buffer.from(JSON.stringify({ n: "evil", t: Date.now() })).toString("base64url");
      assert.equal(csrfMod.validateCSRFToken(`${forgedPayload}.${sig}`), false);
    });

    it("validateCSRFToken returns false for null/undefined/empty", () => {
      assert.equal(csrfMod.validateCSRFToken(null), false);
      assert.equal(csrfMod.validateCSRFToken(undefined), false);
      assert.equal(csrfMod.validateCSRFToken(""), false);
    });

    it("different calls produce unique tokens (nonce)", () => {
      const t1 = csrfMod.generateCSRFToken();
      const t2 = csrfMod.generateCSRFToken();
      assert.notEqual(t1, t2, "Each generated token must be unique");
    });
  });

  describe("CSRF Middleware Route-Anchoring & Exemption Logic", () => {
    let csrfMod;

    before(() => {
      const { randomBytes } = require("crypto");
      const secret = randomBytes(32).toString("hex");
      const { result } = loadSecurityModule({ CSRF_SECRET: secret });
      csrfMod = result;
    });

    function runMiddleware(req) {
      let nextCalled = false;
      let statusCode = null;
      let responseBody = null;
      let headers = {};

      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
        set(k, v) {
          headers[k] = v;
          return this;
        },
      };

      const next = () => {
        nextCalled = true;
      };

      csrfMod.csrfProtection(req, res, next);
      return { nextCalled, statusCode, responseBody, headers };
    }

    it("exempts safe HTTP methods (GET, HEAD, OPTIONS)", () => {
      const { nextCalled } = runMiddleware({ method: "GET", path: "/transactions", headers: {} });
      assert.equal(nextCalled, true, "GET requests must skip CSRF");
    });

    it("exempts exact /api/auth routes", () => {
      const r1 = runMiddleware({ method: "POST", path: "/auth/token", originalUrl: "/api/auth/token", headers: {} });
      assert.equal(r1.nextCalled, true, "/api/auth/token must skip CSRF");

      const r2 = runMiddleware({ method: "POST", path: "/api/auth/nonce", originalUrl: "/api/auth/nonce", headers: {} });
      assert.equal(r2.nextCalled, true, "/api/auth/nonce must skip CSRF");
    });

    it("strictly requires CSRF token for substring collisions like /api/authorizations", () => {
      const r1 = runMiddleware({
        method: "POST",
        path: "/authorizations",
        originalUrl: "/api/authorizations",
        headers: {},
        body: {},
      });
      assert.equal(r1.nextCalled, false, "/api/authorizations must NOT skip CSRF");
      assert.equal(r1.statusCode, 403);
      assert.equal(r1.responseBody?.error, "CSRF token missing");
    });

    it("strictly requires CSRF token for routes containing 'auth' in other segments", () => {
      const r1 = runMiddleware({
        method: "POST",
        path: "/users/author-profile",
        originalUrl: "/api/users/author-profile",
        headers: {},
        body: {},
      });
      assert.equal(r1.nextCalled, false, "/api/users/author-profile must require CSRF");
      assert.equal(r1.statusCode, 403);
    });

    it("accepts valid CSRF token on protected non-auth routes", () => {
      const validToken = csrfMod.generateCSRFToken();
      const r1 = runMiddleware({
        method: "POST",
        path: "/transactions",
        originalUrl: "/api/transactions",
        headers: { "x-csrf-token": validToken },
        body: {},
      });
      assert.equal(r1.nextCalled, true, "Valid CSRF token must allow request");
      assert.ok(r1.headers["X-CSRF-Token"], "Must issue rotated CSRF token in response header");
    });
  });
});

