// routes/facebook.js
const express = require('express');
const router = express.Router();
const {
  handleVerification,
  handleWebhook,
  sendMessageAPI,
  getMessages,
} = require('../controllers/facebookController');

// Middleware: Parse incoming JSON for all /facebook routes
router.use(express.json());

// Route: Facebook Webhook Verification
router.get('/webhook', handleVerification);

// Route: Facebook Webhook Receiver (incoming messages/events)
router.post('/webhook', handleWebhook);

// Route: Get all stored Facebook messages
router.get('/messages', getMessages);

// Route: Send a message via Facebook API
router.post('/messages', sendMessageAPI);

module.exports = router;
