/**
 * Tests: JWT Authentication Middleware (Fix 1 — HIGH)
 *
 * Verifies that checkJwt uses cryptographic RS256 signature verification
 * and never falls back to trusting an unverified JWT payload.
 *
 * Run: node --test tests/auth.middleware.test.js
 *      (Node.js built-in test runner, no additional test framework needed)
 */

"use strict";

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Helpers ─────────────────────────────────────────────────────────────────

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/**
 * Generate an RSA key pair for testing so we do not need a live Asgardeo IdP.
 */
function generateRSAKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
}

/**
 * Create a minimal JWT with the given overrides.
 */
function makeToken(privateKey, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "asgardeo|test-user-001",
    email: "test@example.com",
    name: "Test User",
    iss: "https://api.asgardeo.io/t/testorg/oauth2/token",
    aud: "test-client-id",
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    keyid: "test-kid-1",
    ...overrides._signOptions,
  });
}

// ── Mocking approach ─────────────────────────────────────────────────────────
// We mock the jwks-rsa module by overriding the module cache so the middleware
// uses our in-memory test key without making real network requests.

const Module = require("module");
const originalLoad = Module._load;

let _mockPublicKey = null;
let _mockShouldFail = false;

// Override require("jwks-rsa") globally for this test file.
Module._load = function (request, parent, isMain) {
  if (request === "jwks-rsa") {
    return function jwksClientMock() {
      return {
        getSigningKey: async (kid) => {
          if (_mockShouldFail) {
            throw new Error("JWKS endpoint unreachable (simulated)");
          }
          if (!_mockPublicKey) {
            throw new Error("Key not found for kid: " + kid);
          }
          return { getPublicKey: () => _mockPublicKey };
        },
      };
    };
  }
  return originalLoad.apply(this, arguments);
};

// Also stub out User and crypto utils for attachUser so we can isolate checkJwt.
Module._load = (function (original) {
  return function (request, parent, isMain) {
    if (request === "jwks-rsa") {
      return function jwksClientMock() {
        return {
          getSigningKey: async (kid) => {
            if (_mockShouldFail) {
              throw new Error("JWKS endpoint unreachable (simulated)");
            }
            if (!_mockPublicKey) {
              throw new Error("Key not found for kid: " + kid);
            }
            return { getPublicKey: () => _mockPublicKey };
          },
        };
      };
    }
    return original.apply(this, arguments);
  };
})(Module._load);

// Minimal User stub
const userStub = {
  findOne: async () => ({
    _id: "test-user-id",
    asgardeoId: "asgardeo|test-user-001",
    email: "test@example.com",
    displayName: "Test User",
    walletAddress: "0xtest",
    isActive: true,
    memberships: [],
    getRoleInOrg: () => 1,
    save: async () => {},
  }),
};

Module._load = (function (original) {
  return function (request, parent, isMain) {
    if (request === "jwks-rsa") {
      return function jwksClientMock() {
        return {
          getSigningKey: async (kid) => {
            if (_mockShouldFail) {
              throw new Error("JWKS endpoint unreachable (simulated)");
            }
            if (!_mockPublicKey) {
              throw new Error("Key not found for kid: " + kid);
            }
            return { getPublicKey: () => _mockPublicKey };
          },
        };
      };
    }
    // Stub out Mongoose models so we do not need a live DB
    if (request && request.includes("models/User")) {
      return userStub;
    }
    if (request && request.includes("utils/crypto")) {
      return { encrypt: (v) => "enc:" + v };
    }
    return original.apply(this, arguments);
  };
})(Module._load);

// ── Load middleware under test ────────────────────────────────────────────────

// Must load AFTER the Module._load override
process.env.ASGARDEO_BASE_URL = "https://api.asgardeo.io/t/testorg";
process.env.ASGARDEO_CLIENT_ID = "test-client-id";
process.env.CSRF_SECRET = crypto.randomBytes(32).toString("hex");
process.env.ENCRYPTION_SECRET = "test-encryption-secret-12345678";

// Delete cached version so it picks up our mocks
delete require.cache[require.resolve("../src/middleware/auth")];

const { authenticate } = require("../src/middleware/auth");
const [checkJwtMiddleware] = authenticate; // checkJwt is the first middleware

/**
 * Helper: run checkJwt against a synthetic request and return the result.
 */
