// controllers/messageController.js
const Message = require('../models/message');

exports.saveFacebookMessage = async (event) => {
  if (!event.sender?.id || !event.recipient?.id || !event.message?.text) {
    console.log('Incomplete message event');
    return null;
  }

  const messageData = {
    senderId: event.sender.id,
    recipientId: event.recipient.id,
    source: 'facebook',
    content: event.message.text,
  };

  const newMessage = new Message(messageData);
  const validationError = newMessage.validateSync();

  if (validationError) {
    console.error('Validation failed:', validationError);
    return null;
  }

  await newMessage.save();
  console.log('Message saved successfully:', {
    id: newMessage._id,
    senderId: newMessage.senderId,
    recipientId: newMessage.recipientId
  });

  return newMessage;
};
