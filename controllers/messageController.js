const Message = require('../models/message');

exports.saveFacebookMessage = async (event) => {
  try {
    const senderId = event?.sender?.id;
    const recipientId = event?.recipient?.id;
    const messageText = event?.message?.text;

    if (!senderId || !recipientId || !messageText) {
      console.log('Incomplete or unsupported message event:', event);
      return null;
    }

    const messageData = {
      senderId,
      recipientId,
      source: 'facebook',
      content: messageText,
    };

    const newMessage = new Message(messageData);
    const validationError = newMessage.validateSync();

    if (validationError) {
      console.error('Validation failed:', validationError);
      return null;
    }

    await newMessage.save();

    console.log('Facebook message saved successfully:', {
      id: newMessage._id,
      senderId: newMessage.senderId,
      recipientId: newMessage.recipientId,
    });

    return newMessage;
  } catch (error) {
    console.error('Error saving Facebook message:', error);
    return null;
  }
};
