const axios = require('axios');
const mongoose = require('mongoose');
const Message = require('../models/message');
const User = require('../models/User');
const Conversation = require('../models/conversation');

let currentFacebookConversationId = null;

class FacebookController {
  constructor() {
    // Method binding
    this.verifyWebhook = this.verifyWebhook.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.processPostback = this.processPostback.bind(this);
    this.io = null;
    this.sendMessage = this.sendMessage.bind(this);
    this.findOrCreateUser = this.findOrCreateUser.bind(this);
    this.findOrCreateConversation = this.findOrCreateConversation.bind(this);
    this.getConversations = this.getConversations.bind(this);
    this.getMessages = this.getMessages.bind(this);
  }

  // Webhook verification (unchanged)
  async verifyWebhook(req, res) {
    try {
      const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
      
      if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return res.status(200).send(challenge);
      }
      
      console.error('❌ Verification failed');
      return res.sendStatus(403);
    } catch (error) {
      console.error('Verify webhook error:', error);
      return res.sendStatus(500);
    }
  }

  // Main message handler (unchanged)
  async handleMessage(req, res) {
    try {
      console.log('📩 Incoming webhook');
      
      if (!req.body?.object === 'page') {
        return res.status(400).json({ error: 'Invalid request format' });
      }

      for (const entry of req.body.entry) {
        if (!entry.messaging) continue;
        
        for (const event of entry.messaging) {
          try {
            if (event.message) {
              await this.processMessage(event.sender.id, event.message, event.recipient.id);
            } else if (event.postback) {
              await this.processPostback(event.sender.id, event.postback, event.recipient.id);
            }
          } catch (error) {
            console.error('Event processing error:', error.message);
          }
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Enhanced processMessage with message direction
  async processMessage(senderPsid, message, pageId) {
    try {
      const user = await this.findOrCreateUser(senderPsid);
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);

      const messageData = {
        conversation: conversation._id,
        sender: user._id,
        content: { text: message.text },
        platform: 'facebook',
        direction: 'inbound',
        status: 'received'
      };

      if (message.attachments) {
        messageData.content.attachments = message.attachments.map(att => ({
          type: att.type,
          url: att.payload?.url
        }));
      }

      const newMessage = await Message.create(messageData);
      
      await Conversation.updateOne(
        { _id: conversation._id },
        { 
          $set: { lastMessage: newMessage._id },
          $inc: { unreadCount: 1 }
        }
      );

      // Enhanced real-time emission
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'name profilePic')
        .lean();

      if (this.io) {
        // Emit to conversation room
        this.io.to(`conversation_${conversation._id}`).emit('new_message', populatedMessage);
        
        // Emit to user's personal room for notifications
        this.io.to(`user_${user._id}`).emit('message_notification', {
          conversationId: conversation._id,
          message: populatedMessage
        });
      }

      return populatedMessage;
    } catch (error) {
      console.error('Message processing failed:', error);
      return null;
    }
  }
  // Enhanced user creation with better error handling
  async findOrCreateUser(facebookId) {
    try {
      const email = `${facebookId}@facebook.local`;

      let user = await User.findOne({
        $or: [
          { 'platformIds.facebook': facebookId },
          { email: email }
        ]
      }).select('+platformIds');

      if (!user) {
        const profile = await this.getUserProfile(facebookId);

        user = new User({
          name: profile?.name || `Facebook User ${facebookId}`,
          email,
          platformIds: { facebook: facebookId },
          profilePic: profile?.profile_pic || null,
          lastActive: new Date(),
          roles: ['customer'],
          type: 'platform'
        });

        await user.save();
        console.log(`👤 Created new user: ${user._id}`);
      }

      return user;
    } catch (error) {
      console.error('⚠️ User creation fallback:', error.message);
      // Create a minimal user if all else fails
      return new User({
        name: `Facebook User ${facebookId}`,
        email: `${facebookId}@facebook.local`,
        platformIds: { facebook: facebookId },
        lastActive: new Date(),
        roles: ['customer']
      }).save();
    }
  }

  // Enhanced conversation management with labels and status
  async findOrCreateConversation(userId, pageId, senderPsid) {
    try {
      // Use consistent format: pageId_recipientPsid
      const conversationId = `${pageId}_${senderPsid}`;
      let conversation = await Conversation.findOne({ platformConversationId: conversationId })
        .populate('participants', 'name profilePic');

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [userId],
          platform: 'facebook',
          platformConversationId: conversationId,
          labels: ['facebook-inbox'], // Default label
          status: 'active'
        });
      }

      return conversation;
    } catch (error) {
      console.error('❌ Conversation error:', error);
      throw error;
    }
  }

  // Postback handler (unchanged)
  async processPostback(senderPsid, postback, pageId) {
    try {
      console.log(`🔄 Postback from ${senderPsid}`);
      
      const user = await this.findOrCreateUser(senderPsid);
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);
      
      const newMessage = await Message.create({
        conversation: conversation._id,
        sender: user._id,
        content: { text: `[POSTBACK] ${postback.payload}` },
        platform: 'facebook',
        metadata: { postback },
        status: 'received',
        direction: 'inbound'
      });

      await Conversation.updateOne(
        { _id: conversation._id },
        { $set: { lastMessage: newMessage._id } }
      );

      return newMessage;
    } catch (error) {
      console.error('❌ Postback processing failed:', error);
      return null;
    }
  }

  // Enhanced sendMessage with better error handling and status tracking
  async sendMessage(recipientPsid, text, conversationId, senderId) {
    try {
      console.log(`✉️ Sending to ${recipientPsid}`);

      let conversation;
      
      // If conversationId is provided, try to use that conversation first
      if (conversationId) {
        conversation = await Conversation.findById(conversationId);
        if (conversation) {
          console.log(`Using existing conversation: ${conversationId}`);
        }
      }
      
      // If no conversation found, create or find one using consistent format
      if (!conversation) {
        // Get the page ID from the Facebook API to ensure consistency
        let pageId;
        try {
          const pageResponse = await axios.get(
            `https://graph.facebook.com/me`,
            {
              params: { access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN },
              timeout: 5000
            }
          );
          pageId = pageResponse.data.id;
        } catch (error) {
          console.error('Failed to get page ID, using environment variable:', error.message);
          pageId = process.env.FACEBOOK_PAGE_ID;
        }

        // Use the same conversation ID format as incoming messages: pageId_recipientPsid
        const conversationIdToUse = `${pageId}_${recipientPsid}`;
        
        // Find or create a conversation using the same format as incoming messages
        conversation = await Conversation.findOne({
          platform: 'facebook',
          platformConversationId: conversationIdToUse
        });
        
        if (!conversation) {
          // Create a new conversation with only the sender as participant
          conversation = await Conversation.create({
            participants: [senderId],
            platform: 'facebook',
            platformConversationId: conversationIdToUse,
            labels: ['facebook-inbox'],
            status: 'active'
          });
        }
      }

      // Create pending message first
      const newMessage = await Message.create({
        conversation: conversation._id,
        sender: senderId,
        content: { text },
        platform: 'facebook',
        platformRecipientId: recipientPsid,
        platformMessageId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending',
        direction: 'outbound'
      });

      let response;
      try {
        response = await axios.post(
          `https://graph.facebook.com/v13.0/me/messages`,
          {
            recipient: { id: recipientPsid },
            message: { text }
          },
          {
            params: { access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN },
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // Increased timeout
          }
        );

        // Update message with platform ID and sent status
        await Message.updateOne(
          { _id: newMessage._id },
          { 
            $set: { 
              platformMessageId: response.data.message_id,
              status: 'sent',
              timestamp: new Date() 
            } 
          }
        );

        // Update conversation last message
        await Conversation.updateOne(
          { _id: conversation._id },
          { $set: { lastMessage: newMessage._id } }
        );

        // Return populated message for real-time updates
        const sentMessage = await Message.findById(newMessage._id)
          .populate('sender', 'name profilePic');

        // Emit real-time event if using socket.io
        if (this.io) {
          this.io.to(`conversation_${conversation._id}`).emit('new_message', sentMessage);
        }

        return sentMessage;
      } catch (error) {
        // Update message with error status if send fails
        await Message.updateOne(
          { _id: newMessage._id },
          { 
            $set: { 
              status: 'failed',
              error: error.response?.data || error.message 
            } 
          }
        );
        throw error;
      }
    } catch (error) {
      console.error('❌ Message send failed:', error.response?.data || error.message);
      throw error;
    }
  }

  // New method: Get conversations for API endpoint
  async getConversations(req, res) {
    try {
      const { status, label } = req.query;
      // Show all Facebook conversations to all users
      const query = {
        platform: 'facebook'
      };

      if (status) query.status = status;
      if (label) query.labels = label;

      const conversations = await Conversation.find(query)
        .populate('participants', 'name profilePic')
        .sort('-lastMessage')
        .lean();

      res.json(conversations);
    } catch (error) {
      console.error('Error getting conversations:', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  }

  // New method: Get messages for API endpoint
  async getMessages(req, res) {
    try {
      const id = req.params.id || req.params.conversationId;
      console.log('Requested conversation ID:', id);

      let conversation;
      if (mongoose.Types.ObjectId.isValid(id)) {
        conversation = await Conversation.findById(id);
      }
      if (!conversation) {
        conversation = await Conversation.findOne({ platformConversationId: id });
      }
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const messages = await Message.find({
        conversation: conversation._id
      })
      .populate('sender', 'name profilePic')
      .sort('timestamp')
      .lean();

      res.json(messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }

  // Helper method: Get user profile from Facebook
  async getUserProfile(userId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/${userId}`,
        {
          params: {
            fields: 'name,profile_pic',
            access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
          },
          timeout: 5000
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Facebook profile:', error.message);
      return null;
    }
  }

  // Method to inject socket.io instance
  setSocketIO(io) {
    this.io = io;
  }
}

module.exports = new FacebookController();