// server/models/conversation.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  platform: {
    type: String,
    enum: ['facebook', 'whatsapp', 'email', 'sms'],
    required: true
  },
  platformConversationId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'pending'],
    default: 'active'
  },
  lastMessage: {
    type: Date,
    default: Date.now
  },
  labels: [String],
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual for message count
conversationSchema.virtual('messageCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversation',
  count: true
});

// Indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ platform: 1, status: 1 });
conversationSchema.index({ lastMessage: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;