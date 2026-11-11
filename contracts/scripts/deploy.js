import hardhat from "hardhat";
const { ethers, network } = hardhat;

function resolveInitialApprovers(signers, deployerAddress) {
  const fromList = (process.env.INITIAL_APPROVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("your_"));

  const secondaryRaw = (process.env.SECONDARY_APPROVER_ADDRESS || "").trim();
  const hasSecondary = Boolean(secondaryRaw && !secondaryRaw.startsWith("your_"));

  let approvers;
  if (fromList.length > 0) {
    approvers = fromList;
  } else if (hasSecondary) {
    approvers = [deployerAddress, secondaryRaw];
  } else if (network.name === "hardhat" || network.name === "localhost") {
    approvers = signers.length >= 2 ? [signers[0].address, signers[1].address] : [deployerAddress];
  } else {
    throw new Error(
      "Missing SECONDARY_APPROVER_ADDRESS or INITIAL_APPROVERS in contracts/.env for live network deployment."
    );
  }

  const deduped = [];
  for (const addr of approvers) {
    if (!ethers.isAddress(addr)) {
      throw new Error(`Invalid approver address in environment: ${addr}`);
    }
    const checksum = ethers.getAddress(addr);
    if (!deduped.includes(checksum)) {
      deduped.push(checksum);
    }
  }
  return deduped;
}

async function main() {
  const signers = await ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      "No deployer signer available for network '" +
        network.name +
        "'. Set a valid 64-hex PRIVATE_KEY in contracts/.env before deploying."
    );
  }

  const deployer = signers[0];
  console.log(`Deploying ChainBudget contracts on '${network.name}' with deployer:`, deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "POL");
  if (network.name !== "hardhat" && network.name !== "localhost" && balance === 0n) {
    throw new Error(
      `Deployer ${deployer.address} has 0 POL on '${network.name}'. Fund it from a Polygon Amoy faucet first.`
    );
  }

  const initialApprovers = resolveInitialApprovers(signers, deployer.address);
  const requiredApprovals = Number(
    process.env.REQUIRED_APPROVALS || (initialApprovers.length >= 2 ? 2 : 1)
  );
  if (!Number.isInteger(requiredApprovals) || requiredApprovals < 1 || requiredApprovals > initialApprovers.length) {
    throw new Error(
      `Invalid REQUIRED_APPROVALS=${requiredApprovals} for ${initialApprovers.length} initial approver(s).`
    );
  }
  const initialQuorum = Number(process.env.DAO_INITIAL_QUORUM || requiredApprovals);

  console.log("Initial approvers:", initialApprovers);
  console.log("Required approvals:", requiredApprovals);
  console.log("DAO initial quorum:", initialQuorum);

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

  // 5. Deploy OrgRegistry
  const OrgRegistry = await ethers.getContractFactory("OrgRegistry");
  const orgRegistry = await OrgRegistry.deploy(deployer.address);
  await orgRegistry.waitForDeployment();
  const orgRegistryAddress = await orgRegistry.getAddress();

  console.log("=============================================");
  console.log("All 5 Contracts Deployed Successfully:");
  console.log("ChainBudget (Vault):        ", address);
  console.log("ChainBudgetDAO:             ", daoAddress);
  console.log("MembershipSBT:              ", sbtAddress);
  console.log("ChainBudgetTreasury:        ", treasuryAddress);
  console.log("OrgRegistry:                ", orgRegistryAddress);
  console.log("=============================================");
  console.log("\n# backend/.env & Fly.io secrets:");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`DAO_CONTRACT_ADDRESS=${daoAddress}`);
  console.log(`SBT_CONTRACT_ADDRESS=${sbtAddress}`);
  console.log(`ORG_REGISTRY_CONTRACT_ADDRESS=${orgRegistryAddress}`);
  console.log("\n# frontend/.env.local & Vercel env vars:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_DAO_CONTRACT_ADDRESS=${daoAddress}`);
  console.log(`NEXT_PUBLIC_SBT_CONTRACT_ADDRESS=${sbtAddress}`);
  console.log("\n# mobile/.env:");
  console.log(`EXPO_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`EXPO_PUBLIC_DAO_CONTRACT_ADDRESS=${daoAddress}`);
  console.log(`EXPO_PUBLIC_SBT_CONTRACT_ADDRESS=${sbtAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
