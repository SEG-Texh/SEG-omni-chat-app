const express = require('express');
const router = express.Router();
const Message = require('../models/message');

// Add this endpoint to fetch unclaimed messages
router.get('/unclaimed', async (req, res) => {
  try {
    const messages = await Message.find({ 
      labels: 'unclaimed' 
    }).sort({ timestamp: -1 }).limit(50);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;