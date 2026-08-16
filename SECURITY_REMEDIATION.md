# ChainBudget Application Security Remediation Report

> **Prepared by**: Senior Application Security & Full-Stack Engineer  
> **Date**: 2026-08-15  
> **Repository**: ChainBudget (Frontend, Backend, Smart Contracts, Mobile)  
> **Status**: Core remediation applied; Credential rotation & Git history cleaning procedures documented.

---

## Executive Summary

A comprehensive application security audit and remediation was conducted across the ChainBudget codebase. All active and exposed credentials have been scrubbed from the local working directory and untracked scratch files. Dedicated security controls, including strict rate limiting on private key exports, prompt injection sanitization, singleton SMTP management, and automated secret-detection pipelines (Gitleaks + GitHub Actions) have been deployed.

---

## 1. Findings & Risk Assessment

| Issue ID | Security Issue | Severity | Affected Component | Risk & Impact |
|---|---|---|---|---|
| **SEC-01** | Exposed Credentials in Local `.env` Files | 🔴 **CRITICAL** | `backend/.env`, `contracts/.env`, `frontend/.env.local`, `mobile/.env` | Unencrypted production keys and credentials resided on disk. Duplication of wallet private keys across backend and contract environments increases exposure risk. |
| **SEC-02** | Hardcoded MongoDB URI with Plaintext Password Committed | 🔴 **CRITICAL** | `backend/check_users.js` (Tracked in Git history) | Plaintext database connection string with administrative username and password was committed to version control. Anyone with repo clone access can access the database. |
| **SEC-03** | Auth ID Token & PII Stored in Unencrypted Scratch File | 🟠 **HIGH** | `backend/debug.txt` (Untracked) | Raw Asgardeo user ID token containing full name, email, org handle, and Google profile picture was stored on disk. |
| **SEC-04** | Excessive PII Logging in Authentication Middleware | 🟡 **MEDIUM** | `backend/src/middleware/auth.js` | User claims were printed directly to `stdout` on every authenticated request, potentially polluting log aggregators with PII. |
| **SEC-05** | Unrestricted Rate Limiting on Decrypted Private Key Export | 🟠 **HIGH** | `backend/src/routes/auth.js` (`/keys` endpoint) | `/api/auth/keys` had no dedicated rate limiting and relied on console logging instead of structured audit logging. |
| **SEC-06** | Prompt Injection Vulnerability in Gemini AI Endpoints | 🟡 **MEDIUM** | `backend/src/routes/ai.js` | User inputs (`title`, `description`) were interpolated directly into LLM prompts without sanitization or input length caps. |
| **SEC-07** | High-Value Email Alerts Triggered on Low-Value Transactions | 🟢 **LOW** | `backend/src/routes/transactions.js` | Notification emails for executive approval were fired on every non-request transaction regardless of value. |
| **SEC-08** | Brittle Contract Artifact Import Path in Backend Route | 🟡 **MEDIUM** | `backend/src/routes/transactions.js` | `require("../../../contracts/artifacts/...")` attempted to load contracts from outside the backend root, which fails in isolated container deployments. |
| **SEC-09** | Escrow Flag Dropped in On-Chain Request Processing | 🟡 **MEDIUM** | `backend/src/routes/transactions.js` (`/requests/:id/process`) | The 5th argument (`isEscrow`) was omitted when recording approved requests on-chain. |

---

## 2. Remediation & Code Changes Applied

### A. Secret Scrubbing & Scratch File Removal
- **Deleted Tracked File with Secrets**: `backend/check_users.js` was removed via `git rm` (was containing plaintext MongoDB credentials).
- **Deleted Insecure Scratch & Debug Files**: `backend/debug.txt`, `backend/clear_db.js`, `backend/fix_admin.js`, `backend/update_emails.js`, `backend/test_email.js`, `backend/test-email.js`, `backend/test_auth.js`, `backend/test_db.js`, `backend/test_orgs.js`, `fix.js`, `refactor.js`.
- **Sanitized All `.env` Files on Disk**: `backend/.env`, `contracts/.env`, `frontend/.env.local`, and `mobile/.env` were purged of all real secrets and replaced with safe environment variable templates.

### B. Environment Templates & Version Control Protection
- **Standardized `.env.example` Templates**: Updated `backend/.env.example`, `frontend/.env.example`, `contracts/.env.example`, and created `mobile/.env.example`.
- **Hardened `.gitignore`**: Added explicit rules for all `.env*`, keys, certificates, keystores, debug logs, database dumps, and scratch scripts.

