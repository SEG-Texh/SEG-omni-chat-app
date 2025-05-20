// test-email.js
// Run this script to test your email configuration separately
// Usage: node test-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// Test Nodemailer configuration (sending emails)
async function testSendEmail() {
  try {
    console.log(`Testing email sending with user: ${process.env.GMAIL_USER}`);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_USER, // Send to yourself for testing
      subject: 'Test Email from OmniChat App',
      text: 'If you received this, your nodemailer configuration is working!',
      html: '<p>If you received this, your <b>nodemailer configuration</b> is working!</p>'
    });
    
    console.log('✅ Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    console.error('Error details:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n👉 Authentication failed. Make sure you:');
      console.log('  1. Created an App Password in your Google Account');
      console.log('  2. Added it correctly to your .env file as GMAIL_APP_PASSWORD');
      console.log('  3. Are not using your regular Gmail password');
    }
    
    return false;
  }
}

// Test IMAP configuration (receiving emails)
function testImapConnection() {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Testing IMAP connection with user: ${process.env.GMAIL_USER}`);
      
      const imapConfig = {
        user: process.env.GMAIL_USER,
        password: process.env.GMAIL_APP_PASSWORD,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { 
          rejectUnauthorized: false,
          servername: 'imap.gmail.com'
        }
      };
      
      const imap = new Imap(imapConfig);
      
      imap.once('ready', () => {
        console.log('✅ IMAP connection successful!');
        
        // Try to list mailboxes as a further test
        imap.getBoxes((err, boxes) => {
          if (err) {
            console.error('Error fetching mailboxes:', err);
          } else {
            console.log('Available mailboxes:', Object.keys(boxes));
          }
          imap.end();
          resolve(true);
        });
      });
      
      imap.once('error', (err) => {
        console.error('❌ IMAP connection error:', err);
        
        if (err.source === 'authentication') {
          console.log('\n👉 IMAP Authentication failed. Make sure you:');
          console.log('  1. Created an App Password in your Google Account');
          console.log('  2. Added it correctly to your .env file as GMAIL_APP_PASSWORD');
          console.log('  3. Have enabled IMAP in your Gmail settings');
          console.log('  4. Are not using your regular Gmail password');
        }
        
        reject(err);
      });
      
      imap.once('end', () => {
        console.log('IMAP connection ended');
      });
      
      console.log('Connecting to IMAP server...');
      imap.connect();
    } catch (error) {
      console.error('❌ Error creating IMAP connection:', error);
      reject(error);
    }
  });
}

// Check environment variables
function checkEnvironmentVariables() {
  const requiredVars = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.log('Make sure you have created a .env file with the required variables.');
    return false;
  }
  
  return true;
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting email configuration tests...');
  
  // Check environment variables first
  if (!checkEnvironmentVariables()) {
    return;
  }
  
  console.log('\n📧 Testing Nodemailer (sending emails)...');
  const sendResult = await testSendEmail();
  
  console.log('\n📥 Testing IMAP (receiving emails)...');
  try {
    const imapResult = await testImapConnection();
    
    if (sendResult && imapResult) {
      console.log('\n🎉 SUCCESS! Both sending and receiving emails are working!');
      console.log('Your email configuration is correct. You can now run your main server.');
    } else {
      console.log('\n⚠️ Some tests failed. Review the errors above.');
    }
  } catch (error) {
    console.log('\n⚠️ IMAP test failed. Check your configuration.');
  }
}

// Run the tests when this script is executed
runTests();