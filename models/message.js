const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Platform identifiers
  senderId: { type: String, required: true },        // Could be email address, FB ID, or WhatsApp number
  recipientId: { type: String, required: true },     // Your email, page ID, or phone number

  // Platform source
  source: {
    type: String,
    enum: ['email', 'facebook', 'whatsapp'],
    required: true
  },

  // Message content
  content: { type: String, required: true },

  // Direction of message
  direction: {
    type: String,
    enum: ['inbound', 'outbound'], // inbound = from user to you, outbound = from you to user
    required: true
  },

  // Claiming system
  isClaimed: { type: Boolean, default: false },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Replies from internal users
  replies: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
