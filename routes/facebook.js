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

// Webhook receiver - Improved with better validation
router.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object !== 'page') {
    console.error('Invalid webhook object');
    return res.sendStatus(404);
  }

  try {
    for (const entry of body.entry) {
      // Skip if no messaging events
      if (!entry.messaging || !entry.messaging.length) {
        console.log('No messaging events in entry');
        continue;
      }

      const webhookEvent = entry.messaging[0];
      console.log('Webhook Event:', webhookEvent);

      // Validate required fields
      if (!webhookEvent.sender || !webhookEvent.sender.id) {
        console.error('Missing sender ID');
        continue;
      }

      if (!webhookEvent.recipient || !webhookEvent.recipient.id) {
        console.error('Missing recipient ID');
        continue;
      }

      const senderId = webhookEvent.sender.id;
      const recipientId = webhookEvent.recipient.id;
      const messageText = webhookEvent.message?.text;

      if (!messageText) {
        console.log('No message content received');
        continue;
      }

      try {
        const newMessage = new Message({
          senderId,
          recipientId,
          source: 'facebook',
          content: messageText,
          // Add timestamp if your schema requires it
          timestamp: new Date()
        });

        await newMessage.save();
        console.log('Message saved to DB');

        // Echo the message back
        await sendTextMessage(senderId, `Echo: ${messageText}`);
      } catch (saveError) {
        console.error('Error saving message to DB:', saveError);
        // Continue processing other messages even if one fails
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Error handling webhook event:', err);
    return res.sendStatus(500);
  }
});

// Send message manually - Already looks good
router.post('/messages', async (req, res) => {
  const { recipientId, message } = req.body;

  if (!recipientId || !message)