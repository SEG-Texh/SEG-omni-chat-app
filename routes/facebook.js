const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const { auth } = require('../middleware/auth');

// Test endpoint for webhook verification
router.get('/test-webhook', (req, res) => {
  console.log('Test webhook endpoint hit');
  console.log('Query params:', req.query);
  console.log('Headers:', req.headers);
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log('Test webhook verified successfully');
    return res.status(200).send(challenge);
  }
  
  console.log('Test webhook verification failed');
  return res.status(403).send('Verification failed');
});

// Webhook route with both GET and POST methods
router.get('/webhook', facebookController.webhook);
router.post('/webhook', (req, res, next) => {
  req.io = req.app.get('io');
  next();
}, facebookController.webhook);

// Authenticated endpoints
router.get('/conversations', auth, facebookController.listConversations);
router.get('/messages/:conversationId', auth, facebookController.listMessages);
router.post('/send', auth, facebookController.sendMessage);

module.exports = router;
