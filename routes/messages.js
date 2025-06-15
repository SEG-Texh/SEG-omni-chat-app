const express = require('express');
const Message = require('../models/message');
const { auth } = require('../middleware/auth');
const {
  facebookController,
  emailController,
  whatsappController
} = require('./controllers');

const router = express.Router();

// Initialize services
const platformServices = {
  facebook: new facebookController(),
  email: new emailController(),
  whatsapp: new whatsappController()
};

// Unified message formatting
const formatMessage = (msg) => ({
  _id: msg._id,
  content: msg.content,
  sender: msg.sender,
  receiver: msg.receiver,
  platform: msg.platform,
  timestamp: msg.createdAt,
  isRead: msg.isRead,
  metadata: msg.metadata
});

// Process incoming webhooks from all platforms
router.post('/webhook/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const service = platformServices[platform];
    
    if (!service) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    const normalizedMessage = await service.normalizeIncomingMessage(req.body);
    const message = new Message(normalizedMessage);
    await message.save();

    // Notify via WebSocket
    const io = req.app.get('socketio');
    io.emit('new_message', formatMessage(message));

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Send message through any platform
router.post('/send', auth, async (req, res) => {
  try {
    const { platform, receiverId, content, metadata } = req.body;
    const service = platformServices[platform];
    
    if (!service) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }

    // Find receiver
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Send via platform service
    const platformResponse = await service.sendMessage({
      sender: req.user,
      receiver,
      content,
      metadata
    });

    // Save to our database
    const message = new Message({
      content,
      sender: req.user._id,
      receiver: receiverId,
      platform,
      platformMessageId: platformResponse.id,
      metadata: {
        ...metadata,
        platformResponse
      }
    });
    await message.save();

    res.status(201).json(formatMessage(message));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Keep your existing routes but update them to use the formatMessage function
// ... (rest of your existing routes)

module.exports = router;