// controllers/facebookController.js
const crypto = require('crypto');
const axios = require('axios');

exports.verifyFacebookWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Facebook webhook verified');
        res.status(200).send(challenge);
    } else {
        console.warn('❌ Facebook webhook verification failed');
        res.sendStatus(403);
    }
};

exports.handleFacebookWebhook = async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            const event = entry.messaging[0];
            const senderId = event.sender.id;
            const messageText = event.message?.text;

            if (messageText) {
                console.log(`📩 Message from Facebook (${senderId}): ${messageText}`);

                // Auto-reply (optional)
                await axios.post(
                    `https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
                    {
                        recipient: { id: senderId },
                        message: { text: `Thanks for messaging us! You said: "${messageText}"` },
                    }
                );
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
};
