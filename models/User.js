// ============================================================================
// SERVER/MODELS/USER.JS
// ============================================================================
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Authentication fields
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6,
    select: false // Never return password in queries
  },
  
  // Platform IDs
  facebookId: {
    type: String,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },
  whatsappId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // Role and permissions
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'user', 'agent'],
    default: 'user'
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  permissions: [{
    type: String,
    enum: ['manage_users', 'view_reports', 'manage_conversations']
  }],
  
  // Status tracking
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  
  // Profile information
  profilePic: String,
  timezone: String,
  language: {
    type: String,
    default: 'en'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for user stats (alternative to your pre-save hook)
userSchema.virtual('stats').get(function() {
  return {
    isNew: this.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
  };
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ facebookId: 1 });
userSchema.index({ whatsappId: 1 });
userSchema.index({ isOnline: 1, lastSeen: -1 });

// Static method for finding or creating platform users
userSchema.statics.findOrCreate = async function(platform, platformId, userData = {}) {
  const field = `${platform}Id`;
  let user = await this.findOne({ [field]: platformId });
  
  if (!user) {
    user = new this({
      [field]: platformId,
      name: userData.name || `${platform} User ${platformId.substring(0, 6)}`,
      email: userData.email || `${platformId}@${platform}.com`,
      profilePic: userData.profilePic,
      role: 'user' // Default role for platform users
    });
    await user.save();
  }
  
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;