const request = require('request');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const receivedMessages = [];

exports.handleVerification = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified.');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

exports.handleWebhook = (req, res) => {
  const body = req.body;
  console.log('👉 Incoming webhook:', JSON.stringify(body, null, 2));

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      const webhook_event = entry.messaging[0];
      const sender_psid = webhook_event.sender.id;
      const message = webhook_event.message?.text;

      if (sender_psid && message) {
        receivedMessages.push({ senderId: sender_psid, message, timestamp: new Date() });

        const response = { text: `You said: "${message}"` };
        sendMessage(sender_psid, response);
      }
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
};

function sendMessage(sender_psid, response) {
  const request_body = {
    recipient: { id: sender_psid },
    message: response
  };

  request({
    uri: 'https://graph.facebook.com/v22.0/me/messages',
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: request_body
  }, (err, res, body) => {
    if (!err) {
      console.log(`✅ Sent to ${sender_psid}`);
    } else {
      console.error('❌ Error sending message:', err);
    }
  });
}

exports.sendMessageAPI = (req, res) => {
  const { recipientId, message } = req.body;
  const response = { text: message };
  sendMessage(recipientId, response);
  res.status(200).json({ success: true });
};

exports.getMessages = (req, res) => {
  res.json({ messages: receivedMessages });
};
