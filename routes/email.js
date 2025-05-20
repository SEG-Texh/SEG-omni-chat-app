//routes/email.js - Replace your existing configurations with these:

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
  tls: {
    rejectUnauthorized: true
  }
});

// Configure IMAP for receiving emails
const imapConfig = {
  user: process.env.GMAIL_USER,
  password: process.env.GMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: true },
  authTimeout: 10000 // Add timeout for authentication
};

// Keep your existing routes (POST /email/send, GET /email/list, GET /email/:id)
// but replace the GET /email/receive route with the updated one below

// GET /email/receive - Fetch latest emails
router.get('/receive', async (req, res) => {
  const io = req.app.get('io');
  const { userId } = req.query;
  
  const imap = new Imap(imapConfig);
  const emails = [];
  
  // Set up a timeout to prevent hanging requests
  const timeout = setTimeout(() => {
    if (imap.state !== 'disconnected') {
      imap.end();
    }
    if (!res.headersSent) {
      res.status(504).json({ success: false, error: 'Request timeout' });
    }
  }, 30000); // 30 seconds timeout
  
  imap.once('ready', () => {
    imap.openBox('INBOX', false, async (err, box) => {
      if (err) {
        console.error('Error opening inbox:', err);
        clearTimeout(timeout);
        if (!res.headersSent) {
          return res.status(500).json({ success: false, error: err.message });
        }
        return;
      }
      
      // Search for unread emails
      imap.search(['UNSEEN'], (err, results) => {
        if (err) {
          console.error('Error searching emails:', err);
          clearTimeout(timeout);
          if (!res.headersSent) {
            return res.status(500).json({ success: false, error: err.message });
          }
          return;
        }
        
        if (results.length === 0) {
          clearTimeout(timeout);
          if (!res.headersSent) {
            return res.status(200).json({ 
              success: true, 
              message: 'No new emails found', 
              emails: [] 
            });
          }
          return;
        }
        
        console.log(`Found ${results.length} unread emails`);
        const fetch = imap.fetch(results, { bodies: '', markSeen: true });
        
        fetch.on('message', (msg) => {
          msg.on('body', (stream) => {
            simpleParser(stream, async (err, parsed) => {
              if (err) {
                console.error('Error parsing email:', err);
                return;
              }
              
              try {
                console.log('Processing email:', {
                  from: parsed.from?.text,
                  subject: parsed.subject
                });
                
                // Check if email already exists in database
                const existingEmail = await Email.findOne({
                  from: parsed.from?.text,
                  subject: parsed.subject,
                  date: parsed.date
                });
                
                if (!existingEmail) {
                  // Save email to database
                  const newEmail = new Email({
                    from: parsed.from?.text || 'Unknown Sender',
                    to: parsed.to?.text || process.env.GMAIL_USER,
                    subject: parsed.subject || '(No Subject)',
                    text: parsed.text || '',
                    html: parsed.html || '',
                    status: 'received',
                    date: parsed.date || new Date(),
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
                } else {
                  console.log('Email already exists in database');
                }
              } catch (error) {
                console.error('Error saving email to database:', error);
              }
            });
          });
        });
        
        fetch.once('error', (err) => {
          console.error('Fetch error:', err);
        });
        
        fetch.once('end', () => {
          console.log('All messages processed');
          imap.end();
        });
      });
    });
  });
  
  imap.once('error', (err) => {
    console.error('IMAP error:', err);
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  
  imap.once('end', () => {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(200).json({ 
        success: true, 
        message: `Retrieved ${emails.length} new emails`, 
        emails 
      });
    }
  });
  
  try {
    imap.connect();
  } catch (error) {
    console.error('Failed to connect to IMAP server:', error);
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// New verification endpoint - Add this to your existing routes
router.get('/verify-connection', async (req, res) => {
  try {
    // Verify SMTP connection
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection successful');
    
    // Verify IMAP connection
    console.log('Verifying IMAP connection...');
    const imap = new Imap(imapConfig);
    
    imap.once('ready', () => {
      console.log('IMAP connection successful');
      imap.end();
      res.status(200).json({ 
        success: true, 
        message: 'Email configuration is valid' 
      });
    });
    
    imap.once('error', (err) => {
      console.error('IMAP verification error:', err);
      res.status(500).json({ 
        success: false, 
        error: `IMAP connection failed: ${err.message}` 
      });
    });
    
    imap.connect();
  } catch (error) {
    console.error('Email verification failed:', error);
    res.status(500).json({ 
      success: false, 
      error: `SMTP connection failed: ${error.message}` 
    });
  }
});

// Replace the setupEmailPolling function with this improved version
function setupEmailPolling(app) {
  const pollInterval = process.env.EMAIL_POLL_INTERVAL || 60000; // Default to 1 minute
  
  setInterval(async () => {
    console.log('Checking for new emails...');
    const io = app.get('io');
    const imap = new Imap(imapConfig);
    
    // Handle connection errors properly
    imap.once('error', (err) => {
      console.error('IMAP error during polling:', err);
    });
    
    imap.once('end', () => {
      console.log('IMAP connection ended');
    });
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('Error opening inbox during polling:', err);
          imap.end();
          return;
        }
        
        // Use a more relaxed search criteria - just look for unread messages
        // Remove the time constraint which might be causing issues
        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('Error searching emails during polling:', err);
            imap.end();
            return;
          }
          
          if (results.length === 0) {
            console.log('No new emails found during polling');
            imap.end();
            return;
          }
          
          console.log(`Found ${results.length} new emails during polling`);
          
          const fetch = imap.fetch(results, { bodies: '', markSeen: true });
          
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  console.error('Error parsing email during polling:', err);
                  return;
                }
                
                try {
                  console.log('Received email:', {
                    from: parsed.from?.text,
                    subject: parsed.subject,
                    date: parsed.date
                  });
                  
                  // Check if email already exists in database
                  const existingEmail = await Email.findOne({
                    from: parsed.from?.text,
                    subject: parsed.subject,
                    date: parsed.date
                  });
                  
                  if (!existingEmail) {
                    // Save email to database
                    const newEmail = new Email({
                      from: parsed.from?.text || 'Unknown Sender',
                      to: parsed.to?.text || process.env.GMAIL_USER,
                      subject: parsed.subject || '(No Subject)',
                      text: parsed.text || '',
                      html: parsed.html || '',
                      status: 'received',
                      date: parsed.date || new Date()
                    });
                    
                    const savedEmail = await newEmail.save();
                    console.log('Saved new email to database:', savedEmail._id);
                    
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
                  } else {
                    console.log('Email already exists in database, skipping');
                  }
                } catch (error) {
                  console.error('Error saving email to database during polling:', error);
                }
              });
            });
          });
          
          fetch.once('error', (err) => {
            console.error('Fetch error during polling:', err);
            imap.end();
          });
          
          fetch.once('end', () => {
            console.log('Finished processing new emails during polling');
            imap.end();
          });
        });
      });
    });
    
    // Connect to the IMAP server
    try {
      imap.connect();
    } catch (error) {
      console.error('Failed to connect to IMAP server:', error);
    }
  }, pollInterval);
}

module.exports = { router, setupEmailPolling };