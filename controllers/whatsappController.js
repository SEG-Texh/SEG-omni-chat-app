const axios = require('axios');
const Chat = require('../models/message');
const mongoose = require('mongoose');

class WhatsAppController {
  // Verify webhook
  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified');
      return res.status(200).send(challenge);
    }
    
    console.error('WhatsApp webhook verification failed');
    return res.sendStatus(403);
  }

  // Handle incoming messages
  async handleMessage(req, res) {
    try {
      const body = req.body;
      console.log('[WA][Webhook] Received webhook:', JSON.stringify(body));

      // Twilio WhatsApp Sandbox payload support
      if (body && body.WaId && body.Body) {
        const { sendCustomTwilioReply } = require('./twilioXml');
        const phoneNumber = body.WaId;
        const message = {
          type: 'text',
          text: { body: body.Body },
          id: body.MessageSid
        };
        console.log('[WA][Webhook][Twilio] Processing Twilio WhatsApp message:', { phoneNumber, message });
        await this.processMessage(phoneNumber, message);
        // Respond with empty TwiML to suppress Twilio's default 'OK' reply
        return sendCustomTwilioReply(res, '');
      }
      
      if (body.object && body.entry) {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value.messages) {
              const message = change.value.messages[0];
              const phoneNumber = change.value.contacts[0].wa_id;
              console.log('[WA][Webhook] Processing message:', { phoneNumber, message });
              await this.processMessage(phoneNumber, message);
            }
          }
        }
      } else {
        console.warn('[WA][Webhook] Unexpected webhook shape:', JSON.stringify(body));
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('[WA][Webhook] Error handling WhatsApp message:', error);
      res.sendStatus(500);
    }
  }

  // Process incoming message
  async processMessage(phoneNumber, message) {
    try {
      let text = '';
      let responseTo = null;
      let responseTime = null;
      console.log('[WA][Process] Incoming message object:', message);
  
      if (message.type === 'text') {
        text = message.text.body;
      } else if (message.type === 'interactive') {
        text = message.interactive.button_reply?.title || 
               message.interactive.list_reply?.title || 
               'Interactive message received';
      }
      console.log('[WA][Process] Parsed text:', text);
  
      // If this message is a reply, calculate response time
      if (message.context && message.context.id) {
        responseTo = message.context.id;
        const originalMessage = await Chat.findOne({ _id: responseTo });
        if (originalMessage) {
          responseTime = Date.now() - new Date(originalMessage.createdAt).getTime();
        }
      }
  
      // Find or create User
      const User = require('../models/User');
      let user = await User.findOne({
        $or: [
          { 'platformIds.whatsapp': phoneNumber },
          { email: `${phoneNumber}@whatsapp.local` }
        ]
      });
      if (!user) {
        user = await User.create({
          name: `WhatsApp User ${phoneNumber}`,
          email: `${phoneNumber}@whatsapp.local`,
          type: 'platform',
          platformIds: { whatsapp: phoneNumber },
          roles: ['customer']
        });
        console.log('[WA][Process] Created new user:', user);
      } else {
        console.log('[WA][Process] Found user:', user);
      }
  
      // Find or create Conversation
      const Conversation = require('../models/conversation');
      let conversation = await Conversation.findOne({
        platform: 'whatsapp',
        platformConversationId: phoneNumber
      });
      if (!conversation) {
        conversation = await Conversation.create({
          participants: [user._id],
          platform: 'whatsapp',
          platformConversationId: phoneNumber,
          customerId: phoneNumber,
          status: 'active'
        });
        console.log('[WA][Process] Created new conversation:', conversation);
      } else {
        console.log('[WA][Process] Found conversation:', conversation);
      }
  
      // Always set a unique platformMessageId
      const platformMessageId =
        (message.id) ||
        `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('[WA][Process] platformMessageId:', platformMessageId);
  
      // Save to database
      // Save content as { text } object for consistency with outbound messages
      let chatContent = typeof text === 'string' ? { text } : text;
      const chat = new Chat({
        conversation: conversation._id,
        sender: user._id,
        content: chatContent,
        platform: 'whatsapp',
        direction: 'inbound',
        responseTo: responseTo,
        responseTime: responseTime,
        platformMessageId
      });
      await chat.save();
      console.log('[WA][Process] Saved chat message:', chat);
  
      // Emit real-time event after saving
      const io = require('../config/socket').getIO();
      console.log('[WA][Process] Emitting new_message to room:', `conversation_${conversation._id}`);
      io.to(`conversation_${conversation._id}`).emit('new_message', {
        ...chat.toObject(),
        platform: 'whatsapp',
      });
       // --- BOT/SESSION FLOW LOGIC ---
      // Count number of inbound messages in this conversation
      const inboundCount = await Chat.countDocuments({ conversation: conversation._id, direction: 'inbound' });
      console.log('[WA][Process] inboundCount:', inboundCount);
      // Step 1: Welcome after first message
      if (inboundCount === 1) {
        await this.sendMessage(phoneNumber, 'Hi, welcome. How may I help you?');
        return;
      }
      // Step 2: Offer live agent after second message
      if (inboundCount === 2) {
        await this.sendMessage(phoneNumber, 'Would you like to chat with a live user? Yes / No');
        return;
      }
      // Step 3: Wait for Yes/No response
      if (inboundCount > 2 && conversation.status !== 'awaiting_agent' && conversation.status !== 'active') {
        if (text.trim().toLowerCase() === 'yes') {
          // Mark conversation as awaiting agent
          conversation.status = 'awaiting_agent';
          await conversation.save();
          // Broadcast to all online agents
          const { broadcastToOnlineAgents } = require('../server');
          broadcastToOnlineAgents(conversation);
          await this.sendMessage(phoneNumber, 'Connecting you to a live agent...');
          return;
        } else if (text.trim().toLowerCase() === 'no') {
          await this.sendMessage(phoneNumber, 'Okay! Let me know if you need anything else.');
          return;
        } else {
          await this.sendMessage(phoneNumber, 'Please reply Yes or No if you want to chat with a live user.');
          return;
        }
      }
      // Auto reply example
      if (text.toLowerCase().includes('hello')) {
        await this.sendMessage(phoneNumber, 'Hello! Thanks for reaching out. How can I assist you?');
      }
    } catch (error) {
      console.error('[WA][Process] Error processing WhatsApp message:', error);
    }
  }

  // Send text message via Twilio WhatsApp API
  async sendMessage(phoneNumber, text) {
    try {
      console.log('SENDING TO WHATSAPP (TWILIO):', phoneNumber, text);
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
      console.log('Twilio API RESPONSE:', response.sid);
      return response;
    } catch (error) {
      console.error('TWILIO WHATSAPP API ERROR:', error.message || error);
      throw error;
    }
  }

  // Send template message (for approved templates)
  async sendTemplateMessage(phoneNumber, templateName, languageCode = 'en') {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v13.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppController();