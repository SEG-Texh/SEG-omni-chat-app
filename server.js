const express = require('express');
const { Router } = express;
// Use socket.io from config/socket.js
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Models
const User = require('./models/User');
const UserStats = require('./models/userStats');
const Conversation = require('./models/conversation');
const Message = require('./models/message');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const facebookRoutes = require('./routes/facebook');
const conversationRoutes = require('./routes/conversation');
const messageRoutes = require('./routes/messages');
const dashboardRoutes = require('./routes/dashboard');

// Load environment variables first
require('dotenv').config({
  path: path.join(__dirname, '.env')
});

// Log environment variables
console.log('Environment variables loaded:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('FACEBOOK_VERIFY_TOKEN:', process.env.FACEBOOK_VERIFY_TOKEN);

// Port configuration
const PORT = process.env.PORT || 3000;

// Initialize Express app and server
const app = express();
const router = Router();
app.use(router);
const server = http.createServer(app);

// Initialize socket.io using config/socket.js
const io = require('./config/socket').init(server);

// Store connected users
const connectedUsers = new Map();

// Export io for use in other files
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root URL to login.html
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
const whatsappRoutes = require('./routes/whatsapp');
app.use('/api/whatsapp', whatsappRoutes);

// Set up health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Database connection with retry logic
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to database');
      initializeUserStats();
      createDefaultAdmin();
    })
    .catch(err => {
      console.error('❌ Failed to connect to database:', err);
      console.error('Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      console.log('Retrying database connection in 5 seconds...');
      setTimeout(connectWithRetry, 5000);
    });
};

// Start connection with retry
connectWithRetry();

// Initialize UserStats
async function initializeUserStats() {
  try {
    const exists = await UserStats.findOne({});
    if (!exists) {
      const count = await User.countDocuments();
      await UserStats.create({ totalUsers: count });
      console.log('✅ UserStats initialized with', count, 'users');
    } else {
      console.log('ℹ️ UserStats already exists with', exists.totalUsers, 'users');
    }
  } catch (error) {
    console.error('❌ Error initializing UserStats:', error.message);
  }
}

// Create default admin
async function createDefaultAdmin() {
  try {
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const user = new User({
        name: 'Admin',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin'
      });
      await user.save();
      console.log('✅ Default admin created');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error.message);
  }
}

