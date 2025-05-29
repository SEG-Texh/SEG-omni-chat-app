// controllers/adminService.js
const User = require('../../models/User');
const Message = require('../../models/message');
const Email = require('../../models/Email');

module.exports = {
  // User-related services
  getUserStats: async () => {
    const [totalUsers, activeUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' })
    ]);
    return { totalUsers, activeUsers };
  },

  getMessageStats: async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const [totalMessages, todayMessages] = await Promise.all([
      Message.countDocuments() + Email.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: todayStart } }) + 
      Email.countDocuments({ createdAt: { $gte: todayStart } })
    ]);
    
    return { totalMessages, todayMessages };
  },

  getUsers: async ({ page = 1, limit = 10, search = '', status = '' }) => {
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query)
    ]);

    return { users, total, page, pages: Math.ceil(total / limit) };
  },

  getMessages: async ({ page = 1, limit = 10, filter = 'all', search = '' }) => {
    // ... (use the getAllMessages implementation from earlier)
  },

  getRecentActivity: async (limit = 10) => {
    // ... (use the getRecentActivity implementation from earlier)
  }
};