// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.get('/webhook', whatsappController.verifyWhatsAppWebhook);
router.post('/webhook', whatsappController.handleWhatsAppWebhook);

module.exports = router;
