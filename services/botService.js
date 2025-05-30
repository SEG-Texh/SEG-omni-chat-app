const axios = require('axios');

// Bot responses configuration
const BOT_RESPONSES = {
  greeting: "Hi! I am Omnibot 🤖, your helpful assistant. How can I help you today?",
  options: "I can help you with:\n\n1️⃣ Connect you to a live chat agent\n2️⃣ Schedule a chat for later\n3️⃣ Answer frequently asked questions\n\nPlease type the number of your choice or describe what you need help with.",
  liveChat: "I'm connecting you to a live chat agent. Please wait a moment... 👨‍💼\n\nA representative will be with you shortly!",
  schedule: "I'd be happy to help you schedule a chat! 📅\n\nWhen would be a good time for you? Please provide your preferred:\n• Date\n• Time\n• Time zone (if different from local)",
  schedulingConfirm: "Thank you! I've noted your preferred time. Our team will contact you then. 📝\n\nIs there anything else I can help you with?",
  faq: {
    hours: "🕒 Our support hours:\n• Monday - Friday: 9 AM to 6 PM EST\n• Weekend: Emergency support available\n• 24/7 for urgent matters",
    pricing: "💰 For detailed pricing information:\n• Visit our website\n• Speak with our sales team\n• Request a custom quote\n\nWould you like me to connect you with a representative?",
    contact: "📞 Contact Information:\n• Email: support@company.com\n• Phone: +1-800-123-4567\n• Live Chat: Available now\n• Website: www.company.com"
  },
  fallback: "I understand you need assistance. Let me help you with the right option:\n\n🔹 Connect to live agent\n🔹 Schedule a callback\n🔹 Browse our FAQ\n\nWhat would you prefer?",
  goodbye: "Thank you for contacting us! Have a great day! 😊\n\nFeel free to reach out anytime you need help!",
  error: "I apologize, but I'm having trouble processing your request. Let me connect you with a live agent who can better assist you.",
  maintenance: "Our system is currently under maintenance. Please try again in a few minutes or contact us directly."
};

// Conversation state management
const conversationStates = new Map();

class BotService {
  
  /**
   * Main function to process incoming messages and generate responses
   */
  static processMessage(message, platform, senderId, senderInfo = {}) {
    try {
      const normalizedMessage = message.toLowerCase().trim();
      const state = conversationStates.get(senderId) || { 
        step: 'initial', 
        platform: platform,
        startTime: new Date(),
        messageCount: 0
      };
      
      // Update message count
      state.messageCount++;
      
      let response = '';
      let newState = { ...state };

      // Handle different conversation states
      switch (state.step) {
        case 'initial':
          response = this.handleInitialMessage(normalizedMessage);
          newState.step = 'awaiting_choice';
          break;

        case 'awaiting_choice':
          const choiceResult = this.handleUserChoice(normalizedMessage);
          response = choiceResult.response;
          newState.step = choiceResult.nextStep;
          if (choiceResult.data) {
            newState.data = { ...newState.data, ...choiceResult.data };
          }
          break;

        case 'scheduling':
          response = this.handleScheduling(message);
          newState.step = 'completed';
          break;

        case 'faq_mode':
          response = this.handleFAQ(normalizedMessage) + '\n\n' + BOT_RESPONSES.options;
          newState.step = 'awaiting_choice';
          break;

        case 'live_chat_requested':
          response = "A live agent will be with you shortly. In the meantime, is there anything else I can help you with?";
          newState.step = 'awaiting_agent';
          break;

        case 'completed':
          response = "Is there anything else I can help you with today?\n\n" + BOT_RESPONSES.options;
          newState.step = 'awaiting_choice';
          break;

        default:
          response = BOT_RESPONSES.fallback;
          newState.step = 'awaiting_choice';
      }

      // Update conversation state
      conversationStates.set(senderId, newState);
      
      return {
        success: true,
        response: response,
        shouldSend: true,
        conversationState: newState
      };

    } catch (error) {
      console.error('Bot processing error:', error);
      return {
        success: false,
        response: BOT_RESPONSES.error,
        shouldSend: true,
        error: error.message
      };
    }
  }

  /**
   * Handle initial messages and greetings
   */
  static handleInitialMessage(normalizedMessage) {
    if (this.isGreeting(normalizedMessage)) {
      return BOT_RESPONSES.greeting + '\n\n' + BOT_RESPONSES.options;
    } else {
      return BOT_RESPONSES.greeting + '\n\n' + BOT_RESPONSES.options;
    }
  }

