// scripts/checkMessages.js
const mongoose = require('mongoose');
const Message = require('../models/message'); // Adjust path
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const all = await Message.find({});
  const unclaimed = await Message.find({ claimedBy: null });

  console.log('📦 All messages:', all.length);
  console.log('📭 Unclaimed messages:', unclaimed.length);
  console.log('Unclaimed Messages:', unclaimed);

  mongoose.disconnect();
});
