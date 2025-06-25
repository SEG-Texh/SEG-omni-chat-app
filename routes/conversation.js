const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const auth = require('../middleware/auth'); // Make sure this path is correct

// Get all conversations for a user
router.get('/', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate('participants', 'name email avatar')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages in a conversation
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      conversation: req.params.id
    })
    .populate('sender', 'name avatar')
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new message in conversation
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { content, platform } = req.body;

    const message = new Message({
      conversation: req.params.id,
      sender: req.user._id,
      content,
      platform
    });

    const savedMessage = await message.save();

    await Conversation.findByIdAndUpdate(req.params.id, {
      lastMessage: savedMessage._id,
      $inc: { unreadCount: 1 }
    });

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
