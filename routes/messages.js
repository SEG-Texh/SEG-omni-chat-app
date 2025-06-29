// routes/messages.js
const express = require('express');
const router = express.Router();
const Message = require('../models/message');
const Conversation = require('../models/conversation');
const { auth } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

// Example route
router.get('/', (req, res) => {
  res.send('Messages API working');
});

// POST /api/messages - Send a new message
router.post('/', auth, async (req, res) => {
  try {
    const { conversationId, content, platform, to } = req.body;

    if (!conversationId || !content?.text || !platform) {
      return res.status(400).json({ 
        error: 'conversationId, content.text, and platform are required' 
      });
    }

    // Generate a unique platformMessageId
    const platformMessageId = `${platform}_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create the message
    const message = new Message({
      conversation: conversationId,
      sender: req.user._id,
      content,
      platform,
      direction: 'outbound',
      status: 'sent',
      platformMessageId: platformMessageId
    });

    const savedMessage = await message.save();

    // Add sender to participants if not already present
    await Conversation.findByIdAndUpdate(
      conversationId,
      { 
        $addToSet: { participants: req.user._id }, 
        lastMessage: savedMessage._id 
      }
    );

    // Populate sender info for response
    await savedMessage.populate('sender', 'name avatar');

    // If WhatsApp, send the message via WhatsApp API using the 'to' field if provided
    if (platform === 'whatsapp') {
      let phoneNumber = to;
      if (!phoneNumber) {
        // fallback to old logic if 'to' is not provided
        const conversation = await Conversation.findById(conversationId).populate('participants');
        let recipient = conversation.participants.find(
          p => p._id.toString() !== req.user._id.toString() && Array.isArray(p.roles) && !p.roles.includes('agent') && !p.roles.includes('admin')
        );
        if (!recipient) {
          recipient = conversation.participants.find(
            p => p._id.toString() !== req.user._id.toString()
          );
        }
        if (recipient && recipient.platformIds && recipient.platformIds.whatsapp) {
          phoneNumber = recipient.platformIds.whatsapp;
        }
      }
      if (phoneNumber) {
        try {
          await whatsappController.sendMessage(phoneNumber, content.text);
        } catch (err) {
          console.error('Failed to send WhatsApp message:', err);
        }
      }
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
