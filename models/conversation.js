const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConversationSchema = new Schema({
  platform: { type: String, default: 'facebook' },
  participants: [String], // Facebook user IDs or your user IDs
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  unreadCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
