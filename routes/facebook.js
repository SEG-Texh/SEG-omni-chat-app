const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const { auth } = require('../middleware/auth');

// Test webhook endpoint
router.get('/test-webhook', (req, res) => {
  console.log('Test Webhook Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body
  });

  // Check if this is a verification request
  if (req.query['hub.mode'] === 'subscribe') {
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Verification Request:', {
      mode: req.query['hub.mode'],
      verifyToken,
      challenge,
      expectedToken: process.env.FACEBOOK_VERIFY_TOKEN
    });

    if (verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
      console.log('Verification token matches!');
      return res.status(200).send(challenge);
    }

    console.error('Verification token mismatch!');
    return res.status(403).send('Verification token mismatch');
  }

  // For non-verification requests, just return a test response
  res.json({
    status: 'success',
    message: 'Test webhook endpoint working',
    environment: {
      FACEBOOK_VERIFY_TOKEN: !!process.env.FACEBOOK_VERIFY_TOKEN,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// Main webhook route - handles both GET and POST
router.route('/webhook')
  .get((req, res) => {
    console.log('Webhook GET Request:', {
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers
    });

    // Handle verification
    if (req.query['hub.mode'] === 'subscribe') {
      const verifyToken = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('Verification Request:', {
        mode: req.query['hub.mode'],
        verifyToken,
        challenge,
        expectedToken: process.env.FACEBOOK_VERIFY_TOKEN
      });

      if (verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
        console.log('Verification token matches! Sending challenge:', challenge);
        return res.status(200).send(challenge);
      }

      console.error('Verification token mismatch!');
      return res.status(403).send('Verification token mismatch');
    }

    // For non-verification requests, just return a test response
    res.json({
      status: 'success',
      message: 'Webhook endpoint working',
      environment: {
        FACEBOOK_VERIFY_TOKEN: !!process.env.FACEBOOK_VERIFY_TOKEN,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  })
  .post((req, res, next) => {
    req.io = req.app.get('io');
    next();
  }, facebookController.webhook);

// Authenticated endpoints
router.get('/conversations', auth, facebookController.listConversations);
router.get('/messages/:conversationId', auth, facebookController.listMessages);
router.post('/send', auth, facebookController.sendMessage);

module.exports = router;
