const axios = require('axios'); // Add this missing import
const BotService = require('../services/botService');

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Facebook Webhook Verified');
    return res.status(200).send(challenge);
  } else {
    console.log('❌ Facebook Webhook Verification Failed');
    return res.sendStatus(403);
  }
};

exports.receiveMessage = async (req, res) => {
  try {
    const body = req.body;
    console.log('📨 Incoming Facebook webhook:', JSON.stringify(body, null, 2));
    
    if (body.object === 'page') {
      // Process each entry
      for (const entry of body.entry || []) {
        // Handle messaging events
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await this.processMessagingEvent(event);
          }
        }
        
        // Handle other events (optional)
        if (entry.changes) {
          this.handlePageChanges(entry.changes);
        }
      }
      
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Facebook webhook error:', error);
    res.sendStatus(500);
  }
};

exports.processMessagingEvent = async (event) => {
  try {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id;
    const timestamp = event.timestamp;
    
    // Handle different types of messaging events
    if (event.message) {
      await this.handleMessage(event);
    } else if (event.postback) {
      await this.handlePostback(event);
    } else if (event.delivery) {
      this.handleDelivery(event);
    } else if (event.read) {
      this.handleRead(event);
    } else {
      console.log('🔍 Unhandled Facebook messaging event type:', Object.keys(event));
    }
    
  } catch (error) {
    console.error('❌ Error processing Facebook messaging event:', error);
  }
};

exports.handleMessage = async (event) => {
  const senderId = event.sender.id;
  const message = event.message;
  const messageText = message.text;
  
  // Skip if no text (could be attachment, sticker, etc.)
  if (!messageText) {
    console.log('⚠️ Non-text message received, sending generic response');
    await BotService.sendFacebookMessage(senderId, 'I received your message! Please send me a text message and I\'ll be happy to help you.');
    return;
  }
  
  console.log(`💬 Facebook message from ${senderId}: "${messageText}"`);
  
  // Get user info (optional - requires additional API call)
  const senderInfo = await this.getUserInfo(senderId);
  
  // Process message through bot service
  const botResult = BotService.processMessage(messageText, 'facebook', senderId, senderInfo);
  
  if (botResult.shouldSend && botResult.response) {
    const sendResult = await BotService.sendFacebookMessage(senderId, botResult.response);
    
    if (sendResult.success) {
      console.log(`✅ Bot response sent to Facebook user ${senderId}`);
    } else {
      console.error(`❌ Failed to send bot response to ${senderId}:`, sendResult.error);
    }
  }
};

exports.handlePostback = async (event) => {
  const senderId = event.sender.id;
  const postback = event.postback;
  const payload = postback.payload;
  const title = postback.title;
  
  console.log(`🔘 Facebook postback from ${senderId}: ${payload} (${title})`);
  
  // Treat postback as a message
  const botResult = BotService.processMessage(title || payload, 'facebook', senderId);
  
  if (botResult.shouldSend && botResult.response) {
    await BotService.sendFacebookMessage(senderId, botResult.response);
  }
};

exports.handleDelivery = (event) => {
  const delivery = event.delivery;
  console.log(`📨 Facebook message delivery confirmed:`, delivery.mids);
};

exports.handleRead = (event) => {
  const read = event.read;
  console.log(`👁️ Facebook message read at:`, new Date(read.watermark));
};

exports.handlePageChanges = (changes) => {
  changes.forEach(change => {
    console.log(`📄 Facebook page change:`, change.field, change.value);
  });
};

exports.getUserInfo = async (userId) => {
  try {
    // Optional: Get user profile information
    // This requires additional permissions and API call
    const response = await axios.get(`https://graph.facebook.com/${userId}`, {
      params: {
        fields: 'first_name,last_name,profile_pic',
        access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
      }
    });
    
    return {
      firstName: response.data.first_name,
      lastName: response.data.last_name,
      profilePic: response.data.profile_pic,
      userId: userId
    };
  } catch (error) {
    console.log('ℹ️ Could not fetch user info:', error.message);
    return { userId };
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { recipient_id, message } = req.body;
    
    if (!recipient_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: recipient_id, message'
      });
    }
    
    const result = await BotService.sendFacebookMessage(recipient_id, message);
    
    if (result.success) {
      console.log(`✅ Manual Facebook message sent to ${recipient_id}`);
      res.json({
        success: true,
        message: 'Facebook message sent successfully',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send Facebook message',
        details: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Facebook send error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Additional utility endpoints
exports.resetConversation = (req, res) => {
  const { userId } = req.params;
  const result = BotService.resetConversation(userId);
  res.json(result);
};

exports.getConversationState = (req, res) => {
  const { userId } = req.params;
  const state = BotService.getConversationState(userId);
  res.json({ userId, state });
};