const { simpleParser } = require('mailparser');
const Imap = require('imap');

function startEmailListener() {
    const imap = new Imap({
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASS,
        host: 'imap.gmail.com',
        port: 993,
        tls: true
    });

    imap.once('ready', () => {
        imap.openBox('INBOX', false, () => {
            imap.on('mail', () => {
                // fetch and parse new messages
            });
        });
    });

    imap.connect();
}

module.exports = { startEmailListener };
