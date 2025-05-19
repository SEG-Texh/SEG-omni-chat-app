const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
const { saveFacebookMessage } = require('../controllers/messageController');

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

router.use(bodyParser.json());

// Facebook Webhook Verification (GET route)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

// Handle incoming Facebook messages
router.post('/webhook', async (req, res) => {
  console.log('Incoming Facebook Webhook:', JSON.stringify(req.body, null, 2));
  
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
          // Process only if there's a message with text
          if (event.message && event.message.text) {
            const savedMessage = await saveFacebookMessage(event);
            
            if (savedMessage) {
              // Send a response back to user
              await sendTextMessage(
                savedMessage.sender, 
                `Thanks for your message: "${savedMessage.content}"`
              );
              
              // Notify connected clients via Socket.IO
              const io = req.app.get('io');
              if (io) {
                io.emit('new_message', {
                  platform: 'facebook',
                  message: savedMessage
                });
              }
            }
          }
        } catch (error) {
          console.error('Error processing message:', error.message);
        }
      }
    }
    
    // Always return a 200 OK to Facebook quickly
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.sendStatus(500);
  }
});

/**
 * Send text message to Facebook user
 * @param {String} recipientId - Facebook user ID
 * @param {String} text - Message content
 */
async function sendTextMessage(recipientId, text) {
  try {
    const response = await axios.post(
      'https://graph.facebook.com/v17.0/me/messages',
      {
        recipient: { id: recipientId },
        message: { text }
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN }
      }
    );
    
    console.log('✅ Message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = router;