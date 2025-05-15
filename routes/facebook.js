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

// Webhook verification (unchanged)
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

// Updated webhook handler to match your schema
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
          // Validate required fields
          if (!event.sender?.id || !event.recipient?.id || !event.message?.text) {
            console.log('Incomplete message event');
            continue;
          }

          const messageData = {
            sender: event.sender.id,  // Changed from senderId to sender
            recipient: event.recipient.id,  // Changed from recipientId to recipient
            channel: 'facebook',  // Changed from source to channel
            content: event.message.text,
            // createdAt and updatedAt will be added automatically by Mongoose
            // replies array will be empty by default
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
            sender: newMessage.sender,
            recipient: newMessage.recipient
          });

          await sendTextMessage(messageData.sender, `Echo: ${messageData.content}`);
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

// Updated manual message endpoint to match schema
router.post('/messages', async (req, res) => {
  const { recipient, message } = req.body;  // Changed from recipientId to recipient

  if (!recipient || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Recipient and message content are required' 
    });
  }

  try {
    // Create message in database first
    const newMessage = new Message({
      sender: 'system',  // Or whatever default sender you want
      recipient,
      channel: 'facebook',
      content: message
    });

    await newMessage.save();
    
    // Then send via Facebook
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

// Updated sendTextMessage to use recipient instead of recipientId
async function sendTextMessage(recipient, message) {
  const url = `https://graph.facebook.com/v22.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
  const payload = {
    recipient: { id: recipient },  // Changed to use recipient directly
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