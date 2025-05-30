const nodemailer = require('nodemailer');

exports.sendEmail = async (req, res) => {
  const { to, subject, text } = req.body;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });

    console.log('📤 Email sent to:', to);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Email send failed:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
};
