// routes/facebook.js
const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');

router.get('/webhook', facebookController.verifyFacebookWebhook);
router.post('/webhook', facebookController.handleFacebookWebhook);

module.exports = router;