const express = require("express");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const router = express.Router();
const Approval = require("../models/Approval");
const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { authenticate, requireRole } = require("../middleware/auth");
const { requireIdempotency } = require("../middleware/idempotency");
const { sendPushNotifications } = require("./users");

/// POST /api/approvals/:txId — Submit approval/rejection (Level 1 and 2)
router.post("/:txId", authenticate, requireRole(2), requireIdempotency, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { action, comment, blockchainTxHash, signature } = req.body;
    
    // Input validation
    if (!action || !["approved", "rejected"].includes(action)) {
      await session.abortTransaction();
      return res.status(400).json({ error: "action must be 'approved' or 'rejected'" });
    }
    if (comment && typeof comment !== "string") {
      await session.abortTransaction();
      return res.status(400).json({ error: "comment must be a string" });
    }
    if (!signature) {
      await session.abortTransaction();
      return res.status(400).json({ error: "Web3 digital signature is required" });
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

    // BUG-1 FIX: Verify transaction belongs to the claimed organization
    const claimedOrgId = req.body.organizationId;
    if (claimedOrgId && txn.organization._id.toString() !== claimedOrgId) {
      await session.abortTransaction();
      return res.status(403).json({ error: "Transaction does not belong to this organization" });
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

    // Verify EIP-712 Signature
    // HIGH-4 FIX: The EIP-712 message must be reconstructed entirely from
    // server-side trusted data (the stored txn document). The previous code
    // accepted `signedAmountWei` and `signedTo` from the client body and
    // included them in the recovered-signer message — an attacker could supply
    // a manipulated amountWei that was different from the real transaction amount,
    // obtain a valid signature over it, and pass verification.
    //
    // Fix: always use txn.amount for amountWei and derive `to` from the
    // transaction's stored submittedBy wallet — never from the request body.
    try {
      const domain = { name: "ChainBudget", version: "1" };
      const types = {
        Approval: [
          { name: "action", type: "string" },
          { name: "txId", type: "string" },
          { name: "amount", type: "string" },
          { name: "description", type: "string" },
          { name: "to", type: "address" },
          { name: "amountWei", type: "uint256" }
        ]
      };

      // Resolve the canonical `to` address from the stored transaction submitter.
      // Never trust the client-supplied `to` field for signature verification.
      let canonicalTo = "0x0000000000000000000000000000000000000000";
      if (txn.submittedBy) {
        const submitterId = txn.submittedBy._id || txn.submittedBy;
        const submitter = await User.findById(submitterId).select("walletAddress").lean();
        if (submitter?.walletAddress && ethers.isAddress(submitter.walletAddress)) {
          canonicalTo = ethers.getAddress(submitter.walletAddress);
        }
      }

      const message = {
        action,
        txId: txn._id.toString(),
        amount: txn.amount.toString(),
        description: txn.description || "",
        to: canonicalTo,
        amountWei: txn.amount.toString(), // Server-sourced only — never from client
      };
      
      const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);
      console.log(`[Approval] Verification: Recovered=${recoveredAddress}, UserWallet=${req.user.walletAddress}`);
      if (recoveredAddress.toLowerCase() !== req.user.walletAddress.toLowerCase()) {
        await session.abortTransaction();
        return res.status(401).json({ error: "Cryptographic signature verification failed. Wallet mismatch." });
      }
    } catch (sigErr) {
      console.error("Signature verification error:", sigErr);
      await session.abortTransaction();
      return res.status(400).json({ error: "Invalid digital signature format." });
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
        digitalSignature: signature,
      }],
      { session }
    );

    // Count approvals for this transaction (within lock)
    const approvalCount = await Approval.countDocuments({
      transaction: txn._id,
      action: "approved",
    }).session(session);

    const org = txn.organization;
    if (action === "approved") {
      // Check if approval threshold is now met
      if (approvalCount >= org.requiredApprovals) {
        txn.status = "approved";
        if (blockchainTxHash) {
          txn.blockchainTxHash = blockchainTxHash;
        }
        await txn.save({ session });

        // Trigger Gasless Relayer Execution if Smart Contract is linked
        if (org.contractAddress) {
          try {
            const rpcUrl = process.env.AMOY_RPC_URL || process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology";
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const relayerPrivateKey = process.env.BACKEND_WALLET_PRIVATE_KEY || process.env.BACKEND_PRIVATE_KEY;
            if (!relayerPrivateKey) throw new Error("BACKEND_WALLET_PRIVATE_KEY not set in environment");
            const relayerWallet = new ethers.Wallet(relayerPrivateKey, provider);
            
            let treasuryAbi;
            try {
              treasuryAbi = require("../lib/ChainBudgetTreasury.json").abi;
            } catch {
              console.warn("ChainBudgetTreasury ABI not found. Skipping gasless execution.");
            }

            if (treasuryAbi) {
              const contract = new ethers.Contract(org.contractAddress, treasuryAbi, relayerWallet);
              
              // Gather all digital signatures from the database
              const approvalsList = await Approval.find({ transaction: txn._id, action: "approved" }).session(session);
              const signatures = approvalsList.map(a => a.digitalSignature).filter(Boolean);
              
              if (signatures.length >= org.requiredApprovals) {
                console.log(`[Relayer] Executing Gasless Transaction ${txn._id}...`);
                const txData = await Transaction.findById(txn._id).populate("submittedBy").session(session);
                const toAddress = txData.submittedBy?.walletAddress || "0x000000000000000000000000000000000000dEaD";
                
                // CRIT-5 FIX: The Treasury contract's executeWithSignatures transfers
                // real MATIC (amountWei). Passing a raw PHP integer (e.g. 5000 for ₱5000)
                // would only transfer 5000 Wei ≈ ₱0.000000012.
                //
                // This integration is intentionally disabled in production until a proper
                // PHP→MATIC conversion rate is applied. In a testnet/demo context only,
                // amounts are stored symbolically (1 PHP = 1 unit) for audit purposes.
                //
                // TODO before production: replace amountWei with the correctly converted
                // value using a rate oracle or a fixed exchange rate:
                //   const PHP_TO_WEI_RATE = BigInt(process.env.PHP_TO_WEI_RATE || "0");
                //   const amountWei = BigInt(Math.floor(txn.amount)) * PHP_TO_WEI_RATE;
                if (process.env.NODE_ENV === "production") {
                  throw new Error(
                    "[Relayer] BLOCKED: executeWithSignatures called with raw PHP amount in production. " +
                    "Set PHP_TO_WEI_RATE env var and apply conversion before enabling Treasury execution."
                  );
                }

                // Demo/testnet only — amounts stored symbolically, not as real ETH value
                const amountWei = txn.amount.toString();
                
                const txResponse = await contract.executeWithSignatures(
                  "approved",
                  txn._id.toString(),
                  txn.amount.toString(),
                  amountWei,
                  txn.description,
                  toAddress,
                  signatures
                );
                
                console.log(`[Relayer] Transaction broadcasted! Hash: ${txResponse.hash}`);
                txn.blockchainTxHash = txResponse.hash;
                txn.executed = true;
                await txn.save({ session });
              }
            }
          } catch (relayerErr) {
            console.error("[Relayer] Gasless execution failed:", relayerErr.message);
            // We don't abort the DB transaction here to ensure the approval is still saved.
          }
        }
      }
    } else if (action === "rejected") {
      // BUG-3 FIX: Rejection also requires threshold (symmetric with approval)
      const rejectionCount = await Approval.countDocuments({
        transaction: txn._id,
        action: "rejected",
      }).session(session);
      if (rejectionCount >= org.requiredApprovals) {
        txn.status = "rejected";
        await txn.save({ session });
      }
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
        blockchainTxHash: blockchainTxHash || txn.blockchainTxHash,
        onChainTxId: txn.onChainTxId,
      }],
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    // Emit socket event — scoped to the org room so only members receive it
    const io = req.app.get("io");
    if (io) {
      io.to(`org:${org._id}`).emit("transaction_updated", { orgId: org._id });
    }

    // ── In-App Notifications (Persisted to MongoDB) ───────────────────────────
    try {
      const Notification = require("../models/Notification");
      const notifTitle = txn.status === "approved" ? "Transaction Approved" : txn.status === "rejected" ? "Transaction Rejected" : "Approval Granted";
      const notifMessage = `${req.user.displayName || 'An Executive'} ${action}d request "${txn.description.slice(0, 40)}" for ₱${txn.amount.toLocaleString()}.`;
      const newNotif = await Notification.create({
        organization: org._id,
        title: notifTitle,
        message: notifMessage,
        type: txn.status === "approved" ? "success" : txn.status === "rejected" ? "error" : "info",
        targetId: txn._id,
        targetType: "Transaction",
        readBy: [req.user.id],
      });

      if (io) {
        io.to(`org:${org._id}`).emit("new_notification", {
          orgId: org._id,
          id: newNotif._id,
          title: notifTitle,
          message: notifMessage,
          type: newNotif.type,
          timestamp: newNotif.createdAt,
        });
      }
    } catch (notifErr) {
      console.warn("[approvals] In-app notification creation warning:", notifErr.message);
    }

    // ── Push Notifications ────────────────────────────────────────────────────
    // Notify the transaction submitter when threshold is reached (approved/rejected).
    // Fire-and-forget: failures are logged in sendPushNotifications, never block response.
    if (txn.submittedBy && (txn.status === "approved" || txn.status === "rejected")) {
      const notifTitle = txn.status === "approved" ? "Transaction Approved" : "Transaction Rejected";
      const notifBody = `Your ₱${txn.amount} request for "${txn.description.slice(0, 40)}" was ${txn.status}.`;
      sendPushNotifications(
        [txn.submittedBy.toString()],
        notifTitle,
        notifBody,
        { txId: txn._id.toString(), screen: "TransactionDetail", channelId: "chainbudget-approvals" }
      );
    }

    res.json({ approval: approval[0], transaction: txn });
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
    const txn = await Transaction.findById(req.params.txId);
    if (!txn) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // B-7 FIX: User must be an active member of the transaction's organization or SuperAdmin
    const roleLevel = req.user.getRoleInOrg(txn.organization);
    if (!req.user.isSuperAdmin && roleLevel === null) {
      return res.status(403).json({ error: "Access denied. You are not a member of this organization." });
    }

    const approvals = await Approval.find({ transaction: req.params.txId })
      .populate("approver", "walletAddress displayName");
    res.json(approvals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/// PATCH /api/approvals/:txId/hash — Update blockchain hash after MetaMask confirmation
router.patch("/:txId/hash", authenticate, async (req, res) => {
  try {
    const { blockchainTxHash } = req.body;
    if (!blockchainTxHash) {
      return res.status(400).json({ error: "blockchainTxHash is required" });
    }

    const txn = await Transaction.findById(req.params.txId);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // Authorization check (M-4): User must have role level <= 2 in the org
    const roleLevel = req.user.getRoleInOrg(txn.organization);
    if (!req.user.isSuperAdmin && (roleLevel === null || roleLevel > 2)) {
      return res.status(403).json({ error: "Access denied. Requires role level 2 or above." });
    }

    // Update the blockchain hash on the transaction
    txn.blockchainTxHash = blockchainTxHash;
    await txn.save();

    // Also update the approval record
    await Approval.findOneAndUpdate(
      { transaction: txn._id, approver: req.user._id },
      { blockchainTxHash }
    );

    res.json({ success: true, transaction: txn });
  } catch (err) {
    console.error("Hash update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
