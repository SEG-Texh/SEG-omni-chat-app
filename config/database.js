// ============================================================================
// SERVER/CONFIG/DATABASE.JS
// ============================================================================
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  mongoose.connection.on('connected', () => {
    console.log('Mongoose connection established');
  });

  mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
  });
};

module.exports = connectDB;
