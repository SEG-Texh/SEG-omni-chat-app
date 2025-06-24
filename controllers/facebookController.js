// controllers/facebookController.js
const axios = require('axios');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

const facebookController = {
  verifyFacebookWebhook: (req, res) => {
    const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
    if (
      req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === VERIFY_TOKEN
    ) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.sendStatus(403);
  },

  handleFacebookWebhook: async (req, res) => {
    try {
      if (req.body.object !== 'page') return res.sendStatus(404);
      const io = getIO();

      for (const entry of req.body.entry) {
        const pageId = entry.id;
        for (const event of entry.messaging) {
          if (event.message && !event.message.is_echo) {
            await facebookController._processMessage(event, pageId, io);
          }
          if (event.postback) {
            await facebookController._processPostback(event, pageId, io);
          }
        }
      }
      res.sendStatus(200);
    } catch (err) {
      console.error('Facebook Webhook Error:', err);
      res.sendStatus(500);
    }
  },

  _processMessage: async (event, pageId, io) => {
    const { sender, message } = event;

    if (await Message.findOne({ platformMessageId: message.mid })) return;

    const senderInfo = await facebookController.getFacebookUserInfo(sender.id);
    const newMsg = await Message.create({
      platform: 'facebook',
      platformMessageId: message.mid,
      platformThreadId: sender.id,
      direction: 'inbound',
      status: 'delivered',
      content: {
        text: message.text || '',
        attachments: (message.attachments || []).map(att => ({
          type: att.type,
          url: att.payload?.url || '',
          caption: att.title || ''
        }))
      },
      sender: sender.id,
      recipient: pageId,
      platformSender: senderInfo,
      platformRecipient: { id: pageId },
      labels: ['unclaimed']
    });

    io.emit('new_message', newMsg);
  },

  _processPostback: async (event, pageId, io) => {
    const { sender, postback } = event;
    const senderInfo = await facebookController.getFacebookUserInfo(sender.id);

    const newMsg = await Message.create({
      platform: 'facebook',
      platformMessageId: `postback-${Date.now()}-${sender.id}`,
      platformThreadId: sender.id,
      direction: 'inbound',
      status: 'delivered',
      content: {
        text: `[POSTBACK] ${postback.payload}`,
        attachments: []
      },
      sender: sender.id,
      recipient: pageId,
      platformSender: senderInfo,
      platformRecipient: { id: pageId },
      labels: ['unclaimed', 'postback']
    });

    io.emit('new_message', newMsg);
  },

  sendFacebookMessage: async (req, res) => {
    try {
      const { recipientId, text } = req.body;
      if (!recipientId || !text) {
        return res.status(400).json({ error: 'recipientId and text required' });
      }

      const resp = await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          message: { text }
        }
      );

      const outgoing = await Message.create({
        platform: 'facebook',
        platformMessageId: resp.data.message_id,
        platformThreadId: recipientId,
        direction: 'outbound',
        status: 'sent',
        content: { text },
        sender: process.env.FACEBOOK_PAGE_ID,
        recipient: recipientId,
        platformSender: { id: process.env.FACEBOOK_PAGE_ID },
        platformRecipient: { id: recipientId },
        labels: []
      });

      getIO().emit('new_message', outgoing);
      res.json({ success: true, message: outgoing });
    } catch (err) {
      console.error('Facebook Send Error:', err.response?.data || err.message);
      res.status(500).json({ error: 'Failed to send via Facebook' });
    }
  },

  getFacebookUserInfo: async (id) => {
    try {
      const resp = await axios.get(
        `https://graph.facebook.com/${id}?fields=name,profile_pic&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
      );
      return resp.data;
    } catch {
      return { id, name: 'Facebook User', profile_pic: '' };
    }
  }
};

module.exports = facebookController;
