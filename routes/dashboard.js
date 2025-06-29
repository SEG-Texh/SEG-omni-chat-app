// routes/dashboard.js
const express = require('express');
const router = express.Router();

const UserStats = require('../models/userStats');
const Message = require('../models/message'); // Add this line
const Conversation = require('../models/conversation');

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

// GET /api/chats/response-rate-trend?months=7
router.get('/response-times', async (req, res) => {
  const months = parseInt(req.query.months) || 7;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  try {
    // Calculate response rate trend by month
    const pipeline = [
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          totalMessages: { $sum: 1 },
          deliveredMessages: {
            $sum: {
              $cond: [{ $eq: ["$status", "delivered"] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          month: "$_id",
          responseRate: {
            $cond: [
              { $eq: ["$totalMessages", 0] },
              0,
              { $multiply: [{ $divide: ["$deliveredMessages", "$totalMessages"] }, 100] }
            ]
          }
        }
      },
      { $sort: { month: 1 } }
    ];

    const results = await Message.aggregate(pipeline);
    res.json(results.map(r => ({ 
      month: r.month, 
      responseRate: Math.round(r.responseRate) 
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate response rate trend' });
  }
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

// GET /api/response-rate
router.get('/response-rate', async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const deliveredMessages = await Message.countDocuments({ status: 'delivered' });
    const responseRate = totalMessages === 0 ? 0 : Math.round((deliveredMessages / totalMessages) * 100);
    res.json({ responseRate, deliveredMessages, totalMessages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate response rate' });
  }
});

// GET /api/active-chats
router.get('/active-chats', async (req, res) => {
  try {
    const activeChats = await Conversation.countDocuments({ status: 'active' });
    res.json({ activeChats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active chats' });
  }
});

module.exports = router;