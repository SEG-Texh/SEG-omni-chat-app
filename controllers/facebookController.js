const Conversation = require('../models/conversation');
const Message = require('../models/message');
const axios = require('axios');

// Test route to create a sample conversation
exports.createTestConversation = async (req, res) => {
  try {
    // Create conversation
    const conversation = new Conversation({
      platform: 'facebook',
      platformConversationId: 'test-conversation-123',
      participants: ['user123', 'user456'],
      unreadCount: 0
    });
    await conversation.save();
    
    // Create a test message
    const message = await Message.create({
      platform: 'facebook',
      platformMessageId: 'test-message-123',
      conversation: conversation._id,
      senderId: 'user123',
      content: 'Hello, this is a test message!',
      timestamp: new Date()
    });
    
    // Update conversation with last message
    conversation.lastMessage = message._id;
    await conversation.save();
    
    res.json({
      success: true,
      message: 'Test conversation created successfully',
      conversation: conversation
    });
    } catch (error) {
    console.error('Error creating test conversation:', error);
    res.status(500).json({
      error: 'Failed to create test conversation',
      details: error.message
    });
  }
};

// Test endpoint to verify webhook
exports.testWebhook = async (req, res) => {
  console.log('Test Webhook Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body
  });
  
  res.json({
    status: 'success',
    message: 'Test webhook endpoint working'
  });
};



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
      console.log('Processing page object:', req.body);
      
      for (const entry of req.body.entry) {
        if (entry.messaging) {
          console.log('Found messaging event:', entry.messaging);
          
          for (const event of entry.messaging) {
            const senderId = event.sender.id;
            const recipientId = event.recipient.id;
            console.log('Processing messaging event:', event);
            
            if (event.message && event.message.text) {
              console.log('Processing message:', event.message);
              
              const messageText = event.message.text;
              const timestamp = event.timestamp;
              
              console.log('Message details:', {
                senderId,
                recipientId,
                messageText,
                timestamp
              });

              // 1. Create or find conversation
              // First try to find conversation by platformConversationId
              let conversation = await Conversation.findOne({
          platform: 'facebook',
                platformConversationId: event.message.mid
        });
        
        if (!conversation) {
                // If not found, try to find by participants
                conversation = await Conversation.findOne({
            platform: 'facebook',
                  participants: { $all: [senderId, recipientId] }
                });
              }

              if (!conversation) {
                console.log('Creating new conversation');
                conversation = new Conversation({
                  platform: 'facebook',
                  participants: [senderId, recipientId],
                  platformConversationId: event.message.mid
                });
                await conversation.save();
                console.log('Created new conversation:', conversation._id);
              } else {
                console.log('Found existing conversation:', conversation._id);
                // Update participants if they're missing
                if (!conversation.participants.includes(senderId)) {
                  conversation.participants.push(senderId);
                  await conversation.save();
                  console.log('Added sender to conversation participants');
                }
                if (!conversation.participants.includes(recipientId)) {
                  conversation.participants.push(recipientId);
                  await conversation.save();
                  console.log('Added recipient to conversation participants');
                }
              }

              // 2. Create message
              const message = await Message.create({
                platform: 'facebook',
                platformMessageId: event.message.mid,
                conversation: conversation._id,
                senderId,
                content: messageText,
                timestamp: new Date(timestamp)
              });
              console.log('Created new message:', message._id);

              // --- BOT/SESSION FLOW LOGIC ---
              // Count number of inbound messages in this conversation
              const inboundCount = await Message.countDocuments({ conversation: conversation._id, senderId });
              // Step 1: Welcome after first message
              if (inboundCount === 1) {
                await sendFacebookMessage(senderId, 'Hi, welcome. How may I help you?');
                return;
              }
              // Step 2: Offer live agent after second message
              if (inboundCount === 2) {
                await sendFacebookMessage(senderId, 'Would you like to chat with a live user? Yes / No');
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
                  await sendFacebookMessage(senderId, 'Connecting you to a live agent...');
                  return;
                } else if (messageText.trim().toLowerCase() === 'no') {
                  await sendFacebookMessage(senderId, 'Okay! Let me know if you need anything else.');
                  return;
                } else {
                  await sendFacebookMessage(senderId, 'Please reply Yes or No if you want to chat with a live user.');
                  return;
                }
              }

              // 3. Update conversation
              await Conversation.findByIdAndUpdate(
                conversation._id,
                {
                  lastMessage: message._id,
                  unreadCount: conversation.participants.includes('666543219865098') ? conversation.unreadCount + 1 : conversation.unreadCount
                }
              );
              console.log('Updated conversation:', conversation._id);

              // 4. Emit socket event
              if (req.io) {
                req.io.emit('newMessage', {
                  conversationId: conversation._id,
                  message: {
                    id: message._id,
                    content: messageText,
                    senderId,
                    timestamp: message.timestamp
                  }
                });
                console.log('Emitted socket event for message:', message._id);
              }

              console.log('Message processed successfully');
            }
          }
        }
      }
      return res.status(200).json({ status: 'success' });
    }

    // If not verification or page object, send a generic response
    return res.status(200).json({ status: 'ignored' });
  } catch (error) {
    console.error('Webhook error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    return res.status(500).json({ error: 'Something went wrong' });
  }
};

// List all Facebook conversations (for now)
exports.listConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      platform: 'facebook'
    })
    .populate('lastMessage')
    .populate('participants', 'name')
    .sort({ updatedAt: -1 });
    
    console.log('Found conversations:', conversations.length);
    console.log('Conversations:', conversations);
      res.json(conversations);
    } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch conversations',
      details: error.message
    });
  }
};

// List messages for a Facebook conversation
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

// Send message to Facebook user
exports.sendMessage = async (req, res) => {
  const { conversationId, content } = req.body;
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const senderId = req.user._id || req.user.id;

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
