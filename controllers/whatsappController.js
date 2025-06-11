// controllers/whatsappController.js
const axios = require('axios');

exports.verifyWhatsAppWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ WhatsApp webhook verified');
        res.status(200).send(challenge);
    } else {
        console.warn('❌ WhatsApp webhook verification failed');
        res.sendStatus(403);
    }
};

exports.handleWhatsAppWebhook = async (req, res) => {
    const body = req.body;

    if (body.object) {
        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                const messages = change.value.messages || [];

                for (const msg of messages) {
                    const from = msg.from;
                    const messageText = msg.text?.body;

                    if (messageText) {
                        console.log(`📩 Message from WhatsApp (${from}): ${messageText}`);

                        // Auto-reply (optional)
                        await axios.post(
                            `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
                            {
                                messaging_product: 'whatsapp',
                                to: from,
                                text: { body: `Thanks for messaging us! You said: "${messageText}"` },
                            },
                            {
                                headers: {
                                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                                    'Content-Type': 'application/json',
                                },
                            }
                        );
                    }
                }
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};
