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
      w: 'majority'
    };

    // Add more detailed logging after options are defined
    console.log('MongoDB Atlas connection options:');
    console.log('  Using IPv4:', options.family === 4);
    console.log('  Server selection timeout:', options.serverSelectionTimeoutMS);
    console.log('  Socket timeout:', options.socketTimeoutMS);
    console.log('  Retry writes:', options.retryWrites);
    console.log('  Write concern:', options.w);

    mongoose.connection.on('connected', () => {
      console.log('MongoDB Atlas connection established successfully');
      console.log('Database:', mongoose.connection.name);
      console.log('Connection state:', mongoose.connection.readyState);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB Atlas connection error:', err);
      console.error('Connection string:', process.env.MONGODB_URI);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      console.error('Current connection state:', mongoose.connection.readyState);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB Atlas connection disconnected');
      console.log('Connection state:', mongoose.connection.readyState);
    });

    mongoose.connection.on('reconnectFailed', () => {
      console.error('MongoDB Atlas reconnect failed');
      console.log('Connection state:', mongoose.connection.readyState);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB Atlas reconnected successfully');
      console.log('Connection state:', mongoose.connection.readyState);
    });

    // Connect with retry logic
    const connectWithRetry = async () => {
      try {
        console.log('Attempting MongoDB Atlas connection...');
        console.log('Connection state before connect:', mongoose.connection.readyState);
        await mongoose.connect(process.env.MONGODB_URI, options);
        console.log('MongoDB Atlas connected successfully');
        console.log('Connection state after connect:', mongoose.connection.readyState);
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
