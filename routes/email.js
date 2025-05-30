const express = require('express');
const router = express.Router();
const { sendEmail } = require('../controllers/emailController');

router.post('/send', sendEmail); // POST /email/send

module.exports = router;
