const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  sender: String, // Facebook user ID or your user ID
  content: String,
  platform: { type: String, default: 'facebook' }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
