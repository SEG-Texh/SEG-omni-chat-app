const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const auth = require('../middleware/auth'); // 🔐 Import auth middleware

router.post('/send', auth, emailController.sendEmail);       // Optional: protect sending
router.get('/inbox', auth, emailController.fetchInboxEmails); // ✅ Require token

module.exports = router;
