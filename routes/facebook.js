const express = require('express');
const controller = require('../controllers/facebookController');
const router = express.Router();

router.get('/webhook', controller.verifyFacebookWebhook);
router.post('/webhook', controller.handleFacebookWebhook);
router.post('/send', controller.sendFacebookMessage);

module.exports = router;
