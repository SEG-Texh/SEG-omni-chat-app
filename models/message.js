// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for broadcast messages
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video'],
    default: 'text'
  },
  platform: {
    type: String,
    enum: ['web', 'whatsapp', 'facebook', 'email', 'sms'],
    default: 'web'
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  editedAt: {
    type: Date,
    default: null
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for better query performance
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ platform: 1, createdAt: -1 });

// Virtual for formatted timestamp
messageSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleString();
});

// Don't return deleted messages by default
messageSchema.pre(/^find/, function(next) {
  // 'this' points to the current query
  this.find({ isDeleted: { $ne: true } });
  next();
});

module.exports = mongoose.model('Message', messageSchema);