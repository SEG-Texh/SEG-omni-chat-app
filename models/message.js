const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  // Common platform fields
  platform: {
    type: String,
    enum: ['whatsapp', 'facebook', 'email', 'sms'],
    required: true
  },
  platformMessageId: {
    type: String,
    required: true,
    unique: true
  },

  // Direction and metadata
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  metadata: Schema.Types.Mixed,

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now
  },

  // Message content
  content: {
    text: {
      type: String,
      trim: true
    },
    attachments: [{
      type: {
        type: String, // 'image', 'video', etc.
        enum: ['image', 'video', 'audio', 'file']
      },
      url: String,
      caption: String
    }]
  },

  // Platform-level sender/recipient info
  sender: {
    type: String,
    required: true
  },
  recipient: {
    type: String,
    required: true
  },

  // Internal chat system (optional)
  internalSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  internalReceiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
});

// Indexes
messageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true });
messageSchema.index({ sender: 1 });
messageSchema.index({ recipient: 1 });
messageSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
