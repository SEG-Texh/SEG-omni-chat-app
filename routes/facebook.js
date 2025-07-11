// Force redeploy: sync with Heroku
const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');

// Webhook for receiving Facebook messages from customers
router.post('/webhook', facebookController.webhook.bind(facebookController));

module.exports = router;
