// controllers/facebookController.js
const Message = require('../models/message');
const { getIO } = require('../config/socket');
const axios = require('axios'); // For fetching sender name from Facebook API

// Create a self-contained module with all methods
const facebookController = (() => {
  // Private methods
const getSenderName = async (senderId, pageAccessToken) => {
  try {
    const url = `https://graph.facebook.com/${senderId}?fields=name,profile_pic&access_token=${pageAccessToken}`;
    const response = await axios.get(url);
    return response.data.name || 'Facebook User';
  } catch (error) {
    console.error('Error fetching sender name:', error.response?.data || error.message);
    return 'Facebook User';
  }
};

  const processMessageEvent = async (event, pageId, io) => {
    try {
      const senderId = event.sender.id;
      const message = event.message;
      const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      
      // Check for duplicate message
      const existingMessage = await Message.findOne({
        platform: 'facebook',
        platformMessageId: message.mid
      });
      
      if (existingMessage) {
        console.log('Duplicate message detected, skipping');
        return;
      }

      // Get sender name from Facebook API
      const senderName = await getSenderName(senderId, pageAccessToken);

      // Create and save the message
      const newMessage = await Message.create({
        platform: 'facebook',
        platformMessageId: message.mid,
        platformThreadId: senderId,
        direction: 'inbound',
        status: 'delivered',
        content: {
          text: message.text,
          attachments: message.attachments?.map(attach => ({
            type: attach.type,
            url: attach.payload?.url,
            caption: attach.title,
            mimeType: attach.payload?.mime_type
          }))
        },
        sender: senderId,
        recipient: pageId,
        platformSender: {
          id: senderId,
          name: senderName
        },
        platformRecipient: {
          id: pageId
        },
        labels: ['unclaimed']
      });

      // Emit socket event with complete message data
      io.emit('new_message', {
        event: 'facebook_message',
        message: {
          ...newMessage.toObject(),
          timestamp: new Date() // Ensure fresh timestamp
        }
      });

      console.log('Processed new Facebook message:', newMessage.id);
      return newMessage;
    } catch (error) {
      console.error('Error processing message event:', error);
      throw error;
    }
  };

  const processPostbackEvent = async (event, io) => {
    try {
      const senderId = event.sender.id;
      const payload = event.postback.payload;
      const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const senderName = await getSenderName(senderId, pageAccessToken);

      const postbackMessage = await Message.create({
        platform: 'facebook',
        platformMessageId: `pb-${Date.now()}-${senderId}`,
        platformThreadId: senderId,
        direction: 'inbound',
        status: 'delivered',
        content: {
          text: `[POSTBACK] ${payload}`,
          buttons: [{
            type: 'postback',
            title: event.postback.title || 'Button',
            payload: payload
          }]
        },
        sender: senderId,
        recipient: event.recipient.id,
        platformSender: {
          id: senderId,
          name: senderName
        },
        platformRecipient: {
          id: event.recipient.id
        },
        labels: ['unclaimed', 'postback']
      });

      io.emit('new_message', {
        event: 'facebook_postback',
        message: {
          ...postbackMessage.toObject(),
          timestamp: new Date()
        }
      });

      console.log('Processed Facebook postback:', postbackMessage.id);
      return postbackMessage;
    } catch (error) {
      console.error('Error processing postback event:', error);
      throw error;
    }
  };

  // Public API
  return {
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
})();

module.exports = facebookController;