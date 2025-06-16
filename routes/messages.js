// ============================================================================
// SERVER/ROUTES/MESSAGES.JS
// ============================================================================
const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/message');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Middleware for validating IDs
const validateId = (req, res, next) => {
  const { receiverId, messageId } = req.params;
  
  if (receiverId === 'undefined' || messageId === 'undefined') {
    return res.status(400).json({ error: 'Invalid ID provided' });
  }
  
  if (messageId && !mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }
  
  next();
};

// Middleware for input sanitization
const sanitizeInput = (req, res, next) => {
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    }
  }
  
  if (req.body) {
    if (req.body.content?.text) {
      req.body.content.text = req.body.content.text.trim();
    }
  }
  
  next();
};

// Utility function to format messages for frontend
const formatMessage = (msg) => {
  const sender = msg.sender ? {
    name: msg.sender.name,
    id: msg.sender._id
  } : {
    name: msg.platformSender?.name || 'Unknown',
    id: msg.platformSender?.id || null
  };

  return {
    _id: msg._id,
    content: {
      text: msg.content?.text || '',
      attachments: msg.content?.attachments || []
    },
    sender,
    platform: msg.platform || 'web',
    timestamp: msg.createdAt || new Date(),
    status: msg.status || 'delivered',
    labels: msg.labels || [],
    direction: msg.direction || 'inbound'
  };
};

// Get unclaimed messages (for admin/supervisor dashboard)
router.get('/unclaimed', auth, async (req, res) => {
  try {
    if (!['admin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || isNaN(limitNum)) {
      return res.status(400).json({ error: 'Invalid pagination parameters' });
    }

    const messages = await Message.find({ 
      labels: { $in: ['unclaimed'] },
      isDeleted: false
    })
    .populate({
      path: 'sender',
      select: 'name _id',
      match: { _id: { $exists: true } }
    })
    .populate('claimedBy', 'name _id')
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip((pageNum - 1) * limitNum)
    .lean();

    res.json(messages.map(formatMessage));
  } catch (err) {
    console.error('Error in /unclaimed:', err);
    res.status(500).json({ 
      error: 'Failed to load unclaimed messages',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    });
  }
});

// Get messages between users
router.get('/:receiverId', auth, validateId, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const query = {
      $or: [
        { sender: req.user._id, recipient: receiverId },
        { sender: receiverId, recipient: req.user._id }
      ],
      isDeleted: false
    };

    const messages = await Message.find(query)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    res.json(messages.map(formatMessage));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to load messages',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Send message
router.post('/', auth, sanitizeInput, async (req, res) => {
  try {
    const { recipientId, content, platform = 'web' } = req.body;
    
    if (!content || (!content.text && !content.attachments?.length)) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const messageData = {
      sender: req.user._id,
      content,
      platform,
      direction: 'outbound',
      status: 'sent'
    };

    if (recipientId) {
      if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }
      messageData.recipient = recipientId;
    }

    const message = new Message(messageData);
    await message.save();
    
    await message.populate('sender', 'name email role');
    await message.populate('recipient', 'name email role');
    
    // Emit socket event
    const io = req.app.get('socketio');
    io.emit('new_message', formatMessage(message));

    res.status(201).json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Search messages (Admin and Supervisor)
router.get('/search/:query', auth, async (req, res) => {
  try {
    if (req.user.role === 'user') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { query } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const searchQuery = {
      $or: [
        { 'content.text': { $regex: query, $options: 'i' } },
        { 'platformSender.name': { $regex: query, $options: 'i' } }
      ],
      isDeleted: false
    };

    if (req.user.role === 'supervisor') {
      const User = require('./models/user');
      const supervisedUsers = await User.find({ supervisor: req.user._id }).select('_id');
      const userIds = supervisedUsers.map(user => user._id);
      searchQuery.$or.push(
        { sender: { $in: userIds } },
        { recipient: { $in: userIds } }
      );
    }

    const messages = await Message.find(searchQuery)
      .populate('sender', 'name email role')
      .populate('recipient', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    res.json(messages.map(formatMessage));
  } catch (error) {
    res.status(500).json({ 
      error: 'Search failed',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Mark message as read
router.put('/:messageId/read', auth, validateId, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { 
        _id: req.params.messageId, 
        recipient: req.user._id,
        isDeleted: false
      },
      { isRead: true, readAt: new Date() },
      { new: true }
    )
    .populate('sender', 'name email role')
    .populate('recipient', 'name email role');

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to mark as read',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Claim a message
router.put('/:messageId/claim', auth, validateId, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { 
        _id: req.params.messageId, 
        $or: [
          { claimedBy: { $exists: false } },
          { claimedBy: null },
          { 
            claimedBy: req.user._id,
            isDeleted: false
          }
        ]
      },
      { 
        claimedBy: req.user._id,
        claimedAt: new Date(),
        labels: ['claimed'],
        $addToSet: { recipients: req.user._id }
      },
      { new: true }
    )
    .populate('sender', 'name _id')
    .populate('claimedBy', 'name _id');

    if (!message) {
      return res.status(404).json({ 
        error: 'Message not found or already claimed by another agent' 
      });
    }

    const io = req.app.get('socketio');
    io.emit('message_claimed', {
      messageId: message._id,
      claimedBy: {
        id: req.user._id,
        name: req.user.name
      }
    });

    res.json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to claim message',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

module.exports = router;