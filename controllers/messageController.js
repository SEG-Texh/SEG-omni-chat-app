// === controllers/messageController.js ===
const facebookController = require('./facebookController');
const emailController = require('./emailController');
const Message = require('../models/message');

const sendMessage = async (req, res) => {
  const { receiverId, content, platform } = req.body;

  if (!receiverId || !content?.text || !platform) {
    return res.status(400).json({ error: 'receiverId, content.text, and platform are required' });
  }

  try {
    if (platform === 'facebook') {
      req.body.recipientId = receiverId;
      req.body.text = content.text;
      await facebookController.sendFacebookMessage(req, res);
    } else if (platform === 'email') {
      req.body.to = receiverId;
      req.body.text = content.text;
      await emailController.sendEmail(req, res);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { sendMessage };
