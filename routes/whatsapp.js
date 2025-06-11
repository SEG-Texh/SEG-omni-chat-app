const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsapp.service');

// Webhook verification
router.get('/webhook', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const isValid = await whatsappService.verifyWebhook(token);
    
    if (mode === 'subscribe' && isValid) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('Webhook verification error:', error);
    res.sendStatus(500);
  }
});

// Webhook for receiving messages
router.post('/webhook', async (req, res) => {
  try {
    await whatsappService.handleWebhook(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.sendStatus(500);
  }
});

// Send message API
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    const result = await whatsappService.sendMessage(to, message);
    res.json(result);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;