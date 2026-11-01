const { ethers } = require("ethers");

const sbtAbi = [
  "function mintMembership(address to, string memory orgId) external returns (uint256)",
  "event MembershipMinted(address indexed to, uint256 indexed tokenId, string orgId)"
];

async function mintSBT(walletAddress, orgId) {
  try {
    const rpcUrl = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com";
    const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
    const contractAddress = process.env.SBT_CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      console.log("Skipping SBT Mint: BACKEND_WALLET_PRIVATE_KEY or SBT_CONTRACT_ADDRESS not configured in .env");
      return null;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, 80002, { staticNetwork: true });
    const wallet = new ethers.Wallet(privateKey, provider);
    const sbtContract = new ethers.Contract(contractAddress, sbtAbi, wallet);

    console.log(`Minting SBT for ${walletAddress} (Org: ${orgId})...`);
    
    // Call smart contract
    const tx = await sbtContract.mintMembership(walletAddress, orgId.toString());
    const receipt = await tx.wait();
    
    let mintedTokenId = null;
    if (receipt && Array.isArray(receipt.logs)) {
      for (const log of receipt.logs) {
        try {
          const parsed = sbtContract.interface.parseLog(log);
          if (parsed && parsed.name === "MembershipMinted") {
            mintedTokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // Ignore logs from other contracts
        }
      }
    }

    console.log(`SBT Minted successfully! TX Hash: ${receipt.hash}${mintedTokenId ? ` (Token ID: #${mintedTokenId})` : ""}`);
    
    return mintedTokenId ? `#${mintedTokenId} (${receipt.hash})` : receipt.hash;
  } catch (error) {
    console.error("Failed to mint SBT:", error.message || error);
    return null;
  }
}

module.exports = { mintSBT };
