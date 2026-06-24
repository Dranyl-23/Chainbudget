const User = require("../models/User");

// Middleware to verify Asgardeo Token (works for both JWT and Opaque)
const checkJwt = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];
    
    // Call Asgardeo userinfo endpoint to validate the token
    const response = await fetch("https://api.asgardeo.io/t/orgs3xfu/oauth2/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      console.warn("Asgardeo userinfo rejected the token:", response.status);
      return res.status(401).json({ error: "Invalid token" });
    }

    const data = await response.json();
    req.auth = data;
    next();
  } catch (err) {
    console.error("Token validation failed:", err.message);
    return res.status(401).json({ error: "Token validation error" });
  }
};

// Middleware to attach our User model based on Asgardeo sub claim
const attachUser = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.sub) {
      return res.status(401).json({ error: "Invalid token structure" });
    }

    const asgardeoId = req.auth.sub;
    let user = await User.findOne({ asgardeoId });
    
    // Auto-create user on first login from Asgardeo if they don't exist
    if (!user) {
      user = new User({ 
        asgardeoId, 
        email: req.auth.email || "", 
        displayName: req.auth.given_name || "New User" 
      });
      await user.save();
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "User is inactive" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Attach user error:", err);
    return res.status(500).json({ error: "Failed to load user profile" });
  }
};

const authenticate = [checkJwt, attachUser];

/// Middleware factory: require a minimum role level in a specific org
/// Usage: requireRole(1) → only Level 1 (Executive Approver) or Super Admin
/// Usage: requireRole(2) → Level 1 or Level 2 or Super Admin
const requireRole = (maxLevel) => async (req, res, next) => {
  if (req.user.isSuperAdmin) return next();

  const orgId = req.params.orgId || req.body?.organizationId || req.query.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  const roleLevel = req.user.getRoleInOrg(orgId);
  if (roleLevel === null) {
    return res.status(403).json({ error: "Not a member of this organization" });
  }

  // Lower number = higher privilege (1 = Executive Approver)
  if (roleLevel > maxLevel) {
    return res.status(403).json({
      error: `Access denied. Requires role level ${maxLevel} or above.`,
    });
  }

  req.roleLevel = roleLevel;
  next();
};

/// Middleware: Super Admin only
const requireSuperAdmin = (req, res, next) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
};

module.exports = { authenticate, requireRole, requireSuperAdmin };
