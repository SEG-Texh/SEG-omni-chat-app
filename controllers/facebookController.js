const axios = require('axios');
const Chat = require('../models/Chat');


class FacebookController {
  // Verify webhook
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      console.log('Facebook webhook verified');
      return res.status(200).send(challenge);
    }
    
    console.error('Facebook webhook verification failed');
    return res.sendStatus(403);
  }

  // Handle incoming messages
  async handleMessage(req, res) {
    try {
      console.log('=== RAW WEBHOOK REQUEST ===');
      console.log('Headers:', JSON.stringify(req.headers));
      console.log('Body:', JSON.stringify(req.body));
      const body = req.body;
      
      // Check if this is a page subscription
      if (body.object === 'page') {
        // Iterate over each entry
        for (const entry of body.entry) {
          // Handle messages
          const webhookEvent = entry.messaging[0];
          const senderId = webhookEvent.sender.id;
          const message = webhookEvent.message;
          
          if (message) {
            await this.processMessage(senderId, message);
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling Facebook message:', error);
      res.sendStatus(500);
    }
  }

  // Process incoming message
  async processMessage(senderId, message) {
    try {
      const text = message.text;
      
      // Save to database
      const chat = new Chat({
        platform: 'facebook',
        senderId,
        message: text,
        direction: 'incoming',
        timestamp: new Date()
      });
      await chat.save();
      
      // Auto reply example
      if (text.toLowerCase().includes('hello')) {
        await this.sendMessage(senderId, 'Hello there! How can I help you today?');
      }
    } catch (error) {
      console.error('Error processing Facebook message:', error);
    }
  }

  // Send message to user
  async sendMessage(recipientId, text) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v13.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: recipientId },
          message: { text }
        }
      );
      
      // Save outgoing message to database
      const chat = new Chat({
        platform: 'facebook',
        senderId: recipientId,
        message: text,
        direction: 'outgoing',
        timestamp: new Date()
      });
      await chat.save();
      
      return response.data;
    } catch (error) {
      console.error('Error sending Facebook message:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v13.0/${userId}?fields=name,profile_pic&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting Facebook user profile:', error);
      return null;
    }
  }
}

module.exports = new FacebookController();