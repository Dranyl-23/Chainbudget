import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MembershipSBT with account:", deployer.address);

  const MembershipSBT = await ethers.getContractFactory("MembershipSBT");
  const sbt = await MembershipSBT.deploy();

  await sbt.waitForDeployment();
  const address = await sbt.getAddress();

  console.log("MembershipSBT deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
