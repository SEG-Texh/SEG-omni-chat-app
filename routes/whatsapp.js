const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// Webhook verification
router.get('/webhook', whatsappController.verifyWebhook);

// Webhook for receiving messages
router.post('/webhook', whatsappController.handleMessage.bind(whatsappController));

// Send text message
router.post('/send-message', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    const result = await whatsappController.sendMessage(phoneNumber, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send template message
router.post('/send-template', async (req, res) => {
  try {
    const { phoneNumber, templateName, languageCode } = req.body;
    const result = await whatsappController.sendTemplateMessage(
      phoneNumber, 
      templateName, 
      languageCode
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;