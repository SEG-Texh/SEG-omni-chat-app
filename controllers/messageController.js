const facebookController = require('./facebookController');
const emailController = require('./emailController');
const Message = require('../models/message');

const sendMessage = async (req, res) => {
  const { receiverId, content, platform } = req.body;

  if (!receiverId || !content?.text || !platform) {
    return res.status(400).json({ error: 'receiverId, content.text, and platform are required' });
  }

  try {
    // 1. Handle Facebook message
    if (platform === 'facebook') {
      req.body.recipientId = receiverId;
      req.body.text = content.text;

      const fbResponse = await facebookController.sendFacebookMessage(req, res, true); // true = internal call
      if (!fbResponse || fbResponse.error) throw new Error('Facebook send failed');
    }

    // 2. Handle Email
    else if (platform === 'email') {
      req.body.to = receiverId;
      req.body.text = content.text;

      const emailResponse = await emailController.sendEmail(req, res, true); // true = internal call
      if (!emailResponse || emailResponse.error) throw new Error('Email send failed');
    }

    // 3. Save to database
    const newMessage = new Message({
      sender: req.user._id,
      receiver: receiverId,
      content: {
        text: content.text,
        attachments: content.attachments || []
      },
      platform,
      labels: ['outgoing'],
      createdAt: new Date()
    });

    const savedMessage = await newMessage.save();

    // 4. Emit via Socket.IO
    const io = req.app.get('socketio');
    io.emit('new_message', { message: savedMessage });

    return res.status(200).json(savedMessage);

  } catch (error) {
    console.error('sendMessage error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send message' });
  }
};

module.exports = { sendMessage };
