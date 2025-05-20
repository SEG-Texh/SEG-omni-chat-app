// routes/email.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
require('dotenv').config();

// Create the transporter (missing in your original code)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD
  }
});

// Send email route
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

// Add a route to fetch emails
router.get('/', async (req, res) => {
  try {
    const emails = await Email.find().sort({ date: -1 });
    res.status(200).json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Setup email polling function
const setupEmailPolling = (app) => {
  // Configure Email polling with IMAP
  const imapConfig = {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  };

  // Function to check emails
  const checkEmails = () => {
    const imap = new Imap(imapConfig);
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Error opening inbox:', err);
          return;
        }
        
        // Get emails from the last day
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        imap.search(['UNSEEN', ['SINCE', yesterday]], (err, results) => {
          if (err) {
            console.error('Error searching emails:', err);
            return;
          }
          
          if (results.length === 0) {
            console.log('No new emails');
            imap.end();
            return;
          }
          
          const fetch = imap.fetch(results, { bodies: '' });
          
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  return;
                }
                
                try {
                  // Check if email already exists
                  const existingEmail = await Email.findOne({
                    from: parsed.from.text,
                    subject: parsed.subject,
                    date: parsed.date
                  });
                  
                  if (!existingEmail) {
                    const newEmail = new Email({
                      from: parsed.from.text,
                      to: parsed.to.text,
                      subject: parsed.subject,
                      text: parsed.text || '',
                      html: parsed.html || '',
                      status: 'received',
                      date: parsed.date
                    });
                    
                    const savedEmail = await newEmail.save();
                    console.log('Received email saved:', savedEmail._id);
                    
                    // Emit socket event
                    const io = app.get('io');
                    if (io) {
                      io.emit('new_email_received', {
                        _id: savedEmail._id,
                        from: savedEmail.from,
                        to: savedEmail.to,
                        subject: savedEmail.subject,
                        text: savedEmail.text,
                        status: savedEmail.status,
                        date: savedEmail.date
                      });
                    }
                  }
                } catch (error) {
                  console.error('Error saving received email:', error);
                }
              });
            });
          });
          
          fetch.once('end', () => {
            console.log('Done fetching all messages');
            imap.end();
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      console.error('IMAP error:', err);
    });
    
    imap.connect();
  };
  
  // Check emails initially and then every 5 minutes
  checkEmails();
  setInterval(checkEmails, 5 * 60 * 1000);
};

module.exports = { router, setupEmailPolling };