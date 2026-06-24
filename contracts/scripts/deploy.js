const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ChainBudget with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  // Initial Level-1 approvers — replace with real wallet addresses before deploying
  // For local testing we use the first three Hardhat test accounts
  const signers = await ethers.getSigners();
  const initialApprovers = [
    signers[0].address, // Replace with real Level-1 wallet address 1
    signers[1].address, // Replace with real Level-1 wallet address 2
  ];

  const requiredApprovals = 2; // 2-of-N threshold

  console.log("Initial approvers:", initialApprovers);
  console.log("Required approvals:", requiredApprovals);

  const ChainBudget = await ethers.getContractFactory("ChainBudget");
  const chainBudget = await ChainBudget.deploy(initialApprovers, requiredApprovals);

  await chainBudget.waitForDeployment();
  const address = await chainBudget.getAddress();

  console.log("✅ ChainBudget deployed to:", address);
  console.log("─────────────────────────────────────────────");
  console.log("Copy this to your backend .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
