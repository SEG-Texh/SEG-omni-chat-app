const Conversation = require('../models/conversation');
const Message = require('../models/message');

class FacebookController {
  // Webhook for receiving Facebook messages from customers
  async webhook(req, res) {
    try {
      const body = req.body;
      let senderId, text;
      // Basic Facebook Messenger webhook format
      if (body.object === 'page' && body.entry) {
        for (const entry of body.entry) {
          if (entry.messaging) {
            for (const event of entry.messaging) {
              if (event.message && event.message.text) {
                senderId = event.sender.id;
                text = event.message.text;
              }
            }
          }
        }
      }
      if (!senderId || !text) {
        return res.status(400).json({ error: 'Invalid Facebook webhook payload' });
      }
      // Check for active conversation
      let conversation = await Conversation.findOne({
        customerId: senderId,
        status: 'active',
        expiresAt: { $gt: new Date() },
        platform: 'facebook'
      });
      if (!conversation) {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 35 * 60 * 1000);
        conversation = await Conversation.create({
          platform: 'facebook',
          platformConversationId: `${senderId}_${Date.now()}`,
          customerId: senderId,
          participants: [senderId],
          status: 'active',
          startTime: now,
          expiresAt
        });
        // Emit real-time event for new conversation
        try {
          const io = require('../config/socket').getIO();
          io.emit('new_conversation', { conversation });
        } catch (e) {
          console.error('[FB][Socket] Failed to emit new_conversation:', e);
        }
      }
      // Save inbound message
      let platformMessageId = null;
      if (body.entry && body.entry[0]?.messaging && body.entry[0].messaging[0]?.message?.mid) {
        platformMessageId = body.entry[0].messaging[0].message.mid;
      }
      if (!platformMessageId) {
        platformMessageId = `fb_in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      const messageDoc = new Message({
        conversation: conversation._id,
        sender: senderId,
        content: { text },
        platform: 'facebook',
        direction: 'inbound',
        platformMessageId
      });
      await messageDoc.save();
      res.sendStatus(200);
    } catch (error) {
      console.error('[FB][Webhook] Error handling Facebook message:', error);
      res.sendStatus(500);
    }
  }

  // Send outbound Facebook message (placeholder, to be implemented)
  async sendMessage(recipientId, text) {
    // Implement Facebook Graph API send logic here if needed
    console.log(`[FB][Bot] Would send message to ${recipientId}: ${text}`);
    return { status: 'ok' };
  }
}

module.exports = new FacebookController();
