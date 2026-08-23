require("dotenv").config({ path: __dirname + "/../.env" });
const dns = require("dns");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {}

const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("FATAL: MONGO_URI is not set in backend/.env");
  process.exit(1);
}

async function resetDatabase() {
  const dbNames = ["chainbudget", "test"];

  for (const dbName of dbNames) {
    try {
      console.log(`\nConnecting to database '${dbName}'...`);
      const uriWithDb = mongoUri.replace(/\/[^/?]*(\?|$)/, `/${dbName}$1`);
      const conn = await mongoose.createConnection(uriWithDb).asPromise();
      console.log(`Connected to MongoDB database: ${conn.name}`);

      const collections = await conn.db.collections();
      console.log(`Found ${collections.length} collections in '${conn.name}'.`);

      for (const collection of collections) {
        const countBefore = await collection.countDocuments();
        console.log(`Clearing collection '${collection.collectionName}' (${countBefore} documents)...`);
        await collection.deleteMany({});
        const countAfter = await collection.countDocuments();
        console.log(` -> '${collection.collectionName}' is now clean (${countAfter} documents).`);
      }
      await conn.close();
    } catch (err) {
      console.warn(`Warning on database '${dbName}':`, err.message);
    }
  }

  console.log("\n========================================================");
  console.log(" SUCCESS: All MongoDB database collections are empty! ");
  console.log("========================================================\n");
  process.exit(0);
}

resetDatabase();
