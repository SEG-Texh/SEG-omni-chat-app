// SERVER/MODELS/MESSAGE.JS
// ============================================================================
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['direct', 'broadcast', 'group'],
    default: 'direct'
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
},{  platform: {
    type: String,
    required: true,
    enum: ['whatsapp', 'facebook', 'email', 'sms'],
  },
  platformMessageId: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  recipient: {
    type: String,
    required: true,
  },
  content: {
    text: String,
    attachments: [{
      type: String, // 'image', 'video', 'audio', 'file'
      url: String,
      caption: String,
    }],
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
  },
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

// Indexes for faster querying
messageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true });
messageSchema.index({ sender: 1 });
messageSchema.index({ recipient: 1 });
messageSchema.index({ timestamp: -1 });


module.exports = mongoose.model('Message', messageSchema);