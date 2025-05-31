const express = require('express');
const router = express.Router();
const { sendEmail, sendAutoReplyOnly, testSmtpConnection } = require('../controllers/emailController');

// POST /email/send - Send email with optional auto-reply
router.post('/send', sendEmail);

// POST /email/auto-reply - Send auto-reply only
router.post('/auto-reply', sendAutoReplyOnly);

// GET /email/test - Test SMTP connection
router.get('/test', testSmtpConnection);

// GET /email/status - Check email service status
router.get('/status', (req, res) => {
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  res.json({
    success: true,
    message: 'Email service status',
    data: {
      configured: missingVars.length === 0,
      missingEnvVars: missingVars,
      config: {
        host: process.env.SMTP_HOST || 'not set',
        port: process.env.SMTP_PORT || 'not set',
        secure: process.env.SMTP_SECURE || 'not set',
        user: process.env.SMTP_USER ? 'configured' : 'not set',
        pass: process.env.SMTP_PASS ? 'configured' : 'not set',
        from: process.env.SMTP_FROM || 'not set'
      }
    }
  });
});

module.exports = router;