const Transaction = require("../models/Transaction");
const Organization = require("../models/Organization");
const Budget = require("../models/Budget");
const Approval = require("../models/Approval");
const AuditLog = require("../models/AuditLog");
const { recordTransactionOnChain, submitApprovalOnChain } = require("./blockchain");
const { sendEmail, escapeHtml } = require("./email");

/**
 * TransactionService (B-1 & B-3 FIX)
 *
 * Encapsulates core financial transaction workflows, budget validation,
 * approval resolution, and non-blocking asynchronous blockchain recording.
 */
class TransactionService {
  /**
   * Evaluates whether a transaction is approved based on collected approvals
   * vs organization requirements.
   *
   * @param {string} transactionId
   * @param {object} organization
   * @returns {Promise<boolean>}
   */
  static async checkApprovalThreshold(transactionId, organization) {
    const requiredCount = organization.requiredApprovals || 2;
    const approvalCount = await Approval.countDocuments({
      transaction: transactionId,
      status: "approved",
    });
    return approvalCount >= requiredCount;
  }

  /**
   * Triggers non-blocking background on-chain recording for approved transactions.
   * Does NOT block the HTTP response thread (B-3 Fix).
   *
   * @param {object} txn - Mongoose Transaction document
   * @param {object} io - Socket.io instance for async status updates
   */
  static triggerAsyncBlockchainSync(txn, io) {
    // Execute asynchronously in background without blocking caller
    setImmediate(async () => {
      try {
        if (!txn.onChainTxId && !txn.blockchainTxHash) {
          const payload = JSON.stringify({
            id: txn._id.toString(),
            description: txn.description,
            category: txn.category,
            referenceNumber: txn.referenceNumber,
            date: txn.createdAt,
          });

          const result = await recordTransactionOnChain(
            payload,
            txn.amount,
            txn.recipientAddress || "0x0000000000000000000000000000000000000000",
            txn.isHighValue || false,
            txn.isEscrow || false
          );

          if (result && result.blockchainTxHash) {
            await Transaction.findByIdAndUpdate(txn._id, {
              blockchainTxHash: result.blockchainTxHash,
              onChainTxId: result.onChainTxId,
              isBlockchainPending: false,
            });

            if (io && txn.organization) {
              io.to(`org:${txn.organization}`).emit("transaction_onchain_confirmed", {
                transactionId: txn._id,
                blockchainTxHash: result.blockchainTxHash,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[TransactionService] Background on-chain sync error for ${txn._id}:`, err.message);
      }
    });
  }

  /**
   * Safely deducts amount from matching budget category.
   *
   * @param {string} organizationId
   * @param {string} budgetCategory
   * @param {number} amount
   * @param {object} session - Optional mongoose transaction session
   */
  static async applyBudgetDeduction(organizationId, budgetCategory, amount, session = null) {
    if (!budgetCategory || !amount) return null;

    const query = {
      organization: organizationId,
      category: budgetCategory,
      isActive: true,
    };

    const update = {
      $inc: { spent: amount },
    };

    const options = session ? { session, new: true } : { new: true };
    return await Budget.findOneAndUpdate(query, update, options);
  }
}

module.exports = TransactionService;
