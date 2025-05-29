// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const adminRoutes = require('./routes/admin');



dotenv.config();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/message');
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');
const { router: emailRoutes, setupEmailPolling } = require('./routes/email');


const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*', // In production, use your frontend URL here
    methods: ['GET', 'POST'],
  },
});

// Attach io instance to the app for controller access
app.set('io', io);

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Enable CORS

// Serve static frontend files from /public
app.use(express.static('public'));


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/facebook', facebookRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/email', emailRoutes);
app.use('/api/admin', adminRoutes);

// Health check or root route
app.get('/', (req, res) => {
  res.send('🎉 Omni Chat Server is Live');
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
  
  // You can add more socket event handlers here
});

// MongoDB connection and server start
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      // Start email polling after server is running
      setupEmailPolling(app);
      console.log('📧 Email polling service started');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });