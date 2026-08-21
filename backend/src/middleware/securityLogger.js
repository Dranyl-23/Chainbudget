/**
 * securityLogger.js
 *
 * Structured JSON security event logger for ChainBudget.
 * Emits machine-parseable log entries for security-relevant events:
 *   - Failed authentication attempts
 *   - CSRF token rejections
 *   - Rate limit triggers
 *   - Privilege escalation attempts
 *   - Sensitive data access (key exports)
 *
 * Output is JSON — compatible with Fly.io log drains, Datadog, Grafana Loki,
 * or any structured log aggregation pipeline.
 */

/**
 * Emit a structured security event to stdout (JSON).
 *
 * @param {"AUTH_FAILURE"|"CSRF_REJECTED"|"RATE_LIMITED"|"PRIVILEGE_ESCALATION"|"CORS_BLOCKED"|"KEY_EXPORT"|"UPLOAD_REJECTED"|"SUSPICIOUS_INPUT"} event
 * @param {import("express").Request} req
 * @param {Object} [details]
 */
function securityEvent(event, req, details = {}) {
  const entry = {
    type: "SECURITY_EVENT",
    event,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress || "unknown",
    method: req.method,
    path: req.originalUrl || req.path,
    userAgent: req.headers?.["user-agent"] || "unknown",
    userId: req.user?._id?.toString() || req.auth?.sub || "anonymous",
    ...details,
  };

  // Use console.warn for security events — separates from morgan request logs
  console.warn(JSON.stringify(entry));
}

module.exports = { securityEvent };
