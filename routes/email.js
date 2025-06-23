const express = require('express');
const router = express.Router();
const { sendEmail, fetchInboxEmails } = require('../controllers/emailController'); // ✅ Destructure the functions

router.post('/send', sendEmail);           // ✅ Function
router.get('/inbox', fetchInboxEmails);    // ✅ Function

module.exports = router;
