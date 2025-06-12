// routes/facebook.js
const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const io = require('../path/to/socket').getIO(); // depends on your structure

// Inside the webhook POST handler, after receiving the message:
io.emit('newMessage', {
  source: 'facebook',
  text: messageText,
  from: senderId,
  time: new Date().toISOString()
});


router.get('/webhook', facebookController.verifyFacebookWebhook);
router.post('/webhook', facebookController.handleFacebookWebhook);

module.exports = router;
