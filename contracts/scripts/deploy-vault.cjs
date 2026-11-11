const path = require("path");
const { ethers } = require(path.resolve(__dirname, "../../backend/node_modules/ethers"));
const artifact = require(path.resolve(__dirname, "../../backend/src/lib/ChainBudget.json"));
require(path.resolve(__dirname, "../../backend/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../../backend/.env") });

async function deployVault() {
  console.log("--------------------------------------------------");
  console.log("Deploying fresh ChainBudget.sol to Polygon Amoy...");
  console.log("--------------------------------------------------");

  const rpcUrl = process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com";
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.BACKEND_WALLET_PRIVATE_KEY;
  if (!privateKey || privateKey.includes("your_deployer_wallet")) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY, PRIVATE_KEY, or BACKEND_WALLET_PRIVATE_KEY in environment.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, 80002, { staticNetwork: true });
  const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const deployer = new ethers.Wallet(normalizedKey, provider);

  console.log("Deployer Address (Owner):", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Deployer Balance:        ", ethers.formatEther(balance), "POL");

  const secondaryApprover = process.env.SECONDARY_APPROVER_ADDRESS;
  const initialApprovers = secondaryApprover
    ? [deployer.address, secondaryApprover]
    : [deployer.address];
  const requiredApprovals = Number(process.env.REQUIRED_APPROVALS || (initialApprovers.length >= 2 ? 2 : 1));

  console.log("Initial Approvers:       ", initialApprovers);
  console.log("Required Approvals:      ", requiredApprovals);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  const gasPrice = ethers.parseUnits("35", "gwei");

  console.log("Sending deployment transaction (gasPrice: 35 gwei)...");
  const contract = await factory.deploy(initialApprovers, requiredApprovals, {
    gasPrice,
    type: 0,
  });

  console.log("Deployment Tx Hash:      ", contract.deploymentTransaction().hash);
  console.log("Waiting for confirmation on Polygon Amoy...");

  await contract.waitForDeployment();
  const newAddress = await contract.getAddress();

  console.log("==================================================");
  console.log("ChainBudget Vault DEPLOYED SUCCESSFULLY!");
  console.log("New Contract Address:    ", newAddress);
  console.log("Contract Owner:          ", await contract.owner());
  console.log("==================================================");

  return newAddress;
}

deployVault()
  .then((addr) => {
    console.log("SUCCESS:", addr);
    process.exit(0);
  })
  .catch((err) => {
    console.error("DEPLOYMENT FAILED:", err);
    process.exit(1);
  });
