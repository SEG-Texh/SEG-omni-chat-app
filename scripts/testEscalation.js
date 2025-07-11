const mongoose = require('mongoose');
const User = require('../models/user');
const Conversation = require('../models/conversation');
const Message = require('../models/message');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/omni-chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function testEscalation() {
  try {
    console.log('Testing escalation notification...');
    
    // Find a supervisor user
    const supervisor = await User.findOne({ role: 'supervisor' });
    if (!supervisor) {
      console.log('No supervisor found');
      return;
    }
    
    console.log('Found supervisor:', supervisor.name);
    
    // Find or create a test conversation
    let conversation = await Conversation.findOne({ platform: 'facebook' });
    if (!conversation) {
      console.log('No Facebook conversation found, creating test conversation...');
      conversation = new Conversation({
        platform: 'facebook',
        platformConversationId: `test_${Date.now()}`,
        customerId: 'test_customer_123',
        participants: ['test_customer_123'],
        status: 'active',
        startTime: new Date(),
        expiresAt: new Date(Date.now() + 35 * 60 * 1000)
      });
      await conversation.save();
    }
    
    console.log('Using conversation:', conversation._id);
    
    // Create a test message
    const message = new Message({
      conversation: conversation._id,
      sender: 'test_customer_123',
      content: { text: 'I need help with my order' },
      platform: 'facebook',
      direction: 'inbound',
      platformMessageId: `test_msg_${Date.now()}`
    });
    await message.save();
    
    console.log('Created test message');
    
    // Simulate escalation by emitting the event
    const io = require('../config/socket').getIO();
    
    console.log('Emitting escalation_request event...');
    io.to(supervisor._id.toString()).emit('escalation_request', {
      conversationId: conversation._id,
      customerId: 'test_customer_123',
      platform: 'facebook',
      message: 'I need help with my order'
    });
    
    console.log('Escalation event emitted successfully!');
    console.log('Check the Facebook page to see if the notification appears.');
    
  } catch (error) {
    console.error('Error testing escalation:', error);
  } finally {
    mongoose.connection.close();
  }
}

testEscalation(); 