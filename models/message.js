const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['facebook', 'email', 'whatsapp'], // Expanded enum
    required: true,
    default: 'chat' // Added default
  },
  sender: {
    type: String, // Keeping your original type
    required: true
  },
  recipient: {
    type: String, // Keeping your original type
    default: null // null for broadcast messages
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  claimedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  // New fields from sample code
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'video', 'audio'],
    default: 'text'
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mimetype: String
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // This will add createdAt and updatedAt automatically
});

// Indexes for better query performance
messageSchema.index({ sender: 1, timestamp: -1 });
messageSchema.index({ recipient: 1, timestamp: -1 });
messageSchema.index({ platform: 1, timestamp: -1 });
messageSchema.index({ timestamp: -1 });

// Virtual for formatted date
messageSchema.virtual('formattedDate').get(function() {
  return this.timestamp.toLocaleDateString();
});

// Method to soft delete message
messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method to find active messages
messageSchema.statics.findActive = function() {
  return this.find({ isDeleted: { $ne: true } });
};

// Pre-save middleware to update editedAt when content is modified
messageSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

module.exports = mongoose.models.message || mongoose.model('message', messageSchema);