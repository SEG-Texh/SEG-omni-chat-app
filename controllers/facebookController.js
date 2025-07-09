const Conversation = require('../models/conversation');
const Message = require('../models/message');
const User = require('../models/User');
const axios = require('axios');



// Facebook Graph API helper
async function sendFacebookMessage(recipientId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text }
      }
    );
    console.log(`[FB][Bot] Sent message to ${recipientId}: ${text}`);
  } catch (error) {
    console.error('[FB][Bot] Failed to send message:', error?.response?.data || error.message || error);
  }
}

// Facebook Webhook Handler
exports.webhook = async (req, res) => {
  try {
    console.log('Facebook webhook request received');
    console.log('Request Headers:', req.headers);
    console.log('Request Query:', req.query);
    console.log('Request Body:', req.body);
    console.log('Environment Variables:', {
      FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
      NODE_ENV: process.env.NODE_ENV
    });

    // Check if this is a webhook verification request
    if (req.query['hub.mode'] === 'subscribe') {
      console.log('Webhook verification request received');
      console.log('Request Headers:', {
        'Content-Type': req.headers['content-type'],
        'User-Agent': req.headers['user-agent']
      });
      console.log('Request Query:', {
        mode: req.query['hub.mode'],
        verify_token: req.query['hub.verify_token'],
        challenge: req.query['hub.challenge']
      });
      console.log('Environment Variables:', {
        FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
        NODE_ENV: process.env.NODE_ENV
      });
      
      const verifyToken = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (!verifyToken || !challenge) {
        console.error('Missing verification parameters');
        return res.status(400).json({ 
          error: 'Missing verification parameters',
          details: 'Both verify_token and challenge are required'
        });
      }

      if (!process.env.FACEBOOK_VERIFY_TOKEN) {
        console.error('FACEBOOK_VERIFY_TOKEN not set in environment');
        return res.status(500).json({ 
          error: 'Server configuration error',
          details: 'FACEBOOK_VERIFY_TOKEN is not set'
        });
      }

      if (verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
        console.log('Verification token matches! Sending challenge:', challenge);
        return res.status(200).send(challenge);
      }

      console.error('Verification token mismatch!');
      console.error('Expected:', process.env.FACEBOOK_VERIFY_TOKEN);
      console.error('Received:', verifyToken);
      return res.status(403).json({ 
        error: 'Verification token mismatch',
        expected: process.env.FACEBOOK_VERIFY_TOKEN,
        received: verifyToken
      });
    }

    // Process incoming message
    if (req.body.object === 'page') {
      for (const entry of req.body.entry) {
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (!event.message || !event.message.text) continue;
            const senderId = event.sender.id;
            const messageText = event.message.text;
            const timestamp = event.timestamp;

            // 1. Create or find conversation
            let conversation = await Conversation.findOne({
              platform: 'facebook',
              customerId: senderId,
              status: { $in: ['pending', 'awaiting_agent', 'active'] }
            });
            if (!conversation) {
              conversation = new Conversation({
                platform: 'facebook',
                platformConversationId: event.message.mid || undefined,
                participants: [senderId],
                agentId: null,
                locked: false,
                status: 'pending',
                customerId: senderId
              });
              await conversation.save();
            }

            // Bot message logic
            const inboundCount = await Message.countDocuments({ conversation: conversation._id, sender: senderId });
            if (inboundCount === 0) {
              await sendFacebookMessage(senderId, "Hi, welcome. How may I help you?");
            } else if (inboundCount === 1) {
              await sendFacebookMessage(senderId, "Would you like to chat with a live user? Yes / No");
            } else if (messageText.trim().toLowerCase() === 'yes') {
              await sendFacebookMessage(senderId, "Okay, connecting you to a live agent now...");
              conversation.status = 'awaiting_agent';
              await conversation.save();
              if (req.io) {
                req.io.emit('new_live_chat_request', {
                  conversationId: conversation._id,
                  customerId: senderId,
                  platform: 'facebook',
                  message: messageText,
                });
              }
            } else if (messageText.trim().toLowerCase() === 'no') {
              await sendFacebookMessage(senderId, "Okay! Let me know if you need anything else.");
            } else if (inboundCount >= 2) {
              await sendFacebookMessage(senderId, "Please reply Yes or No if you want to chat with a live user.");
            }

            // Always record the message
            await Message.create({
              platform: 'facebook',
              platformMessageId: event.message.mid,
              conversation: conversation._id,
              sender: senderId,
              content: messageText,
              timestamp: new Date(timestamp)
            });

            // Update conversation lastMessage
            await Conversation.findByIdAndUpdate(
              conversation._id,
              {
                lastMessage: event.message.mid,
                unreadCount: conversation.unreadCount + 1
              }
            );

            // Emit socket event
            if (req.io) {
              req.io.emit('newMessage', {
                conversationId: conversation._id,
                message: {
                  id: event.message.mid,
                  content: messageText,
                  senderId: senderId,
                  timestamp: timestamp
                }
              });
            }
          }
        }
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Facebook webhook error:', error);
    res.status(500).json({ error: 'Facebook webhook handler failed', details: error.message });

              // --- BOT/SESSION FLOW LOGIC ---
              // Count number of inbound messages in this conversation
              const inboundCount = await Message.countDocuments({ conversation: conversation._id, senderId: senderUser._id });
              // Step 1: Welcome after first message
              if (inboundCount === 1) {
                await sendFacebookMessage(event.sender.id, 'Hi, welcome. How may I help you?');
                return;
              }
              // Step 2: Offer live agent after second message
              if (inboundCount === 2) {
                await sendFacebookMessage(event.sender.id, 'Would you like to chat with a live user? Yes / No');
                return;
              }
              // Step 3: Wait for Yes/No response
              if (inboundCount > 2 && conversation.status !== 'awaiting_agent' && conversation.status !== 'active') {
                if (messageText.trim().toLowerCase() === 'yes') {
                  // Mark conversation as awaiting agent
                  conversation.status = 'awaiting_agent';
                  await conversation.save();
                  // Broadcast to all online agents
                  const { broadcastToOnlineAgents } = require('../server');
                  broadcastToOnlineAgents(conversation);
                  // Emit escalation event for frontend notification
                  if (req.io) {
                    req.io.to(`conversation_${conversation._id}`).emit('facebook_escalation', {
                      conversationId: conversation._id,
                      message: 'This conversation has been escalated to a human agent. Please wait for further assistance.'
                    });
                  }
                  await sendFacebookMessage(event.sender.id, 'Connecting you to a live agent...');
                  return;
                } else if (messageText.trim().toLowerCase() === 'no') {
                  await sendFacebookMessage(event.sender.id, 'Okay! Let me know if you need anything else.');
                  return;
                } else {
                  await sendFacebookMessage(event.sender.id, 'Please reply Yes or No if you want to chat with a live user.');
                  return;
                }
              }

              // 3. Update conversation
              try {
                await Conversation.findByIdAndUpdate(
                  conversation._id,
                  {
                    lastMessage: message._id,
                    unreadCount: conversation.participants.includes('666543219865098') ? conversation.unreadCount + 1 : conversation.unreadCount
                  }
                );

                conversation.status = 'ended';
                conversation.locked = false;
                conversation.agentId = null;
                await conversation.save();
                return res.json({ success: true, message: 'Conversation session ended', conversation });
              } catch (error) {
                console.error('[FB][EndSession] Error:', error);
                return res.status(500).json({ error: 'Failed to end session' });
              }
};

exports.listMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({
      conversation: conversationId,
      platform: 'facebook'
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
};

// Agent claims a Facebook conversation (first-come, first-served)
exports.claimConversation = async (req, res) => {
  try {
    const { id } = req.params; // conversation ID
    const agentId = req.user._id || req.user.id;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

    // Atomically assign agent if not already assigned
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: id,
        agentId: null,
        status: 'awaiting_agent',
        locked: false
      },
      {
        agentId,
        $addToSet: { participants: agentId },
        locked: true,
        status: 'active',
        expiresAt
      },
      { new: true }
    );

    if (!conversation) {
      return res.status(409).json({ error: 'Conversation already claimed or not awaiting agent.' });
    }

    // Optionally, notify via socket.io
    if (req.io) {
      req.io.emit('conversation_claimed', {
        conversationId: conversation._id,
        agentId
      });
    }

    // Send bot message to customer: "You are now connected to a live agent."
    try {
      if (conversation && conversation.customerId) {
        await sendFacebookMessage(conversation.customerId, 'You are now connected to a live agent.');
      }
    } catch (err) {
      console.error('[FB][ClaimConversation] Failed to send connection message:', err);
    }

    return res.json({ success: true, conversation });
  } catch (error) {
    console.error('[FB][ClaimConversation] Error:', error);
    return res.status(500).json({ error: 'Failed to claim conversation' });
  }
};
  if (!conversation.participants || !Array.isArray(conversation.participants)) {
    console.error('Conversation participants missing or not an array:', conversation);
    return res.status(500).json({ error: 'Conversation participants missing or invalid', conversation });
  }

  const recipientId = conversation.participants.find(p => p.toString() !== senderId.toString());
  if (!recipientId) {
    console.error('RecipientId could not be determined:', { participants: conversation.participants, senderId });
    return res.status(500).json({ error: 'RecipientId could not be determined', participants: conversation.participants, senderId });
  }

  const platformMessageId = Date.now().toString();

  try {
    // Create message
    const message = await Message.create({
      platform: 'facebook',
      platformMessageId,
      conversation: conversation._id,
      senderId,
      content: content,
      timestamp: new Date()
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(
      conversation._id,
      {
        lastMessage: message._id,
        unreadCount: conversation.participants.includes('456') ? conversation.unreadCount + 1 : conversation.unreadCount
      }
    );

    // Emit socket event
    if (req.io) {
      req.io.emit('newMessage', {
        conversationId: conversation._id,
        message: {
          id: message._id,
          content: content,
          senderId,
          timestamp: message.timestamp
        }
      });
    }

    // Send to Facebook
    await axios.post(
      `https://graph.facebook.com/v17.0/me/messages?access_token=${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: content }
      }
    );

    res.status(200).json({ status: 'success', message: message._id });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};
