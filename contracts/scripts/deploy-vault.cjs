const path = require("path");
const { ethers } = require(path.resolve(__dirname, "../../backend/node_modules/ethers"));
const artifact = require(path.resolve(__dirname, "../../backend/src/lib/ChainBudget.json"));
require(path.resolve(__dirname, "../../backend/node_modules/dotenv")).config({ path: path.resolve(__dirname, "../../backend/.env") });

async function deployVault() {
  console.log("--------------------------------------------------");
  console.log("Deploying fresh ChainBudget.sol to Polygon Amoy...");
  console.log("--------------------------------------------------");

  const rpcUrl = "https://polygon-amoy-bor-rpc.publicnode.com";
  const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY || "0xdd8432526fb22c2bc093f850d2410f63008b06405a2348f0d18545d0a3f2c921";
  
  const provider = new ethers.JsonRpcProvider(rpcUrl, 80002, { staticNetwork: true });
  const deployer = new ethers.Wallet(privateKey, provider);

  console.log("Deployer Address (Owner):", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Deployer Balance:        ", ethers.formatEther(balance), "POL");

  // Initial approvers: deployer + user's MetaMask wallet
  const initialApprovers = [
    deployer.address,
    "0x3A9882B58f34a89c4A5CE0328222cDD8b8Cc6c85",
  ];
  const requiredApprovals = 1; // 1-of-N threshold so approvals succeed smoothly

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
