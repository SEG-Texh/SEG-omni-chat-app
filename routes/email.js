const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');
require('dotenv').config();

// Create reusable transporter object using Gmail SMTP for sending
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

// Configure IMAP for receiving emails
const imapConfig = {
  user: process.env.GMAIL_USER,
  password: process.env.GMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
};

// POST /email/send - Send an email and save to database
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
      userId
    });
    
    const savedEmail = await newEmail.save();
    
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
      email: savedEmail 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /email/receive - Fetch latest emails
router.get('/receive', async (req, res) => {
  const io = req.app.get('io');
  const { userId } = req.query;
  
  const imap = new Imap(imapConfig);
  
  imap.once('ready', () => {
    imap.openBox('INBOX', false, async (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // Search for unread emails from the last day
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      imap.search(['UNSEEN', ['SINCE', yesterday]], (err, results) => {
        if (err) {
          console.error('Error searching emails:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
        
        if (results.length === 0) {
          return res.status(200).json({ 
            success: true, 
            message: 'No new emails found', 
            emails: [] 
          });
        }
        
        const fetch = imap.fetch(results, { bodies: '' });
        const emails = [];
        
        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error('Error parsing email:', err);
                return;
              }
              
              try {
                // Check if email already exists in database
                const existingEmail = await Email.findOne({
                  from: parsed.from.text,
                  subject: parsed.subject,
                  date: parsed.date
                });
                
                if (!existingEmail) {
                  // Save email to database
                  const newEmail = new Email({
                    from: parsed.from.text,
                    to: parsed.to.text,
                    subject: parsed.subject,
                    text: parsed.text || '',
                    html: parsed.html || '',
                    status: 'received',
                    date: parsed.date,
                    userId: userId || null
                  });
                  
                  const savedEmail = await newEmail.save();
                  
                  // Add to response array
                  emails.push({
                    _id: savedEmail._id,
                    from: savedEmail.from,
                    to: savedEmail.to,
                    subject: savedEmail.subject,
                    text: savedEmail.text,
                    status: savedEmail.status,
                    date: savedEmail.date
                  });
                  
                  // Emit socket event for real-time updates
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
                console.error('Error saving email to database:', error);
              }
            });
          });
        });
        
        fetch.once('end', () => {
          imap.end();
          res.status(200).json({ 
            success: true, 
            message: `Retrieved ${emails.length} new emails`, 
            emails 
          });
        });
      });
    });
  });
  
  imap.once('error', (err) => {
    console.error('IMAP error:', err);
    res.status(500).json({ success: false, error: err.message });
  });
  
  imap.connect();
});

// GET /email/list - Get all emails for a user
router.get('/list', async (req, res) => {
  const { userId, status, limit = 20, skip = 0 } = req.query;
  
  try {
    let query = {};
    
    if (userId) {
      query.userId = userId;
    }
    
    if (status) {
      query.status = status;
    }
    
    const emails = await Email.find(query)
      .sort({ date: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
      
    const total = await Email.countDocuments(query);
    
    res.status(200).json({
      success: true,
      emails,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /email/:id - Get a specific email by ID
router.get('/:id', async (req, res) => {
  try {
    const email = await Email.findById(req.params.id);
    
    if (!email) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    res.status(200).json({
      success: true,
      email
    });
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a function to check for new emails periodically
function setupEmailPolling(app) {
  const pollInterval = process.env.EMAIL_POLL_INTERVAL || 60000; // Default to 1 minute
  
  setInterval(async () => {
    console.log('Checking for new emails...');
    const io = app.get('io');
    const imap = new Imap(imapConfig);
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Error opening inbox during polling:', err);
          return;
        }
        
        // Search for unread emails from the last poll interval
        const since = new Date();
        since.setTime(since.getTime() - pollInterval);
        
        imap.search(['UNSEEN', ['SINCE', since]], (err, results) => {
          if (err) {
            console.error('Error searching emails during polling:', err);
            return;
          }
          
          if (results.length === 0) {
            console.log('No new emails found during polling');
            imap.end();
            return;
          }
          
          console.log(`Found ${results.length} new emails during polling`);
          
          const fetch = imap.fetch(results, { bodies: '' });
          
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  console.error('Error parsing email during polling:', err);
                  return;
                }
                
                try {
                  // Check if email already exists in database
                  const existingEmail = await Email.findOne({
                    from: parsed.from.text,
                    subject: parsed.subject,
                    date: parsed.date
                  });
                  
                  if (!existingEmail) {
                    // Save email to database
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
                    
                    // Emit socket event for real-time updates
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
                  console.error('Error saving email to database during polling:', error);
                }
              });
            });
          });
          
          fetch.once('end', () => {
            console.log('Finished processing new emails during polling');
            imap.end();
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      console.error('IMAP error during polling:', err);
    });
    
    imap.connect();
  }, pollInterval);
}

module.exports = { router, setupEmailPolling };