const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

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
  skip: (req) => {
    // Log rate limit hits for security monitoring
    return false;
  },
});

// Strict rate limit for signature verification (10 attempts per minute per IP)
const verifyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: "Too many verification attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit (100 requests per minute per IP)
const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: "Too many requests. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * ── CSRF Protection ──
 * 
 * Generate and validate CSRF tokens to prevent cross-site request forgery
 */

// Store CSRF tokens in memory (in production, use Redis or database)
// Format: { token: timestamp }
const csrfTokenStore = new Map();

// Token expiry: 1 hour
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Generate a CSRF token
 * Should be called when user requests the form/page
 */
function generateCSRFToken() {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokenStore.set(token, Date.now());
  
  // Clean up expired tokens every 10 minutes
  if (csrfTokenStore.size > 10000) {
    const now = Date.now();
    for (const [key, timestamp] of csrfTokenStore.entries()) {
      if (now - timestamp > CSRF_TOKEN_EXPIRY) {
        csrfTokenStore.delete(key);
      }
    }
  }
  
  return token;
}

/**
 * Validate CSRF token
 */
function validateCSRFToken(token) {
  if (!token || !csrfTokenStore.has(token)) {
    return false;
  }

  const timestamp = csrfTokenStore.get(token);
  const isValid = Date.now() - timestamp < CSRF_TOKEN_EXPIRY;

  // NOTE: Token is NOT deleted after use — it remains valid until expiry (1 hour).
  // This prevents BUG-5 where the second form submission in a session always
  // fails 403 because the token was already consumed on the first request.
  if (!isValid) {
    csrfTokenStore.delete(token); // Only clean up if expired
  }

  return isValid;
}

/**
 * Middleware to validate CSRF token for POST/PUT/DELETE requests
 */
function csrfProtection(req, res, next) {
  // Skip CSRF check for GET requests
  if (req.method === "GET") {
    return next();
  }

  // Skip CSRF check for auth endpoints (they use signature verification instead)
  if (req.path.includes("/auth")) {
    return next();
  }

  const token = req.headers["x-csrf-token"] || req.body?.csrfToken;

  if (!token) {
    return res.status(403).json({
      error: "CSRF token missing",
      message: "Please include X-CSRF-Token header or csrfToken in request body",
    });
  }

  if (!validateCSRFToken(token)) {
    return res.status(403).json({
      error: "Invalid or expired CSRF token",
    });
  }

  next();
}

/**
 * Endpoint to retrieve CSRF token
 * Frontend should call this before submitting forms
 */
function csrfTokenEndpoint(req, res) {
  const token = generateCSRFToken();
  res.json({ csrfToken: token });
}

module.exports = {
  nonceRateLimiter,
  verifyRateLimiter,
  generalRateLimiter,
  csrfProtection,
  csrfTokenEndpoint,
  generateCSRFToken,
  validateCSRFToken,
};
