const Conversation = require('../models/conversation');
const Message = require('../models/message');
const axios = require('axios');

// Facebook Webhook Handler
exports.webhook = async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        const senderId = event.sender.id;
        const recipientId = event.recipient.id;
        const messageText = event.message && event.message.text;
        const platformMessageId = event.message && event.message.mid;

        // Check for duplicate message
        if (platformMessageId) {
          const exists = await Message.findOne({ platform: 'facebook', platformMessageId });
          if (exists) continue; // Skip duplicate
        }

        // 1. Find or create conversation
        let conversation = await Conversation.findOne({
          platform: 'facebook',
          participants: { $all: [senderId, recipientId] }
        });
        if (!conversation) {
          conversation = await Conversation.create({
            platform: 'facebook',
            participants: [senderId, recipientId],
            lastMessage: null,
            unreadCount: 0
          });
          req.io.emit('new_facebook_conversation', conversation);
        }

        // 2. Save message
        const message = await Message.create({
          conversation: conversation._id,
          sender: senderId,
          content: messageText,
          platform: 'facebook',
          platformMessageId
        });

        // 3. Update conversation
        conversation.lastMessage = message._id;
        conversation.unreadCount += 1;
        await conversation.save();

        // 4. Broadcast message to frontend
        req.io.to(`conversation_${conversation._id}`).emit('new_message', message);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
};

// Send message to Facebook user
exports.sendMessage = async (req, res) => {
  const { conversationId, content } = req.body;
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  // Assume req.user.facebookId is your page's ID
  const senderId = req.user.facebookId;
  const recipientId = conversation.participants.find(id => id !== senderId);

  // Send to Facebook
  await axios.post(
    `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      message: { text: content }
    }
  );

  // Save message
  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    content,
    platform: 'facebook'
  });

  // Update conversation
  conversation.lastMessage = message._id;
  await conversation.save();

  // Broadcast to room
  req.io.to(`conversation_${conversationId}`).emit('new_message', message);

  res.json({ success: true, message });
};

// List conversations for the logged-in user
exports.listConversations = async (req, res) => {
  const userId = req.user.facebookId;
  const conversations = await Conversation.find({
    platform: 'facebook',
    participants: userId
  }).populate('lastMessage').sort({ updatedAt: -1 });
  res.json(conversations);
};

// List messages for a conversation
exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const messages = await Message.find({ conversation: conversationId }).sort({ createdAt: 1 });
  res.json(messages);
};
