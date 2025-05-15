const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Platform identifiers
  senderId: { type: String, required: true },        // ID from Email, Facebook, or WhatsApp
  recipientId: { type: String, required: true },     // Your Email, Page ID, or Phone number

  // Platform source
  source: { 
    type: String, 
    enum: ['email', 'facebook', 'whatsapp'], 
    required: true 
  },

  // Message content
  content: { type: String, required: true },

  // Claiming system
  isClaimed: { type: Boolean, default: false },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },  // Internal user who claimed

  // Replies from internal users
  replies: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Internal user replying
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ]

}, { timestamps: true }); // Automatically adds createdAt and updatedAt

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
