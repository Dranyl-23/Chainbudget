# ⚡ Quick Setup Checklist

## 🔴 DO THIS TODAY (2-3 hours)

### Phase 1: Prepare (15 mins)
```bash
# Get these values ready:
1. MongoDB URI from MongoDB Atlas
2. Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
3. Backend wallet private key (from MetaMask)
4. Contract address from Polygon Amoy deployment
```

### Phase 2: Deploy Backend (30 mins)
```bash
# Option: Use Railway
1. Commit & push backend code to GitHub
2. Go to railway.app
3. New Project → Deploy from GitHub → Select repo
4. Root directory: backend/
5. Add env vars from Phase 1
6. Wait for deployment ✅
7. Copy Railway API URL
```

### Phase 3: Deploy Frontend (20 mins)
```bash
cd frontend

# Build & test locally first
npm run build

# Deploy to Vercel
npx vercel deploy

# After deployment:
# - Add NEXT_PUBLIC_API_URL = https://chainbudgets-backend.railway.app/api
# - Redeploy
```

### Phase 4: Test (30 mins)
```bash
# Open browser to: https://chainbudgets-frontend.vercel.app
1. Click "Connect Wallet"
2. Sign message
3. Should see dashboard
4. Create test transaction
5. Check Polygonscan for blockchain hash
```

---

## 📝 Environment Variables You Need

**Create `backend/.env`:**
```
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/chainbudgets
JWT_SECRET=<generated_random_key>
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
BACKEND_WALLET_PRIVATE_KEY=<0x...your_key>
CONTRACT_ADDRESS=<0x...deployed_on_amoy>
FRONTEND_URL=https://chainbudgets-frontend.vercel.app
```

**Create `frontend/.env.local`:**
```
NEXT_PUBLIC_API_URL=https://chainbudgets-backend.railway.app/api
NEXT_PUBLIC_CHAIN_ID=80002
```

---

## ✅ Verification Commands

```bash
# Test backend is running
curl https://chainbudgets-backend.railway.app/api/health

# Test frontend is up
curl https://chainbudgets-frontend.vercel.app

# Check blockchain on Polygonscan
# https://amoy.polygonscan.com/ → Search contract address
```

---

## 🎯 Success Indicators

When everything is working, you should see:
- ✅ Live frontend URL loads dashboard
- ✅ MetaMask connects & signs message
- ✅ JWT token stored in browser localStorage
- ✅ Transaction created appears in MongoDB
- ✅ Transaction hash visible on Polygonscan
- ✅ Audit log shows all actions

---

## 🚨 Common Issues

| Issue | Fix |
|-------|-----|
| `401 Unauthorized` | JWT_SECRET mismatch between frontend & backend |
| `Connection refused` | Backend not deployed or URL wrong |
| `Signature verification failed` | Wallet encoding issue (✅ FIXED) |
| `Contract call failed` | CONTRACT_ADDRESS doesn't match or bad private key |
| `CORS error` | FRONTEND_URL not set in backend |

---

## ⏰ Timeline

- **Now to 30 mins:** Deploy backend to Railway
- **30-50 mins:** Deploy frontend to Vercel  
- **50-80 mins:** Test end-to-end login + transaction
- **Remaining time:** Polish demo, test all roles

**Total time: 2-3 hours to "ready for defense"** ⏱️
