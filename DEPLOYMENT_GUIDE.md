# 🚀 Chainbudgets Deployment Guide

## ✅ COMPLETED
- [x] Fixed wallet.ts hex encoding issue
- [x] Backend API ready (all routes implemented)
- [x] Smart contract deployed to Polygon Amoy
- [x] Database schema complete

## 🔴 URGENT - DO THESE TODAY

### Step 1: Prepare Environment Variables

**Backend (.env file in `backend/` folder):**
```env
PORT=5000
MONGO_URI=<your_mongodb_atlas_connection_string>
JWT_SECRET=<generate_random_secret_key>
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
BACKEND_WALLET_PRIVATE_KEY=<service_wallet_private_key>
CONTRACT_ADDRESS=<deployed_contract_address_on_amoy>
FRONTEND_URL=https://chainbudgets-frontend.vercel.app
```

**Frontend (.env.local file in `frontend/` folder):**
```env
NEXT_PUBLIC_API_URL=https://chainbudgets-backend.railway.app/api
NEXT_PUBLIC_CHAIN_ID=80002
```

---

### Step 2: Deploy Frontend to Vercel (20 mins)

```bash
cd frontend
npm run build           # Test build works locally
npx vercel deploy      # Deploy to Vercel
```

**Get your live URL:** `https://chainbudgets-frontend.vercel.app`

**After deployment:**
1. Go to Vercel Dashboard
2. Settings → Environment Variables
3. Add `NEXT_PUBLIC_API_URL=https://chainbudgets-backend.railway.app/api`
4. Redeploy

---

### Step 3: Deploy Backend to Railway (30 mins)

**Option A: Auto-deploy from GitHub**
1. Push backend code to GitHub
2. Go to railway.app → New Project
3. Select "Deploy from GitHub"
4. Choose Chainbudgets repository
5. Set root directory to `backend/`
6. Add environment variables (see Step 1)
7. Railway auto-deploys on push

**Get your live URL:** `https://chainbudgets-backend.railway.app`

---

### Step 4: Verify Deployments

**Test Frontend:**
```bash
curl https://chainbudgets-frontend.vercel.app
# Should return HTML
```

**Test Backend:**
```bash
curl https://chainbudgets-backend.railway.app/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

### Step 5: End-to-End Test (1 hour)

1. **Open live frontend:** https://chainbudgets-frontend.vercel.app
2. **Click "Connect Wallet"** → MetaMask connects
3. **Sign message** → Signature sent to backend
4. **Verify redirect to dashboard** → JWT stored locally
5. **Create low-value transaction** → Auto-approved + recorded on-chain
6. **Check blockchain** → View on Polygonscan
7. **Create high-value transaction** → Pending approval
8. **Approve with Level 1 account** → Recorded on-chain after threshold met
9. **View audit trail** → See all actions logged

---

## 📋 Checklist Before Defense

- [ ] Frontend deployed to Vercel (live URL works)
- [ ] Backend deployed to Railway (API responds)
- [ ] Environment variables set correctly
- [ ] Wallet login works end-to-end
- [ ] Transaction creation works
- [ ] Blockchain recording verified on Polygonscan
- [ ] All 4 role levels tested
- [ ] Postman test collection created
- [ ] Practice demo run through successfully

---

## 🔗 Important Links

- **Frontend:** https://chainbudgets-frontend.vercel.app
- **Backend API:** https://chainbudgets-backend.railway.app/api
- **Blockchain Explorer:** https://amoy.polygonscan.com/
- **MongoDB Atlas:** https://cloud.mongodb.com/

---

## ❌ Troubleshooting

### Frontend won't load?
- Check Vercel logs: `vercel logs`
- Verify `NEXT_PUBLIC_API_URL` is set
- Clear browser cache

### Backend API returns 401?
- Check `JWT_SECRET` is set
- Verify wallet login completed
- Check localStorage has `cb_token`

### Blockchain transaction fails?
- Verify `BACKEND_WALLET_PRIVATE_KEY` is valid
- Check `CONTRACT_ADDRESS` matches deployment
- Confirm `AMOY_RPC_URL` is correct
- Check service wallet has MATIC balance

### Signature verification fails?
- Ensure wallet.ts hex encoding is applied (✅ FIXED)
- Check backend using same `verifyMessage` method
- Verify nonce format matches

---

## 🎯 Next Steps After Deployment

1. Create Postman test collection (6 endpoint tests)
2. Test all 4 role levels with different accounts
3. Practice defense demo (5-7 minute walkthrough)
4. Prepare Asgardeo Phase 2 explanation
