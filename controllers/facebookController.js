const axios = require('axios');
const mongoose = require('mongoose');
const Message = require('../models/message');
const User = require('../models/User');
const Conversation = require('../models/conversation');

class FacebookController {
  constructor() {
    // Method binding
    this.verifyWebhook = this.verifyWebhook.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.processPostback = this.processPostback.bind(this);
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
      console.log(`Processing message from ${senderPsid}`);
      
      const user = await this.findOrCreateUser(senderPsid);
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);

      const messageData = {
        conversation: conversation._id,
        sender: user._id,
        content: { text: message.text },
        platform: 'facebook',
        platformMessageId: message.mid,
        platformSenderId: senderPsid,
        platformRecipientId: pageId,
        status: 'received',
        direction: 'inbound' // Added direction field
      };

      if (message.attachments) {
        messageData.content.attachments = message.attachments.map(att => ({
          type: att.type,
          url: att.payload?.url,
          name: att.payload?.name || null
        }));
      }

      const newMessage = await Message.create(messageData);
      
      // Update conversation with last message and increment unread count if needed
      await Conversation.updateOne(
        { _id: conversation._id },
        { 
          $set: { lastMessage: new Date() },
          $inc: { unreadCount: 1 } // Track unread messages
        }
      );

      // Emit real-time event if using socket.io
      if (this.io) {
        const populatedMessage = await Message.findById(newMessage._id)
          .populate('sender', 'name profilePic');
        this.io.to(`conversation_${conversation._id}`).emit('new_message', populatedMessage);
      }

      return newMessage;
    } catch (error) {
      console.error('❌ Message processing failed:', error.message);
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
          roles: ['customer']
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
      const conversationId = `${pageId}_${senderPsid}`;
      let conversation = await Conversation.findOne({ platformConversationId: conversationId })
        .populate('participants', 'name profilePic');

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [userId],
          platform: 'facebook',
          platformConversationId: conversationId,
          lastMessage: new Date(),
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
        { $set: { lastMessage: new Date() } }
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

      // Find or create a conversation between the logged-in user and the Facebook recipient
      let conversation = await Conversation.findOne({
        platform: 'facebook',
        participants: { $all: [senderId], $size: 2 },
        platformConversationId: { $regex: `${recipientPsid}|${senderId}` }
      });
      if (!conversation) {
        // Create a new conversation with both participants
        conversation = await Conversation.create({
          participants: [senderId, recipientPsid],
          platform: 'facebook',
          platformConversationId: `${senderId}_${recipientPsid}`,
          lastMessage: new Date(),
          labels: ['facebook-inbox'],
          status: 'active'
        });
      }

      // Create pending message first
      const pendingMessage = await Message.create({
        conversation: conversation._id,
        sender: senderId,
        content: { text },
        platform: 'facebook',
        platformRecipientId: recipientPsid,
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
          { _id: pendingMessage._id },
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
          { $set: { lastMessage: new Date() } }
        );

        // Return populated message for real-time updates
        const sentMessage = await Message.findById(pendingMessage._id)
          .populate('sender', 'name profilePic');

        // Emit real-time event if using socket.io
        if (this.io) {
          this.io.to(`conversation_${conversation._id}`).emit('new_message', sentMessage);
        }

        return sentMessage;
      } catch (error) {
        // Update message with error status if send fails
        await Message.updateOne(
          { _id: pendingMessage._id },
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
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid conversation ID' });
      }

      // Verify user has access to this conversation
      const conversation = await Conversation.findOne({
        _id: req.params.id
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const messages = await Message.find({
        conversation: req.params.id
      })
      .populate('sender', 'name profilePic')
      .sort('timestamp')
      .lean();

      // Mark conversation as read if viewing messages
      if (req.user.roles.includes('agent') || req.user.roles.includes('admin')) {
        await Conversation.updateOne(
          { _id: req.params.id },
          { $set: { unreadCount: 0 } }
        );
      }

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