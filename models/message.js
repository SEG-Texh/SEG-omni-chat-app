const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  sender: String, // Facebook user ID or your user ID
  content: Schema.Types.Mixed,
  platform: { type: String, default: 'facebook' },
  platformMessageId: { type: String, default: null }
}, { timestamps: true });

MessageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true, sparse: true });

const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
module.exports = Message;
