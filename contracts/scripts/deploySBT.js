import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MembershipSBT with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC");

  const MembershipSBT = await ethers.getContractFactory("MembershipSBT");
  const sbt = await MembershipSBT.deploy();
  await sbt.waitForDeployment();
  const address = await sbt.getAddress();

  console.log("MembershipSBT deployed to:", address);
  console.log("─────────────────────────────────────────────");
  console.log("Copy this to your backend .env:");
  console.log(`SBT_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
