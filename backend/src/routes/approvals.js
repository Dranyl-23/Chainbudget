const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Approval = require("../models/Approval");
const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const { submitApprovalOnChain } = require("../services/blockchain");
const { authenticate, requireRole } = require("../middleware/auth");

/// POST /api/approvals/:txId — Submit approval/rejection (Level 1 only)
router.post("/:txId", authenticate, requireRole(1), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { action, comment } = req.body;
    
    // Input validation
    if (!action || !["approved", "rejected"].includes(action)) {
      await session.abortTransaction();
      return res.status(400).json({ error: "action must be 'approved' or 'rejected'" });
    }
    if (comment && typeof comment !== "string") {
      await session.abortTransaction();
      return res.status(400).json({ error: "comment must be a string" });
    }

    const txn = await Transaction.findById(req.params.txId)
      .populate("organization")
      .session(session);
    if (!txn) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (txn.status !== "pending_approval") {
      await session.abortTransaction();
      return res.status(400).json({ error: "Transaction is not pending approval" });
    }

    // Prevent duplicate votes (within transaction lock)
    const existing = await Approval.findOne({
      transaction: txn._id,
      approver: req.user._id,
    }).session(session);
    if (existing) {
      await session.abortTransaction();
      return res.status(400).json({ error: "You have already voted on this transaction" });
    }

    // Record approval within transaction
    const approval = await Approval.create(
      [{
        transaction: txn._id,
        organization: txn.organization._id,
        approver: req.user._id,
        action,
        comment,
        walletAddress: req.user.walletAddress,
      }],
      { session }
    );

    // Count approvals for this transaction (within lock)
    const approvalCount = await Approval.countDocuments({
      transaction: txn._id,
      action: "approved",
    }).session(session);

    const org = txn.organization;
    let blockchainResult = null;

    if (action === "approved") {
      // Submit approval on-chain for every vote (contract tracks per-approver counts)
      if (txn.onChainTxId) {
        try {
          blockchainResult = await submitApprovalOnChain(txn.onChainTxId);
        } catch (blockchainError) {
          console.error("Blockchain submitApproval failed:", blockchainError.message);
          // Non-fatal: off-chain approval count is the source of truth for prototype
        }
      }

      // Check if approval threshold is now met
      if (approvalCount >= org.requiredApprovals) {
        txn.status = "approved";
        if (blockchainResult && !blockchainResult.skipped) {
          txn.blockchainTxHash = blockchainResult.blockchainTxHash;
        }
        await txn.save({ session });
      }
    } else if (action === "rejected") {
      txn.status = "rejected";
      await txn.save({ session });
    }

    // Audit log (within transaction)
    await AuditLog.create(
      [{
        organization: org._id,
        actor: req.user._id,
        actorWallet: req.user.walletAddress,
        action: `transaction.${action}`,
        targetType: "Transaction",
        targetId: txn._id,
        details: { action, approvalCount, comment },
        blockchainTxHash: blockchainResult?.blockchainTxHash,
        onChainTxId: blockchainResult?.onChainTxId,
      }],
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    res.json({ approval: approval[0], transaction: txn, blockchain: blockchainResult });
  } catch (err) {
    await session.abortTransaction();
    console.error("Approval error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

/// GET /api/approvals/:txId — Get approvals for a transaction
router.get("/:txId", authenticate, async (req, res) => {
  try {
    const approvals = await Approval.find({ transaction: req.params.txId })
      .populate("approver", "walletAddress displayName");
    res.json(approvals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
