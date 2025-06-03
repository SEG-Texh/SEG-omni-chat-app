// ============================================================================
// SERVER/ROUTES/MESSAGES.JS
// ============================================================================
const express = require('express');
const Message = require('../models/message');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get messages between users (without receiverId)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    // All messages for current user
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
      .skip((page - 1) * limit);

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages between users (with receiverId)
router.get('/:receiverId', auth, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Direct messages between two users
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
      .skip((page - 1) * limit);

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, content, messageType = 'direct' } = req.body;
    
    const messageData = {
      sender: req.user._id,
      content,
      messageType
    };

    if (receiverId && messageType === 'direct') {
      messageData.receiver = receiverId;
    }

    const message = new Message(messageData);
    await message.save();
    
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');
    
    res.status(201).json(message);
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
    const searchQuery = {
      content: { $regex: query, $options: 'i' }
    };

    // If supervisor, limit to messages from users under them
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
      .limit(100);

    res.json(messages);
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
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;