/**
 * Database Migration Script: Re-encrypt User Custodial Keys
 * 
 * Usage:
 *   OLD_SECRET="<old_key>" NEW_SECRET="<new_key>" node scripts/migrate-encryption-key.js
 * 
 * Or pass via command-line arguments:
 *   node scripts/migrate-encryption-key.js <old_key> <new_key>
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../src/utils/crypto");
const User = require("../src/models/User");

async function migrateKeys() {
  const oldSecret = process.argv[2] || process.env.OLD_ENCRYPTION_SECRET;
  const newSecret = process.argv[3] || process.env.NEW_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET;
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!oldSecret || !newSecret) {
    console.error("FATAL: Both old and new secrets must be provided.");
    console.error("Usage: node scripts/migrate-encryption-key.js <old_secret> <new_secret>");
    process.exit(1);
  }

  if (oldSecret === newSecret) {
    console.log("Old and new secret are identical. No migration needed.");
    process.exit(0);
  }

  if (!mongoUri) {
    console.error("FATAL: MONGO_URI is not set in environment.");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Connected successfully.");

  const users = await User.find({
    $or: [
      { encryptedPrivateKey: { $exists: true, $ne: null } },
      { encryptedMnemonic: { $exists: true, $ne: null } },
    ],
  }).select("+encryptedPrivateKey +encryptedMnemonic");

  console.log(`Found ${users.length} users with stored encrypted credentials.`);

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      let updated = false;

      if (user.encryptedPrivateKey) {
        const decryptedPrivKey = decrypt(user.encryptedPrivateKey, oldSecret);
        if (decryptedPrivKey) {
          user.encryptedPrivateKey = encrypt(decryptedPrivKey, newSecret);
          updated = true;
        }
      }

      if (user.encryptedMnemonic) {
        const decryptedMnemonic = decrypt(user.encryptedMnemonic, oldSecret);
        if (decryptedMnemonic) {
          user.encryptedMnemonic = encrypt(decryptedMnemonic, newSecret);
          updated = true;
        }
      }

      if (updated) {
        await user.save();
        successCount++;
        console.log(`[OK] Migrated user: ${user._id} (${user.email || user.walletAddress || "anonymous"})`);
      }
    } catch (err) {
      errorCount++;
      console.error(`[ERROR] Failed to migrate user ${user._id}:`, err.message);
    }
  }

  console.log(`\nMigration completed: ${successCount} updated successfully, ${errorCount} errors.`);
  await mongoose.disconnect();
}

migrateKeys().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
