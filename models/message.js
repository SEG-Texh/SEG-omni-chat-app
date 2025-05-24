const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['facebook', 'email', 'whatsapp'],
    required: true
  },
  sender: String,
  recipient: String,
  content: String,
  timestamp: Date,
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
