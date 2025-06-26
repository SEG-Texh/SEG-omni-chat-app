// models/message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: String,
    attachments: [{
      url: String,
      type: {
        type: String,
        enum: ['image', 'video', 'file', 'audio']
      }
    }]
  },
  platform: {
    type: String,
    enum: ['facebook', 'whatsapp', 'email', 'sms'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Additional fields for platform-specific IDs
  platformMessageId: String,
  platformSenderId: String,
  platformRecipientId: String
}, { 
  timestamps: true,
  // This helps with validation errors
  strict: 'throw' 
});

module.exports = mongoose.model('Message', messageSchema);