// === models/message.js ===
const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  platform: {
    type: String,
    enum: ['whatsapp', 'facebook', 'email', 'sms', 'telegram', 'instagram'],
    required: true
  },
  platformMessageId: {
    type: String,
    required: true,
    index: true
  },
  platformThreadId: {
    type: String,
    index: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'read', 'failed', 'deleted'],
    default: 'delivered'
  },
  statusHistory: [{
    status: String,
    timestamp: Date,
    metadata: Schema.Types.Mixed
  }],
  content: {
    text: String,
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio', 'file', 'location', 'sticker']
      },
      url: String,
      caption: String
    }]
  },
  sender: {
    type: String,
    required: true
  },
  recipient: {
    type: String,
    required: true
  },
  platformSender: {
    id: String,
    name: String,
    profilePic: String
  },
  platformRecipient: {
    id: String,
    name: String
  },
  labels: {
    type: [String],
    enum: ['unclaimed', 'claimed', 'priority', 'spam', 'resolved'],
    default: ['unclaimed']
  },
  claimedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  claimedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

messageSchema.index({ labels: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);

