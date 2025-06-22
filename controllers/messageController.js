const facebookController = require('./facebookController');

const sendMessage = async (req, res) => {
  const { receiverId, content, platform } = req.body;

  if (!receiverId || !content?.text || !platform) {
    return res.status(400).json({ error: 'receiverId, content.text, and platform are required' });
  }

  if (platform === 'facebook') {
    // Map to the structure expected by facebookController
    req.body.recipientId = receiverId;
    req.body.text = content.text;
    return facebookController.sendFacebookMessage(req, res);
  }

  // Add logic here for email, WhatsApp, or others
  if (platform === 'email') {
  const emailController = require('./emailController');
  req.body.to = receiverId; // Assuming receiverId is the email address
  req.body.text = content.text;
  return emailController.sendEmail(req, res);
  }

  return res.status(400).json({ error: `Unsupported platform: ${platform}` });
};

module.exports = { sendMessage };
