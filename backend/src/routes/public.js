const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");

// ── GET /api/public/organizations ── List all active public organizations
router.get("/organizations", async (req, res) => {
  try {
    const orgs = await Organization.find({ isActive: true }).lean();
    if (!orgs.length) return res.json([]);

    const orgIds = orgs.map((o) => o._id);

    // Single aggregation to compute total approved and on-chain verified transactions per org
    const statsAgg = await Transaction.aggregate([
      {
        $match: {
          organization: { $in: orgIds },
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$organization",
          totalApproved: { $sum: 1 },
          totalVerified: {
            $sum: { $cond: [{ $eq: ["$isRecordedOnChain", true] }, 1, 0] },
          },
        },
      },
    ]);

    const statsMap = new Map(statsAgg.map((s) => [s._id.toString(), s]));

    const results = orgs.map((org) => {
      const stats = statsMap.get(org._id.toString()) || { totalApproved: 0, totalVerified: 0 };
      let transparencyScore = 100;
      if (stats.totalApproved > 0) {
        transparencyScore = Math.round((stats.totalVerified / stats.totalApproved) * 100);
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
        isPrivate: org.isPrivate || false,
      };
    });

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
// ── GET /api/public/verify/:hash ── Verify a specific transaction by blockchain hash
router.get("/verify/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    
    // Support querying by either blockchainTxHash or internal ID if someone scans an internal QR
    const query = hash.startsWith("0x") 
      ? { blockchainTxHash: hash } 
      : { _id: hash };

    const transaction = await Transaction.findOne(query)
      .populate("organization", "name isPrivate contractAddress")
      .populate("submittedBy", "displayName walletAddress")
      .lean();

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found on this system." });
    }

    if (transaction.organization && transaction.organization.isPrivate) {
      return res.status(403).json({ error: "This transaction belongs to a private organization and cannot be publicly audited." });
    }

    // Fetch approval signatures from the separate Approval collection
    const Approval = require("../models/Approval");
    const approvals = await Approval.find({ transaction: transaction._id })
      .populate("approver", "displayName walletAddress")
      .lean();

    // Format a clean verification report
    const report = {
      isVerified: transaction.isRecordedOnChain && !!transaction.blockchainTxHash,
      transactionHash: transaction.blockchainTxHash,
      onChainTxId: transaction.onChainTxId,
      status: transaction.status,
      timestamp: transaction.createdAt,
      organizationName: transaction.organization?.name,
      contractAddress: transaction.organization?.contractAddress,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      budgetCategory: transaction.budgetCategory,
      description: transaction.description,
      receiptIpfsHash: transaction.receiptIpfsHash, // Provide the raw receipt for auditing
      receiptUrl: transaction.receiptUrl,
      submittedBy: transaction.submittedBy?.displayName || transaction.submittedBy?.walletAddress,
      signatures: approvals.map(a => ({
        name: a.approver?.displayName,
        wallet: a.approver?.walletAddress || a.walletAddress,
        signature: a.digitalSignature, // Cryptographic proof of approval
        action: a.action,
        date: a.createdAt
      }))
    };

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/public/protocol ── Dynamic live protocol & smart contract discovery endpoint
router.get("/protocol", async (req, res) => {
  try {
    const amoyRpc = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
    const masterContract = process.env.CONTRACT_ADDRESS || "0x1887be6c9cc06ddddb125da24b9b554c18f0a1fb";
    const daoContract = process.env.DAO_CONTRACT_ADDRESS || "0x0b15187c87a9c3f8588753c123b7071a9548cc9c";
    const sbtContract = process.env.SBT_CONTRACT_ADDRESS || "0x7a376e224276988e3b01aae7a5b17c8c14e94031";

    res.json({
      success: true,
      network: {
        name: "Polygon Amoy (POS Testnet)",
        chainId: 80002,
        hexChainId: "0x13882",
        currency: "POL (Polygon Ecosystem Token)",
        rpcUrl: amoyRpc,
        explorerUrl: "https://amoy.polygonscan.com",
        consensus: "Bor + Heimdall (Proof-of-Stake)",
      },
      contracts: {
        masterTreasury: masterContract,
        daoGovernance: daoContract,
        sbtMembership: sbtContract,
      },
      relayer: {
        status: "active",
        type: "Sponsored Gasless Meta-Tx",
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
