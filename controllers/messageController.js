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

/**
 * Get conversations grouped by participants with last message
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $group: {
          _id: '$sender', // Using 'sender' to match your schema
          lastMessage: { $last: '$$ROOT' },
        },
      },
      { $sort: { 'lastMessage.timestamp': -1 } },
    ]);
    
    res.status(200).json(conversations);
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};

/**
 * Get conversation between two participants
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getConversationMessages = async (req, res) => {
  try {
    const { sender, recipient } = req.params;
    
    const messages = await Message.find({
      $or: [
        { sender: sender, recipient: recipient },
        { sender: recipient, recipient: sender }
      ]
    }).sort({ timestamp: 1 }); // Ascending order for conversation flow
    
    res.status(200).json(messages);
  } catch (err) {
    console.error('Error fetching conversation messages:', err);
    res.status(500).json({ error: 'Failed to get conversation messages' });
  }
};

/**
 * Get conversations with better grouping logic
 * Groups by unique sender-recipient pairs regardless of direction
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getConversationsImproved = async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $addFields: {
          // Create a consistent conversation ID by sorting participants
          conversationId: {
            $cond: {
              if: { $lt: ['$sender', '$recipient'] },
              then: { $concat: ['$sender', '-', '$recipient'] },
              else: { $concat: ['$recipient', '-', '$sender'] }
            }
          }
        }
      },
      {
        $sort: { timestamp: 1 } // Sort by timestamp first
      },
      {
        $group: {
          _id: '$conversationId',
          participants: {
            $addToSet: {
              $cond: {
                if: { $lt: ['$sender', '$recipient'] },
                then: ['$sender', '$recipient'],
                else: ['$recipient', '$sender']
              }
            }
          },
          lastMessage: { $last: '$$ROOT' },
          messageCount: { $sum: 1 },
          firstMessage: { $first: '$$ROOT' }
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      },
      {
        $project: {
          _id: 1,
          participants: { $arrayElemAt: ['$participants', 0] },
          lastMessage: 1,
          messageCount: 1,
          firstMessageTime: '$firstMessage.timestamp',
          lastMessageTime: '$lastMessage.timestamp'
        }
      }
    ]);
    
    res.status(200).json(conversations);
  } catch (err) {
    console.error('Error fetching improved conversations:', err);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};