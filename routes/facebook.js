// routes/facebook.js
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const {
  handleVerification,
  handleWebhook,
  sendMessageAPI,
  getMessages
} = require('/controllers/facebookController');

// Parse incoming JSON for all /facebook routes
router.use(bodyParser.json());

// Facebook Webhook Verification
router.get('/webhook', handleVerification);

// Facebook Webhook Receiver
router.post('/webhook', handleWebhook);

// Get stored Facebook messages
router.get('/messages', getMessages);

// Send a message via Facebook
router.post('/messages', sendMessageAPI);

module.exports = router;
