# ChainBudget - Smart Contracts

This directory contains the Web3 layer of ChainBudget. The smart contracts are written in Solidity and deployed to the **Polygon Amoy Testnet** using the Hardhat development environment.

## 🧠 Web3 Architecture & Core Concepts

Our smart contract (`ChainBudget.sol`) introduces three major Web3 innovations for transparent fund management:

### 1. Soulbound Tokens (SBT) for Roles
We use a custom ERC721 logic but make the tokens **non-transferable** (Soulbound). 
- When an organization is created, roles (like `Secretary`, `Vice-President`) are minted as SBTs to specific wallet addresses.
- This proves *on-chain* that a specific wallet holds a specific position in the organization, preventing authorization fraud.

### 2. Multi-Signature Approval Logic
Before a transaction can be finalized on the blockchain, it must reach the required approval threshold.
- The contract checks the SBT balance of the approver's wallet to ensure they have the right to approve.
- A transaction is only marked as `Status 2 (Completed)` once enough authorized signatures are collected.

### 3. On-Chain Escrow
For high-value transactions, funds are securely held in the smart contract's Escrow balance.
- Funds are only released to the final recipient's wallet once all conditions and hierarchical approvals are met.
- This guarantees that funds cannot be disbursed prematurely.

## 🚀 Local Development & Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
Create a `.env` file in the `/contracts` directory:
```env
PRIVATE_KEY=your_metamask_private_key
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

### 4. Run Tests
We use Mocha/Chai for testing our smart contract logic.
```bash
npx hardhat test
```

## 🌐 Deployment to Polygon Amoy

To deploy the smart contract to the live testnet, run the deployment script:
```bash
npx hardhat run scripts/deploy.js --network amoy
```
*Note: Ensure your `PRIVATE_KEY` wallet has sufficient test MATIC before deploying.*

## ✅ Verification on Polygonscan

To make the smart contract source code public and transparent on Polygonscan, run:
```bash
npx hardhat verify --network amoy <DEPLOYED_CONTRACT_ADDRESS>
```
