const express = require('express');
const router = express.Router();
const { 
  sendEmail, 
  sendAutoReplyOnly, 
  testSmtpConnection,
  getEmailLogs,
  getSmtpUserEmails 
} = require('../controllers/emailController');

// POST /email/send - Send email with optional auto-reply
router.post('/send', sendEmail);

// POST /email/auto-reply - Send auto-reply only
router.post('/auto-reply', sendAutoReplyOnly);

// GET /email/test - Test SMTP connection
router.get('/test', testSmtpConnection);

// GET /email/logs - Get all email logs with optional filtering
// Query params: ?toSmtpUser=true&limit=50
router.get('/logs', getEmailLogs);

// GET /email/smtp-user - Get emails sent specifically to SMTP_USER
router.get('/smtp-user', getSmtpUserEmails);

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
      smtpUser: process.env.SMTP_USER || 'not set',
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

// GET /email/stats - Get email statistics
router.get('/stats', (req, res) => {
  try {
    // This would use the same logging system from the controller
    const emailLog = require('../controllers/emailController').emailLog || new Map();
    const logs = Array.from(emailLog.values());
    
    const stats = {
      totalEmails: logs.length,
      successfulSends: logs.filter(log => log.eventType === 'EMAIL_SENT').length,
      failedSends: logs.filter(log => log.eventType === 'EMAIL_FAILED').length,
      autoReplies: logs.filter(log => log.eventType.includes('AUTO_REPLY')).length,
      emailsToSmtpUser: logs.filter(log => log.isToSmtpUser).length,
      lastHourEmails: logs.filter(log => {
        const logTime = new Date(log.timestamp);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return logTime > oneHourAgo;
      }).length,
      todayEmails: logs.filter(log => {
        const logTime = new Date(log.timestamp);
        const today = new Date();
        return logTime.toDateString() === today.toDateString();
      }).length
    };
    
    res.json({
      success: true,
      message: 'Email statistics',
      data: {
        statistics: stats,
        smtpUser: process.env.SMTP_USER,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email statistics',
      details: error.message
    });
  }
});

module.exports = router;