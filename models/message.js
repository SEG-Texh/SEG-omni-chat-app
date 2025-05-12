const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },         // ID from the platform (email, FB, WhatsApp)
  recipient: { type: String, required: true },      // Your Page ID, Email, or number
  channel: { type: String, enum: ['email', 'facebook', 'whatsapp'], required: true },

  content: { type: String, required: true },        // Original message content

  isClaimed: { type: Boolean, default: false },     // Flag to lock session
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  replies: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Internal user replying
      content: String,
      timestamp: { type: Date, default: Date.now },
    }
  ],
}, { timestamps: true }); // Adds createdAt and updatedAt

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
