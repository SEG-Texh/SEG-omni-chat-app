const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Message = require('../models/message');

// Create a new message (simulate incoming message)
router.post('/', authMiddleware, async (req, res) => {
  const { sender, recipient, channel, content } = req.body;

  try {
    const newMessage = new Message({ sender, recipient, channel, content });
    await newMessage.save();

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('new_message', newMessage);

    res.status(201).json({ message: 'Message created', data: newMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating message' });
  }
});

// Get all messages (filter by claimed status)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ claimedBy: null }); // Only open messages
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Claim a message
router.post('/:id/claim', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const userId = req.user.userId;

  try {
    const message = await Message.findById(messageId);
    if (message.claimedBy) {
      return res.status(400).json({ message: 'Message already claimed' });
    }

    message.claimedBy = userId;
    await message.save();
    res.json({ message: 'Message claimed', data: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error claiming message' });
  }
});

// Reply to a message
router.post('/:id/reply', authMiddleware, async (req, res) => {
  const messageId = req.params.id;
  const { content } = req.body;
  const userId = req.user.userId;

  try {
    const message = await Message.findById(messageId);
    if (!message.claimedBy || message.claimedBy.toString() !== userId) {
      return res.status(400).json({ message: 'You must claim the message first' });
    }

    const reply = {
      sender: userId,
      content,
      timestamp: new Date()
    };

    message.replies.push(reply);
    await message.save();

    // Emit real-time reply event
    const io = req.app.get('io');
    io.emit('new_reply', { messageId, reply });

    res.json({ message: 'Reply added', data: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error replying to message' });
  }
});
// Get all messages (admin only)
router.get('/all', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
  
    try {
      const messages = await Message.find().populate('claimedBy', 'email role');
      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching all messages' });
    }
  });
  
module.exports = router;
