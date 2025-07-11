// Test password for Rinel Faith user
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/user');
const bcrypt = require('bcryptjs');

async function testPassword() {
  await connectDB();
  
  // Find the user "Rinel Faith"
  const user = await User.findOne({ name: 'Rinel Faith', role: 'supervisor' }).select('+password');
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
  
  // Test the password
  const testPassword = 'rinel123';
  const isMatch = await bcrypt.compare(testPassword, user.password);
  
  console.log(`Testing password: "${testPassword}"`);
  console.log(`Password match: ${isMatch}`);
  
  if (isMatch) {
    console.log('✅ Password is working correctly!');
    console.log('\nLogin credentials:');
    console.log('Email: rinel@example.com');
    console.log('Password: rinel123');
  } else {
    console.log('❌ Password is not working. Let me reset it...');
    
    // Reset the password
    const newPassword = 'rinel123';
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    
    console.log('✅ Password reset successfully!');
    console.log('\nNew login credentials:');
    console.log('Email: rinel@example.com');
    console.log('Password: rinel123');
  }
  
  process.exit(0);
}

testPassword().catch(err => {
  console.error('Failed to test password:', err);
  process.exit(1);
}); 