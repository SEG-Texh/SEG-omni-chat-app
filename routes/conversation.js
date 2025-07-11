const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const { auth, authorize } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

// Create or get active conversation for a recipient
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { customerId, platform } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }
    // Find active conversation for this customer
    let conversation = await Conversation.findOne({
      customerId,
      status: 'active',
      expiresAt: { $gt: new Date() },
      ...(platform ? { platform } : {})
    });
    if (conversation) {
      return res.json(conversation);
    }
    // Create new conversation
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 35 * 60 * 1000);
    conversation = await Conversation.create({
      platform: platform || 'whatsapp',
      platformConversationId: `${customerId}_${Date.now()}`,
      customerId,
      participants: [customerId],
      status: 'active',
      startTime: now,
      expiresAt
    });
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all conversations for a user
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    let filter = {};
    if (req.query.platform) {
      filter.platform = req.query.platform;
    }
    
    // Show all conversations initially, not just those where user is a participant
    // This allows users to see all incoming messages before they reply
    console.log('Conversation filter:', filter);
    const conversations = await Conversation.find(filter)
      .populate('participants', 'name email avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.json(conversations);
  } catch (error) {
    console.error('Error in /api/conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages in a conversation
router.get('/:id/messages', auth, authorize('admin'), async (req, res) => {
  try {
    const platform = req.query.platform;
    const filter = { conversation: req.params.id };
    if (platform) filter.platform = platform;
    const messages = await Message.find(filter)
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new message in conversation
router.post('/:id/messages', auth, authorize('admin'), async (req, res) => {
  try {
    const { content, platform } = req.body;
    // Always set a unique platformMessageId for WhatsApp
    let platformMessageId = undefined;
    if ((platform || '').toLowerCase() === 'whatsapp') {
      platformMessageId = `wa_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    const message = new Message({
      conversation: req.params.id,
      sender: req.user._id,
      content,
      platform,
      direction: 'outbound',
      ...(platformMessageId ? { platformMessageId } : {})
    });

    const savedMessage = await message.save();

    // Add sender to participants if not already present
    await Conversation.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { participants: req.user._id }, lastMessage: savedMessage._id, $inc: { unreadCount: 1 } }
    );

    // Actually send WhatsApp message to customer
    if ((platform || '').toLowerCase() === 'whatsapp') {
      const conversation = await Conversation.findById(req.params.id);
      const phoneNumber = conversation.customerId;
      const text = content?.text || '';
      try {
        await whatsappController.sendMessage(phoneNumber, text);
      } catch (err) {
        console.error('Failed to send WhatsApp message to customer:', err);
      }
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
