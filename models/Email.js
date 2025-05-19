const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  from: {
    type: String,
    required: true
  },
  to: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  html: {
    type: String
  },
  attachments: [{
    filename: String,
    path: String,
    contentType: String
  }],
  status: {
    type: String,
    enum: ['sent', 'received', 'draft', 'failed'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('Email', emailSchema);