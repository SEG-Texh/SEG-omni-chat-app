const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');

// Webhook verification
router.get('/webhook', facebookController.verifyWebhook);

// Webhook for receiving messages
router.post('/webhook', facebookController.handleMessage);

// Send message API
router.post('/send-message', async (req, res) => {
  try {
    const { recipientId, message } = req.body;
    const result = await facebookController.sendMessage(recipientId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/user/:userId', async (req, res) => {
  try {
    const profile = await facebookController.getUserProfile(req.params.userId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;