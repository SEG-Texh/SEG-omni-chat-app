const Message = require('../models/message');
const { getIO } = require('../config/socket');
const axios = require('axios');

const facebookController = (() => {
  const getSenderName = async (senderId) => {
    try {
      const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      if (!pageAccessToken) {
        console.warn('No Facebook Page Access Token configured');
        return 'Facebook User';
      }

      const response = await axios.get(
        `https://graph.facebook.com/${senderId}?fields=name&access_token=${pageAccessToken}`
      );
      return response.data.name || 'Facebook User';
    } catch (error) {
      console.error('Error fetching sender name:', error.response?.data?.error?.message || error.message);
      return 'Facebook User';
    }
  };

  const processMessageEvent = async (event, pageId, io) => {
    try {
      const senderId = event.sender.id;
      const message = event.message;
      
      // Check for duplicate message
      const existingMessage = await Message.findOne({
        platform: 'facebook',
        platformMessageId: message.mid
      });
      
      if (existingMessage) return;

      // Create message without waiting for sender name
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
        sender: {
          id: senderId,
          platform: 'facebook'
        },
        recipient: {
          id: pageId,
          platform: 'facebook'
        },
        labels: ['unclaimed']
      });

      // Try to get sender name in background
      getSenderName(senderId).then(name => {
        if (name !== 'Facebook User') {
          Message.updateOne(
            { _id: newMessage._id },
            { 'sender.name': name }
          ).then(() => {
            io.emit('message_updated', {
              messageId: newMessage._id,
              updates: { 'sender.name': name }
            });
          });
        }
      });

      io.emit('new_message', {
        event: 'facebook_message',
        message: {
          ...newMessage.toObject(),
          timestamp: new Date(),
          sender: {
            ...newMessage.sender,
            name: 'Facebook User' // Temporary placeholder
          }
        }
      });

      return newMessage;
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  };

  // ... rest of your controller code ...
})();

module.exports = facebookController;