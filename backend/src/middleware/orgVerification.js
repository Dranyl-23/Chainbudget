"use strict";

const Organization = require("../models/Organization");

/**
 * Resolves the Organization model instance for the current request.
 * Checks params, body, query, or pre-attached req.organization.
 */
async function resolveOrganization(req) {
  if (req.organization && typeof req.organization === "object") {
    return req.organization;
  }

  const orgId =
    req.params?.orgId ||
    req.params?.id ||
    req.body?.organizationId ||
    req.body?.organization ||
    req.query?.orgId;

  if (!orgId) return null;

  try {
    const org = await Organization.findById(orgId);
    if (org) {
      req.organization = org;
    }
    return org;
  } catch {
    return null;
  }
}

/**
 * Middleware: requireVerifiedOrg
 * Ensures the target organization has verified legitimacy status.
 *
 * Rules:
 * - "verified": Access granted.
 * - "legacy_unverified":
 *     - If ORG_VERIFICATION_ENFORCE_LEGACY is "true", returns 403 Forbidden.
 *     - Otherwise, permits request during grace period and sets X-Org-Verification header.
 * - "revoked": Returns 403 Forbidden with revocation reason.
 * - "pending" or missing: Returns 403 Forbidden.
 */
async function requireVerifiedOrg(req, res, next) {
  const org = await resolveOrganization(req);

  // If no org was specified or found, let downstream route handle 400/404
  if (!org) {
    return next();
  }

  const verification = org.verification || { status: "legacy_unverified" };
  const status = verification.status || "legacy_unverified";

  if (status === "verified") {
    return next();
  }

  if (status === "legacy_unverified") {
    const enforceLegacy = process.env.ORG_VERIFICATION_ENFORCE_LEGACY === "true";
    if (enforceLegacy) {
      return res.status(403).json({
        error: "ORGANIZATION_VERIFICATION_REQUIRED",
        message:
          "This organization is currently unverified (legacy). Complete the verification process to execute this action.",
        legacy: true,
      });
    }

    res.setHeader("X-Org-Verification", "legacy_unverified");
    return next();
  }

  if (status === "revoked") {
    return res.status(403).json({
      error: "ORGANIZATION_VERIFICATION_REVOKED",
      message: "Organization legitimacy verification has been revoked.",
      reason: verification.revocationReason || "Revoked by platform administrator",
    });
  }

  return res.status(403).json({
    error: "ORGANIZATION_VERIFICATION_REQUIRED",
    message: "This action requires verified organization legitimacy status.",
    status,
  });
}

module.exports = {
  resolveOrganization,
  requireVerifiedOrg,
};
