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
      },
      name: String // Added attachment name
    }]
  },
  platform: {
    type: String,
    enum: ['facebook', 'whatsapp', 'email', 'sms'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'received', 'failed'],
    default: 'sent'
  },
  direction: {  // Added direction field
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  platformMessageId: String,
  platformSenderId: String,
  platformRecipientId: String,
  error: String // Added for tracking send errors
}, { 
  timestamps: true,
  strict: 'throw' 
});

// Indexes for better performance
messageSchema.index({ conversation: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ timestamp: -1 });
messageSchema.index({ platform: 1, status: 1 });

module.exports = mongoose.model('Message', messageSchema);