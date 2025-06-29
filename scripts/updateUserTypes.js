const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust path as needed

mongoose.connect('mongodb://localhost:27017/omnichat', { useNewUrlParser: true, useUnifiedTopology: true });

async function updateUserTypes() {
  // 1. Set all users to 'platform' by default
  await User.updateMany({}, { $set: { type: 'platform' } });

  // 2. Set login users to 'internal'
  // Example: users with an email and a password are likely internal
  await User.updateMany(
    { email: { $exists: true, $ne: null }, password: { $exists: true, $ne: null } },
    { $set: { type: 'internal' } }
  );

  console.log('User types updated!');
  mongoose.disconnect();
}

updateUserTypes();