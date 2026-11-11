import "@nomicfoundation/hardhat-toolbox";
import { subtask } from "hardhat/config.js";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names.js";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);

// Use local bundled solc from node_modules/solc when it matches the configured version (enables offline builds & tests)
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  try {
    const compilerPath = require.resolve("solc/soljson.js");
    const solc = require("solc");
    const longVersion = typeof solc.version === "function" ? solc.version() : args.solcVersion;
    const shortVersion = longVersion.split("+")[0];
    if (shortVersion === args.solcVersion) {
      return {
        compilerPath,
        isSolcJs: true,
        version: shortVersion,
        longVersion,
      };
    }
  } catch {
    // Fall back to Hardhat's default compiler downloader when bundled solc is unavailable
  }
  return runSuper();
});

const normalizePrivateKey = (raw) => {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  const prefixed = cleaned.startsWith("0x") ? cleaned : `0x${cleaned}`;
  return /^0x[0-9a-fA-F]{64}$/.test(prefixed) ? prefixed : null;
};

const amoyPrivateKey = normalizePrivateKey(process.env.PRIVATE_KEY);

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: amoyPrivateKey ? [amoyPrivateKey] : [],
      chainId: 80002,
    },
  },
  etherscan: {
    // Single Etherscan API V2 key works across all supported chains (including Polygon Amoy 80002).
    apiKey: (
      process.env.ETHERSCAN_API_KEY ||
      process.env.POLYGONSCAN_API_KEY ||
      ""
    ).trim(),
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
