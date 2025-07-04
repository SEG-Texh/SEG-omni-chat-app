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
    console.log('Webhook GET request received');
    console.log('Full Request Details:', {
      method: req.method,
      url: req.url,
      protocol: req.protocol,
      host: req.hostname,
      headers: {
        host: req.headers.host,
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-forwarded-proto': req.headers['x-forwarded-proto']
      },
      query: {
        mode: req.query['hub.mode'],
        verify_token: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge']
      },
      env: {
        FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT
      }
    });

    // Check if this is a verification request
    if (req.query['hub.mode'] === 'subscribe') {
      console.log('Webhook verification request received');
      console.log('Verification Request Details:', {
        mode: req.query['hub.mode'],
        verify_token: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge'],
        expected_token: process.env.FACEBOOK_VERIFY_TOKEN,
        server_port: process.env.PORT,
        server_host: req.hostname,
        request_host: req.headers.host
      });

      const verifyToken = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (!verifyToken || !challenge) {
        console.error('Missing verification parameters');
        console.error('Request Details:', {
          mode: req.query['hub.mode'],
          verify_token: req.query['hub.verify_token'],
          challenge: req.query['hub.challenge']
        });
        return res.status(400).json({ 
          error: 'Missing verification parameters',
          details: 'Both verify_token and challenge are required'
        });
      }

      if (!process.env.FACEBOOK_VERIFY_TOKEN) {
        console.error('FACEBOOK_VERIFY_TOKEN not set in environment');
        console.error('Environment Variables:', {
          FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT
        });
        return res.status(500).json({ 
          error: 'Server configuration error',
          details: 'FACEBOOK_VERIFY_TOKEN is not set'
        });
      }

      if (verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
        console.log('Verification token matches! Sending challenge:', challenge);
        console.log('Response Details:', {
          status: 200,
          challenge: challenge,
          headers: {
            'Content-Type': 'text/plain'
          }
        });
        res.status(200).set('Content-Type', 'text/plain').send(challenge);
        return;
      }

      console.error('Verification token mismatch!');
      console.error('Token Comparison:', {
        expected: process.env.FACEBOOK_VERIFY_TOKEN,
        received: verifyToken,
        match: verifyToken === process.env.FACEBOOK_VERIFY_TOKEN
      });
      
      return res.status(403).json({ 
        error: 'Verification token mismatch',
        expected: process.env.FACEBOOK_VERIFY_TOKEN,
        received: verifyToken
      });
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
router.get('/conversations', auth, (req, res) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  facebookController.listConversations(req, res);
});
router.get('/messages/:conversationId', auth, facebookController.listMessages);
router.post('/send', auth, facebookController.sendMessage);
router.post('/create-test-conversation', auth, facebookController.createTestConversation);

module.exports = router;
