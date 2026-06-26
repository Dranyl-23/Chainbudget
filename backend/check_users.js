const mongoose = require('mongoose');
const uri = "mongodb://alfielynard23_db_user:Polacas2587@ac-fphgvbx-shard-00-00.azlfoe9.mongodb.net:27017,ac-fphgvbx-shard-00-01.azlfoe9.mongodb.net:27017,ac-fphgvbx-shard-00-02.azlfoe9.mongodb.net:27017/chainbudget?ssl=true&replicaSet=atlas-10m201-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Chainbudgets";

mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.db;
    const users = await db.collection('users').find({}).toArray();
    console.log("USERS:");
    users.forEach(u => {
      console.log(`Name: ${u.displayName}, Email: ${u.email}, Wallet: ${u.walletAddress}`);
      if (u.memberships) {
        console.log(`  Memberships: ${u.memberships.length}`);
      }
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
