const { ethers } = require("ethers");
const ChainBudgetABI = require("../lib/ChainBudget.json");

let provider = null;
let contract = null;
let signer = null;

/// Initialize the provider, signer, and contract instance
const initBlockchain = () => {
  if (contract) return; // Already initialized

  const rpcUrl = process.env.AMOY_RPC_URL;
  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress) {
    console.warn(
      "Blockchain service: Missing env vars (AMOY_RPC_URL, BACKEND_WALLET_PRIVATE_KEY, CONTRACT_ADDRESS). Blockchain calls will be skipped."
    );
    return;
  }

  provider = new ethers.JsonRpcProvider(rpcUrl);
  signer = new ethers.Wallet(privateKey, provider);
  contract = new ethers.Contract(
    contractAddress,
    ChainBudgetABI.abi,
    signer
  );

  console.log("Blockchain service initialized. Contract:", contractAddress);
};

/// Record a transaction reference on-chain
/// @param {string} payload - JSON string of the off-chain transaction data
/// @param {number} amount  - Numeric amount
/// @param {string} toAddress - Recipient address of the funds
/// @param {boolean} isEscrow
/// @returns {object} { onChainTxId, blockchainTxHash, dataHash }
const recordTransactionOnChain = async (payload, amount, toAddress, isHighValue, isEscrow) => {
  initBlockchain();
  if (!contract) {
    return { skipped: true, reason: "Blockchain not configured" };
  }

  try {
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(payload));
    const tx = await contract.recordTransaction(dataHash, amount, toAddress, isHighValue, isEscrow);
    
    // Add timeout to prevent hanging indefinitely
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Blockchain transaction timeout (60s)")), 60000)
      ),
    ]);

    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    // Parse the TransactionRecorded event to get the on-chain ID
    const event = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "TransactionRecorded");

    const onChainTxId = event ? Number(event.args.txId) : null;

    return {
      onChainTxId,
      blockchainTxHash: receipt.hash,
      dataHash,
    };
  } catch (error) {
    console.error("Blockchain recordTransaction error:", error.message);
    throw error; // Re-throw so caller can handle
  }
};

/// Submit an approval on-chain (called when a Level-1 user approves via the app)
/// Note: For prototype, the backend service wallet submits on behalf of the approver.
/// In production, the approver would sign directly via MetaMask (frontend).
const submitApprovalOnChain = async (onChainTxId) => {
  initBlockchain();
  if (!contract) {
    return { skipped: true, reason: "Blockchain not configured" };
  }

  try {
    const tx = await contract.submitApproval(onChainTxId);
    
    // Add timeout to prevent hanging
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Blockchain transaction timeout (60s)")), 60000)
      ),
    ]);

    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    return { blockchainTxHash: receipt.hash };
  } catch (error) {
    console.error("Blockchain submitApproval error:", error.message);
    throw error;
  }
};

/// Fetch on-chain transaction record
const getOnChainTransaction = async (onChainTxId) => {
  initBlockchain();
  if (!contract) return null;
  return await contract.getTransaction(onChainTxId);
};

/// Release escrow funds (can be called by backend owner or direct payee)
const releaseEscrowOnChain = async (onChainTxId) => {
  initBlockchain();
  if (!contract) {
    return { skipped: true, reason: "Blockchain not configured" };
  }

  try {
    const tx = await contract.releaseEscrow(onChainTxId);
    
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Blockchain transaction timeout (60s)")), 60000)
      ),
    ]);

    if (!receipt) {
      throw new Error("Transaction receipt is null");
    }

    return { blockchainTxHash: receipt.hash };
  } catch (error) {
    console.error("Blockchain releaseEscrow error:", error.message);
    throw error;
  }
};

module.exports = {
  recordTransactionOnChain,
  submitApprovalOnChain,
  getOnChainTransaction,
  releaseEscrowOnChain,
};
