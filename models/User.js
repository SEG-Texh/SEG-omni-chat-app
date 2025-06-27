const mongoose = require('mongoose');
const Message = require('../models/message');
const User = require('../models/User');
const Conversation = require('../models/conversation');

class FacebookController {
  // ... (other methods remain the same)

  async findOrCreateUser(facebookId) {
    try {
      // First try to find by facebookId field
      let user = await User.findOne({ facebookId });
      
      if (!user) {
        // Try to find by platform ID if using different schema
        user = await User.findOne({ 'platformIds.facebook': facebookId });
      }

      if (!user) {
        // Create new user with consistent but non-unique email
        user = await User.create({
          name: `FB-${facebookId}`,
          email: `fb-${facebookId}@facebook.local`,  // Non-unique pattern
          facebookId: facebookId,
          role: 'user',
          isOnline: false,
          lastSeen: new Date()
        });
      }

      return user;
    } catch (error) {
      console.error('User creation fallback:', error.message);
      // Fallback minimal user object
      return {
        _id: new mongoose.Types.ObjectId(),
        name: `FB-${facebookId}`,
        facebookId: facebookId
      };
    }
  }

  async findOrCreateConversation(userId, pageId, senderPsid) {
    try {
      // Consistent conversation ID generation
      const conversationId = `fbconv-${pageId}-${senderPsid}`;
      
      // Atomic findOrCreate operation
      const conversation = await Conversation.findOneAndUpdate(
        { platformConversationId: conversationId },
        { 
          $setOnInsert: {
            participants: [userId],
            platform: 'facebook',
            platformConversationId: conversationId
          },
          $set: { lastMessage: new Date() }
        },
        { 
          upsert: true,
          new: true 
        }
      );

      return conversation;
    } catch (error) {
      console.error('Conversation error:', error);
      throw error;
    }
  }

  async processMessage(senderPsid, message, pageId) {
    try {
      const user = await this.findOrCreateUser(senderPsid);
      const conversation = await this.findOrCreateConversation(user._id, pageId, senderPsid);

      const messageData = {
        conversation: conversation._id,
        sender: user._id,
        content: { text: message.text },
        platform: 'facebook',
        status: 'delivered',
        platformMessageId: message.mid,
        platformSenderId: senderPsid,
        platformRecipientId: pageId
      };

      if (message.attachments) {
        messageData.content.attachments = message.attachments.map(att => ({
          type: att.type,
          url: att.payload?.url
        }));
      }

      const newMessage = await Message.create(messageData);
      return newMessage;
    } catch (error) {
      console.error('Message processing failed:', error);
      return null;
    }
  }
}

module.exports = new FacebookController();