const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');

// Webhook verification
router.get('/webhook', facebookController.verifyFacebookWebhook);

// Webhook handler
router.post('/webhook', facebookController.handleFacebookWebhook);

// Send message API
router.post('/send', facebookController.sendFacebookMessage);

module.exports = router;