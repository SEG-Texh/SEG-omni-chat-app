// Example: testConnection.js
const mongoose = require('mongoose');
const Message = require('./models/Message'); // your message model

mongoose.connect('your_connection_string', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');

    // Create a dummy message
    const testMessage = new Message({
      sender: 'Test Sender',
      text: 'This is a test message',
      receivedAt: new Date(),
    });

    // Save to MongoDB
    await testMessage.save();
    console.log('Test message saved successfully');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error connecting or saving:', err);
  });
