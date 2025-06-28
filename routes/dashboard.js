// routes/dashboard.js
const express = require('express');
const router = express.Router();

const UserStats = require('../models/userStats');
const Message = require('../models/message'); // Add this line

// Users count endpoint (already present)
router.get('/users/count', async (req, res) => {
  try {
    const stats = await UserStats.findOne({});
    res.json({
      success: true,
      count: stats ? stats.totalUsers : 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// --- Add these endpoints for dashboard stats ---

// GET /api/chats/count?startDate=...
router.get('/count', async (req, res) => {
  const { startDate } = req.query;
  const filter = {};
  if (startDate) {
    filter.createdAt = { $gte: new Date(startDate) };
  }
  const count = await Message.countDocuments(filter);
  res.json({ count });
});

// GET /api/chats/active?since=...
router.get('/active', async (req, res) => {
  const { since } = req.query;
  const filter = {};
  if (since) {
    filter.createdAt = { $gte: new Date(since) };
  }
  const count = await Message.distinct('conversation', filter).then(arr => arr.length);
  res.json({ count });
});

// GET /api/chats/platform-distribution
router.get('/platform-distribution', async (req, res) => {
  const pipeline = [
    { $group: { _id: '$platform', count: { $sum: 1 } } }
  ];
  const results = await Message.aggregate(pipeline);
  const distribution = {};
  results.forEach(r => { distribution[r._id] = r.count; });
  res.json(distribution);
});

module.exports = router;