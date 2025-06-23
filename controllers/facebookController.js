const axios = require('axios');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

const facebookController = {
  // Verify Facebook webhook
  verifyFacebookWebhook: (req, res) => {
    const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    if (req.query['hub.mode'] === 'subscribe' && 
        req.query['hub.verify_token'] === VERIFY_TOKEN) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.sendStatus(403);
  },

  // Handle incoming Facebook messages
  handleFacebookWebhook: async (req, res) => {
    try {
      if (req.body.object !== 'page') return res.sendStatus(404);
      
      const io = getIO();
      const entries = req.body.entry;

      for (const entry of entries) {
        const pageId = entry.id;
        for (const event of entry.messaging) {
          if (event.message) {
            await facebookController.processMessage(event, pageId, io);
          } else if (event.postback) {
            await this.processPostback(event, io);
          }
        }
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // Process regular messages
  processMessage: async (event, pageId, io) => {
    const { sender, message } = event;
    const existing = await Message.findOne({ 
      platform: 'facebook', 
      platformMessageId: message.mid 
    });
    if (existing) return;

    const senderInfo = await facebookController.getFacebookUserInfo(sender.id);

    
    const newMessage = await Message.create({
      platform: 'facebook',
      platformMessageId: message.mid,
      platformThreadId: sender.id,
      direction: 'inbound',
      status: 'delivered',
      content: {
        text: message.text,
        attachments: message.attachments?.map(attach => ({
          type: attach.type,
          url: attach.payload?.url,
          caption: attach.title
        }))
      },
      sender: sender.id,
      receiver: pageId,
      platformSender: {
        id: sender.id,
        name: senderInfo.name,
        profilePic: senderInfo.profile_pic
      },
      labels: ['unclaimed']
    });

    io.emit('new_message', { 
      event: 'facebook_message',
      message: newMessage 
    });
  },

  // Process postback events
  processPostback: async (event, io) => {
    const { sender, postback } = event;
    const senderInfo = await this.getFacebookUserInfo(sender.id);

    const postbackMessage = await Message.create({
      platform: 'facebook',
      platformMessageId: `pb-${Date.now()}-${sender.id}`,
      platformThreadId: sender.id,
      direction: 'inbound',
      status: 'delivered',
      content: {
        text: `[POSTBACK] ${postback.payload}`,
        buttons: [{
          type: 'postback',
          title: postback.title,
          payload: postback.payload
        }]
      },
      sender: sender.id,
      receiver: event.recipient.id,
      platformSender: {
        id: sender.id,
        name: senderInfo.name
      },
      labels: ['unclaimed', 'postback']
    });

    io.emit('new_message', {
      event: 'facebook_postback',
      message: postbackMessage
    });
  },

  // Send messages to Facebook
  sendFacebookMessage: async (req, res) => {
    try {
      const { recipientId, text } = req.body;
      if (!recipientId || !text) {
        return res.status(400).json({ error: 'Recipient ID and text are required' });
      }

      const response = await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          message: { text }
        }
      );

      const newMessage = await Message.create({
        platform: 'facebook',
        platformMessageId: response.data.message_id,
        platformThreadId: recipientId,
        direction: 'outbound',
        status: 'sent',
        content: { text },
        sender: process.env.FACEBOOK_PAGE_ID,
        receiver: recipientId,
        labels: []
      });

      getIO().emit('new_message', {
        event: 'facebook_outbound',
        message: newMessage
      });

      res.json({ 
        success: true,
        message: newMessage,
        facebookResponse: response.data
      });
    } catch (error) {
      console.error('Facebook send error:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Failed to send message',
        details: error.response?.data || error.message
      });
    }
  },

  // Get Facebook user info
  getFacebookUserInfo: async (userId) => {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/${userId}?fields=name,profile_pic&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching Facebook user:', error.message);
      return { name: 'Facebook User' };
    }
  }
};

module.exports = facebookController;