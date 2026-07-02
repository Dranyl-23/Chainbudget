const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");

// ── GET /api/public/organizations ── List all active public organizations
router.get("/organizations", async (req, res) => {
  try {
    const orgs = await Organization.find({ isActive: true }).lean();
    
    // We will attach a transparency score to each organization
    // Transparency Score = (Verified On-Chain Transactions / Total Approved Transactions) * 100
    const results = await Promise.all(orgs.map(async (org) => {
      const totalApproved = await Transaction.countDocuments({ organization: org._id, status: "approved" });
      const totalVerified = await Transaction.countDocuments({ organization: org._id, status: "approved", isRecordedOnChain: true });
      
      let transparencyScore = 100;
      if (totalApproved > 0) {
        transparencyScore = Math.round((totalVerified / totalApproved) * 100);
      } else if (!org.contractAddress) {
        transparencyScore = 50; // Penalty for no smart contract linked yet
      }

      return {
        _id: org._id,
        name: org.name,
        type: org.type,
        description: org.description,
        logoUrl: org.logoUrl,
        contractAddress: org.contractAddress,
        transparencyScore,
        isPrivate: org.isPrivate || false
      };
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/public/organizations/:orgId ── Fetch specific org details
router.get("/organizations/:orgId", async (req, res) => {
  try {
    const org = await Organization.findOne({ _id: req.params.orgId, isActive: true }).lean();
    if (!org) return res.status(404).json({ error: "Organization not found or inactive" });

    const totalApproved = await Transaction.countDocuments({ organization: org._id, status: "approved" });
    const totalVerified = await Transaction.countDocuments({ organization: org._id, status: "approved", isRecordedOnChain: true });
    
    let transparencyScore = 100;
    if (totalApproved > 0) {
      transparencyScore = Math.round((totalVerified / totalApproved) * 100);
    } else if (!org.contractAddress) {
      transparencyScore = 50;
    }

    res.json({
      _id: org._id,
      name: org.name,
      type: org.type,
      description: org.description,
      logoUrl: org.logoUrl,
      contractAddress: org.contractAddress,
      transparencyScore,
      isPrivate: org.isPrivate || false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/public/organizations/:orgId/transactions ── Fetch public on-chain transactions only
router.get("/organizations/:orgId/transactions", async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId).lean();
    if (org && org.isPrivate) {
      return res.status(403).json({ error: "This organization is private. Transactions are restricted." });
    }

    // Only fetch APPROVED and ON-CHAIN transactions. Reject pending requests.
    const transactions = await Transaction.find({ 
      organization: req.params.orgId,
      status: "approved",
      isRecordedOnChain: true
    })
    .select("amount type description category budgetCategory createdAt blockchainTxHash onChainTxId")
    .sort({ createdAt: -1 })
    .limit(50);

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/public/organizations/:orgId/budget ── Fetch public budget categories
router.get("/organizations/:orgId/budget", async (req, res) => {
  try {
    const org = await Organization.findById(req.params.orgId).lean();
    if (org && org.isPrivate) {
      return res.status(403).json({ error: "This organization is private. Budget is restricted." });
    }

    const budgets = await Budget.find({ organization: req.params.orgId })
      .select("name allocated spent")
      .sort({ allocated: -1 });

    res.json(budgets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/public/feed ── Fetch global latest verified transactions for the ticker
router.get("/feed", async (req, res) => {
  try {
    const transactions = await Transaction.find({ 
      status: "approved",
      isRecordedOnChain: true
    })
    .populate("organization", "name isPrivate")
    .select("amount type description createdAt blockchainTxHash organization")
    .sort({ createdAt: -1 })
    .limit(20);

    const publicTransactions = transactions
      .filter(t => t.organization && !t.organization.isPrivate)
      .slice(0, 10);

    res.json(publicTransactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
