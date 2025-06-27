const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Database and Models
const connectDB = require('./config/database');
const User = require('./models/User');
const Message = require('./models/message');
const Conversation = require('./models/conversation');
const UserStats = require('./models/userStats');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversation');
const messageRoutes = require('./routes/messages');
const dashboardRoutes = require('./routes/dashboard');

// Initialize Express and Socket.io
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve HTML files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public/chat.html')));

// Socket.io Authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: No token provided'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return next(new Error('Authentication error: User not found'));

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error: ' + err.message));
  }
});

// Track connected users
const connectedUsers = new Map();

// Socket.io Connection Handler
io.on('connection', async (socket) => {
  console.log(`🟢 User connected: ${socket.user.name} (${socket.id})`);

  // Update user status and track connection
  connectedUsers.set(socket.userId, { socketId: socket.id, user: socket.user });
  await User.findByIdAndUpdate(socket.userId, { 
    isOnline: true,
    lastSeen: new Date()
  });

  // Notify others about the new connection
  socket.broadcast.emit('userOnline', {
    userId: socket.userId,
    name: socket.user.name,
    role: socket.user.role
  });

  // Join conversation rooms
  socket.on('joinConversations', async () => {
    try {
      const conversations = await Conversation.find({ participants: socket.user._id });
      conversations.forEach(conv => {
        socket.join(`conversation_${conv._id}`);
        console.log(`User ${socket.user.name} joined conversation ${conv._id}`);
      });
    } catch (err) {
      console.error('Error joining conversations:', err.message);
    }
  });

  // Message handling
  socket.on('sendMessage', async ({ conversationId, content, platform }, callback) => {
    try {
      const message = new Message({
        conversation: conversationId,
        sender: socket.user._id,
        content,
        platform: platform || 'web',
        status: 'delivered'
      });

      const savedMessage = await message.save();
      await savedMessage.populate('sender', 'name profilePic');

      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: savedMessage._id,
        lastMessageAt: new Date(),
        $inc: { unreadCount: 1 }
      });

      // Broadcast to conversation room
      io.to(`conversation_${conversationId}`).emit('newMessage', savedMessage);
      
      if (callback) callback({ status: 'success', message: savedMessage });
    } catch (err) {
      console.error('Message send error:', err);
      if (callback) callback({ status: 'error', message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation_${conversationId}`).emit('userTyping', {
      userId: socket.userId,
      isTyping
    });
  });

  // Disconnection handler
  socket.on('disconnect', async () => {
    console.log(`🔴 User disconnected: ${socket.user.name}`);
    connectedUsers.delete(socket.userId);
    
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    socket.broadcast.emit('userOffline', {
      userId: socket.userId,
      name: socket.user.name
    });
  });
});

// Initialize database and start server
async function initializeServer() {
  try {
    // 1. Connect to database
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    // 2. Initialize statistics
    await initializeUserStats();
    
    // 3. Create default admin if needed
    await createDefaultAdmin();
    
    // 4. Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    process.exit(1);
  }
}

// Helper Functions
async function initializeUserStats() {
  try {
    const stats = await UserStats.findOneAndUpdate(
      {},
      { $setOnInsert: { totalUsers: await User.countDocuments() } },
      { upsert: true, new: true }
    );
    console.log(`ℹ️ UserStats initialized with ${stats.totalUsers} users`);
  } catch (error) {
    console.error('❌ UserStats initialization error:', error.message);
  }
}

async function createDefaultAdmin() {
  try {
    const adminExists = await User.exists({ role: 'admin' });
    if (!adminExists) {
      const admin = new User({
        name: 'Admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        isOnline: false
      });
      await admin.save();
      console.log('✅ Default admin created');
    }
  } catch (error) {
    console.error('❌ Admin creation error:', error.message);
  }
}

// Start the server
initializeServer();