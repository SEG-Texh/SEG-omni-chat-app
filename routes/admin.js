const express = require('express');
const router = express.Router();
const path = require('path');

// Admin Dashboard - Main page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/adminDashboard.html'));
});

module.exports = router;