const express = require('express');
const router = express.Router();
const {
  sendEmail,
  sendAutoReplyOnly,
  testSmtpConnection,
  testImapConnection,
  getEmailLogs,
  getSmtpUserEmails,
  receiveEmails,
  getReceivedEmails,
  getReceivedEmail,
  emailLog
} = require('../controllers/emailController');

// =====================================================================
// SENDING EMAILS
// =====================================================================

// POST /email/send - Send email with optional auto-reply
router.post('/send', sendEmail);

// POST /email/auto-reply - Send auto-reply only
router.post('/auto-reply', sendAutoReplyOnly);

// =====================================================================
// RECEIVING EMAILS
// =====================================================================

// GET /email/receive - Fetch new emails from IMAP server
router.get('/receive', receiveEmails);

// GET /email/received - Get all received emails (stored locally)
// Query params: ?limit=50&detailed=true
router.get('/received', getReceivedEmails);

// GET /email/received/:id - Get specific received email by ID
router.get('/received/:id', getReceivedEmail);

// =====================================================================
// CONNECTION TESTING
// =====================================================================

// GET /email/test-smtp - Test SMTP connection (for sending)
router.get('/test-smtp', testSmtpConnection);

// GET /email/test-imap - Test IMAP connection (for receiving)
router.get('/test-imap', testImapConnection);

// GET /email/test - Test both SMTP and IMAP connections
router.get('/test', async (req, res) => {
  try {
    const results = {
      smtp: { success: false, error: null },
      imap: { success: false, error: null }
    };
    
    // Test SMTP
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false }
      });
      
      await transporter.verify();
      results.smtp.success = true;
      console.log('✅ SMTP test passed');
    } catch (smtpError) {
      results.smtp.error = smtpError.message;
      console.error('❌ SMTP test failed:', smtpError.message);
    }
    
    // Test IMAP
    try {
      const Imap = require('imap');
      const imap = new Imap({
        user: process.env.IMAP_USER || process.env.SMTP_USER,
        password: process.env.IMAP_PASS || process.env.SMTP_PASS,
        host: process.env.IMAP_HOST || (process.env.SMTP_HOST === 'smtp.gmail.com' ? 'imap.gmail.com' : process.env.SMTP_HOST),
        port: parseInt(process.env.IMAP_PORT) || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
      });
      
      await new Promise((resolve, reject) => {
        imap.once('ready', () => {
          imap.end();
          resolve();
        });
        imap.once('error', reject);
        imap.connect();
      });
      
      results.imap.success = true;
      console.log('✅ IMAP test passed');
    } catch (imapError) {
      results.imap.error = imapError.message;
      console.error('❌ IMAP test failed:', imapError.message);
    }
    
    const overallSuccess = results.smtp.success && results.imap.success;
    
    res.status(overallSuccess ? 200 : 500).json({
      success: overallSuccess,
      message: overallSuccess ? 'All email services working' : 'Some email services failed',
      data: {
        smtp: results.smtp,
        imap: results.imap,
        config: {
          smtpHost: process.env.SMTP_HOST,
          smtpPort: process.env.SMTP_PORT,
          imapHost: process.env.IMAP_HOST || 'auto-detected',
          imapPort: process.env.IMAP_PORT || '993',
          user: process.env.SMTP_USER ? 'configured' : 'not configured'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error.message
    });
  }
});