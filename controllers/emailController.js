const nodemailer = require('nodemailer');
const BotService = require('../services/botService');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false // For development only
    }
  });
};

exports.sendEmail = async (req, res) => {
  try {
    const { to, subject, text, html, fromName } = req.body;
    
    if (!to || !subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, and text or html'
      });
    }

    const transporter = createTransporter();
    
    // Verify transporter configuration
    await transporter.verify();

    const fromAddress = fromName
      ? `${fromName} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`
      : process.env.SMTP_FROM || process.env.SMTP_USER;

    // Send the original email
    const mailOptions = {
      from: fromAddress,
      to,
      subject,
      text,
      html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('📤 Email sent to:', to, 'MessageId:', result.messageId);

    // Generate and send auto-reply using bot service
    const autoReply = BotService.generateEmailAutoReply(subject, to);
    const autoReplyOptions = {
      from: fromAddress,
      to,
      subject: autoReply.subject,
      text: autoReply.message,
      inReplyTo: result.messageId,
      references: result.messageId
    };

    // Send auto-reply
    const autoReplyResult = await transporter.sendMail(autoReplyOptions);
    console.log('🤖 Auto-reply sent to:', to, 'MessageId:', autoReplyResult.messageId);

    res.status(200).json({
      success: true,
      message: 'Email sent successfully with auto-reply',
      data: {
        originalEmail: {
          messageId: result.messageId,
          to,
          subject
        },
        autoReply: {
          messageId: autoReplyResult.messageId,
          subject: autoReply.subject
        }
      }
    });

  } catch (error) {
    console.error('❌ Email send failed:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Check your credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Check your SMTP settings.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Email rejected by recipient server.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
};

exports.sendAutoReplyOnly = async (req, res) => {
  try {
    const { to, originalSubject } = req.body;
    
    if (!to || !originalSubject) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, originalSubject'
      });
    }

    const transporter = createTransporter();
    const autoReply = BotService.generateEmailAutoReply(originalSubject, to);
    
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: autoReply.subject,
      text: autoReply.message
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('🤖 Auto-reply sent to:', to);

    res.status(200).json({
      success: true,
      message: 'Auto-reply sent successfully',
      data: {
        messageId: result.messageId,
        to,
        subject: autoReply.subject
      }
    });

  } catch (error) {
    console.error('❌ Auto-reply send failed:', error);
    
    let errorMessage = 'Failed to send auto-reply';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Check your credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email server. Check your SMTP settings.';
    } else if (error.responseCode === 550) {
      errorMessage = 'Auto-reply rejected by recipient server.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message,
      code: error.code
    });
  }
};

// Send bulk emails
exports.sendBulkEmails = async (req, res) => {
  try {
    const { recipients, subject, text, html, fromName } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array is required and must not be empty'
      });
    }

    if (!subject || (!text && !html)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: subject, and text or html'
      });
    }

    const transporter = createTransporter();
    await transporter.verify();

    const fromAddress = fromName
      ? `${fromName} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`
      : process.env.SMTP_FROM || process.env.SMTP_USER;

    const results = [];
    const errors = [];

    // Send emails in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (recipient) => {
        try {
          const mailOptions = {
            from: fromAddress,
            to: recipient,
            subject,
            text,
            html
          };

          const result = await transporter.sendMail(mailOptions);
          console.log('📤 Bulk email sent to:', recipient, 'MessageId:', result.messageId);
          
          return {
            to: recipient,
            messageId: result.messageId,
            status: 'sent'
          };
        } catch (error) {
          console.error('❌ Failed to send to:', recipient, error.message);
          errors.push({
            to: recipient,
            error: error.message,
            code: error.code
          });
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value));
      
      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk email operation completed. ${results.length} sent, ${errors.length} failed.`,
      data: {
        sent: results,
        failed: errors,
        summary: {
          total: recipients.length,
          sent: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Bulk email operation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk email operation failed',
      details: error.message
    });
  }
};

// Get email status/health check
exports.getEmailStatus = async (req, res) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    
    res.status(200).json({
      success: true,
      message: 'Email service is operational',
      data: {
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER
        },
        status: 'connected'
      }
    });
  } catch (error) {
    console.error('❌ Email service check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Email service unavailable',
      details: error.message
    });
  }
};