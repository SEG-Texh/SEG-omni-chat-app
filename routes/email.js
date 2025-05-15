const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
require('dotenv').config();

// create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// POST /email/send
router.post('/send', async (req, res) => {
  const { to, subject, text } = req.body;
  const io = req.app.get('io');

  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'To, subject, and text are required' });
  }

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
  };

  try {
    console.log('Sending email with:', mailOptions);

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);

    if (io) {
      io.emit('new_email_sent', {
        to,
        subject,
        text,
        status: 'sent',
        timestamp: new Date()
      });
    }

    res.status(200).json({ success: true, message: 'Email sent!', info });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
