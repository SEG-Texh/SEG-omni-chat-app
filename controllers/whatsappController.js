// controllers/whatsappController.js
const Message = require('../models/message');
const { getIO } = require('../config/socket');

exports.handleWebhook = async (req, res) => {
  try {
    const from = req.body.From;
    const to = req.body.To;
    const text = req.body.Body;

    const incoming = await Message.create({
      platform: 'whatsapp',
      platformMessageId: req.body.MessageSid,
      platformThreadId: from,
      direction: 'inbound',
      status: 'delivered',
      content: { text },
      sender: from,
      recipient: to,
      platformSender: { id: from },
      platformRecipient: { id: to },
      labels: ['unclaimed']
    });

    getIO().emit('new_message', incoming);
    res.sendStatus(200);
  } catch (err) {
    console.error('WhatsApp Webhook Error:', err);
    res.sendStatus(500);
  }
};

exports.sendWhatsApp = async (req, res) => {
  try {
    const { to, text } = req.body;
    const TWILIO = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const resp = await TWILIO.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to,
      body: text
    });

    const outgoing = await Message.create({
      platform: 'whatsapp',
      platformMessageId: resp.sid,
      platformThreadId: to,
      direction: 'outbound',
      status: resp.status,
      content: { text },
      sender: process.env.TWILIO_WHATSAPP_NUMBER,
      recipient: to,
      platformSender: { id: process.env.TWILIO_WHATSAPP_NUMBER },
      platformRecipient: { id: to },
      labels: []
    });

    getIO().emit('new_message', outgoing);
    res.json({ success: true, message: outgoing });
  } catch (err) {
    console.error('WhatsApp Send Error:', err);
    res.status(500).json({ error: 'Failed to send via WhatsApp' });
  }
};