### C. Application Security & Hardening
- **Authentication & PII Protection**: Sanitized `backend/src/middleware/auth.js` to eliminate `console.log` of raw Asgardeo claims. Parameterized `ASGARDEO_BASE_URL` dynamically.
- **Key Export Hardening**: Added `keyExportRateLimiter` (3 requests per 15 minutes) to `backend/src/middleware/security.js` and wired it into `backend/src/routes/auth.js` with structured logging to MongoDB's `AuditLog` collection.
- **AI Prompt Protection**: Added `sanitizePromptInput()` in `backend/src/routes/ai.js` to strip line breaks, escape double quotes, enforce max character lengths, and validate numeric values before prompt generation.
- **Email Service Optimization**: Replaced per-request transporter creation with a singleton connection pool in `backend/src/services/email.js`.
- **Import & Logic Fixes**: Updated `transactions.js` to load ABI from `backend/src/lib/ChainBudget.json`, restored the `isEscrow` argument in on-chain recording, and gated high-value alert emails behind `isHighValue`.

---

## 3. Credential Rotation Checklist

> [!CAUTION]
> Because credentials existed on disk and in previous Git commits, **all of the following must be treated as permanently compromised and rotated immediately**.

| Credential Type | Compromise Vector | Rotation Status | Required Follow-Up Action |
|---|---|---|---|
| **MongoDB Atlas Database Password** | Committed to Git history (`backend/check_users.js`) | ⚠️ **URGENT** | Log in to MongoDB Atlas > *Database Access* > Edit user > Reset password > Update connection string in backend hosting (Railway/Render). |
| **Blockchain Service / Relayer Wallet Private Key** | Stored in `backend/.env` & `contracts/.env` | ⚠️ **URGENT** | 1. Generate a brand new EVM wallet for backend relayer operations.<br>2. Fund the new address with test MATIC on Polygon Amoy.<br>3. Transfer contract ownership or authorized relayer roles to the new address.<br>4. Do NOT reuse the contract deployer wallet key. |
| **Asgardeo OAuth Client Secret** | Stored in `backend/.env` | ⚠️ **HIGH** | Open Asgardeo Console > *Applications* > Regenerate Client Secret > Update production env vars. |
| **Google Gemini API Key** | Stored in `backend/.env` | ⚠️ **HIGH** | Go to Google AI Studio > API Keys > Revoke old key > Issue replacement key. |
| **SMTP / Gmail App Password** | Stored in `backend/.env` | ⚠️ **HIGH** | Go to Google Account Security > *App Passwords* > Revoke previous app password > Generate a new one. |
| **Pinata IPFS JWT** | Stored in `backend/.env` | ⚠️ **HIGH** | Open Pinata Cloud > *API Keys* > Revoke JWT > Create a new Scoped Key with Pinning permissions. |
| **ENCRYPTION_SECRET** | Stored in `backend/.env` | ⚠️ **HIGH** | Generate a 32-character random key (`crypto.randomBytes(32).toString('hex')`). Note: If existing users have encrypted wallets in DB, run a migration script to re-encrypt with the new key. |
| **JWT_SECRET** | Stored in `backend/.env` | 🟡 **MEDIUM** | Generate a random 256-bit string. (Invalidates current active sessions, requiring re-login). |
| **Polygonscan API Key** | Stored in `contracts/.env` | 🟢 **LOW** | Optional: Rotate via Polygonscan API dashboard (read-only key). |

---

## 4. Git History Assessment & Cleaning Procedure

### Assessment Findings
- `.env` and `.env.*` files were **never tracked** in Git commits.
- One tracked commit contained a plaintext MongoDB connection string:
  - **Commit**: `5a8577a` (and descendants)
  - **File**: `backend/check_users.js`

### Recommended History Cleaning Procedure

To completely remove the secret from all branches and tags in Git history, use `git-filter-repo` (preferred by Git over `git filter-branch`):

```bash
# 1. Install git-filter-repo (via pip or package manager)
pip install git-filter-repo

# 2. Make a fresh backup clone of the repository
git clone --mirror <repository_url> repo-backup.git

# 3. In your working repository, filter out the offending file from all commits
git filter-repo --invert-paths --path backend/check_users.js

# 4. Force push the rewritten history to all remotes (Coordinate with team!)
git push origin --force --all
git push origin --force --tags
```

> [!WARNING]
> **Impact of Rewriting History**: Force-pushing rewritten Git history changes commit hashes. All contributors will need to re-clone the repository or rebase their feature branches.

---

## 5. Prevention & CI/CD Security Controls

### Automated Secret Detection
1. **Gitleaks Configuration (`.gitleaks.toml`)**: Added regex rules specifically detecting EVM private keys, MongoDB URIs, and Asgardeo client secrets.
2. **GitHub Actions Security Workflow (`.github/workflows/security.yml`)**: Automatically scans every pull request and push to `main`/`master` for leaked secrets.
3. **Local Pre-Commit Hook (Optional)**:
   ```bash
   # Run gitleaks locally before committing
   npx husky add .husky/pre-commit "gitleaks protect --staged --verbose"
   ```

---

## 6. Remaining Risks & Required Manual Actions

1. **Rotate MongoDB Password in Atlas**: This must be done manually in your cloud dashboard.
2. **Deploy New Service Wallet**: Replace the exposed testnet private key with a fresh wallet.
3. **Set Production Environment Variables**: Populate your deployment platform (Vercel, Railway, Render) with the newly rotated secrets using the `.env.example` templates.
