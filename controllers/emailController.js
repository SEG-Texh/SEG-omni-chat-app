// controllers/emailController.js
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const sendEmail = async (req, res) => {
  const { to, subject, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: 'To and text are required' });
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to,
      subject: subject || 'No Subject',
      text
    };

    const info = await smtpTransport.sendMail(mailOptions);

    const newMessage = await Message.create({
      platform: 'email',
      direction: 'outbound',
      status: 'sent',
      content: { text },
      sender: process.env.SMTP_FROM,
      recipient: to,
      platformMessageId: info.messageId,
      labels: []
    });

    getIO().emit('new_message', {
      event: 'email_outbound',
      message: { ...newMessage.toObject(), timestamp: new Date() }
    });

    res.status(200).json({ success: true, info });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: err.message });
  }
};

const fetchInboxEmails = async (req, res) => {
  const imap = new Imap({
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  });

  function openInbox(cb) {
    imap.openBox('INBOX', false, cb); // false = read-write
  }

  imap.once('ready', function () {
    openInbox(function (err, box) {
      if (err) return res.status(500).json({ error: err.message });

      imap.search(['UNSEEN'], function (err, results) {
        if (err || !results || results.length === 0) {
          imap.end();
          return res.json([]); // No new messages
        }

        const f = imap.fetch(results, { bodies: '', struct: true });
        const emails = [];
        const parsePromises = [];

        f.on('message', function (msg) {
          msg.on('body', function (stream) {
            const parsePromise = simpleParser(stream).then(async (parsed) => {
              emails.push({
                subject: parsed.subject,
                from: parsed.from.text,
                to: parsed.to.text,
                date: parsed.date,
                text: parsed.text
              });

              const exists = await Message.findOne({ platformMessageId: parsed.messageId });
              if (exists) return;

              await Message.create({
                platform: 'email',
                direction: 'inbound',
                status: 'delivered',
                content: { text: parsed.text },
                sender: parsed.from.text,
                recipient: parsed.to.text,
                platformMessageId: parsed.messageId,
                labels: ['unclaimed']
              });

              getIO().emit('new_message', {
                event: 'email_inbound',
                message: {
                  platform: 'email',
                  content: { text: parsed.text },
                  sender: parsed.from.text,
                  recipient: parsed.to.text,
                  timestamp: new Date()
                }
              });
            });

            parsePromises.push(parsePromise);
          });
        });

        f.once('end', async function () {
          await Promise.all(parsePromises);
          imap.end();
          res.json(emails);
        });
      });
    });
  });

  imap.once('error', function (err) {
    console.error('IMAP error:', err);
    res.status(500).json({ error: err.message });
  });

  imap.connect();
};


module.exports = { sendEmail, fetchInboxEmails };
