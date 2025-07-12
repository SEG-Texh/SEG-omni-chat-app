const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const { auth, authorize } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');
const facebookController = require('../controllers/facebookController');

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
router.get('/', auth, authorize('admin', 'supervisor', 'agent'), async (req, res) => {
  try {
    let filter = {};
    if (req.query.platform) {
      filter.platform = req.query.platform;
    }
    
    // For admins: show all conversations
    // For agents/supervisors: only show conversations they have claimed
    if (req.user.role !== 'admin') {
      filter.agentId = req.user._id;
    }
    
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
router.get('/:id/messages', auth, authorize('admin', 'supervisor', 'agent'), async (req, res) => {
  try {
    // For agents/supervisors: verify they have claimed this conversation
    if (req.user.role !== 'admin') {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation || !conversation.agentId || !conversation.agentId.equals(req.user._id)) {
        return res.status(403).json({ error: 'Access denied. You can only view messages for conversations you have claimed.' });
      }
    }
    
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
router.post('/:id/messages', auth, authorize('admin', 'supervisor', 'agent'), async (req, res) => {
  try {
    // For agents/supervisors: verify they have claimed this conversation
    if (req.user.role !== 'admin') {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation || !conversation.agentId || !conversation.agentId.equals(req.user._id)) {
        return res.status(403).json({ error: 'Access denied. You can only send messages to conversations you have claimed.' });
      }
    }
    
    const { content, platform } = req.body;
    // Always set a unique platformMessageId for WhatsApp and Facebook
    let platformMessageId = undefined;
    if ((platform || '').toLowerCase() === 'whatsapp') {
      platformMessageId = `wa_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } else if ((platform || '').toLowerCase() === 'facebook') {
      platformMessageId = `fb_out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
    
    // Emit socket event for new message notification
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('new_message', {
        conversationId: req.params.id,
        message: savedMessage,
        unreadCount: (await Conversation.findById(req.params.id)).unreadCount
      });
    }

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
    // Actually send Facebook message to customer
    if ((platform || '').toLowerCase() === 'facebook') {
      const conversation = await Conversation.findById(req.params.id);
      const recipientId = conversation.customerId;
      const text = content?.text || '';
      try {
        await facebookController.sendMessage(recipientId, text);
      } catch (err) {
        console.error('Failed to send Facebook message to customer:', err);
      }
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark conversation as read
router.post('/:id/read', auth, authorize('admin', 'supervisor', 'agent'), async (req, res) => {
  try {
    // For agents/supervisors: verify they have claimed this conversation
    if (req.user.role !== 'admin') {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation || !conversation.agentId || !conversation.agentId.equals(req.user._id)) {
        return res.status(403).json({ error: 'Access denied. You can only mark conversations you have claimed as read.' });
      }
    }
    
    // Reset unread count to 0
    await Conversation.findByIdAndUpdate(req.params.id, { unreadCount: 0 });
    
    // Emit socket event for conversation update
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('conversation_updated', {
        conversationId: req.params.id,
        unreadCount: 0
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End conversation session
router.post('/:id/end', auth, authorize('admin', 'supervisor', 'agent'), async (req, res) => {
  try {
    // For agents/supervisors: verify they have claimed this conversation
    if (req.user.role !== 'admin') {
      const conversation = await Conversation.findById(req.params.id);
      if (!conversation || !conversation.agentId || !conversation.agentId.equals(req.user._id)) {
        return res.status(403).json({ error: 'Access denied. You can only end conversations you have claimed.' });
      }
    }
    
    // Update conversation status to inactive
    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'inactive',
        endTime: new Date(),
        agentId: null // Remove agent assignment
      },
      { new: true }
    );
    
    // Emit socket event for session ended
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('session_ended', {
        conversationId: req.params.id,
        status: 'inactive'
      });
    }
    
    res.json({ 
      success: true, 
      conversation: updatedConversation 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
