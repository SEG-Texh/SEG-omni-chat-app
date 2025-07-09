const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  sender: { type: Schema.Types.ObjectId, ref: 'User' },
  content: Schema.Types.Mixed,
  platform: { type: String, default: 'facebook' },
  platformMessageId: { type: String, default: null },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true }
}, { timestamps: true });

MessageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true, sparse: true });

const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
module.exports = Message;
