const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/message');
const Conversation = require('../models/conversation');

class FacebookController {
  constructor() {
    this.verifyWebhook = this.verifyWebhook.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

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

  async handleMessage(req, res) {
    try {
      if (req.body.object !== 'page') {
        return res.status(400).json({ error: 'Invalid request format' });
      }

      for (const entry of req.body.entry) {
        if (!entry.messaging) continue;
        
        for (const event of entry.messaging) {
          if (event.message) {
            await this.processMessage(event.sender.id, event.message, event.recipient.id);
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async processMessage(senderPsid, message, pageId) {
    try {
      const user = await this.findOrCreateUser(senderPsid);
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);

      const newMessage = new Message({
        conversation: conversation._id,
        sender: user._id,
        content: { text: message.text },
        platform: 'facebook',
        status: 'delivered',
        platformMessageId: message.mid,
        platformSenderId: senderPsid,
        platformRecipientId: pageId
      });

      await newMessage.save();
      await Conversation.findByIdAndUpdate(conversation._id, { lastMessage: new Date() });
      
      return newMessage;
    } catch (error) {
      console.error('Message processing failed:', error);
      return null;
    }
  }

  async findOrCreateUser(facebookId) {
    try {
      let user = await User.findOne({ facebookId });
      if (!user) {
        user = new User({
          name: `FB-${facebookId}`,
          facebookId,
          role: 'user'
        });
        await user.save();
      }
      return user;
    } catch (error) {
      console.error('User creation error:', error);
      return { _id: new mongoose.Types.ObjectId(), facebookId };
    }
  }

  async findOrCreateConversation(userId, pageId, senderPsid) {
    const conversationId = `fb_${pageId}_${senderPsid}`;
    let conversation = await Conversation.findOne({ platformConversationId: conversationId });
    
    if (!conversation) {
      conversation = new Conversation({
        participants: [userId],
        platform: 'facebook',
        platformConversationId: conversationId
      });
      await conversation.save();
    }
    
    return conversation;
  }
}

module.exports = new FacebookController();