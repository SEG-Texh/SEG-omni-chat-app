// Create SEGbot user script
const connectDB = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/user');

async function createSegbot() {
  await connectDB();
  const existing = await User.findOne({ role: 'bot', name: '🤖 SEGbot' });
  if (existing) {
    console.log('SEGbot user already exists:', existing._id);
    process.exit(0);
  }
  const segbot = new User({
    name: '🤖 SEGbot',
    role: 'bot',
    type: 'internal',
    status: 'active',
    isOnline: false,
    profilePic: '', // No image, will use emoji in UI
    email: 'segbot@system.local', // Unique email to avoid duplicate key error
  });
  await segbot.save();
  console.log('Created SEGbot user:', segbot._id);
  process.exit(0);
}

createSegbot().catch(err => {
  console.error('Failed to create SEGbot user:', err);
  process.exit(1);
}); 