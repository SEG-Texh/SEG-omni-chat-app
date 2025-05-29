
// services/emailService.js - Email integration using Nodemailer
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const express = require('express');
const router = express.Router();
const { io } = require('../server');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(to, subject, text, html = null) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: to,
        subject: subject,
        text: text,
        html: html || text
      };

      const result = await this.transporter.sendMail(mailOptions);
      return result;
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error('Failed to send email');
    }
  }

  async parseIncomingEmail(emailData) {
    try {
      const parsed = await simpleParser(emailData);
      return {
        from: parsed.from.text,
        subject: parsed.subject,
        text: parsed.text,
        html: parsed.html,
        date: parsed.date
      };
    } catch (error) {
      console.error('Email parse error:', error);
      throw new Error('Failed to parse email');
    }
  }
}

const emailService = new EmailService();

// Webhook for receiving emails (configure with your email provider)
router.post('/', async (req, res) => {
  try {
    // This would be configured based on your email service provider
    // Examples: SendGrid, Mailgun, etc.
    const emailData = req.body;
    
    // Parse the incoming email
    const parsed = await emailService.parseIncomingEmail(emailData.raw || emailData);
    
    // Create or find conversation
    const Conversation = require('../models/conversation');
    let conversation = await Conversation.findOne({
      'contact.identifier': parsed.from,
      'contact.platform': 'email'
    });

    if (!conversation) {
      conversation = new Conversation({
        contact: {
          name: parsed.from,
          identifier: parsed.from,
          platform: 'email'
        },
        lastMessage: {
          content: parsed.subject,
          timestamp: parsed.date,
          sender: parsed.from
        }
      });
      await conversation.save();
    } else {
      conversation.lastMessage = {
        content: parsed.subject,
        timestamp: parsed.date,
        sender: parsed.from
      };
      conversation.unreadCount += 1;
      await conversation.save();
    }

    // Save message
    const Message = require('../models/Message');
    const newMessage = new Message({
      conversationId: conversation._id,
      sender: parsed.from,
      content: parsed.text || parsed.html,
      platform: 'email',
      isOwn: false,
      timestamp: parsed.date
    });
    await newMessage.save();

    // Emit to all connected clients
    io.emit('new_message', {
      conversationId: conversation._id,
      message: newMessage
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Email webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = {
  sendEmail: emailService.sendEmail.bind(emailService),
  parseIncomingEmail: emailService.parseIncomingEmail.bind(emailService),
  webhook: router
};