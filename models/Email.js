const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  // Fields from both schemas
  messageId: {
    type: String,
    unique: true,
    required: true
  },
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: {
    type: [String], // Changed from String to array to support multiple recipients
    required: true
  },
  cc: {
    type: [String],
    default: []
  },
  bcc: {
    type: [String],
    default: []
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    default: ''
  },
  html: {
    type: String,
    default: ''
  },
  body: {
    type: String,
    default: ''
  },
  attachments: [{
    // Combined attachment fields
    filename: String,
    path: String, // From original
    content: Buffer, // From sample
    contentType: String, // In both
    size: Number, // From sample
    cid: String, // From sample (Content-ID for inline attachments)
    disposition: String // From sample (attachment or inline)
  }],
  status: {
    type: String,
    enum: ['sent', 'received', 'draft', 'failed', 'processed', 'replied', 'forwarded', 'archived', 'deleted'], // Combined enums
    required: true,
    default: 'received'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Additional fields from sample schema
  headers: {
    type: Map,
    of: String,
    default: new Map()
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  folder: {
    type: String,
    enum: ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'],
    default: 'inbox'
  },
  tags: [{
    type: String,
    trim: true
  }],
  inReplyTo: {
    type: String,
    default: null
  },
  references: [{
    type: String
  }],
  threadId: {
    type: String,
    default: null
  },
  autoReplySent: {
    type: Boolean,
    default: false
  },
  autoReplyAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  source: {
    type: String,
    enum: ['imap', 'pop3', 'smtp', 'webhook', 'api'],
    default: 'imap'
  },
  rawEmail: {
    type: String,
    default: ''
  },
  // Added direction from message schema if needed
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    default: 'inbound'
  }
}, {
  timestamps: true
});

// Indexes for better query performance (combined from both)
emailSchema.index({ from: 1, date: -1 });
emailSchema.index({ to: 1, date: -1 });
emailSchema.index({ subject: 'text', text: 'text', body: 'text' });
emailSchema.index({ date: -1 });
emailSchema.index({ status: 1, date: -1 });
emailSchema.index({ folder: 1, date: -1 });
emailSchema.index({ messageId: 1 });
emailSchema.index({ threadId: 1, date: 1 });
emailSchema.index({ userId: 1, date: -1 }); // For user-specific queries

// Virtuals from sample schema
emailSchema.virtual('preview').get(function() {
  const content = this.text || this.body || '';
  return content.substring(0, 100) + (content.length > 100 ? '...' : '');
});

emailSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString();
});

emailSchema.virtual('senderName').get(function() {
  const match = this.from.match(/^(.+?)\s*<(.+)>$/);
  return match ? match[1].trim() : this.from;
});

emailSchema.virtual('senderEmail').get(function() {
  const match = this.from.match(/^(.+?)\s*<(.+)>$/);
  return match ? match[2].trim() : this.from;
});

// Methods from sample schema
emailSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

emailSchema.methods.moveToFolder = function(folder) {
  this.folder = folder;
  return this.save();
};

emailSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return Promise.resolve(this);
};

emailSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Static methods from sample schema
emailSchema.statics.findByThread = function(threadId) {
  return this.find({ threadId }).sort({ date: 1 });
};

emailSchema.statics.findUnread = function() {
  return this.find({ isRead: false }).sort({ date: -1 });
};

emailSchema.statics.searchEmails = function(query) {
  return this.find({
    $or: [
      { subject: { $regex: query, $options: 'i' } },
      { text: { $regex: query, $options: 'i' } },
      { body: { $regex: query, $options: 'i' } },
      { from: { $regex: query, $options: 'i' } },
      { to: { $regex: query, $options: 'i' } }
    ]
  }).sort({ date: -1 });
};

// Pre-save middleware from sample schema
emailSchema.pre('save', function(next) {
  // Extract body from text or html if body is empty
  if (!this.body) {
    this.body = this.text || (this.html ? this.html.replace(/<[^>]*>/g, '') : '');
  }
  
  // Generate thread ID if not provided
  if (!this.threadId && this.subject) {
    // Simple thread ID generation based on subject (remove Re:, Fwd:, etc.)
    const cleanSubject = this.subject.replace(/^(Re:|Fwd:|RE:|FWD:)\s*/i, '').trim();
    this.threadId = Buffer.from(cleanSubject).toString('base64').substring(0, 10);
  }
  
  // Set direction based on folder if not set
  if (!this.direction) {
    this.direction = this.folder === 'sent' ? 'outbound' : 'inbound';
  }
  
  next();
});

module.exports = mongoose.models.Email || mongoose.model('Email', emailSchema);