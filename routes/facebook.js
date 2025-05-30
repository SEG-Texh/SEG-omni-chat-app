const express = require('express');
const router = express.Router();
const { verifyWebhook, receiveMessage } = require('../controllers/facebookController');

router.get('/', verifyWebhook);
router.post('/', receiveMessage);

module.exports = router;
