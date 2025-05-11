const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/message');
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Replace with frontend URL in production for security
    methods: ['GET', 'POST'],
  },
});

// Attach Socket.IO to app instance for access in controllers
app.set('io', io);

// Middleware
app.use(express.json());  // Body parser for JSON requests
app.use(cors());

// Routes
app.use('/api/auth', authRoutes);        // Authentication routes
app.use('/api/messages', messageRoutes); // Messaging routes
app.use('/facebook', facebookRoutes);    // Facebook webhook & message routes
app.use('/whatsapp', whatsappRoutes);    // whatsapp webhook & message routes


app.get('/', (req, res) => {
  res.send('🎉 Omni Chat Server is Live');
});

// Socket.IO setup for real-time communication
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// MongoDB Connection & Server Startup
const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
