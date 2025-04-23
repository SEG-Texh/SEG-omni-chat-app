// routes/facebook.js
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const { handleFacebookWebhook, verifyFacebookWebhook, sendFacebookMessage, getFacebookMessages } = require('../controllers/facebookController');

router.use(bodyParser.json());

// Facebook Webhook Verification
router.get('/webhook', verifyFacebookWebhook);

// Facebook Webhook Receiver
router.post('/webhook', handleFacebookWebhook);

// Get stored Facebook messages
router.get('/messages', getFacebookMessages);

// Send a message via Facebook
router.post('/messages', async (req, res) => {
  const { recipientId, message } = req.body;
  try {
    await sendFacebookMessage(recipientId, message);
    res.status(200).json({ status: 'Message sent' });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
