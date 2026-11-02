"use strict";

/**
 * purgeExpiredOrgDocuments.js
 *
 * Operational retention worker: purges private encrypted OrgDocument records
 * whose retention window (purgeAfter timestamp) has expired.
 * (e.g. 90 days after an application was rejected or revoked).
 */

async function purgeExpiredOrgDocuments(models = {}) {
  const OrgDocument = models.OrgDocument || require("../src/models/OrgDocument");
  const OrgApplication = models.OrgApplication || require("../src/models/OrgApplication");

  const now = new Date();
  const filter = {
    purgeAfter: { $ne: null, $lte: now },
  };

  const expiredDocs = await OrgDocument.find(filter);
  let purgedCount = 0;

  for (const doc of expiredDocs) {
    const docId = doc._id;
    const appId = doc.application;

    // Remove from linked OrgApplication's documents array
    if (appId) {
      await OrgApplication.updateOne(
        { _id: appId },
        { $pull: { documents: { _id: docId } } }
      );
    }

    if (typeof doc.deleteOne === "function") {
      await doc.deleteOne();
    } else {
      await OrgDocument.deleteOne({ _id: docId });
    }
    purgedCount++;
  }

  return {
    scanned: expiredDocs.length,
    purged: purgedCount,
  };
}

if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();

  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/chainbudget";
  mongoose
    .connect(uri)
    .then(async () => {
      console.log("[purgeExpiredOrgDocuments] Running retention purge job...");
      const res = await purgeExpiredOrgDocuments();
      console.log(`[purgeExpiredOrgDocuments] Purged ${res.purged} expired document(s).`);
      await mongoose.disconnect();
    })
    .catch((err) => {
      console.error("[purgeExpiredOrgDocuments] Error:", err.message);
      process.exit(1);
    });
}

module.exports = {
  purgeExpiredOrgDocuments,
};
