const Message = require('../models/message.model');
const logger = require('../utils/logger');

exports.getAllMessages = async (req, res) => {
  try {
    const { platform, direction, limit = 50, skip = 0 } = req.query;
    const filter = {};
    
    if (platform) filter.platform = platform;
    if (direction) filter.direction = direction;

    const messages = await Message.find(filter)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    res.json(messages);
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getMessageById = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.json(message);
  } catch (error) {
    logger.error('Get message by ID error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.searchMessages = async (req, res) => {
  try {
    const { query } = req.query;
    const messages = await Message.find({
      $or: [
        { 'content.text': { $regex: query, $options: 'i' } },
        { sender: { $regex: query, $options: 'i' } },
        { recipient: { $regex: query, $options: 'i' } },
      ],
    }).sort({ timestamp: -1 }).limit(50);

    res.json(messages);
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({ error: error.message });
  }
};