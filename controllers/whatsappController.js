const axios = require('axios');
const Chat = require('../models/message');
const mongoose = require('mongoose');
const Conversation = require('../models/conversation');
const Message = require('../models/message');

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
      }
      // Save inbound message
      const messageDoc = new Message({
        conversation: conversation._id,
        sender: phoneNumber,
        content: { text },
        platform: 'whatsapp',
        direction: 'inbound'
      });
      await messageDoc.save();
      // Optionally emit real-time event here if needed
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