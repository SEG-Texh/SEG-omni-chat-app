// routes/messages.js
const express = require('express');
const router = express.Router();

// Example route
router.get('/', (req, res) => {
  res.send('Messages API working');
});

module.exports = router;
