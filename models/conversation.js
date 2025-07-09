const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ConversationSchema = new Schema({
  platform: { type: String, default: 'facebook' },
  platformConversationId: { type: String, unique: true }, // Unique identifier for the conversation on the platform
  participants: [{ type: String }], // Facebook user IDs or your user IDs
  customerId: { type: String, required: true }, // Facebook user/customer ID
  agentId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // Assigned agent (null until paired)
  status: { type: String, enum: ['pending', 'active', 'ended'], default: 'pending' },
  startTime: { type: Date },
  expiresAt: { type: Date },
  endTime: { type: Date },
  locked: { type: Boolean, default: false }, // True when paired
  lastMessageAt: { type: Date },
  messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }], // Optional: message references
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  unreadCount: { type: Number, default: 0 }
}, { timestamps: true });

const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;
