# ChainBudget 🔗💰

**A Blockchain-Based Budget Management System for Transparent Organizational Fund Monitoring**

> Capstone Project — Bachelor of Science in Information Technology  
> College of Computing and Information Sciences, Cor Jesu College  
> Andrei Besanez · Alfie Lynard Polacas · Sanny Sabio  
> Adviser: Sir Benjie Pabroa

---

## Monorepo Structure

```
Chainbudgets/
├── contracts/   ← Solidity smart contracts (Hardhat)
├── backend/     ← REST API (Node.js + Express + Mongoose)
├── frontend/    ← Web dashboard (Next.js 14 + Tailwind CSS)
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js v18+
- npm v9+
- MetaMask browser extension
- MongoDB Atlas account (cluster: `chainbudget`)
- Polygon Amoy RPC URL + deployer wallet

---

### 1. Contracts

```bash
cd contracts
npm install
cp .env.example .env   # Fill in PRIVATE_KEY and AMOY_RPC_URL
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network amoy
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # Fill in MONGO_URI, JWT_SECRET, CONTRACT_ADDRESS
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # Fill in API URL, contract address
npm run dev
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, ethers.js |
| Backend | Node.js, Express.js, Mongoose |
| Database | MongoDB Atlas |
| Blockchain | Solidity, Hardhat, Polygon Amoy testnet |
| Auth | MetaMask wallet signing + JWT (Asgardeo planned) |
| Deployment | Vercel (frontend), Railway (backend) |

---

## Role Levels

| Level | Role | Example |
|---|---|---|
| Super Admin | Platform maintainer | System admin |
| Level 1 | Executive Approver | President, Barangay Captain |
| Level 2 | Finance Officer | Treasurer, Finance Manager |
| Level 3 | Member / Contributor | Staff, Committee member |
| Level 4 | Public Viewer | Donor, Observer |

---

## License
Academic use only — Cor Jesu College Capstone Project 2025–2026.
