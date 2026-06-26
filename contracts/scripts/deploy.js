import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ChainBudget with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  // Initial Level-1 approvers
  const signers = await ethers.getSigners();
  const initialApprovers = [
    signers[1].address, // Deployer and Level-1 approver 1
    signers[2].address, // Level-1 approver 2
  ];

  const requiredApprovals = 2; // 2-of-N threshold

  console.log("Initial approvers:", initialApprovers);
  console.log("Required approvals:", requiredApprovals);

  const ChainBudget = await ethers.getContractFactory("ChainBudget");
  const chainBudget = await ChainBudget.deploy(initialApprovers, requiredApprovals);

  await chainBudget.waitForDeployment();
  const address = await chainBudget.getAddress();

  const ChainBudgetDAO = await ethers.getContractFactory("ChainBudgetDAO");
  const chainBudgetDAO = await ChainBudgetDAO.deploy();
  await chainBudgetDAO.waitForDeployment();
  const daoAddress = await chainBudgetDAO.getAddress();

  console.log("ChainBudget deployed to:", address);
  console.log("ChainBudgetDAO deployed to:", daoAddress);
  console.log("─────────────────────────────────────────────");
  console.log("Copy this to your backend .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`DAO_CONTRACT_ADDRESS=${daoAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
