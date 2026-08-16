import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ChainBudget contracts with deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  // Initial Level-1 approvers
  const initialApprovers = [
    deployer.address,
    "0x20b27B77e153837bCAE263328D6E82666eecCBF6",
  ];

  const requiredApprovals = 2; // 2-of-N threshold
  const initialQuorum = 2;

  console.log("Initial approvers:", initialApprovers);
  console.log("Required approvals:", requiredApprovals);

  // 1. Deploy ChainBudget Vault
  const ChainBudget = await ethers.getContractFactory("ChainBudget");
  const chainBudget = await ChainBudget.deploy(initialApprovers, requiredApprovals);
  await chainBudget.waitForDeployment();
  const address = await chainBudget.getAddress();

  // 2. Deploy ChainBudgetDAO
  const ChainBudgetDAO = await ethers.getContractFactory("ChainBudgetDAO");
  const chainBudgetDAO = await ChainBudgetDAO.deploy(initialQuorum);
  await chainBudgetDAO.waitForDeployment();
  const daoAddress = await chainBudgetDAO.getAddress();

  // 3. Deploy MembershipSBT
  const MembershipSBT = await ethers.getContractFactory("MembershipSBT");
  const membershipSBT = await MembershipSBT.deploy(deployer.address);
  await membershipSBT.waitForDeployment();
  const sbtAddress = await membershipSBT.getAddress();

  // 4. Deploy ChainBudgetTreasury
  const ChainBudgetTreasury = await ethers.getContractFactory("ChainBudgetTreasury");
  const chainBudgetTreasury = await ChainBudgetTreasury.deploy(initialApprovers, requiredApprovals);
  await chainBudgetTreasury.waitForDeployment();
  const treasuryAddress = await chainBudgetTreasury.getAddress();

  console.log("=============================================");
  console.log("Contracts Deployed Successfully:");
  console.log("ChainBudget (Vault):        ", address);
  console.log("ChainBudgetDAO:             ", daoAddress);
  console.log("MembershipSBT:              ", sbtAddress);
  console.log("ChainBudgetTreasury:        ", treasuryAddress);
  console.log("=============================================");
  console.log("Environment variables for backend .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`DAO_CONTRACT_ADDRESS=${daoAddress}`);
  console.log(`SBT_CONTRACT_ADDRESS=${sbtAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
