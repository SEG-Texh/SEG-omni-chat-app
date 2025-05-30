const express = require('express');
const router = express.Router();
const { verifyWebhook, receiveMessage } = require('../controllers/whatsAppController');

// GET route for webhook verification (Facebook/Meta requirement)
router.get('/', verifyWebhook);

// POST route for receiving messages from WhatsApp
router.post('/', receiveMessage);

module.exports = router;