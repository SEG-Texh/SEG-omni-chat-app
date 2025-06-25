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

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
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
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);

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
  socket.join(socket.userId);

  socket.broadcast.emit('userOnline', {
    userId: socket.userId,
    name: socket.user.name,
    role: socket.user.role
  });

  socket.on('sendMessage', async ({ receiverId, content, messageType = 'direct' }) => {
    try {
      const message = new Message({
        sender: socket.userId,
        receiver: receiverId,
        content,
        messageType
      });
      await message.save();
      await message.populate('sender', 'name email role');
      await message.populate('receiver', 'name email role');

      if (messageType === 'broadcast') {
        io.emit('newMessage', message);
      } else {
        socket.to(receiverId).emit('newMessage', message);
        socket.emit('newMessage', message);
      }
    } catch (err) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', ({ receiverId, isTyping }) => {
    socket.to(receiverId).emit('userTyping', {
      userId: socket.userId,
      name: socket.user.name,
      isTyping
    });
  });

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

