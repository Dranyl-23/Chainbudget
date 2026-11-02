import "@nomicfoundation/hardhat-toolbox";
import { subtask } from "hardhat/config.js";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names.js";
import { createRequire } from "module";
import dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);

// Use local bundled solc from node_modules/solc when available (enables offline builds & tests)
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  try {
    const compilerPath = require.resolve("solc/soljson.js");
    const solc = require("solc");
    const longVersion = typeof solc.version === "function" ? solc.version() : args.solcVersion;
    return {
      compilerPath,
      isSolcJs: true,
      version: args.solcVersion,
      longVersion,
    };
  } catch {
    return runSuper();
  }
});

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.24",
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
      accounts:
        process.env.PRIVATE_KEY &&
        process.env.PRIVATE_KEY.startsWith("0x") &&
        process.env.PRIVATE_KEY.length === 66
          ? [process.env.PRIVATE_KEY]
          : [],
      chainId: 80002,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
