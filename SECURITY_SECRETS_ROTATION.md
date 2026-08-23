# SECURITY_SECRETS_ROTATION.md
# ChainBudgets — Secret Rotation & Git History Cleanup Guide
# ─────────────────────────────────────────────────────────────────────────────
# ACTION REQUIRED: Every secret listed below was committed to git history.
# All secrets MUST be rotated BEFORE any code is pushed to a shared remote.
# ─────────────────────────────────────────────────────────────────────────────

## STATUS TRACKER

| Secret | Rotated? | New value stored in? |
|--------|----------|----------------------|
| MONGO_URI (password) | ☐ | Fly.io Secret / .env (local) |
| JWT_SECRET | ☐ | Fly.io Secret / .env (local) |
| ENCRYPTION_SECRET | ☐ | Fly.io Secret / .env (local) |
| CSRF_SECRET | ☐ | Fly.io Secret / .env (local) |
| BACKEND_WALLET_PRIVATE_KEY | ☐ | Fly.io Secret / .env (local) |
| PINATA_JWT | ☐ | Fly.io Secret / .env (local) |
| SMTP_PASSWORD | ☐ | Fly.io Secret / .env (local) |
| GEMINI_API_KEY | ☐ | Fly.io Secret / .env (local) |
| ASGARDEO_CLIENT_SECRET | ☐ | Fly.io Secret / .env (local) |
| Android Keystore | ☐ | EAS Secret Store |

---

## STEP 1: Rotate All External Credentials

### 1.1 MongoDB Atlas — Rotate Database Password

1. Log in to https://cloud.mongodb.com
2. Go to Database Access → Edit user `alfielynard23_db_user`
3. Generate a new strong password (use the Atlas generator)
4. Update the password
5. Update MONGO_URI in your local `.env` file
6. Update the Fly.io secret: `fly secrets set MONGO_URI="mongodb+srv://...NEW_PASSWORD..."`

### 1.2 Generate New Cryptographic Secrets (run these locally)

```bash
# JWT_SECRET (256-bit hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_SECRET (256-bit hex) — WARNING: rotating this means existing
# encrypted wallet keys in MongoDB CANNOT be decrypted with the old secret.
# You MUST run the re-encryption migration script before rotating this.
# See: scripts/migrate-encryption-secret.js (create if needed)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CSRF_SECRET (256-bit hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ ENCRYPTION_SECRET WARNING: If you rotate ENCRYPTION_SECRET without
> first re-encrypting all stored wallet keys, every user's
> `encryptedPrivateKey` and `encryptedMnemonic` field becomes permanently
> unreadable. Coordinate with users to export/backup their keys BEFORE rotation.

### 1.3 Backend Wallet Private Key

The exposed private key `608aa4da...` controls the on-chain relayer wallet.

1. Generate a fresh wallet: `node -e "const {ethers} = require('ethers'); const w = ethers.Wallet.createRandom(); console.log('Address:', w.address); console.log('Key:', w.privateKey)"`
2. Fund the new address with MATIC (transfer remaining balance from old address first)
3. Update BACKEND_WALLET_PRIVATE_KEY: `fly secrets set BACKEND_WALLET_PRIVATE_KEY="0xNEW_KEY"`
4. The old address `608aa4da...` should be considered permanently compromised — move all funds immediately

### 1.4 Pinata (IPFS)

1. Go to https://app.pinata.cloud → API Keys
2. Revoke the compromised JWT key
3. Create a new API key with only the required scopes (pinFileToIPFS, pinJSONToIPFS)
4. Update: `fly secrets set PINATA_JWT="eyJhbGciOiJIUzI1NiIs...NEW..."`

### 1.5 SMTP (Gmail App Password)

1. Go to https://myaccount.google.com/apppasswords
2. Revoke the `lomrvxxqsbxqwpwj` app password
3. Generate a new App Password for "Mail" → "Other (ChainBudgets)"
4. Update: `fly secrets set SMTP_PASSWORD="NEW_APP_PASSWORD"`

### 1.6 Google Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Delete the compromised key `AQ.Ab8RN6KI...`
3. Create a new key
4. Update: `fly secrets set GEMINI_API_KEY="AQ.NEW_KEY"`

### 1.7 Asgardeo Client Secret

1. Go to https://console.asgardeo.io → Applications → ChainBudgets
2. Regenerate the client secret
3. Update: `fly secrets set ASGARDEO_CLIENT_SECRET="NEW_SECRET"`

### 1.8 Android Signing Keystore

The exposed keystores (`@askyyys-team__lynard.jks`, `@lynard__chainbudget.jks`) and
passwords from `credentials.json` are now public.

1. Generate a new keystore:
   ```bash
   keytool -genkey -v -keystore chainbudget-release.jks -alias chainbudget -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Store the new keystore in EAS Secret Store (NOT in the repository):
   ```bash
   eas secret:create --scope project --name KEYSTORE_BASE64 --value "$(base64 -i chainbudget-release.jks)"
   eas secret:create --scope project --name KEYSTORE_PASSWORD --value "NEW_PASSWORD"
   eas secret:create --scope project --name KEY_ALIAS --value "chainbudget"
   eas secret:create --scope project --name KEY_PASSWORD --value "NEW_KEY_PASSWORD"
   ```
