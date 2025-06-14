// routes/facebook.js
const express = require('express');
const router = express.Router();
const facebookController = require('../controllers/facebookController');
const { getIO } = require('../config/socket');
router.post('/webhook', (req, res) => {
  const io = require('../config/socket').getIO();
  io.emit('message', req.body); // Example
  res.sendStatus(200);
});



router.get('/webhook', facebookController.verifyFacebookWebhook);
router.post('/webhook', facebookController.handleFacebookWebhook);

module.exports = router;
