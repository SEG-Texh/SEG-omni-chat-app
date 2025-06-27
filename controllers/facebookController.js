const axios = require('axios');
const mongoose = require('mongoose');
const Message = require('../models/message');
const User = require('../models/User');
const Conversation = require('../models/conversation');

class FacebookController {
  constructor() {
    // Proper method binding without duplicates
    this.verifyWebhook = this.verifyWebhook.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.processMessage = this.processMessage.bind(this);
    this.processPostback = this.processPostback.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.findOrCreateUser = this.findOrCreateUser.bind(this);
    this.findOrCreateConversation = this.findOrCreateConversation.bind(this);
  }

  // Webhook verification
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

  // Main message handler
  async handleMessage(req, res) {
    try {
      console.log('📩 Incoming webhook');
      
      if (!req.body?.object === 'page') {
        return res.status(400).json({ error: 'Invalid request format' });
      }

      // Process entries sequentially to maintain order
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

  // Process messages
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
        { $set: { lastMessage: new Date() } }
      );

      return newMessage;
    } catch (error) {
      console.error('❌ Message processing failed:', error.message);
      return null;
    }
  }

  // User management
  async findOrCreateUser(facebookId) {
  try {
    const email = `${facebookId}@facebook.local`;

    // Try to find user by platform ID or email
    let user = await User.findOne({
      $or: [
        { 'platformIds.facebook': facebookId },
        { email: email }
      ]
    });

    if (!user) {
      // Fetch Facebook profile (optional)
      const profile = await this.getUserProfile(facebookId);

      user = new User({
        name: profile?.name || `Facebook User ${facebookId}`,
        email,
        platformIds: { facebook: facebookId },
        profilePic: profile?.profile_pic || null,
        lastActive: new Date()
      });

      await user.save();
      console.log(`👤 Created new user: ${user._id}`);
    }

    return user;
  } catch (error) {
    console.error('⚠️ User creation fallback:', error.message);
    throw error;
  }
}


  // Conversation management
  async findOrCreateConversation(userId, pageId, senderPsid) {
    try {
      const conversationId = `${pageId}_${senderPsid}`;
      let conversation = await Conversation.findOne({ platformConversationId: conversationId });
      
      if (!conversation) {
        conversation = await Conversation.create({
          participants: [userId],
          platform: 'facebook',
          platformConversationId: conversationId,
          lastMessage: new Date()
        });
      }
      
      return conversation;
    } catch (error) {
      console.error('❌ Conversation error:', error);
      throw error;
    }
  }

  // Postback handler
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
        status: 'received'
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

  // Message sending
  async sendMessage(recipientPsid, text, conversationId, senderId) {
    try {
      console.log(`✉️ Sending to ${recipientPsid}`);
      
      const response = await axios.post(
        `https://graph.facebook.com/v13.0/me/messages`,
        {
          recipient: { id: recipientPsid },
          message: { text }
        },
        {
          params: { access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN },
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        }
      );

      await Message.create({
        conversation: conversationId,
        sender: senderId,
        content: { text },
        platform: 'facebook',
        platformMessageId: response.data.message_id,
        platformRecipientId: recipientPsid,
        status: 'sent'
      });

      return true;
    } catch (error) {
      console.error('❌ Message send failed:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = new FacebookController();