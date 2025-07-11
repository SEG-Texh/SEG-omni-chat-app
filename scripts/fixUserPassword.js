// Fix user password script
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/user');
const bcrypt = require('bcryptjs');

async function fixUserPassword() {
  await connectDB();
  
  // Find the user "Rinel Faith"
  const user = await User.findOne({ name: 'Rinel Faith', role: 'supervisor' });
  if (!user) {
    console.log('User "Rinel Faith" not found');
    process.exit(0);
  }
  
  console.log('Found user:', {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    hasPassword: !!user.password
  });
  
  // Set a default password if none exists
  if (!user.password) {
    const defaultPassword = 'rinel123'; // You can change this
    user.password = await bcrypt.hash(defaultPassword, 12);
    await user.save();
    console.log('Password set for user "Rinel Faith"');
    console.log('Default password:', defaultPassword);
  } else {
    console.log('User already has a password');
  }
  
  process.exit(0);
}

fixUserPassword().catch(err => {
  console.error('Failed to fix user password:', err);
  process.exit(1);
}); 