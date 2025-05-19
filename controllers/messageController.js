const Message = require('../models/message');

/**
 * Save incoming Facebook message to database
 * @param {Object} data - Facebook messenger event data
 * @returns {Promise<Object>} - The saved message object
 */
exports.saveFacebookMessage = async (data) => {
  try {
    // Validate that we have message data
    if (!data.sender || !data.recipient || !data.message || !data.message.text) {
      console.log('Incomplete message data:', data);
      return null;
    }
    
    const message = new Message({
      platform: 'facebook',
      sender: data.sender.id,
      recipient: data.recipient.id,
      content: data.message.text,
      direction: 'inbound',
      timestamp: new Date()
    });
    
    const savedMessage = await message.save();
    console.log('✅ Facebook message saved:', savedMessage._id);
    return savedMessage;
  } catch (err) {
    console.error('❌ Error saving Facebook message:', err);
    throw err; // Re-throw to allow proper error handling in route
  }
};

/**
 * Get all messages for a specific platform
 * @param {String} platform - Platform name (facebook, whatsapp, email)
 * @returns {Promise<Array>} - Array of messages
 */
exports.getMessagesByPlatform = async (platform) => {
  try {
    return await Message.find({ platform }).sort({ timestamp: -1 });
  } catch (err) {
    console.error(`❌ Error fetching ${platform} messages:`, err);
    throw err;
  }
};