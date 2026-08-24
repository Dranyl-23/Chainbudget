require("dotenv").config({ path: __dirname + "/backend/.env" });
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
const mongoose = require("mongoose");

async function checkUrls() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await mongoose.connection.db.collection("users").find({}).toArray();
  const orgs = await mongoose.connection.db.collection("organizations").find({}).toArray();
  console.log("USERS AVATARS:", users.map(u => ({ name: u.displayName, avatarUrl: u.avatarUrl })));
  console.log("ORGS LOGOS:", orgs.map(o => ({ name: o.name, logoUrl: o.logoUrl })));
  await mongoose.disconnect();
  process.exit(0);
}
checkUrls();
