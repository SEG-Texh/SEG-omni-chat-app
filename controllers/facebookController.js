const Conversation = require('../models/conversation');
const Message = require('../models/message');
const axios = require('axios');
const User = require('../models/user');


// Webhook for receiving Facebook messages from customers
exports.webhook = async (req, res) => {
    try {
      const body = req.body;
      let senderId, text;
      // Basic Facebook Messenger webhook format
      if (body.object === 'page' && body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const event of entry.messaging) {
              if (event.message && event.message.text) {
                senderId = event.sender.id;
                text = event.message.text;
              }
            }
          }
        }
      }
      if (!senderId || !text) {
        return res.status(400).json({ error: 'Invalid Facebook webhook payload' });
      }
      // Find SEGbot user
      const segbot = await User.findOne({ role: 'bot', name: '🤖 SEGbot' });
      if (!segbot) throw new Error('SEGbot user not found');
      // Check for active conversation
      let conversation = await Conversation.findOne({
        customerId: senderId,
        status: 'active',
        expiresAt: { $gt: new Date() },
        platform: 'facebook'
      });
      if (!conversation) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 35 * 60 * 1000);
        conversation = await Conversation.create({
          platform: 'facebook',
          platformConversationId: `${senderId}_${Date.now()}`,
          customerId: senderId,
          participants: [senderId],
          status: 'active',
          startTime: now,
          expiresAt
        });
        // Emit real-time event for new conversation
        try {
          const io = require('../config/socket').getIO();
          io.emit('new_conversation', { conversation });
        } catch (e) {
          console.error('[FB][Socket] Failed to emit new_conversation:', e);
        }
        // Send bot welcome message
        const botMsg = new Message({
          conversation: conversation._id,
          sender: segbot._id,
          content: { text: 'Hi, welcome! How may I help?' },
          platform: 'facebook',
          direction: 'outbound',
          platformMessageId: `fb_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        await botMsg.save();
        
        // Actually send the message to customer via Facebook API
        try {
          await exports.sendMessage(senderId, 'Hi, welcome! How may I help?');
        } catch (err) {
          console.error('[FB][Webhook] Failed to send welcome message to customer:', err);
        }
      }
      // Save inbound message
      let platformMessageId = null;
      if (body.MessageSid) {
        platformMessageId = body.MessageSid;
      } else if (body.object && body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const event of entry.messaging) {
              if (event.message && event.message.mid) {
                platformMessageId = event.message.mid;
              }
            }
          }
        }
      }
      if (!platformMessageId) {
        platformMessageId = `fb_in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      const messageDoc = new Message({
        conversation: conversation._id,
        sender: senderId,
        content: { text },
        platform: 'facebook',
        direction: 'inbound',
        platformMessageId
      });
      await messageDoc.save();
      // Bot logic: count customer messages in this conversation
      const customerMsgCount = await Message.countDocuments({ conversation: conversation._id, sender: senderId });
      if (customerMsgCount === 2) {
        // Second message from customer: ask about live agent
        const botMsg2 = new Message({
          conversation: conversation._id,
          sender: segbot._id,
          content: { text: 'Would you like to chat with a live person? Yes/No' },
          platform: 'facebook',
          direction: 'outbound',
          platformMessageId: `fb_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        await botMsg2.save();
        
        // Actually send the message to customer via Facebook API
        try {
          await exports.sendMessage(senderId, 'Would you like to chat with a live person? Yes/No');
        } catch (err) {
          console.error('[FB][Webhook] Failed to send escalation question to customer:', err);
        }
      } else if (customerMsgCount > 2) {
        // Check for escalation trigger
        const lastMsg = text.trim().toLowerCase();
        if (lastMsg === 'yes') {
          // Escalate: send bot message and notify agents/supervisors
          const botMsg3 = new Message({
            conversation: conversation._id,
            sender: segbot._id,
            content: { text: 'Connecting you to a live agent...' },
            platform: 'facebook',
            direction: 'outbound',
            platformMessageId: `fb_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          await botMsg3.save();
          
          // Actually send the message to customer via Facebook API
          try {
            await exports.sendMessage(senderId, 'Connecting you to a live agent...');
          } catch (err) {
            console.error('[FB][Webhook] Failed to send escalation message to customer:', err);
          }
          
          // Emit escalation notification (to agents/supervisors only)
          try {
            const io = require('../config/socket').getIO();
            const User = require('../models/user');
            const agents = await User.find({ role: { $in: ['agent', 'supervisor'] } });
            agents.forEach(agent => {
              io.to(agent._id.toString()).emit('escalation_request', {
                conversationId: conversation._id,
                customerId: senderId,
                platform: 'facebook',
                message: text
              });
            });
          } catch (e) {
            console.error('[FB][Socket] Failed to emit escalation_request:', e);
          }
        } else if (lastMsg === 'no') {
          // Customer declined escalation
          const botMsg4 = new Message({
            conversation: conversation._id,
            sender: segbot._id,
            content: { text: 'Okay, let me know if you need anything else!' },
            platform: 'facebook',
            direction: 'outbound',
            platformMessageId: `fb_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          await botMsg4.save();
          
          // Actually send the message to customer via Facebook API
          try {
            await exports.sendMessage(senderId, 'Okay, let me know if you need anything else!');
          } catch (err) {
            console.error('[FB][Webhook] Failed to send decline message to customer:', err);
          }
        }
      }
      res.sendStatus(200);
    } catch (error) {
      console.error('[FB][Webhook] Error handling Facebook message:', error);
      res.sendStatus(500);
    }
  }

// Send outbound Facebook message using Graph API
exports.sendMessage = async (recipientId, text) => {
  try {
    if (!recipientId || !text) {
      throw new Error('recipientId and text are required');
    }
    
    if (!process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      console.warn('FACEBOOK_PAGE_ACCESS_TOKEN not configured, skipping actual send');
      return { status: 'success', message: 'Token not configured' };
    }
    
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: text }
      }
    );
    return { status: 'success' };
  } catch (error) {
    console.error('Send message error:', error);
    throw new Error('Failed to send Facebook message');
  }
};

// List messages for a Facebook conversation
exports.listMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({
      conversation: conversationId,
      platform: 'facebook'
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    console.error('[FB][listMessages] Error:', error);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
};
