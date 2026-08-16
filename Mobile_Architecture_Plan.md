# ChainBudget: React Native Mobile Architecture Plan

This document outlines the planned architectural shift to a **Mobile-First Experience** using React Native for normal members, while retaining the Next.js Web Dashboard for Founders and Admins. It also introduces **Account Abstraction (Custodial Wallets)** to remove the MetaMask barrier.

## 📱 Dual-Frontend Architecture
The system will now operate with two distinct frontends talking to the same Node.js/Express Backend:
1. **Next.js Web Dashboard (Admin/Founder View):** Used for complex tasks like setting up the organization, managing budgets, and approving high-value transactions. Founders can still use MetaMask here.
2. **React Native Mobile App (Member View):** A streamlined mobile app built with React Native (Expo) designed for everyday members to request funds, scan receipts via AI, and view their organization's public ledger on the go.

## 🔐 Account Abstraction (Seamless Web2 Onboarding)
To prevent non-technical users from dropping out during signup, the React Native app will NOT require MetaMask.

### How it works:
1. **Email-Based Invites:** The Founder invites a member using their Email Address via the Web Dashboard.
2. **Asgardeo Authentication:** The member downloads the React Native app and logs in using that same Email Address (via Asgardeo Mobile SDK).
3. **Automated Web3 Wallet Generation:** Upon first login, the backend automatically generates a Web3 Wallet (`ethers.Wallet.createRandom()`) specifically for that user.
   - **Public Key (Wallet Address):** Used to identify the user on the blockchain.
   - **Private Key:** Securely encrypted and stored on the backend, allowing the server to sign transactions on the user's behalf without MetaMask.
   - **12-Word Recovery Phrase (Mnemonic):** Generated and securely stored for account recovery.

## 🤝 Smart Team Mapping
Because the wallet is auto-generated *after* the invite is sent, the system relies on the **Email Address** as the primary link. Once the user logs in and their wallet is generated, the backend instantly detects their pending email invite and maps their new Web3 Wallet to the Organization's DAO.

## ⚙️ Security & Exportability
Even though the app hides the complexity of blockchain, users maintain true ownership of their assets:
- Inside the React Native app's Profile Settings, users will have a **"Security"** tab.
- They can authenticate (via biometrics or PIN) to reveal their **Private Key** and **12-Word Recovery Phrase**.
- If they wish to become "hardcore" Web3 users, they can simply copy these keys and import them into a self-custodial wallet like MetaMask or Trust Wallet.
