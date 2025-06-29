// routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/message');
const Conversation = require('../models/conversation');
const { auth } = require('../middleware/auth');

// Example route
router.get('/', (req, res) => {
  res.send('Messages API working');
});

// POST /api/messages - Send a new message
router.post('/', auth, async (req, res) => {
  try {
    const { conversationId, content, platform } = req.body;

    if (!conversationId || !content?.text || !platform) {
      return res.status(400).json({ 
        error: 'conversationId, content.text, and platform are required' 
      });
    }

    // Create the message
    const message = new Message({
      conversation: conversationId,
      sender: req.user._id,
      content,
      platform,
      direction: 'outbound',
      status: 'sent'
    });

    const savedMessage = await message.save();

    // Add sender to participants if not already present
    // This makes the conversation "claimed" by the user when they reply
    await Conversation.findByIdAndUpdate(
      conversationId,
      { 
        $addToSet: { participants: req.user._id }, 
        lastMessage: savedMessage._id 
      }
    );

    // Populate sender info for response
    await savedMessage.populate('sender', 'name avatar');

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
