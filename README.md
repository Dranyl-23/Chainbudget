# ChainBudget: Transparent Fund Management System

ChainBudget is a modern, blockchain-powered Web3 application designed to bring absolute transparency and security to institutional or organizational fund management. By combining traditional web application architecture (Web2) with decentralized smart contracts (Web3), ChainBudget ensures that every approved budget request is permanently and immutably recorded on the blockchain.

## 🚀 Key Features

*   **Role-Based Access Control:** Secure authentication powered by Asgardeo (WSO2), ensuring that only authorized users (Requesters, Approvers, Super Admins) can perform specific actions.
*   **Multi-Level Approval Workflow:** Budget requests go through a hierarchical approval process (e.g., Secretary -> Vice-President -> Treasurer) before funds are disbursed.
*   **Blockchain Immutability:** Once a transaction is fully approved, its details (amount, recipient, cryptographic hash of the data) are permanently recorded on the Polygon Amoy testnet.
*   **Soulbound Tokens (SBT):** Organizational roles are represented as non-transferable Soulbound Tokens on the blockchain, acting as an on-chain identity and authorization mechanism.
*   **Escrow Mechanism:** For high-value transactions, funds are securely held in an on-chain escrow until final conditions are met and released.
*   **Automated Email Notifications:** Users and approvers receive real-time email notifications (via Resend) when transactions are created or approved.
*   **Gasless Transactions for Users:** The backend acts as a relayer, meaning normal users don't need to pay cryptocurrency gas fees to interact with the blockchain.

## 🏗️ System Architecture

ChainBudget is built using a modern Full-Stack Web3 architecture, divided into three main layers:

1.  **Frontend (Next.js):** The user-facing application providing the UI/UX. It handles user interactions, displays the dashboard and cash flow graphs, and communicates with the backend API.
2.  **Backend (Express.js & MongoDB):** The central server that processes business logic, stores off-chain metadata (like request descriptions and user profiles), handles email notifications, and interacts with the blockchain on behalf of users.
3.  **Smart Contracts (Solidity):** The decentralized logic deployed on the Polygon network. It enforces rules, holds escrow funds, and stores immutable transaction records.

## 💻 Tech Stack

*   **Frontend:** Next.js 14, React, Tailwind CSS, Recharts, Lucide Icons.
*   **Backend:** Node.js, Express.js, MongoDB (Mongoose), Ethers.js v6, Resend (Emails).
*   **Blockchain:** Solidity ^0.8.24, Hardhat, Polygon Amoy Testnet.
*   **Identity & Auth:** Asgardeo (OIDC/OAuth2).

## 📂 Repository Structure

*   `/frontend` - The Next.js web application.
*   `/backend` - The Express.js server and API endpoints.
*   `/contracts` - The Hardhat project containing Solidity smart contracts and deployment scripts.

*(Please see the `README.md` inside each of the folders above for specific setup instructions and deeper technical details).*

## ⚙️ Quick Start (Local Development)

To run the entire ChainBudget system locally, you need to set up and run all three components:

1.  **Smart Contracts:** Deploy the local contracts using Hardhat.
2.  **Backend:** Start the Express server and connect to MongoDB.
3.  **Frontend:** Start the Next.js development server.

Refer to the individual README files in `/contracts`, `/backend`, and `/frontend` for detailed step-by-step setup guides.
