const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { securityEvent } = require("./securityLogger");

/**
 * ── Rate Limiting Middlewares ──
 * 
 * Prevent brute-force attacks and DOS attacks on critical endpoints
 */

// Strict rate limit for auth nonce requests (5 requests per minute per IP)
const nonceRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: "Too many nonce requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for signature verification (10 attempts per minute per IP)
const verifyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: "Too many verification attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit (500 requests per minute per IP to accommodate development)
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  message: "Too many requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for private key export (3 requests per 15 minutes per user/IP)
const keyExportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: "Too many key export requests. Please try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ── Stateless Cryptographic CSRF Protection (Horizontally Scalable) ──
 * 
 * Generates and validates HMAC-SHA256 signed stateless CSRF tokens.
 * Works seamlessly across multi-instance clusters, load balancers, and serverless runtimes
 * without in-memory state, shared Redis dependency, or memory leaks.
 */

// ── CSRF Signing Key ──────────────────────────────────────────────────────────
// Fail fast at startup if the required secret is not configured.
// A hardcoded fallback would make CSRF tokens universally forgeable.
const _csrfSecret = process.env.CSRF_SECRET;
if (!_csrfSecret) {
  throw new Error(
    "FATAL: CSRF_SECRET environment variable is not set. " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
    "and add it to your .env file."
  );
}
if (_csrfSecret.length < 32) {
  throw new Error(
    "FATAL: CSRF_SECRET is too short. It must be at least 32 characters. " +
    "Generate a secure one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

function getCsrfSigningKey() {
  // Return the validated secret. Never log or expose it.
  return _csrfSecret;
}

// Token expiry: 1 hour (3600000 ms)
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Generate a cryptographically secure, stateless, HMAC-signed CSRF token
 */
function generateCSRFToken() {
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = Date.now();
  const payload = JSON.stringify({ n: nonce, t: timestamp });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  
  const signature = crypto
    .createHmac("sha256", getCsrfSigningKey())
    .update(encodedPayload)
    .digest("hex");

  return `${encodedPayload}.${signature}`;
}

/**
 * Validate a stateless CSRF token using constant-time signature verification and timestamp check
 */
function validateCSRFToken(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, providedSignature] = parts;
  if (!encodedPayload || !providedSignature) {
    return false;
  }

  // 1. Recompute and verify HMAC signature in constant time
  const expectedSignature = crypto
    .createHmac("sha256", getCsrfSigningKey())
    .update(encodedPayload)
    .digest("hex");

  const providedBuf = Buffer.from(providedSignature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return false;
  }

  // 2. Decode payload and check expiration
  try {
    const payloadStr = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(payloadStr);

    if (!payload.t || typeof payload.t !== "number") {
      return false;
    }

    const now = Date.now();
    // Reject tokens from the future (> 60s clock skew) or older than CSRF_TOKEN_EXPIRY
    if (payload.t > now + 60000 || now - payload.t > CSRF_TOKEN_EXPIRY) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to determine if a request targets the /auth route family.
 * Strictly checks path segment boundaries to prevent false matches (e.g. /authorizations).
 */
function isAuthRoute(req) {
  const checkSegment = (p) => {
    if (!p || typeof p !== "string") return false;
    const clean = p.startsWith("/api") ? p.slice(4) : p;
    return clean === "/auth" || clean.startsWith("/auth/") || clean.startsWith("/auth?");
  };

  return checkSegment(req.path) || checkSegment((req.originalUrl || "").split("?")[0]);
}

/**
 * Middleware to validate CSRF token for state-changing HTTP requests (POST, PUT, PATCH, DELETE)
 */
function csrfProtection(req, res, next) {
  // Skip CSRF check for safe HTTP methods (GET, HEAD, OPTIONS)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for auth endpoints (protected by wallet/OAuth cryptographic signatures)
  if (isAuthRoute(req)) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.body?.csrfToken;

  if (!token) {
    securityEvent("CSRF_REJECTED", req, { reason: "missing_token" });
    return res.status(403).json({
      error: "CSRF token missing",
      message: "Please include X-CSRF-Token header or csrfToken in request body",
    });
  }

  if (!validateCSRFToken(token)) {
    securityEvent("CSRF_REJECTED", req, { reason: "invalid_or_expired" });
    return res.status(403).json({
      error: "Invalid or expired CSRF token",
    });
  }

  // Issue a fresh rotated token in the response header for the client
  const newToken = generateCSRFToken();
  res.set("X-CSRF-Token", newToken);

  next();
}

/**
 * Endpoint handler to issue a fresh CSRF token
 */
function csrfTokenEndpoint(req, res) {
  const token = generateCSRFToken();
  res.json({ csrfToken: token });
}

module.exports = {
  nonceRateLimiter,
  verifyRateLimiter,
  generalRateLimiter,
  keyExportRateLimiter,
  csrfProtection,
  csrfTokenEndpoint,
  generateCSRFToken,
  validateCSRFToken,
};
