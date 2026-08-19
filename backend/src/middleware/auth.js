const User = require("../models/User");
const { ethers } = require("ethers");
const { encrypt } = require("../utils/crypto");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

// ── JWKS Client (RS256 signature verification) ────────────────────────────────
// Initialised lazily so the module can still be loaded even if ASGARDEO_BASE_URL
// is not yet set (e.g. during unit-test bootstrapping without a full .env).
let _jwksClient = null;

function getJwksClient() {
  if (_jwksClient) return _jwksClient;

  const asgardeoBase =
    process.env.ASGARDEO_BASE_URL || "https://api.asgardeo.io/t/orgs3xfu";

  _jwksClient = jwksClient({
    // Asgardeo publishes signing keys at this well-known endpoint
    jwksUri: `${asgardeoBase}/oauth2/jwks`,
    // Cache keys for 10 minutes; re-fetch when a new kid is seen
    cache: true,
    cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    cacheMaxEntries: 10,
    // Rate-limit JWKS refetch attempts so a flood of bad tokens cannot DDoS the IdP
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    // Connection timeout — fail fast rather than hanging
    timeout: 10000,
  });

  return _jwksClient;
}

/**
 * Retrieve the RSA public key that matches the JWT `kid` header.
 * Returns null if the key cannot be found (unknown kid, network error, etc.).
 */
async function getSigningKey(kid) {
  try {
    const client = getJwksClient();
    const key = await client.getSigningKey(kid);
    return key.getPublicKey();
  } catch (err) {
    // Log at warn level — this fires on every bad token or JWKS outage, so we
    // deliberately avoid console.error to prevent alert fatigue.
    console.warn("[auth] JWKS key retrieval failed:", err.message);
    return null;
  }
}

/**
 * Cryptographically verify a JWT issued by Asgardeo.
 */
async function verifyAsgardeoJWT(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) {
    return null;
  }

  const { kid, alg } = decoded.header;

  if (alg !== "RS256") {
    console.warn("[auth] JWT rejected: unexpected algorithm:", alg);
    return null;
  }

  const publicKey = await getSigningKey(kid);
  if (!publicKey) {
    return null;
  }

  const asgardeoBase =
    process.env.ASGARDEO_BASE_URL || "https://api.asgardeo.io/t/orgs3xfu";
  const expectedIssuer = `${asgardeoBase}/oauth2/token`;
  const clientId = process.env.ASGARDEO_CLIENT_ID;

  const verifyOptions = {
    algorithms: ["RS256"],
    issuer: expectedIssuer,
    ...(clientId ? { audience: clientId } : {}),
  };

  try {
    const payload = jwt.verify(token, publicKey, verifyOptions);
    return payload;
  } catch (err) {
    console.warn("[auth] JWT verification failed:", err.message);
    return null;
  }
}

/**
 * Verify internal ChainBudget JWTs (used for mobile).
 */
function verifyInternalJWT(token) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch (err) {
    console.warn("[auth] Internal JWT verification failed:", err.message);
    return null;
  }
}

