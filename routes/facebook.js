const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
const Message = require('../models/message');
require('dotenv').config();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

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

// Facebook message webhook
router.post('/webhook', async (req, res) => {
  if (req.body.object !== 'page') {
    console.error('Invalid webhook object');
    return res.sendStatus(404);
  }

  try {
    for (const entry of req.body.entry) {
      if (!entry.messaging || !Array.isArray(entry.messaging)) {
        console.log('Entry has no messaging array');
        continue;
      }

      for (const event of entry.messaging) {
        try {
          if (!event.sender?.id || !event.recipient?.id || !event.message?.text) {
            console.log('Incomplete message event');
            continue;
          }

          const messageData = {
            senderId: event.sender.id,              // ✅ corrected
            recipientId: event.recipient.id,        // ✅ corrected
            source: 'facebook',                     // ✅ corrected
            content: event.message.text,
          };

          const newMessage = new Message(messageData);
          const validationError = newMessage.validateSync();
          
          if (validationError) {
            console.error('Validation failed:', validationError);
            continue;
          }

          await newMessage.save();
          console.log('Message saved successfully:', {
            id: newMessage._id,
            senderId: newMessage.senderId,
            recipientId: newMessage.recipientId
          });

          await sendTextMessage(messageData.senderId, `Echo: ${messageData.content}`);
        } catch (error) {
          console.error('Error processing message:', error.message);
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.sendStatus(500);
  }
});

// Manual message sender
router.post('/messages', async (req, res) => {
  const { recipient, message } = req.body;

  if (!recipient || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Recipient and message content are required' 
    });
  }

  try {
    const newMessage = new Message({
      senderId: 'system',               // ✅ corrected
      recipientId: recipient,           // ✅ corrected
      source: 'facebook',               // ✅ corrected
      content: message
    });

    await newMessage.save();
    await sendTextMessage(recipient, message);
    
    res.status(200).json({ 
      success: true, 
      message: 'Message sent!',
      messageId: newMessage._id
    });
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send message',
      details: err.message
    });
  }
});

// Facebook API sender
async function sendTextMessage(recipient, message) {
  const url = `https://graph.facebook.com/v22.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const payload = {
    recipient: { id: recipient },
    message: { text: message },
  };

  try {
    const response = await axios.post(url, payload);
    console.log('Facebook API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Facebook API error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = router;
