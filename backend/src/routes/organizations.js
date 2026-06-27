const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const { authenticate, requireRole } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadToPinata } = require("../utils/pinata");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB limit for logos
});

/// POST /api/organizations — Create organization (any authenticated user)
router.post("/", authenticate, upload.single("logo"), async (req, res) => {
  try {
    // BUG-8 FIX: Whitelist fields instead of spreading raw req.body
    const { name, type, description, highValueThreshold, requiredApprovals } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: "name and type are required" });
    }

    if (!req.user.walletAddress) {
      return res.status(400).json({ error: "You must link a wallet before creating an organization." });
    }

    let logoUrl = "";
    if (req.file) {
      try {
        const { url } = await uploadToPinata(req.file.buffer, req.file.originalname);
        logoUrl = url;
      } catch (uploadErr) {
        console.error("Error uploading logo to IPFS:", uploadErr);
        // Fallback or just ignore logo if IPFS fails
        logoUrl = "";
      }
    }

    const org = new Organization({
      name,
      type,
      description: description || "",
      logoUrl: logoUrl,
      highValueThreshold: highValueThreshold || 10000,
      requiredApprovals: requiredApprovals || 2,
      createdBy: req.user._id,
    });
    await org.save();

    // Add creator to organization as Level 1
    req.user.memberships.push({
      organization: org._id,
      roleLevel: 1,
      roleLabel: "Founder",
    });
    await req.user.save();

    res.status(201).json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/// GET /api/organizations — List organizations the user belongs to
router.get("/", authenticate, async (req, res) => {
  try {
    let orgs;
    if (req.user.isSuperAdmin) {
      orgs = await Organization.find().sort({ createdAt: -1 });
    } else {
      const orgIds = req.user.memberships
        .filter((m) => m.isActive)
        .map((m) => m.organization);

      orgs = await Organization.find({ _id: { $in: orgIds }, isActive: true });
    }
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/organizations/:orgId — Get single organization details
router.get("/:orgId", authenticate, requireRole(4), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// PATCH /api/organizations/:orgId — Update (Level 1 only)
router.patch("/:orgId", authenticate, requireRole(1), async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params.orgId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/// POST /api/organizations/:orgId/submit-liquidation — Org Admin submits liquidation
router.post("/:orgId/submit-liquidation", authenticate, requireRole(2), async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (org.liquidationStatus === "pending") return res.status(400).json({ error: "Liquidation already pending" });
    
    org.liquidationStatus = "pending";
    await org.save();
    
    res.json({ success: true, organization: org });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// POST /api/organizations/:orgId/approve-liquidation — SuperAdmin approves & replenishes
router.post("/:orgId/approve-liquidation", authenticate, async (req, res) => {
  try {
    // Only SuperAdmin can approve
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ error: "Only SuperAdmin can approve liquidations" });
    }

    const org = await Organization.findById(req.params.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (org.liquidationStatus !== "pending") return res.status(400).json({ error: "No pending liquidation to approve" });

    // 1. Approve Liquidation
    org.liquidationStatus = "approved";
    await org.save();

    // 2. Automated Budget Replenishment (Record Income Off-Chain)
    const Transaction = require("../models/Transaction");
    const txn = new Transaction({
      organization: org._id,
      submittedBy: req.user._id, // SuperAdmin triggered
      type: "income",
      amount: org.subsidyAmount || 50000,
      description: "Automated Semester Subsidy Replenishment",
      category: "University Subsidy",
      isHighValue: false,
      status: "approved",
      executed: true
    });
    await txn.save();

    // 3. Automated On-Chain Transfer (Symbolic Gas Subsidy)
    if (org.contractAddress) {
      try {
        const { ethers } = require("ethers");
        const rpcUrl = process.env.AMOY_RPC_URL;
        const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const signer = new ethers.Wallet(privateKey, provider);
        
        // Transfer 0.01 MATIC as a symbolic representation of the subsidy / gas
        const tx = await signer.sendTransaction({
          to: org.contractAddress,
          value: ethers.parseEther("0.01")
        });
        
        // Don't wait for wait() to prevent blocking
        txn.blockchainTxHash = tx.hash;
        await txn.save();
      } catch (chainErr) {
        console.error("Failed to send on-chain subsidy:", chainErr.message);
      }
    }

    res.json({ success: true, organization: org, transaction: txn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
