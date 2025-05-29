// server.js - Main server file
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

// Import routes and services
const whatsappService = require('./services/whatsappService');
const facebookService = require('./services/facebookService');
const emailService = require('./services/emailService');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/omnichat', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_room', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, message, platform, recipient } = data;
      
      // Send message through appropriate service
      let result;
      switch (platform) {
        case 'whatsapp':
          result = await whatsappService.sendMessage(recipient, message);
          break;
        case 'facebook':
          result = await facebookService.sendMessage(recipient, message);
          break;
        case 'email':
          result = await emailService.sendEmail(recipient, 'Reply', message);
          break;
      }

      // Broadcast message to all clients in the conversation room
      io.to(conversationId).emit('new_message', {
        id: Date.now(),
        conversationId,
        sender: 'Agent',
        content: message,
        timestamp: new Date(),
        platform,
        isOwn: true
      });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message_error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Webhook endpoints
app.use('/webhook/whatsapp', whatsappService.webhook);
app.use('/webhook/facebook', facebookService.webhook);
app.use('/webhook/email', emailService.webhook);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export io for use in other modules
module.exports = { app, io };