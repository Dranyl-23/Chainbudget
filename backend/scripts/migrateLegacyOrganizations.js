"use strict";

/**
 * migrateLegacyOrganizations.js
 *
 * Backfills verification.status = "legacy_unverified" on pre-existing MongoDB
 * organization documents that were created prior to the legitimacy verification system.
 */

async function migrateLegacyOrganizations(OrganizationModel) {
  const Organization = OrganizationModel || require("../src/models/Organization");

  const filter = {
    $or: [
      { verification: { $exists: false } },
      { "verification.status": { $exists: false } },
      { "verification.status": null },
    ],
  };

  const toUpdate = await Organization.find(filter);
  let updatedCount = 0;

  for (const org of toUpdate) {
    org.verification = {
      ...(org.verification ? org.verification.toObject?.() || org.verification : {}),
      status: "legacy_unverified",
    };
    await org.save();
    updatedCount++;
  }

  return {
    scanned: toUpdate.length,
    updated: updatedCount,
  };
}

if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/chainbudget";
  mongoose
    .connect(uri)
    .then(async () => {
      console.log("[migrateLegacyOrganizations] Connected to MongoDB. Starting migration...");
      const res = await migrateLegacyOrganizations();
      console.log(`[migrateLegacyOrganizations] Complete: ${res.updated} organization(s) migrated to legacy_unverified.`);
      await mongoose.disconnect();
    })
    .catch((err) => {
      console.error("[migrateLegacyOrganizations] Error:", err.message);
      process.exit(1);
    });
}

module.exports = {
  migrateLegacyOrganizations,
};
