const jwt = require("jsonwebtoken");
const User = require("../models/User");

/// Middleware to verify JWT and attach the user to req.user
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-nonce");
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/// Middleware factory: require a minimum role level in a specific org
/// Usage: requireRole(1) → only Level 1 (Executive Approver) or Super Admin
/// Usage: requireRole(2) → Level 1 or Level 2 or Super Admin
const requireRole = (maxLevel) => async (req, res, next) => {
  if (req.user.isSuperAdmin) return next();

  const orgId = req.params.orgId || req.body.organizationId || req.query.orgId;
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
