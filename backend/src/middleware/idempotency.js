/**
 * idempotency.js
 *
 * Middleware to intercept duplicate API requests and prevent double spending / double submission.
 * Validates 'x-idempotency-key' header and returns cached response if repeated within TTL window.
 */

const IdempotencyKey = require("../models/IdempotencyKey");

const requireIdempotency = async (req, res, next) => {
  const key =
    req.headers["x-idempotency-key"] ||
    req.headers["idempotency-key"] ||
    (req.body && req.body.idempotencyKey);

  // If no idempotency key provided by client, proceed normally
  if (!key || !req.user || !req.user._id) {
    return next();
  }

  try {
    const existing = await IdempotencyKey.findOne({
      key: key.toString().trim(),
      user: req.user._id,
    });

    if (existing) {
      console.log(
        `[Idempotency] Intercepted duplicate request for key: "${key}" by user: ${req.user._id}. Returning cached response.`
      );
      res.set("X-Cache-Lookup", "HIT - Idempotency Cache");
      return res.status(existing.responseStatus).json(existing.responseBody);
    }

    // Intercept res.json to capture response for successful creation (2xx status codes)
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        IdempotencyKey.create({
          key: key.toString().trim(),
          user: req.user._id,
          path: req.originalUrl || req.path,
          responseStatus: res.statusCode,
          responseBody: body,
        }).catch((saveErr) => {
          // Silent catch if duplicate key inserted concurrently
        });
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error("[Idempotency] Middleware error:", err.message);
    next();
  }
};

module.exports = { requireIdempotency };