async function runCheckJwt(token) {
  const req = {
    headers: {
      authorization: token ? `Bearer ${token}` : undefined,
    },
  };
  let statusCode = null;
  let responseBody = null;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  // Disable UserInfo endpoint (simulate Asgardeo unreachable so only JWKS path runs)
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 401 });

  try {
    await checkJwtMiddleware(req, res, next);
  } finally {
    global.fetch = originalFetch;
  }

  return { req, statusCode, responseBody, nextCalled };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("JWT Authentication Middleware — checkJwt", () => {
  let { privateKey, publicKey } = generateRSAKeyPair();

  before(() => {
    _mockPublicKey = publicKey;
    _mockShouldFail = false;
  });

  it("allows a valid RS256 token signed with the correct key", async () => {
    const token = makeToken(privateKey);
    const { nextCalled, statusCode } = await runCheckJwt(token);
    assert.equal(nextCalled, true, "next() should be called for valid token");
    assert.equal(statusCode, null, "no error status should be set");
  });

  it("rejects a token with an invalid signature (tampered payload)", async () => {
    // Build a valid token, then swap the payload with a different one
    const validToken = makeToken(privateKey);
    const parts = validToken.split(".");
    // Replace the payload with a forged one (different sub)
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "attacker|000", iss: "https://api.asgardeo.io/t/testorg/oauth2/token", aud: "test-client-id", exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

    const { nextCalled, statusCode } = await runCheckJwt(tamperedToken);
    assert.equal(nextCalled, false, "next() must NOT be called for tampered token");
    assert.equal(statusCode, 401);
  });

  it("rejects an expired token", async () => {
    const token = makeToken(privateKey, {
      exp: Math.floor(Date.now() / 1000) - 10, // already expired
    });
    const { nextCalled, statusCode } = await runCheckJwt(token);
    assert.equal(nextCalled, false, "next() must NOT be called for expired token");
    assert.equal(statusCode, 401);
  });

  it("rejects a token with an invalid issuer", async () => {
    const token = makeToken(privateKey, {
      iss: "https://evil.attacker.io/oauth2/token",
    });
    const { nextCalled, statusCode } = await runCheckJwt(token);
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
  });

  it("rejects a token with an invalid audience", async () => {
    const token = makeToken(privateKey, {
      aud: "some-other-client",
    });
    const { nextCalled, statusCode } = await runCheckJwt(token);
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
  });

  it("rejects a token using an unsupported algorithm (HS256)", async () => {
    // HS256 with a shared secret — must NOT be accepted regardless of payload validity
    const hs256Token = jwt.sign(
      {
        sub: "attacker|000",
        iss: "https://api.asgardeo.io/t/testorg/oauth2/token",
        aud: "test-client-id",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      "any-shared-secret",
      { algorithm: "HS256", keyid: "test-kid-1" }
    );
    const { nextCalled, statusCode } = await runCheckJwt(hs256Token);
    assert.equal(nextCalled, false, "HS256 tokens must be rejected");
    assert.equal(statusCode, 401);
  });

  it("rejects a token when JWKS is unavailable and there is no cached key", async () => {
    _mockShouldFail = true; // simulate JWKS network failure

    const token = makeToken(privateKey);
    const { nextCalled, statusCode } = await runCheckJwt(token);
    assert.equal(nextCalled, false, "Must reject when JWKS is unreachable and no cached key");
    assert.equal(statusCode, 401);

    _mockShouldFail = false; // restore
  });

  it("rejects a request with no Authorization header", async () => {
    const { nextCalled, statusCode, responseBody } = await runCheckJwt(null);
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
    assert.ok(responseBody.error.includes("Missing"));
  });

  it("does NOT expose jwt.decode payload trust path (fail-secure verification)", async () => {
    // A crafted 'token' that is parseable as JWT but has no valid signature.
    // The middleware must reject it rather than trusting the decoded payload.
    const fakePayload = Buffer.from(
      JSON.stringify({
        sub: "attacker|escalation",
        exp: Math.floor(Date.now() / 1000) + 9999,
        iss: "https://api.asgardeo.io/t/testorg/oauth2/token",
        aud: "test-client-id",
        alg: "RS256",
      })
    ).toString("base64url");
    const fakeHeader = Buffer.from(
      JSON.stringify({ alg: "RS256", kid: "test-kid-1", typ: "JWT" })
    ).toString("base64url");
    const unsignedToken = `${fakeHeader}.${fakePayload}.invalidsignature`;

    const { nextCalled, statusCode } = await runCheckJwt(unsignedToken);
    assert.equal(nextCalled, false, "Must not trust an unsigned / forged token");
    assert.equal(statusCode, 401);
  });
});
