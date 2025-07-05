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
      text: 'Hello, this is a test message!',
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
        console.log('Sending response with status 200 and challenge:', challenge);
        res.status(200).send(challenge);
        return;
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
            
            if (event.message) {
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
                text: messageText,
                timestamp: new Date(timestamp)
              });
              console.log('Created new message:', message._id);

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
                    text: messageText,
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
    }

    res.status(200).json({ status: 'success' });

    // Check if this is a webhook verification request
    if (req.query['hub.mode'] === 'subscribe') {
      console.log('Facebook Webhook Verification Attempt');
      console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Request Query:', JSON.stringify(req.query, null, 2));
      console.log('Environment Variables:', {
        FACEBOOK_VERIFY_TOKEN: process.env.FACEBOOK_VERIFY_TOKEN,
        NODE_ENV: process.env.NODE_ENV
      });

      const mode = req.query['hub.mode'];
      const verifyToken = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('Verification Data:', {
        mode,
        verifyToken,
        challenge
      });

      // Check if this is a verification request
      if (mode && mode === 'subscribe') {
        console.log('Mode is subscribe');
        
        // Check if verify token matches
        if (verifyToken === process.env.FACEBOOK_VERIFY_TOKEN) {
          console.log('Verify token matches!');
          console.log('Sending challenge:', challenge);
          return res.status(200).send(challenge);
        } else {
          console.error('Verify token mismatch!');
          console.error('Expected:', process.env.FACEBOOK_VERIFY_TOKEN);
          console.error('Received:', verifyToken);
          return res.status(403).send('Verification token mismatch');
        }
      } else {
        console.error('Invalid mode:', mode);
        return res.status(403).send('Invalid verification mode');
      }
    }

    // Handle incoming messages
    if (req.body.object === 'page') {
      for (const entry of req.body.entry) {
        for (const event of entry.messaging) {
          const senderId = event.sender.id;
          const recipientId = event.recipient.id;
          const messageText = event.message && event.message.text;
          const platformMessageId = event.message && event.message.mid;
          const timestamp = event.timestamp || Date.now();

          console.log('Processing Facebook message:', {
            timestamp: new Date(timestamp),
            sender: {
              id: senderId,
              isPage: senderId === recipientId
            },
            recipient: {
              id: recipientId,
              isPage: recipientId === '456'
            },
            message: {
              text: messageText,
              id: platformMessageId,
              timestamp: new Date(timestamp)
            },
            rawEvent: event
          });

          // Check if this is a message from the page
          const isPageMessage = senderId === '456';
          const isUserMessage = !isPageMessage;

          console.log(`Message type: ${isUserMessage ? 'User' : 'Page'} message`);

          // Check for duplicate message
          if (platformMessageId) {
            const exists = await Message.findOne({ 
              platform: 'facebook', 
              platformMessageId 
            });
            if (exists) {
              console.log('Duplicate message detected, skipping:', platformMessageId);
              continue;
            }
          }

          // Generate a unique conversation ID based on sorted participant IDs
          const conversationId = [senderId, recipientId].sort().join('_');
          
          // 1. Find or create conversation
          let conversation = await Conversation.findOne({
            platform: 'facebook',
            platformConversationId: conversationId
          });
          
          if (!conversation) {
            conversation = await Conversation.create({
              platform: 'facebook',
              platformConversationId: conversationId,
              participants: [senderId, recipientId]
            });
            console.log('Created new conversation:', conversation._id);
          }

          // 2. Create message
          const message = await Message.create({
            platform: 'facebook',
            platformMessageId,
            conversation: conversation._id,
            senderId,
            text: messageText,
            timestamp: new Date(timestamp)
          });
          console.log('Created new message:', message._id);

          // 3. Update conversation
          await Conversation.findByIdAndUpdate(
            conversation._id,
            {
              lastMessage: message._id,
              unreadCount: conversation.participants.includes('456') ? conversation.unreadCount + 1 : conversation.unreadCount
            }
          );
          console.log('Updated conversation:', conversation._id);

          // 4. Emit socket event
          if (req.io) {
            req.io.emit('newMessage', {
              conversationId: conversation._id,
              message: {
                id: message._id,
                text: messageText,
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

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ error: 'Something went wrong' });
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
      text: content,
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
          text: content,
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
