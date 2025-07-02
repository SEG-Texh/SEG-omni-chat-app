// ============================================================================
// SERVER/CONFIG/DATABASE.JS
// ============================================================================
const mongoose = require('mongoose');
require('dotenv').config();

// Configure MongoDB Atlas connection options
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Connecting to MongoDB Atlas...');
    console.log('Using connection string:', process.env.MONGODB_URI);
    
    // Parse connection string to verify format
    const url = new URL(process.env.MONGODB_URI);
    console.log('MongoDB Atlas connection details:');
    console.log('  Protocol:', url.protocol);
    console.log('  Host:', url.host);
    console.log('  Pathname:', url.pathname);
    console.log('  Search Params:', url.searchParams.toString());

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Increase timeout for Atlas
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, as IPv6 can cause issues
      retryWrites: true,
      w: 'majority',
      keepAlive: true,
      keepAliveInitialDelay: 300000,
      autoIndex: false, // Don't build indexes automatically
      poolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTryOnce: false, // Keep trying with other servers if a server is down
      heartbeatFrequencyMS: 10000, // Heartbeat every 10 seconds
      minHeartbeatFrequencyMS: 500 // Heartbeat at least every 500ms
    };

    mongoose.connection.on('connected', () => {
      console.log('MongoDB Atlas connection established successfully');
      console.log('Database:', mongoose.connection.name);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB Atlas connection error:', err);
      console.error('Connection string:', process.env.MONGODB_URI);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB Atlas connection disconnected');
    });

    mongoose.connection.on('reconnectFailed', () => {
      console.error('MongoDB Atlas reconnect failed');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB Atlas reconnected successfully');
    });

    // Connect with retry logic
    const connectWithRetry = async () => {
      try {
        console.log('Attempting MongoDB Atlas connection...');
        await mongoose.connect(process.env.MONGODB_URI, options);
        console.log('MongoDB Atlas connected successfully');
      } catch (error) {
        console.error('MongoDB Atlas connection error:', error);
        console.error('Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
      }
    };

    return connectWithRetry();
  } catch (error) {
    console.error('Database connection failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Export the connection function
module.exports = connectDB;

module.exports = connectDB;
