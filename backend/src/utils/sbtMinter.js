const { ethers } = require("ethers");

const sbtAbi = [
  "function mintMembership(address to, string memory orgId) external returns (uint256)"
];

async function mintSBT(walletAddress, orgId) {
  try {
    const rpcUrl = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/";
    const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
    const contractAddress = process.env.SBT_CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      console.log("Skipping SBT Mint: BACKEND_WALLET_PRIVATE_KEY or SBT_CONTRACT_ADDRESS not configured in .env");
      return null;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const sbtContract = new ethers.Contract(contractAddress, sbtAbi, wallet);

    console.log(`Minting SBT for ${walletAddress} (Org: ${orgId})...`);
    
    // Call smart contract
    const tx = await sbtContract.mintMembership(walletAddress, orgId.toString());
    const receipt = await tx.wait();
    
    console.log(`SBT Minted successfully! TX Hash: ${receipt.hash}`);
    
    // Normally we'd parse the event to get the tokenId, but since it's an auto-incrementing ID
    // and we don't strictly need it in the DB to prove ownership (the blockchain is the truth),
    // we can just return success.
    return receipt.hash;
  } catch (error) {
    console.error("Failed to mint SBT:", error.message || error);
    return null;
  }
}

module.exports = { mintSBT };
