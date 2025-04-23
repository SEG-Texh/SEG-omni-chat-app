const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  channel: { type: String, required: true },
  content: { type: String, required: true },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Null if not claimed
  replies: [
    {
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      content: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
