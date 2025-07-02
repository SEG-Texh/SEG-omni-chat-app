const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');

// Initialize Express app
const app = express();

// Load environment variables
require('dotenv').config();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, './public')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const facebookRoutes = require('./routes/facebook');
const conversationRoutes = require('./routes/conversation');
const messageRoutes = require('./routes/messages');
const dashboardRoutes = require('./routes/dashboard');
const User = require('./models/User');
const Message = require('./models/message');
const Conversation = require('./models/conversation');
const UserStats = require('./models/userStats');

// Initialize database and stats
const socket = require('./config/socket');
const connectDB = require('./config/database');
const bcrypt = require('bcryptjs');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chats', dashboardRoutes);

// Static files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, './public/index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, './public/dashboard.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, './public/chat.html')));

// Create server and socket
const server = http.createServer(app);
const io = socket.init(server);

// Attach io to req for all routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.set('io', io);

// Initialize database and stats
connectDB().then(async () => {
  await initializeUserStats(); // Initialize UserStats after DB connection
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`MongoDB URI: ${process.env.MONGODB_URI}`);
    console.log(`JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log(`WebSocket URL: wss://omni-chat-app.onrender.com/socket.io`);
    createDefaultAdmin();
  });
}).catch(err => {
  console.error('❌ Failed to connect to database:', err.message);
  process.exit(1);
});

// Set up WebSocket CORS
io.origins((origin, callback) => {
  callback(null, true);
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Set up health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Add error handling for socket.io
io.on('error', (error) => {
  console.error('Socket.io error:', error);
});

// Add error handling for server
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Socket.io connection handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('Authentication error'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    console.error('WebSocket authentication error:', err);
    next(new Error('Authentication error'));
  }
});

// Set up the connection handler after authentication middleware
io.on('connection', async (socket) => {
  try {
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
        io.to(`conversation_${conversationId}`).emit('new_message', savedMessage);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
        console.error('Error sending message:', err);
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
      try {
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
      } catch (err) {
        console.error('Error during disconnect:', err);
      }
    });

    socket.on('joinFacebookConversationRoom', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
      console.log(`Socket ${socket.id} joined room conversation_${conversationId}`);
    });
  } catch (err) {
    console.error('Error in connection handler:', err);
  }
});

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
      io.to(`conversation_${conversationId}`).emit('new_message', savedMessage);
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

  socket.on('joinFacebookConversationRoom', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`Socket ${socket.id} joined room conversation_${conversationId}`);
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
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return next(new Error('Authentication error'));

    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
}

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
};
