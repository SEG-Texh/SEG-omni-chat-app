// models/conversation.js
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  platform: {
    type: String,
    enum: ['facebook', 'whatsapp', 'email', 'sms'],
    required: true
  },
  platformConversationId: String,
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  lastMessage: Date
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);