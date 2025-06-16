//models/message.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  // Platform identification
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

  // Message direction and status
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

  // Message content
  content: {
    text: {
      type: String,
      trim: true
    },
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio', 'file', 'location', 'sticker']
      },
      url: String,
      caption: String
    }]
  },

  // User references (using ObjectId for internal users)
sender: {
  type: String,  // Change from ObjectId to String
  required: true
},
// Remove ref: 'User' since it's not referencing your User model
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Platform sender/recipient info (for external messages)
  platformSender: {
    id: String,
    name: String,
    profilePic: String
  },
  platformRecipient: {
    id: String,
    name: String
  },

  // Message management
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

  // System fields
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
});
// Add index for unclaimed messages
messageSchema.index({ labels: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);