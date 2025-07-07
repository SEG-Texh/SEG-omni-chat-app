// Respond with TwiML to override Twilio's default 'OK' reply
const twilio = require('twilio');

function sendCustomTwilioReply(res, replyText = '') {
  const twiml = new twilio.twiml.MessagingResponse();
  if (replyText) {
    twiml.message(replyText);
    res.type('text/xml').send(twiml.toString());
  } else {
    // Send empty TwiML (no reply)
    res.type('text/xml').send('<Response></Response>');
  }
}

module.exports = { sendCustomTwilioReply };
