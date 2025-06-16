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
    text: msg.content?.text || '',
    attachments: msg.content?.attachments || []
  },
  sender: msg.sender ? {
    name: msg.sender.name || 'Unknown',
    id: msg.sender._id || msg.sender
  } : null,
  receiver: msg.receiver ? {
    name: msg.receiver.name || 'Unknown',
    id: msg.receiver._id || msg.receiver
  } : null,
  platform: msg.platform || 'web',
  createdAt: msg.createdAt,
  labels: msg.labels || []
});

// Get unclaimed messages (for admin/supervisor dashboard)
router.get('/unclaimed', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
const messages = await Message.find({ 
  labels: { $in: ['unclaimed'] },
  isDeleted: false
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
    const { receiverId, content, platform = 'web', isFacebook = false } = req.body;
    
    // Validate required fields
    if (!receiverId || !content?.text) {
      return res.status(400).json({ 
        error: 'Validation failed',
        message: 'receiverId and content.text are required' 
      });
    }

    let result;
    const io = req.app.get('socketio');
    
    // Handle Facebook messages
    if (isFacebook) {
      try {
        const fbResponse = await axios.post(
          `https://graph.facebook.com/v19.0/me/messages`,
          {
            recipient: { id: receiverId },
            message: { text: content.text }
          },
          {
            params: {
              access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
            }
          }
        );
        
        result = fbResponse.data;
        
        if (result.error) {
          return res.status(400).json({
            error: 'Facebook API error',
            message: result.error.message
          });
        }
      } catch (fbError) {
        console.error('Facebook API error:', fbError.response?.data || fbError.message);
        return res.status(500).json({
          error: 'Facebook API failed',
          message: fbError.response?.data?.error?.message || 'Failed to send Facebook message'
        });
      }
    }

    // Create message document
    const messageData = {
      sender: req.user._id,
      receiver: receiverId,
      content,
      platform,
      ...(isFacebook && { 
        platformMessageId: result?.message_id,
        platformThreadId: receiverId,
        direction: 'outbound',
        status: 'sent',
        labels: []
      })
    };

    const message = new Message(messageData);
    await message.save();
    
    // Populate sender/receiver if needed
    await message.populate('sender', 'name email role');
    await message.populate('receiver', 'name email role');

    // Emit socket event
    if (platform === 'web') {
      io.to(receiverId).emit('new_message', formatMessage(message));
    }
    io.emit('message_update', formatMessage(message));

    res.status(201).json(formatMessage(message));

  } catch (err) {
    console.error('Message creation error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
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

// Claim a message (for any authenticated agent)
router.put('/:messageId/claim', auth, async (req, res) => {
  try {
    const message = await Message.findOneAndUpdate(
      { 
        _id: req.params.messageId, 
        claimed: false,
        // Optional: Only allow claiming messages assigned to them or unassigned
        $or: [
          { receiver: req.user._id },
          { receiver: null },
          { receiver: { $exists: false } }
        ]
      },
      { 
        claimed: true,
        claimedBy: req.user._id,
        claimedAt: new Date(),
        // Assign the message to the claiming agent
        receiver: req.user._id
      },
      { new: true }
    )
    .populate('sender', 'name _id')
    .populate('claimedBy', 'name');

    if (!message) {
      return res.status(404).json({ 
        error: 'Message not found, already claimed, or not assigned to you' 
      });
    }

    // Notify via WebSocket
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;