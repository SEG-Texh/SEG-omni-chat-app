const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserStats', userStatsSchema);
