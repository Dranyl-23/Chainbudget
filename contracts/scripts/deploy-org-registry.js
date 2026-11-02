import hardhat from "hardhat";
const { ethers } = hardhat;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying OrgRegistry with account:", deployer.address);

  const OrgRegistry = await ethers.getContractFactory("OrgRegistry");
  const registry = await OrgRegistry.deploy(deployer.address);

  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log("OrgRegistry deployed to:", address);
  console.log("Set ORG_REGISTRY_CONTRACT_ADDRESS=" + address + " in backend/.env");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
