// models/Conversation.js - MongoDB schemas
const conversationSchema = new mongoose.Schema({
  contact: {
    name: String,
    identifier: String, // phone, email, or facebook ID
    platform: {
      type: String,
      enum: ['whatsapp', 'facebook', 'email'],
      required: true
    }
  },
  lastMessage: {
    content: String,
    timestamp: Date,
    sender: String
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'pending'],
    default: 'open'
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: String,
  content: String,
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio'],
    default: 'text'
  },
  platform: {
    type: String,
    enum: ['whatsapp', 'facebook', 'email'],
    required: true
  },
  isOwn: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
});

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: {
    type: String,
    enum: ['agent', 'admin', 'supervisor'],
    default: 'agent'
  },
  status: {
    type: String,
    enum: ['online', 'away', 'offline'],
    default: 'offline'
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});