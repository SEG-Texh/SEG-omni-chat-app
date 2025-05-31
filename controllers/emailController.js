const nodemailer = require('nodemailer');
const BotService = require('../services/botService');

// Create email transporter with enhanced configuration
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // For development only
    },
    // Add debug logging
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

// Add email validation function
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

exports.sendEmail = async (req, res) => {
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
    
    // Verify transporter configuration with better error handling
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
    
    console.log('📤 Preparing to send email from:', fromAddress, 'to:', to);
    
    // Send the original email
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html,
      // Add additional headers for better deliverability
      headers: {
        'X-Mailer': 'Omni Chat App',
        'Reply-To': fromAddress
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
          'Auto-Submitted': 'auto-replied'
        }
      };
      
      // Send auto-reply
      autoReplyResult = await transporter.sendMail(autoReplyOptions);
      console.log('🤖 Auto-reply sent successfully:', {
        to: to,
        messageId: autoReplyResult.messageId,
        subject: autoReply.subject
      });
    } catch (autoReplyError) {
      console.error('⚠️ Auto-reply failed (but original email sent):', autoReplyError);
      // Don't fail the main request if auto-reply fails
    }
    
    res.status(200).json({
      success: true,
      message: autoReplyResult ? 'Email sent successfully with auto-reply' : 'Email sent successfully (auto-reply failed)',
      data: {
        originalEmail: {
          messageId: result.messageId,
          to,
          subject,
          accepted: result.accepted,
          rejected: result.rejected
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
      responseCode: error.responseCode
    });
  }
};

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
    
    // Verify connection
    await transporter.verify();
    console.log('✅ SMTP connection verified for auto-reply');
    
    const autoReply = BotService.generateEmailAutoReply(originalSubject, to);
    
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: autoReply.subject,
      text: autoReply.message,
      headers: {
        'X-Mailer': 'Omni Chat App Auto-Reply',
        'Auto-Submitted': 'auto-replied'
      }
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('🤖 Auto-reply sent successfully:', {
      to: to,
      messageId: result.messageId,
      subject: autoReply.subject
    });
    
    res.status(200).json({
      success: true,
      message: 'Auto-reply sent successfully',
      data: {
        messageId: result.messageId,
        to,
        subject: autoReply.subject,
        accepted: result.accepted,
        rejected: result.rejected
      }
    });
    
  } catch (error) {
    console.error('❌ Auto-reply send failed:', {
      error: error.message,
      code: error.code,
      responseCode: error.responseCode
    });
    
    // Provide more specific error messages
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

// Add a new endpoint to test SMTP configuration
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