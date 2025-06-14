// controllers/facebookController.js
const Message = require('../models/message');
const { getIO } = require('../config/socket');
const axios = require('axios');

const getSenderName = async (senderId) => {
  // ... keep your existing implementation ...
};

const processMessageEvent = async (event, pageId, io) => {
  // ... keep your existing implementation ...
};

const processPostbackEvent = async (event, io) => {
  // ... keep your existing implementation ...
};

// Export the controller methods directly
module.exports = {
  verifyFacebookWebhook: (req, res) => {
    const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    
    if (!VERIFY_TOKEN) {
      console.error('Facebook verify token not configured');
      return res.sendStatus(500);
    }
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Facebook webhook verified');
        return res.status(200).send(challenge);
      }
      return res.sendStatus(403);
    }
    return res.sendStatus(400);
  },

  handleFacebookWebhook: async (req, res) => {
    try {
      if (req.body.object !== 'page') {
        return res.status(400).send('Invalid object type');
      }

      const io = getIO();
      const processingPromises = [];

      for (const entry of req.body.entry) {
        for (const event of entry.messaging) {
          try {
            if (event.message && !event.message.is_echo) {
              processingPromises.push(
                processMessageEvent(event, entry.id, io)
              );
            } else if (event.postback) {
              processingPromises.push(
                processPostbackEvent(event, io)
              );
            }
          } catch (error) {
            console.error('Error processing individual event:', error);
          }
        }
      }

      await Promise.all(processingPromises);
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Error in Facebook webhook handler:', error);
      return res.status(500).send('SERVER_ERROR');
    }
  }
};