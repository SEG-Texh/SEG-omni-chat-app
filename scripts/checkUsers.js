// Check all users for password issues
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/user');

async function checkUsers() {
  await connectDB();
  
  // Find all users
  const users = await User.find({}).select('+password');
  
  console.log(`Found ${users.length} users:`);
  
  users.forEach(user => {
    console.log({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      isOnline: user.isOnline
    });
  });
  
  // Check for users without passwords (excluding bots)
  const usersWithoutPasswords = users.filter(user => !user.password && user.role !== 'bot');
  
  if (usersWithoutPasswords.length > 0) {
    console.log('\n⚠️  Users without passwords (excluding bots):');
    usersWithoutPasswords.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });
  } else {
    console.log('\n✅ All users have passwords set (excluding bots)');
  }
  
  process.exit(0);
}

checkUsers().catch(err => {
  console.error('Failed to check users:', err);
  process.exit(1);
}); 