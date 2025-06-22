const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// Send an email
router.post('/send', emailController.sendEmail);

// Fetch emails
router.get('/inbox', emailController.fetchInboxEmails);

module.exports = router;
