// routes/facebook.js
const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const { getIO } = require('../config/socket');
// In your webhook handler
    const messageData = req.body; // Get data from request body
console.log('Received Facebook message:', messageData);

// After saving to DB
console.log('Message saved:', savedMessage);

// Before emitting Socket.io event
console.log('Emitting unclaimedMessages event');



router.get('/webhook', facebookController.verifyFacebookWebhook);
router.post('/webhook', facebookController.handleFacebookWebhook);

module.exports = router;
