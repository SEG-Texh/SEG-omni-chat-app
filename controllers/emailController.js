const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
async function fetchInboxEmails(req, res) {
  // Dummy placeholder response for now
  return res.status(200).json({ inbox: [] });
}

module.exports = { sendEmail, fetchInboxEmails };


async function sendEmail(req, res) {
  try {
    const { to, subject, text, platform = 'email' } = req.body;

    if (!to || !text) {
      return res.status(400).json({
        error: 'Validation failed',
        details: {
          to: !to ? 'Missing recipient email' : undefined,
          text: !text ? 'Missing message text' : undefined
        }
      });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: subject || 'No Subject',
      text
    };

    const info = await transporter.sendMail(mailOptions);

    const newMessage = await Message.create({
      platform,
      direction: 'outbound',
      status: 'sent',
      content: { text },
      sender: process.env.SMTP_FROM || process.env.SMTP_USER,
      recipient: to,
      platformMessageId: info.messageId,
      labels: []
    });

    getIO().emit('new_message', {
      event: 'email_outbound',
      message: newMessage
    });

    return res.status(200).json({
      success: true,
      messageId: newMessage._id,
      info
    });

  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
}

// If you're not using fetchInboxEmails yet, export only sendEmail:
module.exports = { sendEmail };
