const Message = require('../models/message');
const { getIO } = require('../config/socket');
const axios = require('axios');

const facebookController = (() => {
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

      const existingMessage = await Message.findOne({
        platform: 'facebook',
        platformMessageId: message.mid
      });

      if (existingMessage) {
        console.log('Duplicate message detected, skipping');
        return;
      }

      const senderName = await getSenderName(senderId, pageAccessToken);

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

      io.emit('new_message', {
        event: 'facebook_message',
        message: {
          ...newMessage.toObject(),
          timestamp: new Date()
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

  // ✅ NEW: Outbound message sender
  const sendFacebookMessage = async (req, res) => {
    const { recipientId, text } = req.body;

    if (!recipientId || !text) {
      return res.status(400).json({ error: 'recipientId and text are required' });
    }

    try {
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`,
        {
          recipient: { id: recipientId },
          message: { text }
        }
      );

      // Save sent message to DB
      const newMessage = await Message.create({
        platform: 'facebook',
        platformMessageId: `out-${Date.now()}`,
        platformThreadId: recipientId,
        direction: 'outbound',
        status: 'sent',
        content: { text },
        sender: process.env.FACEBOOK_PAGE_ID,
        recipient: recipientId,
        platformSender: {
          id: process.env.FACEBOOK_PAGE_ID,
          name: 'Page'
        },
        platformRecipient: {
          id: recipientId
        },
        labels: []
      });

      // Emit to Socket.IO
      const io = getIO();
      io.emit('new_message', {
        event: 'facebook_outbound',
        message: {
          ...newMessage.toObject(),
          timestamp: new Date()
        }
      });

      return res.status(200).json({ success: true, data: response.data });
    } catch (error) {
      console.error('Error sending Facebook message:', error.response?.data || error.message);
      return res.status(500).json({ error: error.response?.data || error.message });
    }
  };

  return {
    verifyFacebookWebhook,
    handleFacebookWebhook,
    sendFacebookMessage // 👈 Export the new method
  };
})();

module.exports = facebookController;
