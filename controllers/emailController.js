const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

// Email sending configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send email
const sendEmail = async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    if (!to || !text) {
      return res.status(400).json({ error: 'Recipient and text are required' });
    }

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: subject || 'No Subject',
      text
    };

    const info = await transporter.sendMail(mailOptions);

    const newMessage = await Message.create({
      platform: 'email',
      direction: 'outbound',
      status: 'sent',
      content: { text },
      sender: process.env.SMTP_FROM,
      receiver: to,
      platformMessageId: info.messageId,
      labels: []
    });

    getIO().emit('new_message', {
      event: 'email_outbound',
      message: newMessage
    });

    res.json({ success: true, info });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Fetch inbox emails
const fetchInboxEmails = (req, res) => {
  const imap = new Imap({
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  const emails = [];

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('IMAP error:', err);
        return res.status(500).json({ error: 'Failed to open inbox' });
      }

      const fetch = imap.seq.fetch('1:*', {
        bodies: '',
        struct: true,
        markSeen: false
      });

      fetch.on('message', msg => {
        let email = {};
        msg.on('body', stream => {
          simpleParser(stream, async (err, parsed) => {
            if (err || !parsed.messageId) return;

            const exists = await Message.exists({
              platform: 'email',
              platformMessageId: parsed.messageId
            });
            if (exists) return;

            try {
              const newMessage = await Message.create({
                platform: 'email',
                direction: 'inbound',
                status: 'delivered',
                content: { text: parsed.text },
                sender: parsed.from.text,
                receiver: parsed.to.text,
                platformMessageId: parsed.messageId,
                labels: ['unclaimed']
              });

              getIO().emit('new_message', {
                event: 'email_inbound',
                message: newMessage
              });

              emails.push({
                subject: parsed.subject,
                from: parsed.from.text,
                date: parsed.date,
                text: parsed.text
              });
            } catch (saveError) {
              console.error('Email save error:', saveError);
            }
          });
        });
      });

      fetch.once('end', () => imap.end());
      fetch.once('error', err => {
        console.error('Fetch error:', err);
        res.status(500).json({ error: 'Email fetch failed' });
      });
    });
  });

  imap.once('error', err => {
    console.error('IMAP connection error:', err);
    res.status(500).json({ error: 'IMAP connection failed' });
  });

  imap.once('end', () => {
    console.log('IMAP connection ended');
    res.json(emails);
  });

  imap.connect();
};

module.exports = { sendEmail, fetchInboxEmails };