// scripts/createAdmin.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createAdminUser() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
    console.log('Connected to database');

    // Check if admin already exists (check both possible emails)
    const existingAdmin = await User.findOne({
      $or: [
        { email: 'admin@example.com' },
        { email: 'admin@admin.com' }
      ]
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.name);
      console.log('Role:', existingAdmin.role);
      return;
    }

    // Create admin user - UPDATED to match frontend
    const adminUser = new User({
      name: 'System Administrator',
      email: 'admin@example.com', // Changed to match frontend
      password: 'admin123',
      role: 'admin',
      isActive: true
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('Name:', adminUser.name);
    console.log('Role:', adminUser.role);
    console.log('⚠️ IMPORTANT: Change the admin password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Helper function to update admin email
async function updateAdminEmail() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
    console.log('Connected to database');

    const oldAdmin = await User.findOne({ email: 'admin@admin.com' });
    if (oldAdmin) {
      oldAdmin.email = 'admin@example.com';
      await oldAdmin.save();
      console.log('✅ Admin email updated from admin@admin.com to admin@example.com');
    } else {
      console.log('❌ No admin found with email admin@admin.com');
    }

  } catch (error) {
    console.error('❌ Error updating admin email:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  const action = process.argv[2];
  
  if (action === 'update-email') {
    updateAdminEmail();
  } else {
    createAdminUser();
  }
}

module.exports = { createAdminUser, updateAdminEmail };