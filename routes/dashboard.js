// routes/dashboard.js
const UserStats = require('../models/userStats'); // Import your new model

// Updated users/count endpoint
router.get('/users/count', async (req, res) => {
  try {
    const stats = await UserStats.findOne({});
    res.json({ 
      success: true,
      count: stats ? stats.totalUsers : 0 // Fallback to 0 if no stats exist
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});