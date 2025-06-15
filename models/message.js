const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Core message fields
  content: {
    text: { type: String, required: true },
    attachments: [{
      url: String,
      type: { type: String, enum: ['image', 'video', 'audio', 'file'] },
      name: String,
      size: Number
    }]
  },
  
  // Participant information
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return this.messageType === 'direct'; }
  },
  
  // Platform metadata
  platform: {
    type: String,
    required: true,
    enum: ['facebook', 'whatsapp', 'email', 'web', 'sms']
  },
  platformMessageId: String, // Original ID from the platform
  
  // Message classification
  messageType: {
    type: String,
    enum: ['direct', 'broadcast', 'group'],
    default: 'direct'
  },
  
  // Status flags
  isRead: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  claimedAt: Date,
  
  // Platform-specific metadata
  metadata: {
    // Common fields
    originalTimestamp: Date,
    
    // Email specific
    emailHeaders: Object,
    subject: String,
    
    // Facebook specific
    fbThreadId: String,
    
    // WhatsApp specific
    waFrom: String,
    waTo: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
messageSchema.index({ claimed: 1, createdAt: -1 });
messageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true });

module.exports = mongoose.model('Message', messageSchema);