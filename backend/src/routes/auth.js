const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { decrypt } = require("../utils/crypto");
const { authenticate } = require("../middleware/auth");
const {
  nonceRateLimiter,
  verifyRateLimiter,
  keyExportRateLimiter,
  generateCSRFToken,
} = require("../middleware/security");

// Helper to validate Ethereum address format
function isValidEthereumAddress(address) {
  return ethers.isAddress(address);
}

/// GET /api/auth/csrf-token
router.get("/csrf-token", (req, res) => {
  const token = generateCSRFToken();
  res.json({ csrfToken: token });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE WEB3 AUTH ENDPOINTS (no Asgardeo required)
// ═══════════════════════════════════════════════════════════════════════════════

/// POST /api/auth/register
/// Registers a new user via embedded wallet (mobile). No Asgardeo required.
/// Also handles Level 1/2 users who already have a browser (Asgardeo) account —
/// their mobile wallet becomes the primary wallet, browser login continues to work.
/// Body: { walletAddress, publicKey, displayName, email }
router.post("/register", verifyRateLimiter, async (req, res) => {
  try {
    const { walletAddress, publicKey, displayName, email } = req.body;

    if (!walletAddress || !displayName) {
      return res.status(400).json({ error: "walletAddress and displayName are required" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email address is required" });
    }
    if (!isValidEthereumAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    const addr = walletAddress.toLowerCase();

    // Check if this exact wallet address is already registered
    let user = await User.findOne({ walletAddress: addr });
    if (user) {
      if (user.asgardeoId) {
        // This wallet is already linked to a browser account — just confirm login
        return res.json({ message: "Wallet already linked to account", userId: user._id });
      }
      // Invite stub — complete the registration
      user.displayName = displayName;
      if (publicKey) user.publicKey = publicKey;
      user.walletType = "embedded_bip44";
      await user.save();
      return res.status(201).json({ message: "Registration successful", userId: user._id });
    }

    // Check for an existing account by email (covers Level 1/2 browser users and invite stubs)
    if (email) {
      const emailUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (emailUser) {
        // ── Case A: Asgardeo browser user linking their mobile wallet ────────
        // They already have a server-generated wallet — replace it with their
        // personal non-custodial mobile wallet. The asgardeoId is preserved so
        // browser login via Asgardeo continues to work unchanged.
        if (emailUser.asgardeoId) {
          emailUser.walletAddress = addr;
          if (publicKey) emailUser.publicKey = publicKey;
          emailUser.walletType = "embedded_bip44";
          emailUser.walletVersion = 1;
          // Clear old server-held keys — no longer needed (non-custodial now)
          emailUser.encryptedPrivateKey = undefined;
          emailUser.encryptedMnemonic = undefined;
          await emailUser.save();
          return res.json({
            message: "Mobile wallet linked to your existing account. You can now sign in on both browser and mobile.",
            userId: emailUser._id,
          });
        }

        // ── Case B: Invite stub (no asgardeoId, no wallet yet) ───────────────
        if (!emailUser.walletAddress) {
          emailUser.walletAddress = addr;
          emailUser.displayName = displayName;
          if (publicKey) emailUser.publicKey = publicKey;
          emailUser.walletType = "embedded_bip44";
          await emailUser.save();
          return res.json({ message: "Wallet linked to existing account", userId: emailUser._id });
        }

        // ── Case C: Email taken by a fully registered mobile user ────────────
        return res.status(409).json({
          error: "An account with this email already exists with a different wallet.",
        });
      }
    }

    // Brand new user (Level 3/4 — mobile only)
    user = new User({
      walletAddress: addr,
      publicKey: publicKey || undefined,
      displayName,
      email: email ? email.toLowerCase().trim() : undefined,
      walletType: "embedded_bip44",
      walletVersion: 1,
    });

    await user.save();
    res.status(201).json({ message: "Registration successful", userId: user._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Wallet address or email already registered" });
    }
    console.error("[auth/register]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/auth/nonce/:walletAddress
/// Public endpoint — no auth required. Issues a one-time login challenge.
/// Rate limited to prevent brute force.
router.get("/nonce/:walletAddress", nonceRateLimiter, async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    const user = await User.findOne({ walletAddress: wallet });
    if (!user) {
      return res.status(404).json({ error: "Wallet not registered. Please register first." });
    }

    // Generate a cryptographically random nonce with timestamp for replay protection
    const randomHex = require("crypto").randomBytes(32).toString("hex");
    const nonce = `ChainBudget Auth [${Date.now()}]: ${randomHex}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    user.nonce = nonce;
    user.nonceExpiresAt = expiresAt;
    await user.save();

    res.json({ nonce, expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/auth/verify-signature
/// Verifies an ECDSA signature over the nonce and issues a ChainBudget JWT.
/// Body: { walletAddress, signature }
router.post("/verify-signature", verifyRateLimiter, async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({ error: "walletAddress and signature are required" });
    }
    if (!isValidEthereumAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    const addr = walletAddress.toLowerCase();
    const user = await User.findOne({ walletAddress: addr });

    if (!user) {
      return res.status(404).json({ error: "Wallet not registered" });
    }
    if (!user.nonce) {
      return res.status(400).json({ error: "No challenge found. Request a nonce first." });
    }

    // Check nonce has not expired
    if (user.nonceExpiresAt && new Date() > user.nonceExpiresAt) {
      user.nonce = null;
      user.nonceExpiresAt = null;
      await user.save();
      return res.status(401).json({ error: "Challenge expired. Request a new nonce." });
    }

    // Verify ECDSA signature — recover signer address from nonce + signature
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(user.nonce, signature);
    } catch (verifyErr) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    if (recoveredAddress.toLowerCase() !== addr) {
      return res.status(401).json({ error: "Signature does not match wallet address" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Account is inactive" });
    }

    // Consume the nonce immediately to prevent replay attacks
    user.nonce = null;
    user.nonceExpiresAt = null;
    user.lastLogin = new Date();
    user.lastAuthenticatedAt = new Date();
    await user.save();

    // Issue a short-lived ChainBudget application JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const token = require("jsonwebtoken").sign(
      {
        sub: user._id.toString(),
        wallet: addr,
        iss: "chainbudget-api",
      },
      jwtSecret,
      { algorithm: "HS256", expiresIn: "24h" }
    );

    await user.populate("memberships.organization", "name type logoUrl");

    res.json({
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        memberships: user.memberships,
        isSuperAdmin: user.isSuperAdmin,
        hasBackedUpPhrase: user.hasBackedUpPhrase,
      },
    });
  } catch (err) {
    console.error("[auth/verify-signature]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING ASGARDEO-BASED ENDPOINTS (browser — unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

/// GET /api/auth/validate — Validate if stored token is still valid
router.get("/validate", authenticate, (req, res) => {
  res.json({ valid: true, userId: req.user._id });
});

/// POST /api/auth/confirm-backup
/// Called from mobile after the user confirms they saved their recovery phrase.
/// Sets hasBackedUpPhrase = true so the reminder banner is dismissed permanently.
router.post("/confirm-backup", authenticate, async (req, res) => {
  try {
    await req.user.updateOne({ hasBackedUpPhrase: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/auth/me
/// Returns the current user profile (relies on authenticate middleware to check Asgardeo JWT)
router.get("/me", authenticate, async (req, res) => {
  try {
    // Attempt to extract picture from X-ID-Token if the user has no avatar
    const idToken = req.headers["x-id-token"];
    if (idToken && (!req.user.avatarUrl || req.user.avatarUrl.includes("googleusercontent"))) {
      try {
        const payloadBase64 = idToken.split(".")[1];
        const payloadJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
        const decoded = JSON.parse(payloadJson);
        const picture = decoded.picture || decoded.profileUrl;
        
        if (picture && req.user.avatarUrl !== picture) {
          req.user.avatarUrl = picture;
          await req.user.save();
        }
      } catch (err) {
        console.warn("Failed to decode X-ID-Token for picture:", err.message);
      }
    }

    await req.user.populate("memberships.organization", "name type logoUrl");
    res.json({
      user: {
        id: req.user._id,
        walletAddress: req.user.walletAddress,
        displayName: req.user.displayName,
        email: req.user.email,
        avatarUrl: req.user.avatarUrl,
        linkedWallets: req.user.linkedWallets,
        isSuperAdmin: req.user.isSuperAdmin,
        memberships: req.user.memberships,
        hasBackedUpPhrase: req.user.hasBackedUpPhrase,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/auth/nonce/:walletAddress
/// Returns a one-time nonce for the wallet to sign (used for linking)
router.get("/nonce/:walletAddress", authenticate, nonceRateLimiter, async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    const nonce = `ChainBudget Link Wallet: ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Store nonce on the CURRENT user
    req.user.nonce = nonce;
    await req.user.save();

    res.json({ nonce });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/auth/link-wallet
/// Verifies the signed nonce and links the wallet to the Asgardeo user
router.post("/link-wallet", authenticate, verifyRateLimiter, async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    if (!walletAddress || !signature) {
      return res.status(400).json({ error: "walletAddress and signature required" });
    }

    const wallet = walletAddress.toLowerCase();
    
    if (!req.user.nonce) {
      return res.status(400).json({ error: "No nonce found. Request a nonce first." });
    }

    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(req.user.nonce, signature);
    } catch (verifyError) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    if (recoveredAddress.toLowerCase() !== wallet) {
      return res.status(401).json({ error: "Signature does not match wallet address" });
    }

    // Check if wallet is already linked to another user
    const existing = await User.findOne({ walletAddress: wallet });
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      // If it's a dummy user (created via invite without Asgardeo ID), merge it!
      if (!existing.asgardeoId) {
        // Merge memberships
        existing.memberships.forEach(newMem => {
          const alreadyHas = req.user.memberships.find(m => m.organization.toString() === newMem.organization.toString());
          if (!alreadyHas) {
            req.user.memberships.push(newMem);
          }
        });
        await User.findByIdAndDelete(existing._id);
      } else {
        return res.status(400).json({ error: "Wallet already linked to another registered account" });
      }
    }

    // Link wallet
    req.user.walletAddress = wallet;
    req.user.nonce = null; // consume nonce
    req.user.lastLogin = new Date();
    await req.user.save();

    // Auto-mint SBT for any active memberships
    if (req.user.memberships && req.user.memberships.length > 0) {
      const { mintSBT } = require("../utils/sbtMinter");
      for (const membership of req.user.memberships) {
        if (membership.isActive && !membership.hasSBT) {
          const txHash = await mintSBT(wallet, membership.organization.toString());
          if (txHash) {
            membership.hasSBT = true;
            membership.sbtTokenId = txHash; // We just store txHash for reference
          }
        }
      }
      await req.user.save();
    }

    res.json({
      user: {
        id: req.user._id,
        walletAddress: req.user.walletAddress,
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl,
        linkedWallets: req.user.linkedWallets,
        isSuperAdmin: req.user.isSuperAdmin,
        memberships: req.user.memberships,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/auth/mint-sbt
/// Allows an existing user with a wallet to mint their SBT if they haven't already
router.post("/mint-sbt", authenticate, async (req, res) => {
  try {
    if (!req.user.walletAddress) {
      return res.status(400).json({ error: "No primary wallet linked." });
    }

    let updated = false;
    if (req.user.memberships && req.user.memberships.length > 0) {
      const { mintSBT } = require("../utils/sbtMinter");
      for (const membership of req.user.memberships) {
        if (membership.isActive && !membership.hasSBT) {
          const txHash = await mintSBT(req.user.walletAddress, membership.organization.toString());
          if (txHash) {
            membership.hasSBT = true;
            membership.sbtTokenId = txHash;
            updated = true;
          }
        }
      }
      if (updated) {
        await req.user.save();
      }
    }

    res.json({
      success: updated,
      memberships: req.user.memberships
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
