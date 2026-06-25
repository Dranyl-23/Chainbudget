const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const { recordTransactionOnChain } = require("../services/blockchain");
const { authenticate, requireRole } = require("../middleware/auth");
const { ethers } = require("ethers");

/// POST /api/transactions — Create a new transaction (Level 2+) or Request (Level 3)
router.post("/", authenticate, requireRole(3), async (req, res) => {
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
      urgency,
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

    // Determine status based on role
    const roleLevel = req.user.getRoleInOrg(organizationId);
    const isRequest = roleLevel === 3;
    
    let initialStatus;
    if (isRequest) {
      initialStatus = "requested";
    } else {
      initialStatus = isHighValue ? "pending_approval" : "approved";
    }

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
      status: initialStatus,
      urgency: urgency && urgency === "urgent" ? "urgent" : "normal",
    });

    await txn.save();

    let blockchainResult = null;
    
    // Only record on blockchain if it's NOT a level 3 request
    if (!isRequest) {
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

// GET /api/transactions/pending-count?orgId=xxx
router.get("/pending-count", authenticate, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: "orgId required" });

    // Only Level 1 & Level 2 can approve/reject
    const roleLevel = req.user.getRoleInOrg(orgId);
    if (roleLevel > 2 && !req.user.isSuperAdmin) {
      return res.json({ count: 0 }); // They don't have pending actions
    }

    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(orgId)) {
      return res.json({ count: 0 });
    }

    // Count both requested and pending_approval
    const count = await Transaction.countDocuments({
      organization: new mongoose.Types.ObjectId(orgId),
      status: { $in: ["requested", "pending_approval"] }
    });

    res.json({ count });
  } catch (err) {
    console.error("Failed to fetch pending count:", err);
    res.status(500).json({ error: "Server error" });
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
    if (type) filter.type = type;

    // Security filters based on Role Level
    const roleLevel = req.user.getRoleInOrg(orgId);
    if (!req.user.isSuperAdmin) {
      if (roleLevel === 4) {
        // Level 4 (Public Viewers) ONLY see approved transactions
        filter.status = "approved";
      } else if (roleLevel === 3) {
        // Level 3 can see approved and their/others' requested transactions
        if (status) {
          if (["approved", "requested"].includes(status)) {
            filter.status = status;
          } else {
            filter.status = "unauthorized_status";
          }
        } else {
          filter.status = { $in: ["approved", "requested"] };
        }
      } else {
        // Admins (Level 1 & 2) can filter by any status
        if (status) filter.status = status;
      }
    } else {
      // SuperAdmins can filter by any status
      if (status) filter.status = status;
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

/// PATCH /api/transactions/:id/process-request — Approve/Reject Level 3 Request
router.patch("/:id/process-request", authenticate, requireRole(2), async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
    }

    const txn = await Transaction.findById(req.params.id).populate("organization");
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    if (txn.status !== "requested") {
      return res.status(400).json({ error: "Transaction is not in requested state" });
    }

    const orgId = txn.organization._id.toString();
    const userRole = req.user.getRoleInOrg(orgId);
    if (!req.user.isSuperAdmin && (!userRole || userRole > 2)) {
      return res.status(403).json({ error: "Insufficient permissions to process request" });
    }

    if (action === "reject") {
      txn.status = "rejected";
      await txn.save();
      
      await AuditLog.create({
        organization: orgId,
        actor: req.user._id,
        actorWallet: req.user.walletAddress,
        action: "transaction.request_rejected",
        targetType: "Transaction",
        targetId: txn._id,
        details: { reason: "Rejected by admin" }
      });

      return res.json({ transaction: txn, message: "Request rejected" });
    }

    // Process Approval
    const org = txn.organization;
    const isHighValue = txn.amount >= org.highValueThreshold;
    txn.isHighValue = isHighValue;
    txn.status = isHighValue ? "pending_approval" : "approved";

    // Now record on blockchain
    let blockchainResult = null;
    try {
      const payload = JSON.stringify({
        orgId,
        amount: txn.amount,
        type: txn.type,
        description: txn.description,
        submittedBy: txn.submittedBy.toString(), // Original requester
        timestamp: new Date().toISOString(),
        documentHash: txn.documentHash || null,
      });

      blockchainResult = await recordTransactionOnChain(
        payload,
        Math.round(txn.amount),
        isHighValue
      );

      if (blockchainResult && !blockchainResult.skipped) {
        txn.onChainTxId = blockchainResult.onChainTxId;
        txn.blockchainTxHash = blockchainResult.blockchainTxHash;
        txn.dataHash = blockchainResult.dataHash;
        txn.isRecordedOnChain = true;
      }
    } catch (blockchainError) {
      console.error("Blockchain recording failed for request:", blockchainError.message);
    }

    await txn.save();

    await AuditLog.create({
      organization: orgId,
      actor: req.user._id,
      actorWallet: req.user.walletAddress,
      action: "transaction.request_approved",
      targetType: "Transaction",
      targetId: txn._id,
      details: { amount: txn.amount, type: txn.type, isHighValue },
      blockchainTxHash: blockchainResult?.blockchainTxHash,
      onChainTxId: blockchainResult?.onChainTxId,
    });

    res.json({ transaction: txn, blockchain: blockchainResult, message: "Request approved and processed" });
  } catch (err) {
    console.error("Process request error:", err);
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