// Socket.io connection handling
io.on('connection', async (socket) => {
  // Handle escalation accept/decline
  socket.on('accept_escalation', async ({ conversationId }) => {
    try {
      const Conversation = require('./models/conversation');
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('claim_result', { success: false, message: 'Conversation not found.' });
        return;
      }
      // Only allow claim if not already locked
      if (conversation.locked && conversation.agentId) {
        socket.emit('claim_result', { success: false, message: 'Session already claimed.' });
        return;
      }
      conversation.locked = true;
      conversation.agentId = socket.userId;
      conversation.status = 'active';
      await conversation.save();
      socket.emit('claim_result', { success: true, conversation });
      io.emit('session_claimed', { conversationId });
    } catch (err) {
      socket.emit('claim_result', { success: false, message: 'Server error.' });
    }
  });
  socket.on('decline_escalation', ({ conversationId }) => {
    // Optionally handle metrics, but just dismiss on frontend for now
  });
  // --- Agent claims live chat session ---
  socket.on('claim_live_chat', async ({ conversationId }) => {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
      const Conversation = require('./models/conversation');
      // Atomically assign agent if not already paired
      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: conversationId,
          agentId: null,
          locked: false,
          status: { $in: ['pending', 'awaiting_agent'] }
        },
        {
          agentId: socket.userId,
          locked: true,
          status: 'active',
          startTime: now,
          expiresAt
        },
        { new: true }
      );
      if (!conversation) {
        socket.emit('claim_result', { success: false, message: "Session already claimed." });
        return;
      }
      // Notify this agent and the customer
      socket.emit('claim_result', { success: true, conversation });
      io.to(conversation.customerId).emit('session_paired', { conversation });
      // Notify all other agents to remove this request from their UI
      for (const [userId, { socketId, user }] of connectedUsers.entries()) {
        if ((user.role === 'agent' || user.role === 'supervisor') && userId !== socket.userId) {
          io.to(socketId).emit('session_claimed', { conversationId });
        }
      }
    } catch (err) {
      socket.emit('claim_result', { success: false, message: "Server error." });
    }
  });

  try {
    // Get user info from socket auth
    const { userId, token } = socket.handshake.auth;
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.user = await User.findById(decoded.id);
    } catch (err) {
      console.error('Invalid token:', err);
      socket.disconnect(true);
      return;
    }

    // Add user to connected users map
  connectedUsers.set(socket.userId, { socketId: socket.id, user: socket.user });
  await User.findByIdAndUpdate(socket.userId, { isOnline: true });
    socket.join(socket.userId);

    console.log(`🟢 User connected: ${socket.user && socket.user.name ? socket.user.name : 'Unknown'}`);

  socket.broadcast.emit('userOnline', {
    userId: socket.userId,
      name: socket.user && socket.user.name ? socket.user.name : 'Unknown',
      role: socket.user && socket.user.role ? socket.user.role : 'Unknown'
    });

    // Handle Facebook room
    socket.on('joinFacebookRoom', async () => {
      console.log(`User ${socket.user && socket.user.name ? socket.user.name : 'Unknown'} joining Facebook room`);
      socket.join('facebook');
      
      try {
        const conversations = await Conversation.find({ platform: 'facebook' })
          .populate('lastMessage')
          .populate('participants', 'name');
        
        socket.emit('facebookConversations', conversations);
        console.log(`Sent Facebook conversations to user: ${socket.user.name}`);
      } catch (err) {
        console.error('Error sending Facebook conversations:', err);
      }
    });

    // Handle WhatsApp conversation room join
    socket.on('joinWhatsAppConversationRoom', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`[WA][Socket] User joined WhatsApp room: conversation_${conversationId}`);
    });

  socket.on('joinConversations', async () => {
    try {
      const conversations = await Conversation.find({ participants: socket.user._id });
      conversations.forEach(conv => {
        socket.join(`conversation_${conv._id}`);
      });
    } catch (err) {
      console.error('Error joining conversations:', err.message);
    }
  });

  socket.on('sendMessage', async ({ conversationId, content, platform }) => {
    try {
      const Conversation = require('./models/conversation');
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }
      // Session expiry check
      const now = new Date();
      if (conversation.status === 'active' && conversation.expiresAt && conversation.expiresAt < now) {
        conversation.status = 'ended';
        conversation.locked = false;
        conversation.endTime = now;
        await conversation.save();
        // Notify both agent and customer
        io.to(conversation.customerId).emit('session_ended', { conversationId });
        if (conversation.agentId) io.to(conversation.agentId.toString()).emit('session_ended', { conversationId });
        socket.emit('error', { message: 'Session has expired.' });
        return;
      }
      // Only paired agent or customer can send messages during active session
      if (conversation.status === 'active' && conversation.locked) {
        if (socket.user.role === 'agent' || socket.user.role === 'supervisor') {
          if (!conversation.agentId || !conversation.agentId.equals(socket.userId)) {
            socket.emit('error', { message: 'You are not authorized to reply to this conversation.' });
            return;
          }
        } else if (socket.userId !== conversation.customerId) {
          socket.emit('error', { message: 'You are not authorized to reply to this conversation.' });
          return;
        }
      }
      // If session ended, block sending
      if (conversation.status === 'ended') {
        socket.emit('error', { message: 'Session has ended.' });
        return;
      }
      // Proceed to send message
      const message = new Message({
        conversation: conversationId,
        sender: socket.user._id,
        content,
        platform
      });
      const savedMessage = await message.save();
      await savedMessage.populate('sender', 'name avatar');
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: savedMessage._id,
        $inc: { unreadCount: 1 }
      });
      io.to(`conversation_${conversationId}`).emit('new_message', savedMessage);
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
      console.error('Error sending message:', err);
    }
  });

  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation_${conversationId}`).emit('userTyping', {
      userId: socket.userId,
      name: socket.user.name,
      isTyping
    });
  });

    socket.on('joinFacebookConversationRoom', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} joined room conversation_${conversationId}`);
    });

  socket.on('disconnect', async () => {
      try {
    const userName = socket.user && socket.user.name ? socket.user.name : 'Unknown';
    console.log(`🔴 User disconnected: ${userName}`);
    connectedUsers.delete(socket.userId);
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    socket.broadcast.emit('userOffline', {
      userId: socket.userId,
      name: userName
    });
      } catch (err) {
        console.error('Error during disconnect:', err);
      }
    });

  } catch (err) {
    console.error('Error in connection handler:', err);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('HTTP error:', {
    message: err.message,
    stack: err.stack,
    user: req.user ? req.user._id : 'anonymous'
  });
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: err.message
  });
});

// Error handling for socket.io
io.on('error', (error) => {
  console.error('Socket.io error:', {
    message: error.message,
    stack: error.stack
  });
});

// Error handling for server
server.on('error', (error) => {
  console.error('Server error:', {
    message: error.message,
    stack: error.stack
  });
});

// Start the server
const hostname = process.env.NODE_ENV === 'production' ? 
'chat-app-omni-33e1e5eaa993-e4c6c1d133e6.herokuapp.com' : 
'localhost';

server.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
console.log(`WebSocket URL: wss://${hostname}/socket.io`);
});

// Handle process termination gracefully
process.on('SIGTERM', () => {
console.log('SIGTERM signal received: closing HTTP server');
server.close(() => {
console.log('HTTP server closed');
process.exit(0);
});
});

process.on('SIGINT', () => {
console.log('SIGINT signal received: closing HTTP server');
server.close(() => {
console.log('HTTP server closed');
process.exit(0);
});
});