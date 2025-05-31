// Enhanced email controller with comprehensive tracking and email receiving
const nodemailer = require('nodemailer');
const { simpleParser } = require('mailparser');
const BotService = require('../services/botService');

// Email tracking store (in production, use a database)
const emailLog = new Map();
const receivedEmails = new Map(); // Store for received emails

// Create email transporter with enhanced configuration
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: process.env.NODE_ENV === 'development',
    logger: process.env.NODE_ENV === 'development'
  };
  
  console.log('📧 Email transporter config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user ? '***masked***' : 'NOT SET',
    pass: config.auth.pass ? '***masked***' : 'NOT SET'
  });
  
  return nodemailer.createTransporter(config);
};

// Create IMAP connection for receiving emails
const createImapConnection = () => {
  const Imap = require('imap');
  
  const config = {
    user: process.env.IMAP_USER || process.env.SMTP_USER,
    password: process.env.IMAP_PASS || process.env.SMTP_PASS,
    host: process.env.IMAP_HOST || (process.env.SMTP_HOST === 'smtp.gmail.com' ? 'imap.gmail.com' : process.env.SMTP_HOST),
    port: parseInt(process.env.IMAP_PORT) || 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false
    }
  };
  
  console.log('📥 IMAP config:', {
    host: config.host,
    port: config.port,
    user: config.user ? '***masked***' : 'NOT SET'
  });
  
  return new Imap(config);
};

// Enhanced email validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Email tracking functions
const logEmailEvent = (eventType, emailData, result = null, error = null) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    emailData: {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      messageId: result?.messageId || emailData.messageId
    },
    result,
    error: error?.message || null,
    isToSmtpUser: emailData.to === process.env.SMTP_USER
  };
  
  // Store in memory (use database in production)
  const logId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  emailLog.set(logId, logEntry);
  
  // Enhanced console logging with special marking for SMTP_USER emails
  const userIndicator = logEntry.isToSmtpUser ? '🎯 [TO SMTP_USER]' : '';
  console.log(`📧 ${eventType} ${userIndicator}:`, {
    timestamp: logEntry.timestamp,
    to: emailData.to,
    subject: emailData.subject,
    messageId: result?.messageId,
    isToSmtpUser: logEntry.isToSmtpUser
  });
  
  // Special notification for emails sent to SMTP_USER
  if (logEntry.isToSmtpUser) {
    console.log(`🎯 ALERT: Email sent to SMTP_USER (${process.env.SMTP_USER})`);
    console.log(`   Subject: ${emailData.subject}`);
    console.log(`   Time: ${logEntry.timestamp}`);
    console.log(`   Message ID: ${result?.messageId || 'N/A'}`);
  }
  
  return logId;
};

// Store received email
const storeReceivedEmail = (emailData) => {
  const emailId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const entry = {
    id: emailId,
    timestamp: new Date().toISOString(),
    ...emailData
  };
  
  receivedEmails.set(emailId, entry);
  console.log('📨 Email received and stored:', {
    id: emailId,
    from: emailData.from,
    subject: emailData.subject,
    timestamp: entry.timestamp
  });
  
  return emailId;
};

