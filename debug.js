// debugLogin.js - Run this to test login credentials
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User Schema (adjust to match your actual model)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'agent'], default: 'agent' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function debugLogin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Test credentials
    const testEmail = 'admin@omnichat.com';
    const testPassword = 'admin123';

    console.log('🔍 Looking for user with email:', testEmail);

    // Find user
    const user = await User.findOne({ email: testEmail });
    if (!user) {
      console.log('❌ User not found!');
      
      // Check what users exist
      const allUsers = await User.find({});
      console.log('📋 All users in database:');
      allUsers.forEach(u => {
        console.log(`  - ${u.name} (${u.email}) - Role: ${u.role}`);
      });
      
      process.exit(1);
    }

    console.log('✅ User found:', user.name, '(' + user.email + ')');
    console.log('👤 Role:', user.role);

    // Test password
    console.log('🔐 Testing password...');
    const isMatch = await bcrypt.compare(testPassword, user.password);
    
    if (isMatch) {
      console.log('✅ Password matches!');
      console.log('🎉 Login should work with these credentials:');
      console.log('📧 Email:', testEmail);
      console.log('🔐 Password:', testPassword);
    } else {
      console.log('❌ Password does not match!');
      console.log('🔧 Stored hash:', user.password);
      
      // Create a new hash for comparison
      const newHash = await bcrypt.hash(testPassword, 10);
      console.log('🆕 New hash would be:', newHash);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

debugLogin();