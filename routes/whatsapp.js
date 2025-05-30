const express = require('express');
const router = express.Router();

// Make sure this matches the actual file name exactly (case-sensitive)
const { verifyWebhook, receiveMessage } = require('../controllers/whatsappController');

// GET route for webhook verification (Facebook/Meta requirement)
router.get('/', verifyWebhook);

// POST route for receiving messages from WhatsApp
router.post('/', receiveMessage);

module.exports = router;
