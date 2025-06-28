const http = require('http');
const express = require('express');
const socketIo = require('socket.io');
const app = require('./app');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const socket = require('./config/socket');
const connectDB = require('./config/database');
const bcrypt = require('bcryptjs');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const facebookRoutes = require('./routes/facebook'); // ✅
const conversationRoutes = require('./routes/conversation');
const messageRoutes = require('./routes/messages');
const dashboardRoutes = require('./routes/dashboard');
const User = require('./models/User');
const Message = require('./models/message');
const UserStats = require('./models/userStats'); // Add this line

const server = http.createServer(app);
const io = socket.init(server);

// Initialize database and stats
connectDB().then(async () => {
  await initializeUserStats(); // Initialize UserStats after DB connection
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await createDefaultAdmin();
  });
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './public')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/facebook', facebookRoutes); // ✅
app.use('/api/conversation', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chats', dashboardRoutes);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, './public/dashboard.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, './public/chat.html')));

// Authentication Middleware BEFORE connection
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return next(new Error('Authentication error'));

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

const connectedUsers = new Map();

io.on('connection', async (socket) => {
  console.log(`🟢 User connected: ${socket.user.name} (${socket.id})`);

  connectedUsers.set(socket.userId, { socketId: socket.id, user: socket.user });
  await User.findByIdAndUpdate(socket.userId, { isOnline: true });
  socket.join(socket.userId); // Optional: for personal notifications

  // Broadcast that user is online
  socket.broadcast.emit('userOnline', {
    userId: socket.userId,
    name: socket.user.name,
    role: socket.user.role
  });

  // JOIN ALL CONVERSATION ROOMS
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

  // SEND A MESSAGE
  socket.on('sendMessage', async ({ conversationId, content, platform }) => {
    try {
      const message = new Message({
        conversation: conversationId,
        sender: socket.user._id,
        content,
        platform
      });

      const savedMessage = await message.save();
      await savedMessage.populate('sender', 'name avatar');

      // Update conversation metadata
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: savedMessage._id,
        $inc: { unreadCount: 1 }
      });

      // Emit to all users in the conversation room
      io.to(`conversation_${conversationId}`).emit('newMessage', savedMessage);
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // TYPING INDICATOR
  socket.on('typing', ({ conversationId, isTyping }) => {
    socket.to(`conversation_${conversationId}`).emit('userTyping', {
      userId: socket.userId,
      name: socket.user.name,
      isTyping
    });
  });

  // DISCONNECT
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


// UserStats initialization function
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
    // Consider whether you want to proceed with server startup or exit
  }
}

const createDefaultAdmin = async () => {
  const exists = await User.findOne({ role: 'admin' });
  if (!exists) {
    const admin = new User({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('✅ Default admin created: admin@example.com / admin123');
  }
};

