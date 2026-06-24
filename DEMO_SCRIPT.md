# 🎬 Defense Demo Script (5-7 minutes)

## Pre-Demo Checklist
- [ ] Browser tabs ready: Frontend + Polygonscan
- [ ] Multiple MetaMask accounts: Level 1 + Level 2
- [ ] Test transaction amount ready (pick ₱5,000 and ₱15,000)
- [ ] Screenshots of diagrams available
- [ ] Network set to Polygon Amoy in MetaMask
- [ ] Internet connection stable

---

## 📊 Demo Flow (7 minutes total)

### **Minute 0-1: Architecture Overview**
**Show:** System Architecture Diagram
```
"ChainBudget is a blockchain-based budget management system. 
Users connect via MetaMask wallet on the frontend. 
The backend applies role-based access control and business rules. 
Transactions are recorded on Polygon Amoy testnet for transparency.
Database stores flexible data, blockchain stores immutable hashes."
```

---

### **Minute 1-2: Wallet Login & Authentication**
**Action:** Demonstrate wallet connection

```
1. Click "Connect Wallet" button
2. MetaMask popup appears
3. Click "Connect" → User grants permission
4. MetaMask prompts to sign message (nonce)
5. Click "Sign" → Signature sent to backend
6. Backend verifies signature
7. Frontend stores JWT in localStorage
8. Redirected to dashboard as Level 2 user
```

**Talking Point:**
> "The wallet login uses cryptographic signatures, not passwords. 
> This is more secure because users never share their private key. 
> The backend verifies the signature to prove wallet ownership."

---

### **Minute 2-4: Create & Auto-Approve Low-Value Transaction**
**Action:** Create ₱5,000 transaction (below ₱10,000 threshold)

```
1. Navigate to Transactions page
2. Click "Create Transaction"
3. Fill form:
   - Type: Expense
   - Amount: 5000
   - Description: "Office supplies"
   - Category: "Administrative"
4. Click "Submit"
```

**What happens in background:**
- Backend validates role (Level 2 ✓)
- Checks threshold: 5000 < 10000 = LOW-VALUE ✓
- Auto-approves immediately
- Records transaction on blockchain
- Captures dataHash from Keccak256

**Expected response:**
```
✅ Transaction approved!
Blockchain Hash: 0x1234...abcd
On-Chain TX ID: 1
View on Polygonscan →
```

**Talking Point:**
> "This low-value transaction was automatically approved because 
> it's below the organization's ₱10,000 threshold. 
> The system immediately recorded it on the blockchain for immutability. 
> Anyone can verify this transaction exists by checking Polygonscan."

**Minute 3.5:** Click "View on Polygonscan" link
- Shows blockchain explorer with transaction hash
- Demonstrates immutability proof
- Highlight dataHash in transaction logs

---

### **Minute 4-5.5: Create & Approve High-Value Transaction**
**Action:** Create ₱15,000 transaction (above threshold, requires approval)

```
1. Click "Create Transaction" again
2. Fill form:
   - Type: Expense
   - Amount: 15000
   - Description: "Equipment purchase"
   - Category: "Equipment"
3. Click "Submit"
```

**Expected response:**
```
⏳ Transaction pending approval
Status: Awaiting 2 of 2 Level 1 approvals
Approvers: [empty list]
View pending approvals →
```

**Talking Point:**
> "This high-value transaction exceeds the threshold, 
> so it enters a multi-signature approval queue. 
> It requires approval from 2 Level 1 users (executives) before recording. 
> Let me demonstrate the approval workflow."

**Switch to Level 1 Account:**
```
1. Open MetaMask second account (Level 1)
2. Log in to Chainbudgets with this account
3. Navigate to Approvals page
4. See pending transaction (₱15,000 - Equipment purchase)
5. Click "Approve"
6. Add comment: "Approved for Q2 equipment"
7. Click "Submit Approval"
```

**Expected:**
```
✅ Approval submitted!
Approvals: 1 of 2
Waiting for 1 more approval...
```

**Second Level 1 Approval:**
```
1. Open third MetaMask account (another Level 1)
2. Log in
3. Go to Approvals
4. See same transaction
5. Click "Approve"
6. Click "Submit"
```

**Expected:**
```
✅ Threshold reached! Transaction recorded on blockchain.
Blockchain Hash: 0x5678...efgh
On-Chain TX ID: 2
View on Polygonscan →
```

**Talking Point:**
> "Now that we have 2 approved signatures, the system automatically 
> recorded the high-value transaction on the blockchain. 
> This ensures no single person can approve large expenses alone. 
> The approval audit trail is permanently stored."

