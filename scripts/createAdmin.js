// scripts/createAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createAdminUser() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
    console.log('Connected to database');
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: 'admin@admin.com' }, 
        { username: 'admin' }
      ] 
    });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email:', existingAdmin.email);
      return;
    }

    // Create admin user
    const adminUser = new User({
      username: 'admin',
      email: 'admin@admin.com',
      password: 'admin123', // Will be hashed automatically by User model
      role: 'admin',
      profile: {
        firstName: 'System',
        lastName: 'Administrator',
        phone: '+1234567890'
      }
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@admin.com');
    console.log('Password: admin123');
    console.log('⚠️  IMPORTANT: Change the admin password after first login!');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;