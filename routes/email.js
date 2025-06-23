const express = require('express');
const router = express.Router();
const { sendEmail, fetchInboxEmails } = require('../controllers/emailController');

// Send email
router.post('/send', sendEmail);

// Fetch emails
router.get('/inbox', fetchInboxEmails);

module.exports = router;