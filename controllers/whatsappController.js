const axios = require('axios');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const User = require('../models/user');

class WhatsAppController {
  // Webhook for receiving WhatsApp messages from customers
  async handleMessage(req, res) {
    try {
      // Assume Twilio or Meta webhook payload
      const body = req.body;
      let phoneNumber, text;
      // Twilio format
      if (body && body.WaId && body.Body) {
        phoneNumber = body.WaId;
        text = body.Body;
      } else if (body.object && body.entry) {
        // Meta format
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value.messages) {
              phoneNumber = change.value.contacts[0].wa_id;
              text = change.value.messages[0].text.body;
            }
          }
        }
      }
      if (!phoneNumber || !text) {
        return res.status(400).json({ error: 'Invalid WhatsApp webhook payload' });
      }
      // Find SEGbot user
      const segbot = await User.findOne({ role: 'bot', name: '🤖 SEGbot' });
      if (!segbot) throw new Error('SEGbot user not found');
      // Check for active conversation
      let conversation = await Conversation.findOne({
        customerId: phoneNumber,
        status: 'active',
        expiresAt: { $gt: new Date() },
        platform: 'whatsapp'
      });
      if (!conversation) {
        // Create new conversation (reuse POST /api/conversation logic)
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 35 * 60 * 1000);
        conversation = await Conversation.create({
          platform: 'whatsapp',
          platformConversationId: `${phoneNumber}_${Date.now()}`,
          customerId: phoneNumber,
          participants: [phoneNumber],
          status: 'active',
          startTime: now,
          expiresAt
        });
        // Emit real-time event for new conversation
        try {
          const io = require('../config/socket').getIO();
          io.emit('new_conversation', { conversation });
        } catch (e) {
          console.error('[WA][Socket] Failed to emit new_conversation:', e);
        }
        // Send bot welcome message
        const botMsg = new Message({
          conversation: conversation._id,
          sender: segbot._id,
          content: { text: 'Hi, welcome! How may I help?' },
          platform: 'whatsapp',
          direction: 'outbound',
          platformMessageId: `wa_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        await botMsg.save();
      }
      // Save inbound message
      // Always set a unique platformMessageId for inbound messages
      let platformMessageId = null;
      if (body.MessageSid) {
        platformMessageId = body.MessageSid;
      } else if (body.object && body.entry) {
        // Try to extract from Meta payload if present
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.value.messages && change.value.messages[0]?.id) {
              platformMessageId = change.value.messages[0].id;
            }
          }
        }
      }
      if (!platformMessageId) {
        platformMessageId = `wa_in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      const messageDoc = new Message({
        conversation: conversation._id,
        sender: phoneNumber,
        content: { text },
        platform: 'whatsapp',
        direction: 'inbound',
        platformMessageId
      });
      await messageDoc.save();
      // Bot logic: count customer messages in this conversation
      const customerMsgCount = await Message.countDocuments({ conversation: conversation._id, sender: phoneNumber });
      if (customerMsgCount === 2) {
        // Second message from customer: ask about live agent
        const botMsg2 = new Message({
          conversation: conversation._id,
          sender: segbot._id,
          content: { text: 'Would you like to chat with a live person? Yes/No' },
          platform: 'whatsapp',
          direction: 'outbound',
          platformMessageId: `wa_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        await botMsg2.save();
      } else if (customerMsgCount > 2) {
        // Check for escalation trigger
        const lastMsg = text.trim().toLowerCase();
        if (lastMsg === 'yes') {
          // Escalate: send bot message and notify agents/supervisors
          const botMsg3 = new Message({
            conversation: conversation._id,
            sender: segbot._id,
            content: { text: 'Connecting you to a live agent...' },
            platform: 'whatsapp',
            direction: 'outbound',
            platformMessageId: `wa_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          await botMsg3.save();
          // Emit escalation notification (to agents/supervisors only)
          try {
            const io = require('../config/socket').getIO();
            const agents = await User.find({ role: { $in: ['agent', 'supervisor'] } });
            agents.forEach(agent => {
              io.to(agent._id.toString()).emit('escalation_request', {
                conversationId: conversation._id,
                customerId: phoneNumber,
                platform: 'whatsapp',
                message: text
              });
            });
          } catch (e) {
            console.error('[WA][Socket] Failed to emit escalation_request:', e);
          }
        } else if (lastMsg === 'no') {
          // Customer declined escalation
          const botMsg4 = new Message({
            conversation: conversation._id,
            sender: segbot._id,
            content: { text: 'Okay, let me know if you need anything else!' },
            platform: 'whatsapp',
            direction: 'outbound',
            platformMessageId: `wa_bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
          await botMsg4.save();
        }
      }
      res.sendStatus(200);
    } catch (error) {
      console.error('[WA][Webhook] Error handling WhatsApp message:', error);
      res.sendStatus(500);
    }
  }

  // Send outbound WhatsApp message to customer using Twilio
  async sendMessage(phoneNumber, text) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
        ? process.env.TWILIO_WHATSAPP_NUMBER
        : `whatsapp:+${process.env.TWILIO_WHATSAPP_NUMBER.replace(/[^\d]/g, '')}`;
      const toNumber = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
      const client = require('twilio')(accountSid, authToken);
      const response = await client.messages.create({
        from: fromNumber,
        to: toNumber,
        body: text
      });
      console.log('[WA][Twilio] Sent WhatsApp message to', phoneNumber, 'SID:', response.sid);
      return response;
    } catch (error) {
      console.error('[WA][Twilio] Failed to send WhatsApp message:', error.message || error);
      throw error;
    }
  }
}

module.exports = new WhatsAppController();