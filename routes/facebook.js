const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Parse incoming JSON
router.use(bodyParser.json());

// Webhook verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook receiver
router.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      const webhookEvent = entry.messaging[0];
      console.log('Webhook Event:', webhookEvent);

      const senderId = webhookEvent.sender.id;
      const message = webhookEvent.message?.text;

      if (message) {
        console.log(`Message from ${senderId}: ${message}`);
        // Optionally send an auto-reply:
        sendTextMessage(senderId, `Echo: ${message}`);
      }
    });

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Send message via Facebook API
router.post('/messages', async (req, res) => {
  const { recipientId, message } = req.body;

  try {
    await sendTextMessage(recipientId, message);
    res.status(200).json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error('Error sending message:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Dummy getMessages endpoint (optional – update as needed)
router.get('/messages', (req, res) => {
  res.json({ message: 'This would return stored messages if implemented.' });
});

// Helper to send message through Facebook Send API
async function sendTextMessage(recipientId, message) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const payload = {
    recipient: { id: recipientId },
    message: { text: message }
  };

  await axios.post(url, payload);
}

module.exports = router;
