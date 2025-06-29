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
// GET /api/chats/message-volume?days=7
router.get('/message-volume', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Group by day
  const pipeline = [
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const results = await Message.aggregate(pipeline);
  res.json(results.map(r => ({ date: r._id, count: r.count })));
});

// GET /api/chats/response-times?months=7
router.get('/response-times', async (req, res) => {
  const months = parseInt(req.query.months) || 7;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  // Only consider messages with a responseTo field (i.e., replies)
  const pipeline = [
    { $match: { createdAt: { $gte: since }, responseTo: { $exists: true, $ne: null } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" }
        },
        avgResponseTime: { $avg: "$responseTime" }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const results = await Message.aggregate(pipeline);
  res.json(results.map(r => ({ month: r._id, avgResponseTime: r.avgResponseTime })));
});

// GET /api/stats/response-rate
router.get('/stats/response-rate', async (req, res) => {
  try {
    const Message = require('../models/message');
    // Count user messages (inbound)
    const userMessages = await Message.countDocuments({ direction: 'inbound' });
    // Count agent replies (outbound)
    const agentReplies = await Message.countDocuments({ direction: 'outbound' });
    // Calculate response rate
    const responseRate = userMessages > 0 ? (agentReplies / userMessages) * 100 : 0;
    res.json({ responseRate: Math.round(responseRate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;