// routes/dashboard.js)

const express = require('express');
const router = express.Router();
const Chat = require('../models/message');
const User = require('../models/User');

// Get total user count
router.get('/users/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's message count
router.get('/chats/count', async (req, res) => {
  try {
    const startDate = new Date(req.query.startDate) || new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
    const count = await Chat.countDocuments({
      timestamp: { $gte: startDate, $lt: endDate }
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active chats count
router.get('/chats/active', async (req, res) => {
  try {
    const since = new Date(req.query.since) || new Date(Date.now() - 15 * 60 * 1000);
    
    const count = await Chat.distinct('senderId', {
      timestamp: { $gte: since },
      direction: 'incoming'
    }).count();
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get platform distribution
router.get('/chats/platform-distribution', async (req, res) => {
  try {
    const result = await Chat.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const distribution = {};
    result.forEach(item => {
      distribution[item._id] = item.count;
    });
    
    res.json(distribution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get message volume (last 7 days by default)
router.get('/chats/message-volume', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    
    const result = await Chat.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const data = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const found = result.find(item => item._id === dateStr);
      data.push({
        date: dateStr,
        count: found ? found.count : 0
      });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get response times (last 7 months by default)
router.get('/chats/response-times', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 7;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    
    // This is a simplified version - implement actual response time calculation
    const result = await Chat.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate },
          direction: 'outgoing'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$timestamp" }
          },
          avgResponseTime: { $avg: "$responseTime" } // Assuming responseTime field
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const data = [];
    for (let i = 0; i < months; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthStr = date.toISOString().substring(0, 7);
      
      const found = result.find(item => item._id === monthStr);
      data.push({
        month: monthStr,
        avgResponseTime: found ? found.avgResponseTime : 0
      });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;