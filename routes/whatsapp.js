// services/whatsappService.js - WhatsApp Business API integration
const axios = require('axios');
const express = require('express');
const router = express.Router();
const { io } = require('../server');

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    this.apiUrl = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
  }

  async sendMessage(to, message) {
    try {
      const response = await axios.post(this.apiUrl, {
        messaging_product: "whatsapp",
        to: to,
        text: { body: message }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp message');
    }
  }

  async sendMediaMessage(to, mediaType, mediaUrl, caption = '') {
    try {
      const mediaPayload = {
        messaging_product: "whatsapp",
        to: to,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl
        }
      };

      if (caption && (mediaType === 'image' || mediaType === 'video')) {
        mediaPayload[mediaType].caption = caption;
      }

      const response = await axios.post(this.apiUrl, mediaPayload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error('WhatsApp media send error:', error.response?.data || error.message);
      throw new Error('Failed to send WhatsApp media message');
    }
  }
}

const whatsappService = new WhatsAppService();

// Webhook verification
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === whatsappService.webhookVerifyToken) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook for receiving messages
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          if (change.field === 'messages') {
            const messages = change.value.messages;
            const contacts = change.value.contacts;

            messages?.forEach(async (message) => {
              const contact = contacts?.find(c => c.wa_id === message.from);
              
              // Create or find conversation
              const Conversation = require('../models/conversation');
              let conversation = await Conversation.findOne({
                'contact.identifier': message.from,
                'contact.platform': 'whatsapp'
              });

              if (!conversation) {
                conversation = new Conversation({
                  contact: {
                    name: contact?.profile?.name || message.from,
                    identifier: message.from,
                    platform: 'whatsapp'
                  },
                  lastMessage: {
                    content: message.text?.body || 'Media message',
                    timestamp: new Date(message.timestamp * 1000),
                    sender: contact?.profile?.name || message.from
                  }
                });
                await conversation.save();
              } else {
                conversation.lastMessage = {
                  content: message.text?.body || 'Media message',
                  timestamp: new Date(message.timestamp * 1000),
                  sender: contact?.profile?.name || message.from
                };
                conversation.unreadCount += 1;
                await conversation.save();
              }

              // Save message
              const Message = require('../models/Message');
              const newMessage = new Message({
                conversationId: conversation._id,
                sender: contact?.profile?.name || message.from,
                content: message.text?.body || 'Media message',
                platform: 'whatsapp',
                isOwn: false,
                timestamp: new Date(message.timestamp * 1000)
              });
              await newMessage.save();

              // Emit to all connected clients
              io.emit('new_message', {
                conversationId: conversation._id,
                message: newMessage
              });
            });
          }
        });
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = {
  sendMessage: whatsappService.sendMessage.bind(whatsappService),
  sendMediaMessage: whatsappService.sendMediaMessage.bind(whatsappService),
  webhook: router
};