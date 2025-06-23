// controllers/emailController.js

const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

// ✅ SMTP Send
const smtpTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail(req, res) {
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
}

// ✅ IMAP Receive (with self-signed cert allowed)
function fetchInboxEmails(req, res) {
  const imap = new Imap({
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false // ✅ Accept self-signed certificates
    }
  });

  const emails = [];

  function openInbox(cb) {
    imap.openBox('INBOX', false, cb);
  }

  imap.once('ready', () => {
    openInbox((err, box) => {
      if (err) {
        console.error('IMAP inbox open error:', err.message);
        return res.status(500).json({ error: 'IMAP error' });
      }

      const f = imap.seq.fetch('1:*', {
        bodies: '',
        struct: true,
        markSeen: false
      });

      let pending = 0;

      f.on('message', function (msg) {
        pending++;
        msg.on('body', function (stream) {
          simpleParser(stream, async (err, parsed) => {
            if (!parsed?.messageId) {
              pending--;
              return;
            }

            const exists = await Message.findOne({
              platform: 'email',
              platformMessageId: parsed.messageId
            });

            if (exists) {
              pending--;
              return;
            }

            try {
              const newMessage = await Message.create({
                platform: 'email',
                direction: 'inbound',
                status: 'delivered',
                content: { text: parsed.text },
                sender: parsed.from.text,
                recipient: parsed.to.text,
                platformMessageId: parsed.messageId,
                labels: ['unclaimed']
              });

              const io = getIO();
              io.emit('new_message', {
                event: 'email_inbound',
                message: { ...newMessage.toObject(), timestamp: new Date() }
              });

              emails.push({
                subject: parsed.subject,
                from: parsed.from.text,
                to: parsed.to.text,
                date: parsed.date,
                text: parsed.text
              });
            } catch (saveError) {
              console.error('Email save error:', saveError.message);
            }

            pending--;
            if (pending === 0) {
              imap.end();
              res.json(emails);
            }
          });
        });
      });

      f.once('error', function (err) {
        console.error('IMAP fetch error:', err.message);
        res.status(500).json({ error: 'Fetch error' });
      });

      f.once('end', function () {
        if (pending === 0) imap.end();
      });
    });
  });

  imap.once('error', function (err) {
    console.error('IMAP connection error:', err.message);
    res.status(500).json({ error: err.message });
  });

  imap.once('end', function () {
    console.log('✅ Email fetch complete');
  });

  imap.connect();
}

module.exports = {
  sendEmail,
  fetchInboxEmails
};
