require("dotenv").config({ path: __dirname + "/../.env" });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
const mongoose = require("mongoose");

async function cleanStaleUrls() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas.");

  // Clean stale dead 404 Fly.io upload URLs from users
  const userResult = await mongoose.connection.db.collection("users").updateMany(
    { avatarUrl: { $regex: "^https://chainbudget-api\\.fly\\.dev/uploads/" } },
    { $set: { avatarUrl: "" } }
  );
  console.log(`Cleaned ${userResult.modifiedCount} stale user avatar URLs.`);

  // Clean stale dead 404 Fly.io upload URLs from organizations
  const orgResult = await mongoose.connection.db.collection("organizations").updateMany(
    { logoUrl: { $regex: "^https://chainbudget-api\\.fly\\.dev/uploads/" } },
    { $set: { logoUrl: "" } }
  );
  console.log(`Cleaned ${orgResult.modifiedCount} stale organization logo URLs.`);

  await mongoose.disconnect();
  console.log("Disconnected. Database cleaned successfully.");
  process.exit(0);
}

cleanStaleUrls().catch(err => {
  console.error("Error cleaning database:", err);
  process.exit(1);
});
