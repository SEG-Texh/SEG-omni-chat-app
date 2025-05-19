const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const { saveFacebookMessage } = require('../controllers/messageController'); // ✅ Import controller

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

router.use(bodyParser.json());

// ... (Webhook verification unchanged)

// ✅ Handle incoming Facebook messages using controller
router.post('/webhook', async (req, res) => {
  console.log('Incoming Facebook Webhook:', JSON.stringify(req.body, null, 2));

  if (req.body.object !== 'page') {
    console.error('Invalid webhook object');
    return res.sendStatus(404);
  }

  try {
    for (const entry of req.body.entry) {
      if (!entry.messaging || !Array.isArray(entry.messaging)) {
        console.log('Entry has no messaging array');
        continue;
      }

      for (const event of entry.messaging) {
        try {
          const newMessage = await saveFacebookMessage(event); // ✅ Delegate to controller
          if (newMessage) {
            await sendTextMessage(newMessage.senderId, `Echo: ${newMessage.content}`);
          }
        } catch (error) {
          console.error('Error processing message:', error.message);
        }
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.sendStatus(500);
  }
});
module.exports = router;
