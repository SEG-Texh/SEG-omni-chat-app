const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const auth = require('../middleware/auth');

// Facebook webhook endpoint (no auth)
router.post('/webhook', facebookController.webhook);

// Authenticated endpoints
router.get('/conversations', auth, facebookController.listConversations);
router.get('/messages/:conversationId', auth, facebookController.listMessages);
router.post('/send', auth, facebookController.sendMessage);

module.exports = router;