// Get email logs with filtering
const getEmailLogs = (filterToSmtpUser = false) => {
  const logs = Array.from(emailLog.values());
  
  if (filterToSmtpUser) {
    return logs.filter(log => log.isToSmtpUser);
  }
  
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

// Get received emails
const getReceivedEmails = (limit = 50) => {
  const emails = Array.from(receivedEmails.values());
  return emails
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// IMAP email fetching function
const fetchEmails = () => {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection();
    const emails = [];
    
    imap.once('ready', () => {
      console.log('📥 IMAP connection ready');
      
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          console.error('❌ Failed to open INBOX:', err);
          return reject(err);
        }
        
        console.log(`📮 INBOX opened, ${box.messages.total} total messages`);
        
        // Search for recent unseen emails
        imap.search(['UNSEEN'], (err, results) => {
          if (err) {
            console.error('❌ Search failed:', err);
            return reject(err);
          }
          
          if (!results || results.length === 0) {
            console.log('📪 No new emails found');
            imap.end();
            return resolve([]);
          }
          
          console.log(`📬 Found ${results.length} new emails`);
          
          const fetch = imap.fetch(results, {
            bodies: '',
            markSeen: true
          });
          
          fetch.on('message', (msg, seqno) => {
            console.log(`📨 Processing email #${seqno}`);
            let emailData = {};
            
            msg.on('body', (stream, info) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              
              stream.once('end', () => {
                simpleParser(buffer)
                  .then(parsed => {
                    emailData = {
                      seqno,
                      messageId: parsed.messageId,
                      from: parsed.from?.text || 'Unknown',
                      to: parsed.to?.text || '',
                      subject: parsed.subject || 'No Subject',
                      text: parsed.text || '',
                      html: parsed.html || '',
                      date: parsed.date || new Date(),
                      attachments: parsed.attachments || []
                    };
                    
                    // Store the received email
                    const emailId = storeReceivedEmail(emailData);
                    emailData.id = emailId;
                    emails.push(emailData);
                  })
                  .catch(parseErr => {
                    console.error('❌ Email parsing failed:', parseErr);
                  });
              });
            });
            
            msg.once('end', () => {
              console.log(`✅ Finished processing email #${seqno}`);
            });
          });
          
          fetch.once('error', (fetchErr) => {
            console.error('❌ Fetch error:', fetchErr);
            reject(fetchErr);
          });
          
          fetch.once('end', () => {
            console.log('📥 Finished fetching all emails');
            imap.end();
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      console.error('❌ IMAP connection error:', err);
      reject(err);
    });
    
    imap.once('end', () => {
      console.log('📥 IMAP connection ended');
      resolve(emails);
    });
    
    imap.connect();
  });
};

// Send Email Function
exports.sendEmail = async (req, res) => {
  let logId = null;
  
  try {
    console.log('📨 Incoming email request:', {
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });

    const { to, subject, text, html, fromName } = req.body;
    
    // Enhanced validation
    if (!to || !subject || (!text && !html)) {
      console.log('❌ Validation failed - missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and text or html',
        received: { to: !!to, subject: !!subject, text: !!text, html: !!html }
      });
    }

    // Validate email format
    if (!validateEmail(to)) {
      console.log('❌ Invalid email format:', to);
      return res.status(400).json({
        success: false,
        error: 'Invalid email format for recipient'
      });
    }
    
    const transporter = createTransporter();
    
    // Verify transporter configuration
    try {
      console.log('🔍 Verifying SMTP connection...');
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP verification failed:', verifyError);
      return res.status(500).json({
        success: false,
        error: 'SMTP configuration error',
        details: verifyError.message
      });
    }
    
    const fromAddress = fromName 
      ? `${fromName} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`
      : process.env.SMTP_FROM || process.env.SMTP_USER;
    
    // Log email attempt
    logId = logEmailEvent('EMAIL_ATTEMPT', { to, from: fromAddress, subject });
    
    console.log('📤 Preparing to send email from:', fromAddress, 'to:', to);
    
    // Send the original email
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html,
      headers: {
        'X-Mailer': 'Omni Chat App',
        'Reply-To': fromAddress,
        'X-Email-Log-ID': logId
      }
    };
    
    console.log('📧 Mail options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      hasText: !!mailOptions.text,
      hasHtml: !!mailOptions.html
    });
    
    const result = await transporter.sendMail(mailOptions);
    
    // Log successful send
    logEmailEvent('EMAIL_SENT', { to, from: fromAddress, subject }, result);
    
    console.log('✅ Email sent successfully!');
    console.log('📤 Email details:', {
      to: to,
      messageId: result.messageId,
      response: result.response,
      accepted: result.accepted,
      rejected: result.rejected,
      pending: result.pending
    });
    
    // Generate and send auto-reply using bot service
    let autoReplyResult = null;
    try {
      console.log('🤖 Generating auto-reply...');
      const autoReply = BotService.generateEmailAutoReply(subject, to);
      
      const autoReplyOptions = {
        from: fromAddress,
        to,
        subject: autoReply.subject,
        text: autoReply.message,
        inReplyTo: result.messageId,
        references: result.messageId,
        headers: {
          'X-Mailer': 'Omni Chat App Auto-Reply',
          'Auto-Submitted': 'auto-replied',
          'X-Email-Log-ID': logId
        }
      };
      
      // Log auto-reply attempt
      logEmailEvent('AUTO_REPLY_ATTEMPT', { 
        to, 
        from: fromAddress, 
        subject: autoReply.subject 
      });
      
      // Send auto-reply
      autoReplyResult = await transporter.sendMail(autoReplyOptions);
      
      // Log auto-reply success
      logEmailEvent('AUTO_REPLY_SENT', { 
        to, 
        from: fromAddress, 
        subject: autoReply.subject 
      }, autoReplyResult);
      
      console.log('🤖 Auto-reply sent successfully:', {
        to: to,
        messageId: autoReplyResult.messageId,
        subject: autoReply.subject
      });
    } catch (autoReplyError) {
      console.error('⚠️ Auto-reply failed (but original email sent):', autoReplyError);
      logEmailEvent('AUTO_REPLY_FAILED', { 
        to, 
        from: fromAddress, 
        subject: 'Auto-reply' 
      }, null, autoReplyError);
    }
    
    res.status(200).json({
      success: true,
      message: autoReplyResult ? 'Email sent successfully with auto-reply' : 'Email sent successfully (auto-reply failed)',
      data: {
        logId,
        originalEmail: {
          messageId: result.messageId,
          to,
          subject,
          accepted: result.accepted,
          rejected: result.rejected,
          sentToSmtpUser: to === process.env.SMTP_USER
        },
        autoReply: autoReplyResult ? {
          messageId: autoReplyResult.messageId,
          subject: autoReplyResult.subject || 'Auto-reply'
        } : null
      }
    });
    
  } catch (error) {
    console.error('❌ Email send failed with detailed error:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    
    // Log the failure
    if (logId) {
      logEmailEvent('EMAIL_FAILED', req.body, null, error);
    }
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Check your SMTP credentials.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Could not connect to email server. Check your SMTP host and port settings.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection timed out. Check your network connection.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Email rejected by recipient server. Check the recipient email address.';
    } else if (error.responseCode === 535) {
      errorMessage = 'SMTP authentication failed. Check your username and password.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code,
      responseCode: error.responseCode,
      logId
    });
  }
};

