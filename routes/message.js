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

    const io = req.app.get('io');
    io.emit('new_message', newMessage); // 🔌 Emit new message event

    res.status(201).json({ message: 'Message created', data: newMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating message' });
  }
});

// Get all unclaimed messages (for agents)
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ claimedBy: null });
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
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.claimedBy) {
      return res.status(400).json({ message: 'Message already claimed' });
    }

    message.claimedBy = userId;
    await message.save();

    const io = req.app.get('io');
    io.emit('message_claimed', { messageId, claimedBy: userId }); // 🔌 Emit claim event

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
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (!message.claimedBy || message.claimedBy.toString() !== userId) {
      return res.status(403).json({ message: 'You must claim the message first' });
    }

    const reply = {
      sender: userId,
      content,
      timestamp: new Date()
    };

    message.replies.push(reply);
    await message.save();

    const io = req.app.get('io');
    io.emit('new_reply', { messageId, reply }); // 🔌 Emit reply event

    res.json({ message: 'Reply added', data: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error replying to message' });
  }
});

// Admin: Get all messages with claimed status
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
