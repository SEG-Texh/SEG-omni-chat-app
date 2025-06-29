const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    unique: true,
    lowercase: true,
    trim: true,
    sparse: true
  },
  password: {
    type: String,
    minlength: 6,
    select: false
  },
  facebookId: {
    type: String,
    unique: true,
    sparse: true
  },
  whatsappId: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'agent', 'user'],
    default: 'user'
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['internal', 'platform'],
    default: 'internal'
  },
  profilePic: String,
  permissions: [String],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Static methods
userSchema.statics.countUsers = function() {
  return this.countDocuments();
};

userSchema.statics.adminExists = function() {
  return this.exists({ role: 'admin' });
};

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;