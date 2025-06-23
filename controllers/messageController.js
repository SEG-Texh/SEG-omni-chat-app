const Message = require('../models/message');
const { sendEmail } = require('./emailController');

async function sendMessage(req, res) {
  try {
    const { receiverId, content, platform = 'web' } = req.body;

    if (!receiverId || !content?.text || !platform) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: {
          receiverId: !receiverId ? 'Missing receiverId' : undefined,
          content: !content?.text ? 'Missing message text' : undefined,
          platform: !platform ? 'Missing platform' : undefined
        }
      });
    }

    let result;
    
    if (platform === 'email') {
      result = await sendEmail(req, res, true); // true = internal call
      if (result.error) throw new Error(result.error);
    } 
    // Add other platform handlers here
    
    // Save to database
    const newMessage = new Message({
      sender: req.user._id,
      recipient: receiverId,  // Changed to match model
      content: {
        text: content.text,
        attachments: content.attachments || []
      },
      platform,
      direction: 'outbound',
      status: 'sent'
    });

    const savedMessage = await newMessage.save();

    // Emit via Socket.IO
    const io = req.app.get('socketio');
    io.emit('new_message', { message: savedMessage });

    return res.status(200).json(savedMessage);

  } catch (error) {
    console.error('sendMessage error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

module.exports = { sendMessage };