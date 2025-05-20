// routes/email.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
require('dotenv').config();

// Create the nodemailer transporter using Gmail app password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD  // Use app password instead of regular password
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

// Get all emails route
router.get('/', async (req, res) => {
  try {
    const emails = await Email.find().sort({ date: -1 });
    res.status(200).json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get email by ID route
router.get('/:id', async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.status(200).json(email);
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Setup email polling function with improved error handling
const setupEmailPolling = (app) => {
  // Configure Email polling with IMAP using Gmail app password
  const imapConfig = {
    user: process.env.GMAIL_USER,
    password: process.env.GMAIL_APP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000, // Increase auth timeout
    tlsOptions: { 
      rejectUnauthorized: false,
      servername: 'imap.gmail.com' // Explicitly set server name
    }
  };

  // Function to check emails with better error handling
  const checkEmails = () => {
    try {
      const imap = new Imap(imapConfig);
      
      imap.once('ready', () => {
        try {
          imap.openBox('INBOX', false, (err, box) => {
            if (err) {
              console.error('Error opening inbox:', err);
              imap.end();
              return;
            }
            
            // Get emails from the last day
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            imap.search(['UNSEEN', ['SINCE', yesterday]], (err, results) => {
              if (err) {
                console.error('Error searching emails:', err);
                imap.end();
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
        } catch (boxError) {
          console.error('Error in IMAP ready handler:', boxError);
          imap.end();
        }
      });
      
      imap.once('error', (err) => {
        console.error('IMAP error:', err);
        // Don't immediately try to reconnect if there's an auth error
        if (err.source !== 'authentication') {
          console.log('Will try again in next polling interval');
        } else {
          console.log('Authentication error - please check your credentials');
        }
      });
      
      imap.once('end', () => {
        console.log('IMAP connection ended');
      });
      
      imap.connect();
    } catch (error) {
      console.error('Error creating IMAP connection:', error);
    }
  };
  
  // Initial check
  checkEmails();
  
  // Set up polling every 5 minutes
  const pollingInterval = 5 * 60 * 1000; // 5 minutes
  setInterval(checkEmails, pollingInterval);
  
  console.log(`Email polling set up. Checking for new emails every ${pollingInterval/60000} minutes`);
};

module.exports = { router, setupEmailPolling };