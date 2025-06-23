const express = require('express');
const router = express.Router();
const { sendEmail, fetchInboxEmails } = require('../controllers/emailController');

router.post('/send', sendEmail);
router.get('/inbox', fetchInboxEmails); // If fetchInboxEmails isn't defined, remove this line

module.exports = router;