// Receive Emails Function
exports.receiveEmails = async (req, res) => {
  try {
    console.log('📥 Checking for new emails...');
    
    const emails = await fetchEmails();
    
    console.log(`📬 Retrieved ${emails.length} new emails`);
    
    res.status(200).json({
      success: true,
      message: `Retrieved ${emails.length} new emails`,
      data: {
        emailCount: emails.length,
        emails: emails.map(email => ({
          id: email.id,
          from: email.from,
          subject: email.subject,
          date: email.date,
          hasAttachments: email.attachments.length > 0
        })),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to receive emails:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to receive emails',
      details: error.message,
      code: error.code
    });
  }
};

// Get received emails
exports.getReceivedEmails = async (req, res) => {
  try {
    const { limit = 50, detailed = false } = req.query;
    const emails = getReceivedEmails(parseInt(limit));
    
    const responseData = detailed === 'true' 
      ? emails 
      : emails.map(email => ({
          id: email.id,
          from: email.from,
          subject: email.subject,
          date: email.date,
          timestamp: email.timestamp,
          hasAttachments: email.attachments?.length > 0
        }));
    
    res.status(200).json({
      success: true,
      message: `Retrieved ${emails.length} received emails`,
      data: {
        emailCount: emails.length,
        emails: responseData,
        filters: {
          limit: parseInt(limit),
          detailed: detailed === 'true'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get received emails:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get received emails',
      details: error.message
    });
  }
};

// Get specific received email
exports.getReceivedEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const email = receivedEmails.get(id);
    
    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Email retrieved successfully',
      data: email
    });
    
  } catch (error) {
    console.error('❌ Failed to get email:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get email',
      details: error.message
    });
  }
};

// Test IMAP connection
exports.testImapConnection = async (req, res) => {
  try {
    console.log('🔍 Testing IMAP connection...');
    
    const imap = createImapConnection();
    
    const testConnection = new Promise((resolve, reject) => {
      imap.once('ready', () => {
        console.log('✅ IMAP connection test successful');
        imap.end();
        resolve(true);
      });
      
      imap.once('error', (err) => {
        console.error('❌ IMAP connection test failed:', err);
        reject(err);
      });
      
      imap.connect();
    });
    
    await testConnection;
    
    res.status(200).json({
      success: true,
      message: 'IMAP connection successful',
      config: {
        host: process.env.IMAP_HOST || 'auto-detected',
        port: process.env.IMAP_PORT || '993',
        user: process.env.IMAP_USER || process.env.SMTP_USER ? 'configured' : 'not configured'
      }
    });
    
  } catch (error) {
    console.error('❌ IMAP connection test failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'IMAP connection failed',
      details: error.message,
      code: error.code
    });
  }
};

