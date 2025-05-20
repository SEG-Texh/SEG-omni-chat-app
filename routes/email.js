// routes/email.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
require('dotenv').config();

// SMTP Config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true
  }
});


// IMAP Config
const imapConfig = { /* ... */ };

// ✅ SEND EMAIL ROUTE
router.post('/send', async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    const info = await transporter.sendMail({ from: process.env.GMAIL_USER, to, subject, text });
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ RECEIVE EMAILS ROUTE (manual)
router.get('/receive', async (req, res) => { /* ... your posted code ... */ });

// ✅ VERIFY CONNECTION ROUTE
router.get('/verify-connection', async (req, res) => { /* ... your posted code ... */ });

// ✅ POLLING FUNCTION
function setupEmailPolling(app) { /* ... your posted code ... */ }

module.exports = { router, setupEmailPolling };
