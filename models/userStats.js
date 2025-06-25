// In models/UserStats.js
const userStatsSchema = new mongoose.Schema({
  totalUsers: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});