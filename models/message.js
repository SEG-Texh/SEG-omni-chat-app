const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['facebook', 'whatsapp', 'email', 'sms']
  },
  senderId: {
    type: String,
    required: true
  },
  recipientId: String,
  message: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    required: true,
    enum: ['incoming', 'outgoing']
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  metadata: mongoose.Schema.Types.Mixed
});

// Indexes for faster queries
chatSchema.index({ platform: 1, senderId: 1 });
chatSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Chat', chatSchema);