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

  // Handle incoming messages
  async handleMessage(req, res) {
    try {
      if (!req.body || req.body.object !== 'page') {
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
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Process message with duplicate email handling
  async processMessage(senderPsid, message, pageId) {
    try {
      const user = await this.findOrCreateUser(senderPsid);
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);

      const newMessage = new Message({
        conversation: conversation._id,
        sender: user._id,
        content: {
          text: message.text,
          attachments: message.attachments?.map(att => ({
            type: att.type,
            url: att.payload?.url
          }))
        },
        platform: 'facebook',
        platformMessageId: message.mid,
        platformSenderId: senderPsid,
        platformRecipientId: pageId
      });

      await newMessage.save();
      await Conversation.findByIdAndUpdate(conversation._id, { lastMessage: new Date() });

      return newMessage;
    } catch (error) {
      console.error('Message processing error:', error);
      return null;
    }
  }

  // Handle duplicate emails gracefully
  async findOrCreateUser(facebookId) {
    try {
      // 1. Try by Facebook ID first
      let user = await User.findOne({ 'platformIds.facebook': facebookId });
      if (user) return user;

      // 2. Try by generated email
      user = await User.findOne({ email: `${facebookId}@facebook.local` });
      if (user) {
        if (!user.platformIds?.facebook) {
          user.platformIds = { ...user.platformIds, facebook: facebookId };
          await user.save();
        }
        return user;
      }

      // 3. Create new user
      user = new User({
        name: `FB-${facebookId}`,
        email: `${facebookId}@facebook.local`,
        platformIds: { facebook: facebookId },
        lastActive: new Date()
      });
      await user.save();
      return user;

    } catch (error) {
      console.error('User creation error:', error);
      return {
        _id: new mongoose.Types.ObjectId(),
        platformIds: { facebook: facebookId }
      };
    }
  }

  // Conversation handling (unchanged)
  async findOrCreateConversation(userId, pageId, senderPsid) {
    const conversationId = `${pageId}_${senderPsid}`;
    let conversation = await Conversation.findOne({ platformConversationId: conversationId });
    
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
  }

  // Postback and message sending methods (unchanged)
  async processPostback(senderPsid, postback, pageId) {
    const user = await this.findOrCreateUser(senderPsid);
    const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);
    
    const newMessage = new Message({
      conversation: conversation._id,
      sender: user._id,
      content: { text: `[POSTBACK] ${postback.payload}` },
      platform: 'facebook',
      metadata: { postback }
    });

    await newMessage.save();
    return newMessage;
  }

  async sendMessage(recipientPsid, text, conversationId, senderId) {
    const response = await axios.post(
      `https://graph.facebook.com/v13.0/me/messages`,
      {
        recipient: { id: recipientPsid },
        message: { text }
      },
      {
        params: { access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const newMessage = new Message({
      conversation: conversationId,
      sender: senderId,
      content: { text },
      platform: 'facebook',
      platformMessageId: response.data.message_id,
      platformRecipientId: recipientPsid
    });

    await newMessage.save();
    return newMessage;
  }
}

module.exports = new FacebookController();