// ── Middleware: verify token (ChainBudget mobile JWT OR Asgardeo browser JWT) ──
const checkJwt = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
    }

    const token = authHeader.split(" ")[1];

    // ── Strategy 1: ChainBudget mobile JWT (HS256) ──────────────────────────
    // Issued after wallet challenge-response. Fast — no network call.
    const cbPayload = verifyInternalJWT(token);
    if (cbPayload) {
      req.auth = { ...cbPayload, _source: "chainbudget" };
      return next();
    }

    // ── Strategy 2: Asgardeo RS256 JWT (browser OIDC) ────────────────────────
    if (token.includes(".")) {
      const asgardeoPayload = await verifyAsgardeoJWT(token);
      if (asgardeoPayload) {
        req.auth = { ...asgardeoPayload, _source: "asgardeo" };
        return next();
      }
    }

    // ── Strategy 3: Asgardeo UserInfo endpoint (opaque tokens) ───────────────
    const asgardeoBase =
      process.env.ASGARDEO_BASE_URL || "https://api.asgardeo.io/t/orgs3xfu";
    try {
      const response = await fetch(`${asgardeoBase}/oauth2/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        req.auth = { ...data, _source: "asgardeo" };
        return next();
      }
      console.warn("[auth] Asgardeo UserInfo rejected token, status:", response.status);
    } catch (fetchErr) {
      console.warn("[auth] UserInfo endpoint unreachable:", fetchErr.message);
    }

    console.warn("[auth] All token strategies failed — rejecting");
    return res.status(401).json({ error: "Invalid or unverifiable token" });
  } catch (err) {
    console.error("[auth] Unexpected token validation error:", err.message);
    return res.status(401).json({ error: "Token validation error" });
  }
};

// ── Middleware: attach our User model ─────────────────────────────────────────
const attachUser = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.sub) {
      return res.status(401).json({ error: "Invalid token structure" });
    }

    // ── Path A: ChainBudget mobile JWT — look up by MongoDB _id ─────────────
    if (req.auth._source === "chainbudget") {
      const user = await User.findById(req.auth.sub);
      if (!user) return res.status(401).json({ error: "User not found" });
      if (!user.isActive) return res.status(401).json({ error: "User is inactive" });
      req.user = user;
      return next();
    }

    // ── Path B: Asgardeo JWT — look up or provision by asgardeoId ───────────
    const asgardeoId = req.auth.sub;

    let rawEmail =
      req.auth.email ||
      req.auth.email_address ||
      req.auth.emailAddress ||
      req.auth["http://wso2.org/claims/emailaddress"] ||
      "";
    if (!rawEmail && req.auth.username && req.auth.username.includes("@")) {
      rawEmail = req.auth.username;
    }
    const email = rawEmail.toLowerCase().trim();

    let nameFromToken = req.auth.name || "New User";
    if (nameFromToken === "New User") {
      const givenName = req.auth.given_name || req.auth.firstName || "";
      const familyName =
        req.auth.family_name || req.auth.lastName || req.auth.last_name || "";
      if (givenName || familyName) {
        nameFromToken = `${givenName} ${familyName}`.trim();
      } else if (req.auth.preferred_username) {
        nameFromToken = req.auth.preferred_username;
      }
    }
    const pictureFromToken =
      req.auth.picture ||
      req.auth.profileUrl ||
      req.auth.profile_url ||
      req.auth["http://wso2.org/claims/profileurl"] ||
      req.auth["http://wso2.org/claims/picture"] ||
      "";

    let user = await User.findOne({ asgardeoId });

    if (!user && email) {
      user = await User.findOne({ email });
      if (user) {
        user.asgardeoId = asgardeoId;
        if (user.displayName === "New User" && nameFromToken !== "New User") {
          user.displayName = nameFromToken;
        }
        if (pictureFromToken && !user.avatarUrl) {
          user.avatarUrl = pictureFromToken;
        }

        if (!user.walletAddress) {
          const wallet = ethers.Wallet.createRandom();
          user.walletAddress = wallet.address;
          user.encryptedPrivateKey = encrypt(wallet.privateKey);
          user.encryptedMnemonic = encrypt(wallet.mnemonic.phrase);
        }

        await user.save();
      }
    }

    if (!user) {
      const wallet = ethers.Wallet.createRandom();
      const encryptedPrivateKey = encrypt(wallet.privateKey);
      const encryptedMnemonic = encrypt(wallet.mnemonic.phrase);

      user = new User({
        asgardeoId,
        email,
        displayName: nameFromToken,
        avatarUrl: pictureFromToken,
        walletAddress: wallet.address,
        encryptedPrivateKey,
        encryptedMnemonic,
      });
      try {
        await user.save();
      } catch (saveErr) {
        if (saveErr.code === 11000) {
          user = await User.findOne({ asgardeoId });
        } else {
          throw saveErr;
        }
      }
    } else {
      let updated = false;
      if (!user.email && email) {
        user.email = email;
        updated = true;
      }
      if (nameFromToken !== "New User" && user.displayName !== nameFromToken) {
        user.displayName = nameFromToken;
        updated = true;
      }
      if (pictureFromToken && user.avatarUrl !== pictureFromToken) {
        if (!user.avatarUrl || user.avatarUrl.includes("googleusercontent")) {
          user.avatarUrl = pictureFromToken;
          updated = true;
        }
      }
      if (updated) {
        await user.save();
      }
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

/** Optional authentication: attaches req.user if a valid token is provided, otherwise proceeds as guest */
const optionalAuthenticate = async (req, res, next) => {
  if (!req.headers.authorization) {
    return next();
  }
  checkJwt(req, res, (jwtErr) => {
    if (jwtErr) return next();
    attachUser(req, res, (attachErr) => {
      next();
    });
  });
};

const requireRole = (maxLevel) => async (req, res, next) => {
  if (req.user.isSuperAdmin) return next();

  const orgId =
    req.params.orgId || req.body?.organizationId || req.query.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "Organization ID is required" });
  }

  const roleLevel = req.user.getRoleInOrg(orgId);
  if (roleLevel === null) {
    return res
      .status(403)
      .json({ error: "Not a member of this organization" });
  }

  if (roleLevel > maxLevel) {
    return res.status(403).json({
      error: `Access denied. Requires role level ${maxLevel} or above.`,
    });
  }

  req.roleLevel = roleLevel;
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user.isSuperAdmin) {
    return res.status(403).json({ error: "Super Admin access required" });
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireSuperAdmin,
  verifyChainBudgetJWT: verifyInternalJWT,
  verifyInternalJWT,
};
