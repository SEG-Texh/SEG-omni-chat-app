// ============================================================================
// SERVER/ROUTES/MESSAGES.JS
// ============================================================================
const express = require('express');
const Message = require('../models/message');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Utility function to format messages for frontend
const formatMessage = (msg) => ({
  _id: msg._id,
  content: {
    text: msg.content,
    attachments: msg.attachments || []
  },
  sender: {
    name: msg.sender?.name || 'Unknown',
    id: msg.sender?._id || null
  },
  platform: msg.platform || 'web',
  timestamp: msg.createdAt || new Date()
});

// Get unclaimed messages (for admin/supervisor dashboard)
router.get('/unclaimed', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({ 
      claimed: false,
      $or: [
        { receiver: null },           // Broadcast messages
        { receiver: req.user._id }    // Messages directly to current user
      ]
    })
    .populate('sender', 'name _id')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
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

// Get messages between users (without receiverId)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const query = {
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id },
        { receiver: null } // Broadcast messages
      ]
    };

    const messages = await Message.find(query)
      .populate('sender', 'name email role')
      .populate('receiver', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    res.json(messages.map(formatMessage));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages between users (with receiverId)
router.get('/:receiverId', auth, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const query = {
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ]
    };

    const messages = await Message.find(query)
      .populate('sender', 'name email role')
      .populate('receiver', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    res.json(messages.map(formatMessage));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'direct', platform = 'web' } = req.body;
    
    const messageData = {
      sender: req.user._id,
      content,
      messageType,
      platform,
      claimed: messageType === 'broadcast' // Auto-claim broadcast messages
    };

    if (receiverId && messageType === 'direct') {
      messageData.receiver = receiverId;
    }

    const message = new Message(messageData);
    await message.save();
    
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');
    
    // Emit socket event
    const io = req.app.get('socketio');
    io.emit('new_message', formatMessage(message));

    res.status(201).json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    const searchQuery = {
      content: { $regex: query, $options: 'i' }
    };

    if (req.user.role === 'supervisor') {
      const User = require('../models/User');
      const supervisedUsers = await User.find({ supervisor_id: req.user._id }).select('_id');
      const userIds = supervisedUsers.map(user => user._id);
      searchQuery.$or = [
        { sender: { $in: userIds } },
        { receiver: { $in: userIds } }
      ];
    }

    const messages = await Message.find(searchQuery)
      .populate('sender', 'name email role')
      .populate('receiver', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    res.json(messages.map(formatMessage));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark message as read
router.put('/:messageId/read', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { _id: req.params.messageId, receiver: req.user._id },
      { isRead: true },
      { new: true }
    ).populate('sender', 'name email role')
     .populate('receiver', 'name email role');

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Claim a message (for admin/supervisor)
router.put('/:messageId/claim', auth, async (req, res) => {
  try {
    if (!['admin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = await Message.findOneAndUpdate(
      { _id: req.params.messageId, claimed: false },
      { 
        claimed: true,
        claimedBy: req.user._id,
        claimedAt: new Date() 
      },
      { new: true }
    ).populate('sender', 'name _id');

    if (!message) {
      return res.status(404).json({ error: 'Message not found or already claimed' });
    }

    // Notify via WebSocket
    const io = req.app.get('socketio');
    io.emit('message_claimed', message._id);

    res.json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;