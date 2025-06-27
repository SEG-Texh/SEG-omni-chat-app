const axios = require('axios');
const mongoose = require('mongoose');
const Message = require('../models/message');
const User = require('../models/User');
const Conversation = require('../models/conversation');

class FacebookController {
  constructor() {
    // Bind all methods
    this.verifyWebhook = this.verifyWebhook.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.processPostback = this.processPostback.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.findOrCreateUser = this.findOrCreateUser.bind(this);
    this.findOrCreateConversation = this.findOrCreateConversation.bind(this);
  }

  // Verify webhook
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Facebook webhook verified');
      return res.status(200).send(challenge);
    }
    
    console.error('❌ Facebook webhook verification failed');
    return res.sendStatus(403);
  }

  // Handle incoming webhook events
  async handleMessage(req, res) {
    try {
      console.log('=== INCOMING FACEBOOK WEBHOOK ===');
      
      if (!req.body || req.body.object !== 'page' || !Array.isArray(req.body.entry)) {
        console.error('Invalid request format');
        return res.status(400).json({ error: 'Invalid request format' });
      }

      // Process each entry
      for (const entry of req.body.entry) {
        if (!Array.isArray(entry.messaging)) continue;
        
        for (const event of entry.messaging) {
          try {
            if (event.message) {
              await this.processMessage(
                event.sender.id,
                event.message,
                event.recipient.id
              );
            } else if (event.postback) {
              await this.processPostback(
                event.sender.id,
                event.postback,
                event.recipient.id
              );
            }
          } catch (error) {
            console.error('Error processing event:', {
              error: error.message,
              event
            });
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('❌ Error in handleMessage:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Process incoming message
  async processMessage(senderPsid, message, pageId) {
    try {
      console.log(`📩 Processing message from ${senderPsid}`);
      
      // 1. Find or create basic user record
      const user = await this.findOrCreateUser(senderPsid);
      
      // 2. Find or create conversation
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);
      
      // 3. Create and save message
      const newMessage = new Message({
        conversation: conversation._id,
        sender: user._id,
        content: {
          text: message.text,
          attachments: message.attachments?.map(att => ({
            url: att.payload?.url,
            type: att.type
          }))
        },
        platform: 'facebook',
        status: 'delivered',
        platformMessageId: message.mid,
        platformSenderId: senderPsid,
        platformRecipientId: pageId
      });

      await newMessage.save();
      console.log(`💾 Message saved: ${newMessage._id}`);

      // 4. Update conversation last message
      await Conversation.findByIdAndUpdate(conversation._id, {
        lastMessage: new Date()
      });

      return newMessage;
    } catch (error) {
      console.error('❌ Error in processMessage:', error);
      throw error;
    }
  }

  // Process postback
  async processPostback(senderPsid, postback, pageId) {
    try {
      console.log(`🔄 Processing postback from ${senderPsid}: ${postback.payload}`);
      
      // 1. Find or create basic user record
      const user = await this.findOrCreateUser(senderPsid);
      
      // 2. Find or create conversation
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);
      
      // 3. Save postback as message
      const newMessage = new Message({
        conversation: conversation._id,
        sender: user._id,
        content: {
          text: `[POSTBACK] ${postback.payload}`
        },
        platform: 'facebook',
        status: 'delivered',
        platformSenderId: senderPsid,
        platformRecipientId: pageId,
        metadata: {
          postback: postback
        }
      });

      await newMessage.save();
      return newMessage;
    } catch (error) {
      console.error('❌ Error processing postback:', error);
      throw error;
    }
  }

  // Send message to user
  async sendMessage(recipientPsid, text, conversationId, senderId, quickReplies = null) {
    try {
      console.log(`✉️ Sending message to ${recipientPsid}: ${text.substring(0, 30)}...`);
      
      const messagePayload = {
        recipient: { id: recipientPsid },
        message: { text }
      };

      if (quickReplies) {
        messagePayload.message.quick_replies = quickReplies;
      }

      const response = await axios.post(
        `https://graph.facebook.com/v13.0/me/messages`,
        messagePayload,
        {
          params: { access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN },
          headers: { 'Content-Type': 'application/json' }
        }
      );

      // Save outgoing message
      const newMessage = new Message({
        conversation: conversationId,
        sender: senderId,
        content: { text },
        platform: 'facebook',
        status: 'sent',
        platformMessageId: response.data.message_id,
        platformRecipientId: recipientPsid
      });

      await newMessage.save();
      return newMessage;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  // Simple user creation without profile
  async findOrCreateUser(facebookId) {
    try {
      let user = await User.findOne({ 'platformIds.facebook': facebookId });
      
      if (!user) {
        user = new User({
          name: `User-${facebookId}`,
          email: `${facebookId}@facebook.local`,
          platformIds: { facebook: facebookId },
          lastActive: new Date()
        });
        await user.save();
      }
      
      return user;
    } catch (error) {
      console.error('❌ Error in findOrCreateUser:', error);
      throw error;
    }
  }

  // Find or create conversation
  async findOrCreateConversation(userId, pageId, senderPsid) {
    try {
      const conversationId = `${pageId}_${senderPsid}`;
      
      let conversation = await Conversation.findOne({
        platformConversationId: conversationId
      });
      
      if (!conversation) {
        conversation = new Conversation({
          participants: [userId],
          platform: 'facebook',
          platformConversationId: conversationId,
          lastMessage: new Date()
        });
        await conversation.save();
      }
      
      return conversation;
    } catch (error) {
      console.error('❌ Error in findOrCreateConversation:', error);
      throw error;
    }
  }
}

module.exports = new FacebookController();