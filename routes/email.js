const express = require('express');
const router = express.Router();
const { sendEmail, sendAutoReplyOnly, sendBulkEmails, getEmailStatus } = require('../controllers/emailController');

router.post('/send', sendEmail);
router.post('/autoreply', sendAutoReplyOnly);
router.post('/bulk', sendBulkEmails);
router.get('/status', getEmailStatus);

module.exports = router;