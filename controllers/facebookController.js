const axios = require('axios');

const VERIFY_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const receivedMessages = [];

// Webhook Verification
exports.handleVerification = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified.');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
};

// Webhook Receiver
exports.handleWebhook = async (req, res) => {
  const body = req.body;
  console.log('👉 Incoming webhook:', JSON.stringify(body, null, 2));

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const event = entry.messaging?.[0];
      const sender_psid = event?.sender?.id;
      const message = event?.message?.text;

      if (sender_psid && message) {
        receivedMessages.push({
          senderId: sender_psid,
          message,
          timestamp: new Date(),
        });

        await sendMessage(sender_psid, { text: `You said: "${message}"` });
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  }

  res.sendStatus(404);
};

// Send Message to Facebook
async function sendMessage(sender_psid, response) {
  try {
    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;
    const payload = {
      recipient: { id: sender_psid },
      message: response,
    };

    await axios.post(url, payload);
    console.log(`✅ Message sent to ${sender_psid}`);
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
  }
}

// API to send message manually
exports.sendMessageAPI = async (req, res) => {
  const { recipientId, message } = req.body;

  if (!recipientId || !message) {
    return res.status(400).json({ error: 'recipientId and message are required' });
  }

  await sendMessage(recipientId, { text: message });
  res.status(200).json({ success: true });
};

// API to get stored messages
exports.getMessages = (req, res) => {
  res.json({ messages: receivedMessages });
};
