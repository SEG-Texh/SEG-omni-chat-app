const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  platform: {
    type: String,
    enum: ['facebook', 'whatsapp', 'email', 'sms'],
    required: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  labels: [String],
  archived: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

conversationSchema.index({ participants: 1, platform: 1 });
module.exports = mongoose.model('Conversation', conversationSchema);