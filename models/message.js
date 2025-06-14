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
  platformThreadId: {  // For conversation threads
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
    default: 'sent'
  },
  statusHistory: [{
    status: String,
    timestamp: Date,
    metadata: Schema.Types.Mixed
  }],

  // Message content with rich media support
  content: {
    text: {
      type: String,
      trim: true
    },
    attachments: [{
      type: {
        type: String,
        enum: ['image', 'video', 'audio', 'file', 'location', 'sticker', 'template']
      },
      url: String,
      caption: String,
      mimeType: String,
      size: Number,
      name: String,
      coordinates: {  // For location attachments
        lat: Number,
        long: Number
      }
    }],
    quickReplies: [{
      type: String
    }],
    buttons: [{
      type: {
        type: String,
        enum: ['url', 'postback', 'phone', 'account_link']
      },
      title: String,
      payload: Schema.Types.Mixed
    }]
  },

  // Sender and recipient information
  sender: {
    id: String,
    name: String,
    profilePic: String,
    platform: String
  },
  recipient: {
    id: String,
    name: String,
    platform: String
  },

  // Internal system references
  conversation: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  assignedTo: {  // For agent assignment
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  labels: [{
    type: String,
    enum: ['unclaimed', 'priority', 'spam', 'resolved', 'follow_up']
  }],

  // Message metadata
  metadata: {
    isForwarded: Boolean,
    isReply: Boolean,
    originalMessageId: String,
    facebookMessageTag: String,  // For messenger tags
    whatsappContext: {  // For whatsapp replies
      messageId: String,
      from: String
    },
    deliveryMetrics: {  // For analytics
      deliveryTime: Number,
      readTime: Number
    }
  },

  // System fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for optimized queries
messageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true });
messageSchema.index({ 'sender.id': 1 });
messageSchema.index({ 'recipient.id': 1 });
messageSchema.index({ timestamp: -1 });
messageSchema.index({ labels: 1 });
messageSchema.index({ conversation: 1 });
messageSchema.index({ assignedTo: 1, status: 1 });

// Virtual for formatted message display
messageSchema.virtual('displayText').get(function() {
  if (this.content.text) return this.content.text;
  if (this.content.attachments.length > 0) {
    return `[${this.content.attachments[0].type.toUpperCase()}] ${this.content.attachments[0].caption || ''}`;
  }
  return '[No content]';
});

// Pre-save hook for status history
messageSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory = this.statusHistory || [];
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date()
    });
  }
  next();
});

// Static method for Facebook message creation
messageSchema.statics.createFromFacebook = async function(webhookEvent) {
  const messagingEvent = webhookEvent.messaging[0];
  
  return this.create({
    platform: 'facebook',
    platformMessageId: messagingEvent.message.mid,
    platformThreadId: messagingEvent.sender.id,
    direction: 'inbound',
    status: 'delivered',
    content: {
      text: messagingEvent.message.text,
      attachments: messagingEvent.message.attachments?.map(attach => ({
        type: attach.type,
        url: attach.payload?.url,
        mimeType: attach.payload?.mime_type
      }))
    },
    sender: {
      id: messagingEvent.sender.id,
      platform: 'facebook'
    },
    recipient: {
      id: messagingEvent.recipient.id,
      platform: 'facebook'
    },
    labels: ['unclaimed'],
    metadata: {
      isReply: messagingEvent.message.is_echo
    }
  });
};

module.exports = mongoose.model('Message', messageSchema);