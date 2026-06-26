const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const User = require("../models/User");
const { authenticate } = require("../middleware/auth");
const {
  nonceRateLimiter,
  verifyRateLimiter,
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

/// GET /api/auth/validate — BUG-10 FIX: Validate if stored token is still valid
router.get("/validate", authenticate, (req, res) => {
  res.json({ valid: true, userId: req.user._id });
});

/// GET /api/auth/me
/// Returns the current user profile (relies on authenticate middleware to check Asgardeo JWT)
router.get("/me", authenticate, async (req, res) => {
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
