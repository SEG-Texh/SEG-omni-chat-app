// routes/conversations.js - API routes for conversations
const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const Message = require('../models/Message');

// Get all conversations
router.get('/', async (req, res) => {
  try {
    const { platform, search, limit = 50, offset = 0 } = req.query;
    
    let query = {};
    if (platform && platform !== 'all') {
      query['contact.platform'] = platform;
    }
    
    if (search) {
      query.$or = [
        { 'contact.name': { $regex: search, $options: 'i' } },
        { 'lastMessage.content': { $regex: search, $options: 'i' } }
      ];
    }

    const conversations = await Conversation.find(query)
      .populate('assignedAgent', 'name email')
      .sort({ 'lastMessage.timestamp': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get specific conversation
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('assignedAgent', 'name email');
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get messages for a conversation
router.get('/:id/messages', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Assign conversation to agent
router.patch('/:id/assign', async (req, res) => {
  try {
    const { agentId } = req.body;
    
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { assignedAgent: agentId },
      { new: true }
    ).populate('assignedAgent', 'name email');

    res.json(conversation);
  } catch (error) {
    console.error('Assign conversation error:', error);
    res.status(500).json({ error: 'Failed to assign conversation' });
  }
});

// Mark conversation as read
router.patch('/:id/read', async (req, res) => {
  try {
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { unreadCount: 0 },
      { new: true }
    );

    res.json(conversation);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

module.exports = router;