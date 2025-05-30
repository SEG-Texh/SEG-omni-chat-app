const BotService = require('../services/botService');

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WhatsApp Webhook Verified');
    return res.status(200).send(challenge);
  } else {
    console.log('❌ WhatsApp Webhook Verification Failed');
    return res.sendStatus(403);
  }
};

exports.receiveMessage = async (req, res) => {
  try {
    console.log('📨 Incoming WhatsApp webhook:', JSON.stringify(req.body, null, 2));
    
    const body = req.body;
    
    if (body.object === 'whatsapp_business_account') {
      // Process each entry in the webhook
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Process incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                await this.processIncomingMessage(message, value);
              }
            }
            
            // Handle message status updates (delivered, read, etc.)
            if (value.statuses) {
              this.handleMessageStatus(value.statuses);
            }
          }
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ WhatsApp webhook error:', error);
    res.sendStatus(500);
  }
};

exports.processIncomingMessage = async (message, webhookValue) => {
  try {
    const from = message.from;
    const messageId = message.id;
    const timestamp = message.timestamp;
    
    // Handle different message types
    let messageText = '';
    let messageType = message.type;
    
    switch (messageType) {
      case 'text':
        messageText = message.text?.body || '';
        break;
      case 'button':
        messageText = message.button?.text || '';
        break;
      case 'interactive':
        if (message.interactive?.type === 'button_reply') {
          messageText = message.interactive.button_reply.title;
        } else if (message.interactive?.type === 'list_reply') {
          messageText = message.interactive.list_reply.title;
        }
        break;
      default:
        messageText = 'I received your message, but I can only respond to text messages right now.';
        break;
    }
    
    if (!messageText) {
      console.log('⚠️ No text content in message, skipping bot processing');
      return;
    }
    
    console.log(`📱 WhatsApp message from ${from}: "${messageText}"`);
    
    // Get contact info if available
    const contact = webhookValue.contacts?.[0];
    const senderInfo = {
      name: contact?.profile?.name || 'User',
      phone: from
    };
    
    // Process message through bot service
    const botResult = BotService.processMessage(messageText, 'whatsapp', from, senderInfo);
    
    if (botResult.shouldSend && botResult.response) {
      // Send bot response
      const sendResult = await BotService.sendWhatsAppMessage(from, botResult.response);
      
      if (sendResult.success) {
        console.log(`✅ Bot response sent to ${from}`);
      } else {
        console.error(`❌ Failed to send bot response to ${from}:`, sendResult.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Error processing WhatsApp message:', error);
  }
};

exports.handleMessageStatus = (statuses) => {
  statuses.forEach(status => {
    console.log(`📊 WhatsApp message ${status.id} status: ${status.status}`);
    // Here you could update message status in your database
  });
};

exports.sendMessage = async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message'
      });
    }
    
    const result = await BotService.sendWhatsAppMessage(to, message);
    
    if (result.success) {
      console.log(`✅ Manual WhatsApp message sent to ${to}`);
      res.json({
        success: true,
        message: 'WhatsApp message sent successfully',
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send WhatsApp message',
        details: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ WhatsApp send error:', error);
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