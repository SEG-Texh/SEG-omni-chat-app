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
    this.fetchConversationHistory = this.fetchConversationHistory.bind(this);
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
    
    console.error('Facebook webhook verification failed. Received token:', token);
    return res.sendStatus(403);
  }

  // Handle incoming messages
  async handleMessage(req, res) {
    try {
      console.log('=== INCOMING WEBHOOK ===');
      console.log('Headers:', req.headers);
      console.log('Body:', JSON.stringify(req.body, null, 2));
      
      if (!req.body || typeof req.body !== 'object') {
        console.error('Invalid request body');
        return res.status(400).json({ error: 'Invalid request body' });
      }
      
      if (req.body.object === 'page') {
        if (!Array.isArray(req.body.entry)) {
          console.error('Invalid entry format');
          return res.status(400).json({ error: 'Invalid entry format' });
        }
        
        for (const entry of req.body.entry) {
          if (!Array.isArray(entry.messaging)) {
            console.error('Invalid messaging format in entry:', entry.id);
            continue;
          }
          
          for (const event of entry.messaging) {
            try {
              if (!event.sender?.id) {
                console.error('Missing sender ID in event:', event);
                continue;
              }
              
              if (event.message) {
                console.log('Processing message from:', event.sender.id);
                await this.processMessage(event.sender.id, event.message);
              } else if (event.postback) {
                console.log('Processing postback from:', event.sender.id);
                await this.processPostback(event.sender.id, event.postback);
              }
            } catch (error) {
              console.error('Error processing event:', {
                error: error.message,
                event
              });
            }
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Error in handleMessage:', {
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
      console.log('Processing message from', senderId, ':', message);
      
      const text = message.text || '';
      const attachments = message.attachments || [];
      const messageId = message.mid || Date.now().toString();
      
      // Get user profile info
      const userProfile = await this.getUserProfile(senderId);
      
      // Create chat document
      const chatData = {
        platform: 'facebook',
        senderId,
        messageId,
        senderName: userProfile?.name || 'Unknown',
        senderAvatar: userProfile?.profile_pic || '',
        message: text,
        attachments,
        direction: 'incoming',
        timestamp: new Date(),
        metadata: {
          isRead: false,
          isReplied: false,
          rawMessage: message
        }
      };
      
      console.log('Saving message to DB:', chatData);
      const chat = new Chat(chatData);
      await chat.save();
      console.log('Message saved successfully');
      
      // Generate and send response
      if (text) {
        const response = await this.generateReply(text);
        await this.sendMessage(senderId, response);
      } else if (attachments.length > 0) {
        await this.sendMessage(senderId, "Thanks for the attachment!");
      }
    } catch (error) {
      console.error('Error in processMessage:', {
        error: error.message,
        stack: error.stack,
        senderId,
        message
      });
      throw error;
    }
  }

  // Process postback
  async processPostback(senderId, postback) {
    try {
      console.log('Processing postback from', senderId, ':', postback);
      
      const payload = postback.payload;
      const chat = new Chat({
        platform: 'facebook',
        senderId,
        message: `[POSTBACK] ${payload}`,
        direction: 'incoming',
        timestamp: new Date(),
        metadata: {
          isRead: false,
          isReplied: false,
          payload: postback
        }
      });
      
      await chat.save();
      
      // Handle different postback payloads
      if (payload === 'GET_STARTED') {
        await this.sendMessage(senderId, "Welcome! How can I help you today?");
      }
    } catch (error) {
      console.error('Error processing postback:', error);
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

  // Fetch conversation history
  async fetchConversationHistory(userId, limit = 50) {
    try {
      console.log(`Fetching conversation history for ${userId}`);
      
      let url = `https://graph.facebook.com/v13.0/${userId}/conversations?fields=messages{from,message,created_time,attachments,id}&limit=${limit}&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`;
      
      const allMessages = [];
      while (url && allMessages.length < limit) {
        const response = await axios.get(url);
        const conversations = response.data.data || [];
        
        for (const conversation of conversations) {
          if (conversation.messages?.data) {
            allMessages.push(...conversation.messages.data);
          }
        }
        
        url = response.data.paging?.next || null;
      }
      
      console.log(`Fetched ${allMessages.length} messages`);
      return allMessages.slice(0, limit);
    } catch (error) {
      console.error('Error fetching conversation history:', {
        error: error.response?.data || error.message,
        userId
      });
      throw error;
    }
  }

  // Send message to user
  async sendMessage(recipientId, text, quickReplies = null) {
    try {
      console.log('Sending message to', recipientId, ':', text);
      
      if (!recipientId || !text) {
        throw new Error('Missing required parameters');
      }

      const messagePayload = {
        recipient: { id: recipientId },
        message: { text }
      };

      if (quickReplies) {
        messagePayload.message.quick_replies = quickReplies;
      }

      const response = await axios.post(
        `https://graph.facebook.com/v13.0/me/messages`,
        messagePayload,
        {
          params: {
            access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Save outgoing message
      const chat = new Chat({
        platform: 'facebook',
        senderId: recipientId,
        message: text,
        direction: 'outgoing',
        timestamp: new Date(),
        metadata: {
          isDelivered: true,
          isRead: false,
          messageId: response.data.message_id
        }
      });
      
      await chat.save();
      console.log('Message sent and saved successfully');
      
      return response.data;
    } catch (error) {
      console.error('Error sending message:', {
        status: error.response?.status,
        errorCode: error.response?.data?.error?.code,
        message: error.response?.data?.error?.message || error.message,
        recipientId,
        text
      });
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId) {
    try {
      console.log('Fetching profile for user:', userId);
      const response = await axios.get(
        `https://graph.facebook.com/v13.0/${userId}?fields=name,first_name,last_name,profile_pic,gender&access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', {
        error: error.response?.data || error.message,
        userId
      });
      return null;
    }
  }
}

module.exports = new FacebookController();