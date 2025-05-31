// scripts/createAdmin.js (updated)
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createAdminUser() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
    console.log('Connected to database');

    // Check if admin already exists with either email
    const existingAdmin = await User.findOne({
      $or: [
        { email: 'admin@admin.com' },  // Frontend expects this
        { email: 'admin@example.com' } // Original
      ]
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.name);
      console.log('Role:', existingAdmin.role);
      return;
    }

    // Create admin user with frontend expected credentials
    const adminUser = new User({
      name: 'System Administrator',
      email: 'admin@admin.com', // Matches frontend demo credentials
      password: 'admin123',     // Matches frontend demo credentials
      role: 'admin',
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@admin.com');
    console.log('Password: admin123');
    console.log('⚠️ IMPORTANT: Change the admin password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };