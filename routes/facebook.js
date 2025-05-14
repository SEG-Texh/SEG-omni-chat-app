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
      console.error('Token mismatch: ', token);
      return res.sendStatus(403); // Forbidden if token doesn't match
    }
  }
  return res.sendStatus(404); // Not found if parameters are missing
});

// Webhook receiver
router.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    // Loop through the entries
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      console.log('Webhook Event:', webhookEvent);

      const senderId = webhookEvent.sender.id;
      const message = webhookEvent.message?.text;

      if (message) {
        console.log(`Message from ${senderId}: ${message}`);

        // Save message to MongoDB
        const newMessage = new Message({
          source: 'facebook',
          senderId,
          content: message,
          timestamp: new Date(),
        });

        try {
          await newMessage.save();
          console.log('Message saved to DB');
        } catch (err) {
          console.error('Error saving message:', err);
        }

        // Send an auto-reply to the user
        try {
          await sendTextMessage(senderId, `Echo: ${message}`);
        } catch (err) {
          console.error('Error sending message:', err);
        }
      } else {
        console.log('No message content received');
      }
    }

    return res.status(200).send('EVENT_RECEIVED');
  } else {
    console.error('Invalid webhook object');
    return res.sendStatus(404); // Not found if body doesn't match 'page'
  }
});

// Send message via Facebook API
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

// Helper to send message through Facebook Send API
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
    throw error; // Rethrow error to propagate to the caller
  }
}

module.exports = router;
