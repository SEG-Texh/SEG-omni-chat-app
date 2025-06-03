// ============================================================================
// SERVER/SERVER.JS (MAIN SERVER FILE)
// ============================================================================
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');

const User = require('./models/User');
const Message = require('./models/message');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', async (socket) => {
  console.log(`User ${socket.user.name} connected`);
  
  // Store connected user
  connectedUsers.set(socket.userId, {
    socketId: socket.id,
    user: socket.user
  });

  // Update user online status
  await User.findByIdAndUpdate(socket.userId, { isOnline: true });

  // Join user to their room
  socket.join(socket.userId);

  // Notify all users about online status change
  socket.broadcast.emit('userOnline', {
    userId: socket.userId,
    name: socket.user.name,
    role: socket.user.role
  });

  // Handle sending messages
  socket.on('sendMessage', async (data) => {
    try {
      const { receiverId, content, messageType = 'direct' } = data;

      const messageData = {
        sender: socket.userId,
        content,
        messageType
      };

      if (receiverId && messageType === 'direct') {
        messageData.receiver = receiverId;
      }

      const message = new Message(messageData);
      await message.save();

      await message.populate('sender', 'name email role');
      await message.populate('receiver', 'name email role');

      if (messageType === 'broadcast') {
        // Send to all connected users
        io.emit('newMessage', message);
      } else if (receiverId) {
        // Send to specific user
        socket.to(receiverId).emit('newMessage', message);
        socket.emit('newMessage', message); // Also send to sender for UI update
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    socket.to(data.receiverId).emit('userTyping', {
      userId: socket.userId,
      name: socket.user.name,
      isTyping: data.isTyping
    });
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log(`User ${socket.user.name} disconnected`);
    
    // Remove from connected users
    connectedUsers.delete(socket.userId);

    // Update user offline status
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: false,
      lastSeen: new Date()
    });

    // Notify all users about offline status
    socket.broadcast.emit('userOffline', {
      userId: socket.userId,
      name: socket.user.name
    });
  });
});

// Create default admin user if none exists
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const admin = new User({
        name: 'Admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      });
      await admin.save();
      console.log('Default admin created: admin@example.com / admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await createDefaultAdmin();
});

module.exports = { app, server, io };