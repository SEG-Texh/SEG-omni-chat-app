const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
const Message = require('../models/message');
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
      return res.status(200).send(challenge);
    } else {
      console.error('Token mismatch:', token);
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(404);
});

// Webhook receiver
router.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    try {
      for (const entry of body.entry) {
        const webhookEvent = entry.messaging[0];
        console.log('Webhook Event:', webhookEvent);

        const senderId = webhookEvent.sender.id;
        const recipientId = webhookEvent.recipient.id;
        const message = webhookEvent.message?.text;

        if (message) {
          console.log(`Message from ${senderId}: ${message}`);

          const newMessage = new Message({
            senderId,
            recipientId,
            source: 'facebook',
            content: message,
          });

          await newMessage.save();
          console.log('Message saved to DB');

          await sendTextMessage(senderId, `Echo: ${message}`);
        } else {
          console.log('No message content received');
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('Error handling webhook event:', err);
      return res.sendStatus(500);
    }
  } else {
    console.error('Invalid webhook object');
    return res.sendStatus(404);
  }
});


// Send message manually
router.post('/messages', async (req, res) => {
  const { recipientId, message } = req.body;

  if (!recipientId || !message) {
    return res.status(400).json({ success: false, error: 'Recipient ID and message content are required' });
  }

  try {
    await sendTextMessage(recipientId, message);
    res.status(200).json({ success: true, message: 'Message sent!' });
  } catch (err) {
    console.error('Error sending message:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Helper to send Facebook message
async function sendTextMessage(recipientId, message) {
  const url = `https://graph.facebook.com/v22.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const payload = {
    recipient: { id: recipientId },
    message: { text: message },
  };

  try {
    const response = await axios.post(url, payload);
    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = router;