---

### **Minute 5.5-6.5: Show Audit Trail & Role-Based Access**
**Action:** Navigate to Audit page

```
View all recorded actions:
✓ Transaction created (Level 2 user, 5000 PHp, auto-approved)
✓ Transaction created (Level 2 user, 15000 PHP, pending)
✓ Approval submitted (Level 1 user A, approved)
✓ Approval submitted (Level 1 user B, approved)
✓ Transaction recorded on-chain (15000 PHP, high-value)
```

**Talking Point:**
> "The audit trail shows every action with actor, timestamp, and blockchain reference. 
> This creates accountability. Let me show you role-based access in action."

**Switch to Level 3 (Member):**
```
1. Log in as Level 3 user
2. Notice "Create Transaction" button is hidden
3. Notice "Approve Transaction" button is hidden
4. Can only view dashboard and transaction history
5. Cannot perform restricted actions
```

**Show Level 4 (Public):**
```
No login required
Can view public financial summaries
Cannot see sensitive details
Ensures transparency for donors/stakeholders
```

**Talking Point:**
> "ChainBudget enforces role-based access at every level. 
> Members can view budgets but not create transactions. 
> Approvers have the highest privileges. 
> Public viewers see only published reports. 
> This protects sensitive operations while maintaining transparency."

---

### **Minute 6.5-7: Summary & Questions**
```
"ChainBudget solves the problem of trust in shared fund management:

✓ Transparent: Everyone sees transactions recorded on blockchain
✓ Verifiable: Anyone can check hashes on Polygonscan
✓ Accountable: Role-based access prevents unauthorized actions
✓ Auditable: Complete audit trail with blockchain references
✓ Secure: Wallet signatures prevent impersonation

The system works for student organizations, barangays, NGOs, 
cooperatives, churches, and any group managing shared funds."

Questions?
```

---

## 🎯 Key Points to Emphasize During Demo

1. **Blockchain Immutability**
   - Show transaction hash on Polygonscan
   - Explain: "Once recorded, cannot be changed"

2. **Multi-Signature Security**
   - Demonstrate approval queue requiring 2 signatures
   - "Prevents single-person control of large amounts"

3. **Role-Based Access**
   - Show different users see different features
   - "Matches organizational hierarchy"

4. **Audit Trail**
   - Show action logs with blockchain references
   - "Complete accountability for all actions"

5. **Real-World Applicability**
   - Mention 10 organization types supported
   - "Addresses SDG 16.6: Transparent institutions"

---

## ⏱️ Timing Breakdown

| Time | Action | Duration |
|------|--------|----------|
| 0:00 | Show architecture diagram | 1 min |
| 1:00 | Wallet login demo | 1 min |
| 2:00 | Low-value transaction | 1 min |
| 3:00 | Show on Polygonscan | 0.5 min |
| 3:30 | High-value transaction (pending) | 0.5 min |
| 4:00 | First approval (Level 1 A) | 0.5 min |
| 4:30 | Second approval (Level 1 B) | 0.5 min |
| 5:00 | Show blockchain recording | 0.5 min |
| 5:30 | Audit trail + role-based access demo | 1 min |
| 6:30 | Summary & key takeaways | 0.5 min |

---

## 🚨 If Something Goes Wrong During Demo

| Problem | Quick Fix |
|---------|-----------|
| MetaMask won't connect | Switch browser/wallet, or refresh page |
| Transaction fails | Check network is Polygon Amoy, try again |
| API not responding | Check Railway deployment, restart backend |
| Blockchain hash missing | Might be pending, wait 10 secs & refresh |
| Signature verification failed | Wallet encoding was fixed, should work |

---

## ✅ After Demo (Q&A Prep)

Be ready to answer:
- "Why use blockchain instead of just a database?" → Immutability + transparency
- "Isn't blockchain slow?" → Testnet is fast enough, optimizations possible
- "Can users trick the system?" → Role checks prevent unauthorized actions
- "What about privacy?" → Off-chain data private, only hashes on blockchain
- "How do you handle dispute?" → Complete audit trail enables investigation

---

## 💡 Pro Tips

1. **Practice at least 3 times** before defense
2. **Have URLs ready** in browser tabs
3. **Know exact MetaMask accounts** and their roles
4. **Prepare screenshots** in case live demo fails
5. **Rehearse talking points** to stay within 7 minutes
6. **Test all roles beforehand** to find any issues

Good luck! 🚀
