const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

function sendEmail(to, subject, text) {
    return transporter.sendMail({ from: process.env.SMTP_USER, to, subject, text });
}

module.exports = { sendEmail };
