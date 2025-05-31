const express = require('express');
const router = express.Router();
const { verifyWebhook, receiveMessage } = require('../controllers/facebookController');

// Change from '/' to '/webhook' to match Facebook's requests
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveMessage);

module.exports = router;