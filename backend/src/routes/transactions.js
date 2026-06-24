const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const { recordTransactionOnChain } = require("../services/blockchain");
const { authenticate, requireRole } = require("../middleware/auth");
const { ethers } = require("ethers");

/// POST /api/transactions — Create a new transaction (Level 2+)
router.post("/", authenticate, requireRole(2), async (req, res) => {
  try {
    const {
      organizationId,
      type,
      amount,
      description,
      category,
      referenceNumber,
      budgetCategory,
      notes,
      documentUrl,
      documentHash,
    } = req.body;

    // Input validation
    if (!organizationId || typeof organizationId !== "string") {
      return res.status(400).json({ error: "organizationId is required and must be a string" });
    }
    if (!type || !["income", "expense"].includes(type)) {
      return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ error: "description is required and must be non-empty" });
    }

    const org = await Organization.findById(organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    if (!org.isActive) {
      return res.status(400).json({ error: "Organization is inactive" });
    }

    const isHighValue = amount >= org.highValueThreshold;

    const txn = new Transaction({
      organization: organizationId,
      submittedBy: req.user._id,
      type,
      amount,
      description: description.trim(),
      category: category ? category.trim() : undefined,
      referenceNumber: referenceNumber ? referenceNumber.trim() : undefined,
      budgetCategory: budgetCategory ? budgetCategory.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      documentUrl: documentUrl || undefined,
      documentHash: documentHash || undefined,
      isHighValue,
      status: isHighValue ? "pending_approval" : "approved",
    });

    await txn.save();

    // Record ALL transactions on blockchain at creation.
    // Non-high-value → isApproved immediately in contract.
    // High-value → registered on contract with isApproved=false, awaiting submitApproval votes.
    let blockchainResult = null;
    try {
      const payload = JSON.stringify({
        orgId: organizationId,
        amount,
        type,
        description,
        submittedBy: req.user.walletAddress,
        timestamp: new Date().toISOString(),
        documentHash: documentHash || null,  // Bind receipt hash on-chain
      });

      blockchainResult = await recordTransactionOnChain(
        payload,
        Math.round(amount),
        isHighValue
      );

      if (blockchainResult && !blockchainResult.skipped) {
        txn.onChainTxId = blockchainResult.onChainTxId;
        txn.blockchainTxHash = blockchainResult.blockchainTxHash;
        txn.dataHash = blockchainResult.dataHash;
        txn.isRecordedOnChain = true;
        await txn.save();
      }
    } catch (blockchainError) {
      console.error("Blockchain recording failed:", blockchainError.message);
      // Continue - blockchain is optional for now
    }

    // Audit log
    await AuditLog.create({
      organization: organizationId,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "transaction.created",
      targetType: "Transaction",
      targetId: txn._id,
      details: { amount, type, isHighValue },
      blockchainTxHash: blockchainResult?.blockchainTxHash,
      onChainTxId: blockchainResult?.onChainTxId,
    });

    res.status(201).json({ transaction: txn, blockchain: blockchainResult });
  } catch (err) {
    console.error("Transaction creation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/transactions?orgId=xxx — List transactions for an org
router.get("/", authenticate, async (req, res) => {
  try {
    const { orgId, status, type, page = 1, limit = 20 } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    const mongoose = require("mongoose");

    // Validate orgId format before creating ObjectId
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.status(400).json({ error: "Invalid orgId" });
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const filter = { organization: orgObjectId };
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Level 3+ can only see approved transactions
    const roleLevel = req.user.getRoleInOrg(orgId);
    if (roleLevel >= 3 && !req.user.isSuperAdmin) {
      filter.status = "approved";
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Aggregate to include approvalCount and organization data in one query
    const [transactions, total] = await Promise.all([
      Transaction.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: Number(limit) },
        // Join submittedBy user
        {
          $lookup: {
            from: "users",
            localField: "submittedBy",
            foreignField: "_id",
            as: "submittedByArr",
          },
        },
        {
          $addFields: {
            submittedBy: {
              $let: {
                vars: { u: { $arrayElemAt: ["$submittedByArr", 0] } },
                in: { _id: "$$u._id", walletAddress: "$$u.walletAddress", displayName: "$$u.displayName" },
              },
            },
          },
        },
        { $project: { submittedByArr: 0 } },
        // Join organization (for threshold info)
        {
          $lookup: {
            from: "organizations",
            localField: "organization",
            foreignField: "_id",
            as: "organizationArr",
          },
        },
        {
          $addFields: {
            organization: {
              $let: {
                vars: { o: { $arrayElemAt: ["$organizationArr", 0] } },
                in: {
                  _id: "$$o._id",
                  name: "$$o.name",
                  highValueThreshold: "$$o.highValueThreshold",
                  requiredApprovals: "$$o.requiredApprovals",
                },
              },
            },
          },
        },
        { $project: { organizationArr: 0 } },
        // Count how many "approved" votes this transaction has received
        {
          $lookup: {
            from: "approvals",
            let: { txId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$transaction", "$$txId"] },
                      { $eq: ["$action", "approved"] },
                    ],
                  },
                },
              },
              { $count: "count" },
            ],
            as: "approvalDocs",
          },
        },
        {
          $addFields: {
            approvalCount: {
              $ifNull: [{ $arrayElemAt: ["$approvalDocs.count", 0] }, 0],
            },
          },
        },
        { $project: { approvalDocs: 0 } },
      ]),
      Transaction.countDocuments(filter),
    ]);

    res.json({ transactions, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("GET /transactions error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/// GET /api/transactions/public/:hash — Verify a transaction publicly (No Auth)
router.get("/public/:hash", async (req, res) => {
  try {
    const { hash } = req.params;
    
    // Allow searching by blockchainTxHash or short reference if implemented
    const txn = await Transaction.findOne({
      $or: [
        { blockchainTxHash: hash },
        { _id: hash.length === 24 ? hash : null } // Fallback to ID if it looks like one
      ]
    }).populate("organization", "name");

    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Return safe public fields only
    res.json({
      txHash: txn.blockchainTxHash,
      amount: txn.amount,
      description: txn.description,
      category: txn.category || "Uncategorized",
      status: txn.status === "approved" ? "Approved" : txn.status === "rejected" ? "Rejected" : "Pending",
      organization: txn.organization?.name || "Unknown",
      date: txn.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: "Server error during verification" });
  }
});

/// GET /api/transactions/:id — Get single transaction
router.get("/:id", authenticate, async (req, res) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate("submittedBy", "walletAddress displayName")
      .populate("organization", "name type");
    if (!txn) return res.status(404).json({ error: "Transaction not found" });
    res.json(txn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
