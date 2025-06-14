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
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for optimized queries
messageSchema.index({ platform: 1, platformMessageId: 1 }, { unique: true });
messageSchema.index({ labels: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ recipient: 1 });
messageSchema.index({ claimedBy: 1 });

// Virtual for formatted message display
messageSchema.virtual('displayText').get(function() {
  return this.content.text || 
    (this.content.attachments.length > 0 ? 
      `[${this.content.attachments[0].type.toUpperCase()}]` : 
      '[No content]');
});

// Status history tracking
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
messageSchema.statics.createFromFacebook = async function(webhookEvent, User) {
  const messagingEvent = webhookEvent.messaging[0];
  
  // Find or create user based on Facebook ID
  const user = await User.findOneAndUpdate(
    { 'platformIds.facebook': messagingEvent.sender.id },
    { 
      $setOnInsert: {
        name: `FB-${messagingEvent.sender.id}`,
        platformIds: { facebook: messagingEvent.sender.id }
      }
    },
    { upsert: true, new: true }
  );

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
        caption: attach.payload?.caption
      }))
    },
    sender: user._id,
    platformSender: {
      id: messagingEvent.sender.id,
      name: messagingEvent.sender.name
    },
    platformRecipient: {
      id: messagingEvent.recipient.id
    },
    labels: ['unclaimed'],
    metadata: {
      isReply: messagingEvent.message.is_echo,
      rawEvent: webhookEvent
    }
  });
};

// Method to claim a message
messageSchema.methods.claim = async function(userId) {
  if (this.labels.includes('claimed')) {
    throw new Error('Message already claimed');
  }
  
  this.labels = this.labels.filter(l => l !== 'unclaimed');
  this.labels.push('claimed');
  this.claimedBy = userId;
  this.claimedAt = new Date();
  
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);