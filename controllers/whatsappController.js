exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WhatsApp Webhook Verified');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
};

exports.receiveMessage = (req, res) => {
  console.log('📨 Incoming WhatsApp message:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
};
