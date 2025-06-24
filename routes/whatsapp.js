const express = require('express');
const controller = require('../controllers/whatsappController');
const router = express.Router();

router.post('/webhook', controller.handleWebhook);
router.post('/send', controller.sendWhatsApp);

module.exports = router;
