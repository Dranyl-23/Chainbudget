const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI)
.then(async () => { 
  const User = require('./src/models/User'); 
  const result = await User.updateOne({ displayName: 'Z Andrie Barraba' }, { $set: { isSuperAdmin: false } }); 
  console.log('Updated Z Andrie Barraba to isSuperAdmin: false', result); 
  process.exit(0); 
}).catch(console.error);
