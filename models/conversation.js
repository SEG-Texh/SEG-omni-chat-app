const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConversationSchema = new Schema({
  platform: { type: String, default: 'facebook' },
  platformConversationId: { type: String, unique: true }, // Unique identifier for the conversation on the platform
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Facebook user IDs or your user IDs
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  unreadCount: { type: Number, default: 0 }
}, { timestamps: true });

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;
