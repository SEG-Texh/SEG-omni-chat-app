const Message = require('../models/message');

exports.saveFacebookMessage = async (req, res) => {
  try {
    const entry = req.body.entry[0];
    const messagingEvent = entry.messaging[0];

    const message = new Message({
      platform: 'facebook',
      sender: messagingEvent.sender.id,
      recipient: messagingEvent.recipient.id,
      content: messagingEvent.message.text,
      timestamp: messagingEvent.timestamp,
      direction: 'inbound', // ✅ Required field
    });

    await message.save();
    res.sendStatus(200);
  } catch (error) {
    console.error('Error saving Facebook message:', error);
    res.sendStatus(500);
  }
};
