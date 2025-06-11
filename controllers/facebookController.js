const crypto = require('crypto');
const axios = require('axios');

exports.handleFacebookWebhook = async (req, res) => {
    try {
        // 1. Verify signature
        const signature = req.headers['x-hub-signature'];
        const appSecret = process.env.FACEBOOK_APP_SECRET;

        if (!signature) {
            console.warn('❌ Missing Facebook signature header');
            return res.sendStatus(401);
        }

        if (!verifyRequestSignature(req.rawBody, signature, appSecret)) {
            console.warn('❌ Invalid Facebook signature');
            return res.sendStatus(403);
        }

        // 2. Handle challenge verification (for webhook setup)
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
            console.log('✅ Webhook verified');
            return res.status(200).send(req.query['hub.challenge']);
        }

        // 3. Process incoming messages
        const body = req.body;

        if (body.object !== 'page') {
            return res.sendStatus(404);
        }

        // Process each entry (there may be multiple)
        for (const entry of body.entry) {
            // Skip if no messaging events
            if (!entry.messaging) continue;

            for (const event of entry.messaging) {
                try {
                    await processMessageEvent(event);
                } catch (error) {
                    console.error('Error processing message event:', error);
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('❌ Webhook handler error:', error);
        res.status(500).send('Internal Server Error');
    }
};

async function processMessageEvent(event) {
    const senderId = event.sender.id;
    
    // Handle different types of messages
    if (event.message) {
        const messageText = event.message.text;
        console.log(`📩 Message from Facebook (${senderId}): ${messageText}`);
        
        await sendFacebookMessage(
            senderId,
            `Thanks for messaging us! You said: "${messageText}"`
        );
    } else if (event.postback) {
        console.log(`🔄 Postback from Facebook (${senderId}):`, event.postback);
        // Handle postbacks here
    }
    // Add other event types as needed
}

async function sendFacebookMessage(recipientId, messageText) {
    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/me/messages`,
            {
                recipient: { id: recipientId },
                message: { text: messageText },
            },
            {
                params: {
                    access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
                }
            }
        );
    } catch (error) {
        console.error('Error sending Facebook message:', error.response?.data || error.message);
        throw error;
    }
}

function verifyRequestSignature(rawBody, signature, appSecret) {
    if (!signature || !appSecret) return false;

    const [method, receivedHash] = signature.split('=');
    if (method !== 'sha1' || !receivedHash) return false;

    const expectedHash = crypto
        .createHmac('sha1', appSecret)
        .update(rawBody)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(receivedHash, 'hex'),
        Buffer.from(expectedHash, 'hex')
    );
}