const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-uri-here';

async function updateIndex() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const collection = db.collection('messages');

  try {
    console.log('Dropping old index (if exists)...');
    await collection.dropIndex('platformMessageId_1').catch(() => {}); // Ignore error if index doesn't exist
    console.log('Creating new partial unique index...');
    await collection.createIndex(
      { platformMessageId: 1 },
      { unique: true, partialFilterExpression: { platformMessageId: { $type: "string" } } }
    );
    console.log('Index updated successfully!');
  } catch (err) {
    console.error('Error updating index:', err);
  } finally {
    await mongoose.disconnect();
  }
}

updateIndex(); 