exports.handleFacebookWebhook = async (req, res) => {
    const signature = req.headers['x-hub-signature'];
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!verifyRequestSignature(req.rawBody, signature, appSecret)) {
        console.warn('❌ Invalid Facebook signature');
        return res.sendStatus(403);
    }

    const body = req.body;

    if (body.object === 'page') {
        for (const entry of body.entry) {
            const event = entry.messaging[0];
            const senderId = event.sender.id;
            const messageText = event.message?.text;

            if (messageText) {
                console.log(`📩 Message from Facebook (${senderId}): ${messageText}`);

                // Auto-reply
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

function verifyRequestSignature(rawBody, signature, appSecret) {
    if (!signature || !appSecret) return false;

    const [method, receivedHash] = signature.split('=');
    const expectedHash = crypto
        .createHmac('sha1', appSecret)
        .update(rawBody)
        .digest('hex');

    return method === 'sha1' && receivedHash === expectedHash;
}
