require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const res = await mongoose.connection.db.collection('users').updateMany(
    { email: '' },
    { $set: { email: 'alfielynard23@gmail.com' } }
  );
  console.log('Updated users:', res);
  process.exit(0);
}).catch(console.error);
