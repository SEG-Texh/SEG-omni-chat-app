// controllers/emailController.js
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Message = require('../models/message');
const { getIO } = require('../config/socket');

function fetchInboxEmails() {
  const imap = new Imap({
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASS,
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  });

  const emails = [];

  function openInbox(cb) {
    imap.openBox('INBOX', false, cb); // set false to markSeen: false
  }

  imap.once('ready', () => {
    openInbox((err, box) => {
      if (err) {
        console.error('IMAP inbox open error:', err.message);
        return;
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
            } catch (saveError) {
              console.error('Email save error:', saveError.message);
            }

            pending--;
            if (pending === 0) imap.end();
          });
        });
      });

      f.once('error', function (err) {
        console.error('IMAP fetch error:', err.message);
      });

      f.once('end', function () {
        if (pending === 0) imap.end();
      });
    });
  });

  imap.once('error', function (err) {
    console.error('IMAP error:', err.message);
  });

  imap.once('end', function () {
    console.log('✅ Email fetch complete');
  });

  imap.connect();
}

module.exports = fetchInboxEmails;
