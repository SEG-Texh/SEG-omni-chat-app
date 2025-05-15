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

// Updated webhook handler with complete validation
router.post('/webhook', async (req, res) => {
  if (req.body.object !== 'page') {
    console.error('Invalid webhook object');
    return res.sendStatus(404);
  }

  try {
    for (const entry of req.body.entry) {
      // Skip if no messaging events
      if (!entry.messaging || !Array.isArray(entry.messaging)) {  // Fixed: Added missing parenthesis
        console.log('Entry has no messaging array');
        continue;
      }

      for (const event of entry.messaging) {
        try {
          // Validate all required fields exist
          if (!event.sender?.id || !event.recipient?.id || !event.message?.text) {
            console.log('Incomplete message event:', {
              hasSender: !!event.sender,
              hasRecipient: !!event.recipient,
              hasMessageText: !!event.message?.text
            });
            continue;
          }

          const messageData = {
            senderId: event.sender.id,
            recipientId: event.recipient.id,
            source: 'facebook',
            content: event.message.text,
            timestamp: new Date()
          };

          // Validate against schema before saving
          const newMessage = new Message(messageData);
          const validationError = newMessage.validateSync();
          
          if (validationError) {
            console.error('Validation failed:', validationError);
            continue;
          }

          await newMessage.save();
          console.log('Message saved successfully:', {
            senderId: messageData.senderId,
            recipientId: messageData.recipientId,
            length: messageData.content.length
          });

          // Send response
          await sendTextMessage(messageData.senderId, `Echo: ${messageData.content}`);
        } catch (error) {
          console.error('Error processing individual message:', {
            error: error.message,
            stack: error.stack
          });
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Top-level webhook error:', {
      error: err.message,
      stack: err.stack,
      body: req.body
    });
    return res.sendStatus(500);
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
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = router;