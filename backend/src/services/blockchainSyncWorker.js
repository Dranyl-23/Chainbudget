/**
 * blockchainSyncWorker.js
 *
 * Enterprise Asynchronous Blockchain Reconciliation & Auto-Retry Worker.
 * Automatically discovers any transactions that failed or were skipped during on-chain
 * anchoring (e.g. due to temporary gas exhaustion or RPC latency) and syncs them to Polygon Amoy.
 */

const { ethers } = require("ethers");
const User = require("../models/User");
const Organization = require("../models/Organization");
const Transaction = require("../models/Transaction");
const { recordTransactionOnChain } = require("./blockchain");

let isSyncing = false;

/**
 * Checks backend relayer wallet balance and reconciles unanchored transactions.
 * @param {object} io - Socket.io instance for real-time client updates
 */
const syncPendingTransactions = async (io = null) => {
  if (isSyncing) {
    return { status: "already_running" };
  }

  const rpcUrl = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    return { status: "skipped", reason: "Blockchain not configured" };
  }

  isSyncing = true;
  let syncedCount = 0;
  let errorCount = 0;

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // 1. Check Relayer Gas Balance
    const balanceWei = await provider.getBalance(wallet.address);
    const balancePol = Number(ethers.formatEther(balanceWei));

    if (balancePol < 0.003) {
      console.warn(
        `[BlockchainSyncWorker] Relayer gas low: ${balancePol.toFixed(4)} POL. Minimum needed: 0.005 POL. Waiting for faucet funding.`
      );
      isSyncing = false;
      return { status: "low_gas", balance: balancePol };
    }

    // 2. Find transactions that are approved/completed but not yet anchored on-chain
    const pendingTxns = await Transaction.find({
      status: { $in: ["approved", "completed"] },
      $or: [
        { isRecordedOnChain: false },
        { isRecordedOnChain: { $exists: false } },
        { blockchainTxHash: null },
        { blockchainTxHash: { $exists: false } },
      ],
    })
      .populate("submittedBy", "walletAddress displayName")
      .limit(10) // Process in safe batches of 10 to avoid nonce race conditions
      .sort({ createdAt: 1 });

    if (pendingTxns.length === 0) {
      isSyncing = false;
      return { status: "up_to_date", synced: 0 };
    }

    console.log(
      `[BlockchainSyncWorker] Found ${pendingTxns.length} unanchored transaction(s). Starting on-chain synchronization...`
    );

    for (const txn of pendingTxns) {
      try {
        const recipientWallet =
          (txn.submittedBy && txn.submittedBy.walletAddress) ||
          "0x0000000000000000000000000000000000000000";

        const payload = JSON.stringify({
          orgId: txn.organization?.toString(),
          amount: txn.amount,
          type: txn.type,
          description: txn.description,
          submittedBy: recipientWallet,
          timestamp: txn.createdAt ? txn.createdAt.toISOString() : new Date().toISOString(),
          documentHash: txn.documentHash || null,
        });

        const result = await recordTransactionOnChain(
          payload,
          Math.floor(txn.amount || 0),
          recipientWallet,
          txn.isHighValue || false,
          txn.isEscrow === true
        );

        if (result && !result.skipped && result.blockchainTxHash) {
          txn.onChainTxId = result.onChainTxId;
          txn.blockchainTxHash = result.blockchainTxHash;
          txn.dataHash = result.dataHash;
          txn.isRecordedOnChain = true;
          await txn.save();

          syncedCount++;
          console.log(
            `[BlockchainSyncWorker] Successfully anchored Tx ${txn._id} on Polygon Amoy! Hash: ${result.blockchainTxHash}`
          );

          // Broadcast real-time update to Mobile and Web clients
          if (io) {
            io.emit("transaction_updated", {
              txId: txn._id,
              orgId: txn.organization,
              isRecordedOnChain: true,
              blockchainTxHash: result.blockchainTxHash,
              onChainTxId: result.onChainTxId,
            });
          }
        }
      } catch (txErr) {
        errorCount++;
        console.error(
          `[BlockchainSyncWorker] Failed to anchor Tx ${txn._id}:`,
          txErr.message
        );
        // If out of gas during loop, stop processing rest of batch
        if (txErr.message && txErr.message.includes("insufficient funds")) {
          break;
        }
      }
    }
  } catch (globalErr) {
    console.error("[BlockchainSyncWorker] Worker error:", globalErr.message);
  } finally {
    isSyncing = false;
  }

  return { status: "completed", synced: syncedCount, errors: errorCount };
};

/**
 * Initializes the background recurring worker.
 * @param {object} io - Socket.io instance
 * @param {number} intervalMs - Poll interval in milliseconds (default: 45s)
 */
const startBlockchainSyncWorker = (io, intervalMs = 45000) => {
  console.log(
    `[BlockchainSyncWorker] Initializing Blockchain Reconciliation Worker (Interval: ${intervalMs / 1000}s)...`
  );

  // Initial delayed run (10 seconds after server boot)
  setTimeout(() => {
    syncPendingTransactions(io).catch((err) =>
      console.error("[BlockchainSyncWorker] Initial sync error:", err.message)
    );
  }, 10000);

  // Recurring cron worker
  setInterval(() => {
    syncPendingTransactions(io).catch((err) =>
      console.error("[BlockchainSyncWorker] Interval sync error:", err.message)
    );
  }, intervalMs);
};

module.exports = {
  startBlockchainSyncWorker,
  syncPendingTransactions,
};