// Auto-reply only function (unchanged)
exports.sendAutoReplyOnly = async (req, res) => {
  try {
    console.log('🤖 Auto-reply only request:', req.body);
    
    const { to, originalSubject } = req.body;
    
    if (!to || !originalSubject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, originalSubject'
      });
    }

    if (!validateEmail(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format for recipient'
      });
    }
    
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ SMTP connection verified for auto-reply');
    
    const autoReply = BotService.generateEmailAutoReply(originalSubject, to);
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    
    // Log auto-reply attempt
    const logId = logEmailEvent('AUTO_REPLY_ONLY_ATTEMPT', { 
      to, 
      from: fromAddress, 
      subject: autoReply.subject 
    });
    
    const mailOptions = {
      from: fromAddress,
      to,
      subject: autoReply.subject,
      text: autoReply.message,
      headers: {
        'X-Mailer': 'Omni Chat App Auto-Reply',
        'Auto-Submitted': 'auto-replied',
        'X-Email-Log-ID': logId
      }
    };
    
    const result = await transporter.sendMail(mailOptions);
    
    // Log success
    logEmailEvent('AUTO_REPLY_ONLY_SENT', { 
      to, 
      from: fromAddress, 
      subject: autoReply.subject 
    }, result);
    
    console.log('🤖 Auto-reply sent successfully:', {
      to: to,
      messageId: result.messageId,
      subject: autoReply.subject
    });
    
    res.status(200).json({
      success: true,
      message: 'Auto-reply sent successfully',
      data: {
        logId,
        messageId: result.messageId,
        to,
        subject: autoReply.subject,
        accepted: result.accepted,
        rejected: result.rejected,
        sentToSmtpUser: to === process.env.SMTP_USER
      }
    });
    
  } catch (error) {
    console.error('❌ Auto-reply send failed:', {
      error: error.message,
      code: error.code,
      responseCode: error.responseCode
    });
    
    let errorMessage = 'Failed to send auto-reply';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Check your SMTP credentials.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Could not connect to email server. Check your SMTP settings.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Email rejected by recipient server.';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code,
      responseCode: error.responseCode
    });
  }
};

// Test SMTP connection (unchanged)
exports.testSmtpConnection = async (req, res) => {
  try {
    console.log('🔍 Testing SMTP connection...');
    
    const transporter = createTransporter();
    await transporter.verify();
    
    console.log('✅ SMTP connection test successful');
    
    res.status(200).json({
      success: true,
      message: 'SMTP connection successful',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE,
        user: process.env.SMTP_USER ? 'configured' : 'not configured'
      }
    });
    
  } catch (error) {
    console.error('❌ SMTP connection test failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'SMTP connection failed',
      details: error.message,
      code: error.code
    });
  }
};

// Get email logs (unchanged)
exports.getEmailLogs = async (req, res) => {
  try {
    const { toSmtpUser, limit = 100 } = req.query;
    const filterToSmtpUser = toSmtpUser === 'true';
    
    let logs = getEmailLogs(filterToSmtpUser);
    
    // Apply limit
    if (limit && parseInt(limit) > 0) {
      logs = logs.slice(0, parseInt(limit));
    }
    
    const smtpUserEmails = logs.filter(log => log.isToSmtpUser);
    
    res.status(200).json({
      success: true,
      message: 'Email logs retrieved successfully',
      data: {
        totalLogs: logs.length,
        smtpUserEmailCount: smtpUserEmails.length,
        logs,
        filters: {
          toSmtpUser: filterToSmtpUser,
          limit: parseInt(limit) || 100
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to retrieve email logs:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve email logs',
      details: error.message
    });
  }
};

// Get SMTP user emails (unchanged)
exports.getSmtpUserEmails = async (req, res) => {
  try {
    const smtpUserEmails = getEmailLogs(true);
    
    console.log(`📊 Found ${smtpUserEmails.length} emails sent to SMTP_USER (${process.env.SMTP_USER})`);
    
    res.status(200).json({
      success: true,
      message: `Found ${smtpUserEmails.length} emails sent to SMTP_USER`,
      data: {
        smtpUser: process.env.SMTP_USER,
        emailCount: smtpUserEmails.length,
        emails: smtpUserEmails,
        lastEmailTime: smtpUserEmails[0]?.timestamp || null
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to retrieve SMTP user emails:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve SMTP user emails',
      details: error.message
    });
  }
};

// Export the emailLog for stats route
exports.emailLog = emailLog;

module.exports = {
  sendEmail: exports.sendEmail,
  sendAutoReplyOnly: exports.sendAutoReplyOnly,
  testSmtpConnection: exports.testSmtpConnection,
  testImapConnection: exports.testImapConnection,
  getEmailLogs: exports.getEmailLogs,
  getSmtpUserEmails: exports.getSmtpUserEmails,
  receiveEmails: exports.receiveEmails,
  getReceivedEmails: exports.getReceivedEmails,
  getReceivedEmail: exports.getReceivedEmail,
  emailLog
};