3. Update `eas.json` to use the secrets instead of `credentials.json`
4. If already on the Play Store: go to Play Console → Setup → App signing
   → you may need to contact Google Play support to rotate the upload key

---

## STEP 2: Remove Secrets from Working Tree

The `.gitignore` has been updated to block future commits of these files.
However, the files may still exist in the working directory. Remove them:

```bash
# Remove from working tree (files still exist locally — just untracked)
git rm --cached backend/.env
git rm --cached mobile/credentials.json
git rm --cached "mobile/@askyyys-team__lynard.jks"
git rm --cached "mobile/@askyyys-team__lynard.bak.jks"
git rm --cached "mobile/@lynard__chainbudget.jks"
git rm --cached frontend/.env.local

# Verify they are now untracked
git status
```

---

## STEP 3: Purge Git History (RECOMMENDED)

This permanently removes secrets from all historical commits.
**⚠️ This rewrites every commit SHA. All collaborators must re-clone.**

```bash
# Install git-filter-repo (pip install git-filter-repo)
pip install git-filter-repo

# Or on macOS: brew install git-filter-repo

# Purge specific files from entire history
git filter-repo --invert-paths \
  --path backend/.env \
  --path mobile/credentials.json \
  --path "mobile/@askyyys-team__lynard.jks" \
  --path "mobile/@askyyys-team__lynard.bak.jks" \
  --path "mobile/@lynard__chainbudget.jks" \
  --path frontend/.env.local

# Force-push the rewritten history (ALL collaborators must re-clone after this)
git push origin --force --all
git push origin --force --tags
```

---

## STEP 4: Set Fly.io Deployment Secrets

After rotating all credentials, set them in Fly.io:

```bash
cd backend

fly secrets set \
  MONGO_URI="mongodb+srv://NEW_USER:NEW_PASS@chainbudgets..." \
  JWT_SECRET="NEW_64_HEX_JWT_SECRET" \
  ENCRYPTION_SECRET="NEW_64_HEX_ENCRYPTION_SECRET" \
  CSRF_SECRET="NEW_64_HEX_CSRF_SECRET" \
  BACKEND_WALLET_PRIVATE_KEY="0xNEW_PRIVATE_KEY" \
  PINATA_JWT="NEW_PINATA_JWT" \
  SMTP_PASSWORD="NEW_SMTP_APP_PASSWORD" \
  GEMINI_API_KEY="NEW_GEMINI_API_KEY" \
  ASGARDEO_CLIENT_SECRET="NEW_ASGARDEO_CLIENT_SECRET"
```

---

## STEP 5: Verify No Secrets Remain Exposed

```bash
# Scan current working tree
gitleaks detect --source . --config .gitleaks.toml --verbose

# Scan full git history (after filter-repo)
gitleaks detect --source . --config .gitleaks.toml --log-opts="--all" --verbose

# Verify no sensitive files are tracked
git ls-files | grep -E '(\.env|\.jks|credentials\.json)'
# Expected: no output
```
