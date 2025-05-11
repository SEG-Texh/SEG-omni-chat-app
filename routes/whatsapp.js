// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Verify webhook (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Handle webhook messages (POST)
router.post('/webhook', async (req, res) => {
  const data = req.body;
  console.log('📥 WhatsApp Webhook:', JSON.stringify(data, null, 2));

  if (data.object) {
    for (const entry of data.entry) {
      const changes = entry.changes;
      for (const change of changes) {
        const message = change.value.messages?.[0];
        const from = message?.from;
        const text = message?.text?.body;

        if (from && text) {
          console.log(`From ${from}: ${text}`);
          await sendMessage(from, `Echo: ${text}`);
        }
      }
    }
    return res.sendStatus(200);
  }
  res.sendStatus(404);
});

// Helper: Send reply via WhatsApp Cloud API
async function sendMessage(to, message) {
  const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
  await axios.post(url, {
    messaging_product: 'whatsapp',
    to,
    text: { body: message },
  }, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}

module.exports = router;
