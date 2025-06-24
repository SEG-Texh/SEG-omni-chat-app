const axios = require('axios');
const Chat = require('../models/message');

class FacebookController {
  constructor() {
    // Bind all methods to maintain proper 'this' context
    this.verifyWebhook = this.verifyWebhook.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.getUserProfile = this.getUserProfile.bind(this);
  }

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
      console.log('Body:', JSON.stringify(req.body, null, 2));
      
      const body = req.body;
      
      // Validate basic payload structure
      if (!body || typeof body !== 'object') {
        console.error('Invalid request body');
        return res.status(400).json({ error: 'Invalid request body' });
      }
      
      // Check if this is a page subscription
      if (body.object === 'page') {
        if (!body.entry || !Array.isArray(body.entry)) {
          console.error('Invalid entry format');
          return res.status(400).json({ error: 'Invalid entry format' });
        }
        
        // Iterate over each entry
        for (const entry of body.entry) {
          if (!entry.messaging || !Array.isArray(entry.messaging)) {
            console.error('Invalid messaging format in entry:', entry);
            continue;
          }
          
          for (const webhookEvent of entry.messaging) {
            try {
              const senderId = webhookEvent.sender?.id;
              const message = webhookEvent.message;
              
              if (!senderId) {
                console.error('Missing sender ID in event:', webhookEvent);
                continue;
              }
              
              if (message) {
                await this.processMessage(senderId, message);
              }
            } catch (eventError) {
              console.error('Error processing messaging event:', eventError);
            }
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling Facebook message:', {
        message: error.message,
        stack: error.stack,
        body: req.body
      });
      res.status(500).json({ 
        error: 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Process incoming message
  async processMessage(senderId, message) {
    try {
      const text = message.text || '';
      const attachments = message.attachments || [];
      
      // Get user profile info
      const userProfile = await this.getUserProfile(senderId);
      
      // Save to database with more details
      const chat = new Chat({
        platform: 'facebook',
        senderId,
        senderName: userProfile?.name || 'Unknown',
        senderAvatar: userProfile?.profile_pic || '',
        message: text,
        attachments,
        direction: 'incoming',
        timestamp: new Date(),
        metadata: {
          isRead: false,
          isReplied: false
        }
      });
      
      await chat.save();
      
      // Enhanced auto-reply logic
      if (text) {
        const response = await this.generateReply(text);
        await this.sendMessage(senderId, response);
      } else if (attachments.length > 0) {
        await this.sendMessage(senderId, "Thanks for sending the attachment!");
      }
    } catch (error) {
      console.error('Error processing Facebook message:', {
        error: error.message,
        stack: error.stack,
        senderId,
        message
      });
      throw error;
    }
  }

  // Generate intelligent reply
  async generateReply(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('hello') || lowerText.includes('hi')) {
      return 'Hello there! How can I help you today?';
    } else if (lowerText.includes('price') || lowerText.includes('cost')) {
      return 'Our pricing starts at $9.99/month. Would you like more details?';
    } else if (lowerText.includes('thank')) {
      return "You're welcome! Is there anything else I can help with?";
    } else {
      return 'Thanks for your message! Our team will get back to you shortly.';
    }
  }

  // Send message to user
  async sendMessage(recipientId, text, quickReplies = null) {
    try {
      const messagePayload = {
        recipient: { id: recipientId },
        message: { text }
      };
      
      if (quickReplies) {
        messagePayload.message.quick_replies = quickReplies;
      }
      
      const response = await axios.post(
        `https://graph.facebook.com/v13.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
        messagePayload,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Save outgoing message to database
      const chat = new Chat({
        platform: 'facebook',
        senderId: recipientId,
        message: text,
        direction: 'outgoing',
        timestamp: new Date(),
        metadata: {
          isDelivered: true,
          isRead: false
        }
      });
      
      await chat.save();
      
      return response.data;
    } catch (error) {
      console.error('Error sending Facebook message:', {
        error: error.response?.data || error.message,
        recipientId,
        text
      });
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
      console.error('Error getting Facebook user profile:', {
        error: error.response?.data || error.message,
        userId
      });
      return null;
    }
  }
}

// Export a properly configured instance
module.exports = new FacebookController();