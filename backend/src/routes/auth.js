const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  nonceRateLimiter,
  verifyRateLimiter,
  csrfTokenEndpoint,
  generateCSRFToken,
} = require("../middleware/security");

// Helper to validate Ethereum address format
function isValidEthereumAddress(address) {
  return ethers.isAddress(address);
}

/// GET /api/auth/csrf-token
/// Get a CSRF token for form submissions
router.get("/csrf-token", (req, res) => {
  const token = generateCSRFToken();
  res.json({ csrfToken: token });
});

/// GET /api/auth/nonce/:walletAddress
/// Returns a one-time nonce for the wallet to sign
/// Rate limited: 5 requests per minute per IP
router.get("/nonce/:walletAddress", nonceRateLimiter, async (req, res) => {
  try {
    const wallet = req.params.walletAddress.toLowerCase();
    
    // Validate wallet address format
    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    const nonce = `ChainBudget Sign-In: ${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let user = await User.findOne({ walletAddress: wallet });
    if (!user) {
      user = new User({ walletAddress: wallet, nonce });
    } else {
      user.nonce = nonce;
    }
    await user.save();

    res.json({ nonce });
  } catch (err) {
    console.error("Nonce generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/auth/verify
/// Verifies the signed nonce, issues JWT
/// Rate limited: 10 attempts per minute per IP
router.post("/verify", verifyRateLimiter, async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    
    // Input validation
    if (!walletAddress || typeof walletAddress !== "string") {
      return res.status(400).json({ error: "walletAddress is required and must be a string" });
    }
    if (!signature || typeof signature !== "string") {
      return res.status(400).json({ error: "signature is required and must be a string" });
    }

    const wallet = walletAddress.toLowerCase();
    
    // Validate wallet address format
    if (!isValidEthereumAddress(wallet)) {
      return res.status(400).json({ error: "Invalid Ethereum address format" });
    }

    const user = await User.findOne({ walletAddress: wallet });
    if (!user || !user.nonce) {
      return res.status(400).json({ error: "No nonce found. Request a nonce first." });
    }

    // Recover signer from signature with error handling
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(user.nonce, signature);
    } catch (verifyError) {
      console.error("Signature verification error:", verifyError.message);
      return res.status(401).json({ error: "Signature verification failed" });
    }

    if (recoveredAddress.toLowerCase() !== wallet) {
      return res.status(401).json({ error: "Signature does not match wallet address" });
    }

    // Clear nonce (one-time use)
    user.nonce = null;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, walletAddress: wallet },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        isSuperAdmin: user.isSuperAdmin,
        memberships: user.memberships,
      },
    });
  } catch (err) {
    console.error("Auth verify error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/auth/validate
/// Validate current JWT token (used for session restoration)
router.get("/validate", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({ valid: true });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