  /**
   * Handle user choice selection
   */
  static handleUserChoice(normalizedMessage) {
    // Live chat options
    if (normalizedMessage.includes('1') || 
        normalizedMessage.includes('live') || 
        normalizedMessage.includes('agent') ||
        normalizedMessage.includes('human') ||
        normalizedMessage.includes('representative')) {
      return {
        response: BOT_RESPONSES.liveChat,
        nextStep: 'live_chat_requested',
        data: { requestType: 'live_chat', timestamp: new Date() }
      };
    }
    
    // Scheduling options
    if (normalizedMessage.includes('2') || 
        normalizedMessage.includes('schedule') || 
        normalizedMessage.includes('appointment') ||
        normalizedMessage.includes('callback')) {
      return {
        response: BOT_RESPONSES.schedule,
        nextStep: 'scheduling',
        data: { requestType: 'schedule' }
      };
    }
    
    // FAQ options
    if (normalizedMessage.includes('3') || 
        normalizedMessage.includes('faq') || 
        normalizedMessage.includes('question') ||
        normalizedMessage.includes('help')) {
      return {
        response: this.handleFAQ(normalizedMessage),
        nextStep: 'faq_mode',
        data: { requestType: 'faq' }
      };
    }

    // Fallback
    return {
      response: BOT_RESPONSES.fallback,
      nextStep: 'awaiting_choice'
    };
  }

  /**
   * Check if message is a greeting
   */
  static isGreeting(message) {
    const greetings = [
      'hi', 'hello', 'hey', 'hola', 'good morning', 
      'good afternoon', 'good evening', 'start', 'help',
      'greetings', 'howdy', 'what\'s up', 'sup'
    ];
    return greetings.some(greeting => message.includes(greeting));
  }

  /**
   * Handle FAQ queries
   */
  static handleFAQ(message) {
    if (message.includes('hours') || message.includes('time') || message.includes('when')) {
      return BOT_RESPONSES.faq.hours;
    } 
    
    if (message.includes('price') || message.includes('cost') || message.includes('money') || message.includes('payment')) {
      return BOT_RESPONSES.faq.pricing;
    } 
    
    if (message.includes('contact') || message.includes('phone') || message.includes('email') || message.includes('reach')) {
      return BOT_RESPONSES.faq.contact;
    }
    
    // General FAQ response
    return "I'm here to help! Here are some common topics:\n\n• Business hours\n• Pricing information\n• Contact details\n\nWhat would you like to know more about?";
  }

  /**
   * Handle scheduling requests
   */
  static handleScheduling(message) {
    // Here you could integrate with a calendar system
    return BOT_RESPONSES.schedulingConfirm.replace('your preferred time', `"${message}"`);
  }

  /**
   * Send WhatsApp message
   */
  static async sendWhatsAppMessage(to, message) {
    try {
      const url = `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const data = {
        messaging_product: 'whatsapp',
        to: to,
        text: { body: message }
      };

      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Facebook Messenger message
   */
  static async sendFacebookMessage(recipientId, message) {
    try {
      const url = 'https://graph.facebook.com/v17.0/me/messages';
      const data = {
        recipient: { id: recipientId },
        message: { text: message }
      };

      const response = await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${process.env.FACEBOOK_PAGE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Facebook send error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Email with bot auto-reply
   */
  static generateEmailAutoReply(originalSubject, senderEmail) {
    const subject = `Re: ${originalSubject} - Auto Reply from Omnibot`;
    const message = `${BOT_RESPONSES.greeting}\n\nThank you for contacting us via email. We have received your message and will respond soon.\n\n${BOT_RESPONSES.options}\n\nPlease reply to this email with your choice or call us directly for immediate assistance.\n\nBest regards,\nOmnibot Support Team`;
    
    return { subject, message };
  }

  /**
   * Reset conversation state for a user
   */
  static resetConversation(senderId) {
    conversationStates.delete(senderId);
    return { success: true, message: 'Conversation reset successfully' };
  }

  /**
   * Get conversation state for a user
   */
  static getConversationState(senderId) {
    return conversationStates.get(senderId) || null;
  }

  /**
   * Get all active conversations (for admin purposes)
   */
  static getActiveConversations() {
    const conversations = [];
    conversationStates.forEach((state, senderId) => {
      conversations.push({
        senderId,
        platform: state.platform,
        step: state.step,
        messageCount: state.messageCount,
        startTime: state.startTime
      });
    });
    return conversations;
  }

  /**
   * Update bot responses (for dynamic configuration)
   */
  static updateBotResponses(newResponses) {
    Object.assign(BOT_RESPONSES, newResponses);
    return { success: true, message: 'Bot responses updated' };
  }
}

module.exports = BotService;