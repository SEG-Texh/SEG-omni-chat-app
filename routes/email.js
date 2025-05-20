// routes/email.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
require('dotenv').config();

router.post('/send', async (req, res) => {
  const { to, subject, text, html, userId } = req.body;
  const io = req.app.get('io');
  
  if (!to || !subject || !(text || html)) {
    return res.status(400).json({ error: 'To, subject, and either text or html are required' });
  }
  
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html
  };
  
  try {
    console.log('Sending email with:', mailOptions);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    
    // Save email to database
    const newEmail = new Email({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text: text || '',
      html: html || '',
      status: 'sent',
      userId: userId || null // Make userId optional
    });
    
    const savedEmail = await newEmail.save();
    console.log('Email saved to database:', savedEmail._id);
    
    // Emit socket event
    if (io) {
      io.emit('new_email_sent', {
        _id: savedEmail._id,
        from: savedEmail.from,
        to: savedEmail.to,
        subject: savedEmail.subject,
        text: savedEmail.text,
        status: savedEmail.status,
        date: savedEmail.date
      });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Email sent and saved!', 
      messageId: info.messageId,
      email: {
        _id: savedEmail._id,
        from: savedEmail.from,
        to: savedEmail.to,
        subject: savedEmail.subject,
        status: savedEmail.status,
        date: savedEmail.date
      }
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});