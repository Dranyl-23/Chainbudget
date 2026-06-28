const express = require("express");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const router = express.Router();
const Approval = require("../models/Approval");
const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const AuditLog = require("../models/AuditLog");
const { authenticate, requireRole } = require("../middleware/auth");

/// POST /api/approvals/:txId — Submit approval/rejection (Level 1 and 2)
router.post("/:txId", authenticate, requireRole(2), async (req, res) => {
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
    try {
      const domain = { name: "ChainBudget", version: "1" };
      const types = {
        Approval: [
          { name: "action", type: "string" },
          { name: "txId", type: "string" },
          { name: "amount", type: "string" },
          { name: "description", type: "string" }
        ]
      };
      const message = {
        action,
        txId: txn._id.toString(),
        amount: txn.amount.toString(),
        description: txn.description
      };
      
      const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);
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
            // Setup relayer using local Hardhat node for demo purposes
            const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL || "http://127.0.0.1:8545");
            const relayerPrivateKey = process.env.BACKEND_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Default Hardhat Account #0
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
                
                // We convert PHP amount to WEI equivalent (e.g., 1 PHP = 1 WEI for simplicity in demo)
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

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("transaction_updated", { orgId: org._id });
      io.emit("new_notification", {
        orgId: org._id,
        id: txn._id,
        title: "Approval Granted",
        message: `${req.user.displayName || 'An Executive'} approved a transaction for ${txn.amount}.`,
        type: "system",
        timestamp: new Date().toISOString()
      });
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
