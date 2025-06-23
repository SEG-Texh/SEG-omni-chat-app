// === controllers/facebookController.js ===
const axios = require('axios');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

const facebookController = {
  verifyFacebookWebhook: (req, res) => {
    if (
      req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
    ) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
  },

  handleFacebookWebhook: async (req, res) => {
    if (req.body.object !== 'page') return res.sendStatus(404);

    const io = getIO();
    for (const entry of req.body.entry) {
      const pageId = entry.id;
      for (const event of entry.messaging) {
        if (event.message) await facebookController.processMessage(event, pageId, io);
        if (event.postback) await facebookController.processPostback(event, io);
      }
    }
    res.sendStatus(200);
  },

  processMessage: async (event, pageId, io) => {
    const { sender, message } = event;
    const existing = await Message.findOne({ platform: 'facebook', platformMessageId: message.mid });
    if (existing) return;

    const senderInfo = await facebookController.getFacebookUserInfo(sender.id);

    const newMessage = await Message.create({
      platform: 'facebook',
      direction: 'inbound',
      status: 'delivered',
      platformMessageId: message.mid,
      platformThreadId: sender.id,
      content: { text: message.text },
      sender: sender.id,
      recipient: pageId,
      platformSender: senderInfo,
      labels: ['unclaimed']
    });

    io.emit('new_message', { event: 'facebook_message', message: newMessage });
  },

  processPostback: async (event, io) => {
    const { sender, postback } = event;
    const senderInfo = await facebookController.getFacebookUserInfo(sender.id);

    const postbackMessage = await Message.create({
      platform: 'facebook',
      direction: 'inbound',
      status: 'delivered',
      platformMessageId: `pb-${Date.now()}`,
      platformThreadId: sender.id,
      content: {
        text: `[POSTBACK] ${postback.payload}`,
        buttons: [{ type: 'postback', title: postback.title, payload: postback.payload }]
      },
      sender: sender.id,
      recipient: event.recipient.id,
      platformSender: senderInfo,
      labels: ['unclaimed', 'postback']
    });

    io.emit('new_message', { event: 'facebook_postback', message: postbackMessage });
  },

  sendFacebookMessage: async (req, res) => {
    try {
      const { recipientId, text } = req.body;
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          message: { text }
        }
      );

      const newMessage = await Message.create({
        platform: 'facebook',
        direction: 'outbound',
        status: 'sent',
        content: { text },
        platformMessageId: response.data.message_id,
        platformThreadId: recipientId,
        sender: process.env.FACEBOOK_PAGE_ID,
        recipient: recipientId,
        labels: []
      });

      getIO().emit('new_message', { event: 'facebook_outbound', message: newMessage });

      res.json({ success: true, message: newMessage, facebookResponse: response.data });
    } catch (error) {
      console.error('Facebook send error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to send message' });
    }
  },

  getFacebookUserInfo: async (userId) => {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/${userId}?fields=name,profile_pic&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
      );
      return response.data;
    } catch (error) {
      return { name: 'Facebook User' };
    }
  }
};

module.exports = facebookController;