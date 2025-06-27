const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const authMiddleware = require('../middleware/auth'); // Add authentication middleware

// Webhook routes
router.get('/webhook', facebookController.verifyWebhook);
router.post('/webhook', facebookController.handleMessage);

// Authenticated API routes
router.use(authMiddleware); // All routes below require authentication

// Conversation routes
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await facebookController.getConversations(req, res);
    // Controller should handle the response
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const messages = await facebookController.getMessages(req, res);
    // Controller should handle the response
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      error: 'Failed to fetch messages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Message sending
router.post('/messages', async (req, res) => {
  try {
    const { recipientId, text, conversationId } = req.body;
    
    if (!recipientId || !text || !conversationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await facebookController.sendMessage(
      recipientId, 
      text, 
      conversationId, 
      req.user._id // Using authenticated user
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      error: 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// User profile
router.get('/users/:userId', async (req, res) => {
  try {
    const profile = await facebookController.getUserProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;