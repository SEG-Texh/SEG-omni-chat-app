const facebookController = {
    /**
     * Verify Facebook Webhook
     * This is used during the webhook setup process
     */
    verifyFacebookWebhook: (req, res) => {
        // Your verify token (should match the one you set in Facebook Developer Portal)
        const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "my-free-app-1234";
        
        // Parse params from the webhook verification request
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        // Check if a token and mode were sent
        if (mode && token) {
            // Check the mode and token sent are correct
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                // Respond with 200 OK and challenge token from the request
                console.log('WEBHOOK_VERIFIED');
                res.status(200).send(challenge);
            } else {
                // Responds with '403 Forbidden' if verify tokens do not match
                res.sendStatus(403);
            }
        } else {
            // Respond with '400 Bad Request' if required params aren't sent
            res.sendStatus(400);
        }
    },

    /**
     * Handle incoming messages and events from Facebook
     */
    handleFacebookWebhook: (req, res) => {
        // Facebook will send a POST request to this endpoint whenever there's activity
        // on your Facebook Page or app that you've subscribed to
        
        // Check if this is a page subscription
        if (req.body.object === 'page') {
            // Iterate over each entry (there may be multiple if batched)
            req.body.entry.forEach(entry => {
                // Process each messaging event
                entry.messaging.forEach(messagingEvent => {
                    if (messagingEvent.message) {
                        // Handle received message
                        console.log('Received message:', messagingEvent.message);
                        // Here you would typically process the message and send a reply
                    } else if (messagingEvent.postback) {
                        // Handle postback (e.g., from buttons)
                        console.log('Received postback:', messagingEvent.postback);
                    } else {
                        console.log('Unknown messaging event:', messagingEvent);
                    }
                });
            });
        }

        // Return a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    }
};

module.exports = facebookController;