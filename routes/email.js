const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Message = require('../models/message'); // ⬅️ Add this line
require('dotenv').config();

// create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
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
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);

    // ✅ Save to MongoDB
    const savedMessage = await Message.create({
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      source: 'email',
    });

    // ✅ Emit real-time message to frontend
    if (io) {
      io.emit('new_email_sent', savedMessage);
    }

    res.status(200).json({ success: true, message: 'Email sent and saved!', data: savedMessage });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
