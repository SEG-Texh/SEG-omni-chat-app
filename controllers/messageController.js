const Message = require('../models/message');

exports.saveFacebookMessage = async (data) => {
  try {
    const message = new Message({
      sender: data.sender.id,
      recipient: data.recipient.id,
      text: data.message.text,
      source: 'facebook',
      direction: 'inbound', // ✅ Add this line
      timestamp: new Date()
    });
    await message.save();
    console.log('✅ Facebook message saved');
  } catch (err) {
    console.error('❌ Error saving Facebook message:', err);
  }
};
