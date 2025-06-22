const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController'); // ✅ Correct spelling!

router.post('/send', emailController.sendEmail);   // ✅ Function must exist
router.get('/inbox', emailController.fetchInboxEmails); // ✅ Function must exist

module.exports = router;
