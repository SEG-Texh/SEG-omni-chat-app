// routes/email.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
require('dotenv').config();

// Email sender (SMTP)
router.post('/send', async (req, res) => {
  const { to, subject, text } = req.body;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD, // or app password
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_ADDRESS,
      to,
      subject,
      text,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Email receiver (IMAP)
router.get('/inbox', async (req, res) => {
  const config = {
    imap: {
      user: process.env.EMAIL_ADDRESS,
      password: process.env.EMAIL_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 3000,
    },
  };

  try {
    const connection = await imaps.connect({ imap: config.imap });
    await connection.openBox('INBOX');
    const results = await connection.search(['UNSEEN'], {
      bodies: ['HEADER', 'TEXT'],
      markSeen: true,
    });

    const messages = [];
    for (const item of results) {
      const all = item.parts.find(part => part.which === 'TEXT');
      const parsed = await simpleParser(all.body);
      messages.push({
        from: parsed.from?.text,
        subject: parsed.subject,
        text: parsed.text,
      });
    }

    res.json(messages);
  } catch (err) {
    console.error('IMAP error:', err.message);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

module.exports = router;
