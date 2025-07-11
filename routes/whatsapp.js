const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Webhook for receiving WhatsApp messages from customers
router.post('/webhook', whatsappController.handleMessage.bind(whatsappController));

module.exports = router;