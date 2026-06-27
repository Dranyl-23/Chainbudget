# ChainBudget - Backend API

This directory contains the Express.js server that acts as the bridge between the Frontend interface, the MongoDB database (for off-chain metadata), and the Polygon Smart Contracts.

## 🛠️ Technology Stack

*   **Runtime:** [Node.js](https://nodejs.org/)
*   **Framework:** [Express.js](https://expressjs.com/) (RESTful API)
*   **Database:** [MongoDB](https://www.mongodb.com/) (using Mongoose ODM)
*   **Web3 Integration:** [Ethers.js v6](https://docs.ethers.org/v6/) (For interacting with Polygon Amoy)
*   **Email Service:** [Resend](https://resend.com/) (via SMTP)

## 🏗️ Core Responsibilities

1.  **Off-Chain Data Storage:** Stores heavy metadata that is too expensive to put on the blockchain (e.g., long descriptions, PDF receipt links via Pinata IPFS, user profiles).
2.  **Web3 Relayer:** The backend holds a `BACKEND_WALLET_PRIVATE_KEY` funded with test MATIC. When a user approves a transaction on the frontend, the backend submits the actual transaction to the blockchain on their behalf. This ensures a **gasless experience** for the end-user.
3.  **Email Notifications:** Sends automated emails when a request is created, requires approval, or is fully approved and released.

## 📂 Folder Structure

*   `/src/routes`: Express API route handlers (`/transactions`, `/organizations`, `/auth`).
*   `/src/models`: Mongoose database schemas (`Transaction.js`, `Organization.js`, `User.js`).
*   `/src/services`: Core business logic (e.g., `blockchain.js` for Ethers.js integration, `emailService.js`).
*   `/src/utils`: Helper functions (e.g., IPFS/Pinata uploaders, SBT Minter).

## 🚀 Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file in the root of the `/backend` directory:
```env
# MongoDB Atlas
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/chainbudget

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000
PORT=5000

# Blockchain Config
CONTRACT_ADDRESS=your_deployed_smart_contract
BACKEND_WALLET_PRIVATE_KEY=your_private_key_with_matic
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# Asgardeo Config
ASGARDEO_BASE_URL=https://api.asgardeo.io/t/your_org
ASGARDEO_CLIENT_ID=your_client_id

# Email Config (Resend/SMTP)
SMTP_EMAIL=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### 3. Run the Server
For development (with auto-reload):
```bash
npm run dev
```
For production:
```bash
npm start
```

## 🔗 API Endpoints Overview
- `GET /api/transactions` - Fetch all transactions.
- `POST /api/transactions/request` - Create a new budget request.
- `POST /api/transactions/approve/:id` - Approve a transaction (triggers blockchain relayer).
- `GET /api/organizations` - Fetch organization data.
