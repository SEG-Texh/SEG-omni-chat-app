// routes/facebook.js
const express = require('express');
const router = express.Router();
const facebookController = require('./controllers/facebookController');
const { getIO } = require('./config/socket');
const io = getIO();


router.get('/webhook', facebookController.verifyFacebookWebhook);
router.post('/webhook', facebookController.handleFacebookWebhook);

module.exports = router;
