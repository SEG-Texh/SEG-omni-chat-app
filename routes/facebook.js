
// services/facebookService.js - Facebook Messenger API integration
const axios = require('axios');
const express = require('express');
const router = express.Router();
const { io } = require('../server');

class FacebookService {
  constructor() {
    this.accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    this.appSecret = process.env.FACEBOOK_APP_SECRET;
    this.verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    this.apiUrl = 'https://graph.facebook.com/v18.0/me/messages';
  }

  async sendMessage(recipientId, message) {
    try {
      const response = await axios.post(this.apiUrl, {
        recipient: { id: recipientId },
        message: { text: message }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Facebook send error:', error.response?.data || error.message);
      throw new Error('Failed to send Facebook message');
    }
  }

  async getUserProfile(userId) {
    try {
      const response = await axios.get(`https://graph.facebook.com/v18.0/${userId}`, {
        params: {
          fields: 'first_name,last_name,profile_pic',
          access_token: this.accessToken
        }
      });
      return response.data;
    } catch (error) {
      console.error('Facebook profile error:', error);
      return null;
    }
  }
}

const facebookService = new FacebookService();

// Webhook verification
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === facebookService.verifyToken) {
    console.log('Facebook webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook for receiving messages
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'page') {
      body.entry?.forEach(entry => {
        entry.messaging?.forEach(async (event) => {
          if (event.message && !event.message.is_echo) {
            const senderId = event.sender.id;
            const messageText = event.message.text;

            // Get user profile
            const userProfile = await facebookService.getUserProfile(senderId);
            const userName = userProfile ? 
              `${userProfile.first_name} ${userProfile.last_name}` : 
              senderId;

            // Create or find conversation
            const Conversation = require('../models/conversation');
            let conversation = await Conversation.findOne({
              'contact.identifier': senderId,
              'contact.platform': 'facebook'
            });

            if (!conversation) {
              conversation = new Conversation({
                contact: {
                  name: userName,
                  identifier: senderId,
                  platform: 'facebook'
                },
                lastMessage: {
                  content: messageText,
                  timestamp: new Date(event.timestamp),
                  sender: userName
                }
              });
              await conversation.save();
            } else {
              conversation.lastMessage = {
                content: messageText,
                timestamp: new Date(event.timestamp),
                sender: userName
              };
              conversation.unreadCount += 1;
              await conversation.save();
            }

            // Save message
            const Message = require('../models/Message');
            const newMessage = new Message({
              conversationId: conversation._id,
              sender: userName,
              content: messageText,
              platform: 'facebook',
              isOwn: false,
              timestamp: new Date(event.timestamp)
            });
            await newMessage.save();

            // Emit to all connected clients
            io.emit('new_message', {
              conversationId: conversation._id,
              message: newMessage
            });
          }
        });
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Facebook webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = {
  sendMessage: facebookService.sendMessage.bind(facebookService),
  getUserProfile: facebookService.getUserProfile.bind(facebookService),
  webhook: router
};
