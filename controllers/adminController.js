const User = require('../models/User');
const Message = require('../models/Message');
const ActivityLog = require('../models/ActivityLog');

module.exports = {
  // Get all users
  async getAllUsers(req, res) {
    try {
      const users = await User.find()
        .sort({ createdAt: -1 })
        .select('-password -__v');
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get all messages
  async getAllMessages(req, res) {
    try {
      const { filter, search } = req.query;
      let query = { isDeleted: { $ne: true } };
      
      if (filter && filter !== 'all') {
        if (filter === 'today') {
          query.createdAt = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
        } else {
          query.type = filter;
        }
      }
      
      if (search) {
        query.$or = [
          { content: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { 'sender.name': { $regex: search, $options: 'i' } }
        ];
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .populate('sender', 'name email');
      
      res.json({ success: true, data: messages });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get dashboard stats
  async getStats(req, res) {
    try {
      const [
        totalUsers,
        activeUsers,
        totalMessages,
        todayMessages
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ status: 'active' }),
        Message.countDocuments({ isDeleted: { $ne: true } }),
        Message.countDocuments({ 
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } 
        })
      ]);

      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          totalMessages,
          todayMessages
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get recent activity
  async getRecentActivity(req, res) {
    try {
      const activities = await ActivityLog.find()
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'username email name');
      
      res.json({ success: true, data: activities });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Create new user
  async createUser(req, res) {
    try {
      const { name, email, password, role } = req.body;
      
      if (!email || !password || !role) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'User already exists' });
      }
      
      const newUser = new User({ name, email, password, role });
      await newUser.save();
      
      const userResponse = newUser.toObject();
      delete userResponse.password;
      
      res.status(201).json({ success: true, data: userResponse });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Delete user
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const deletedUser = await User.findByIdAndDelete(userId);
      
      if (!deletedUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      res.json({ success: true, data: { message: 'User deleted successfully' } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Update user status
  async updateUserStatus(req, res) {
    try {
      const { status } = req.body;
      const { userId } = req.params;
      
      if (!['active', 'suspended', 'banned'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
      }
      
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { status },
        { new: true }
      ).select('-password -__v');
      
      if (!updatedUser) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      res.json({ success: true, data: updatedUser });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Delete single message
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const deletedMessage = await Message.findByIdAndUpdate(
        messageId,
        { isDeleted: true },
        { new: true }
      );
      
      if (!deletedMessage) {
        return res.status(404).json({ success: false, error: 'Message not found' });
      }
      
      res.json({ success: true, data: { message: 'Message deleted successfully' } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Clear all messages
  async clearAllMessages(req, res) {
    try {
      const result = await Message.updateMany(
        { isDeleted: { $ne: true } },
        { isDeleted: true }
      );
      
      res.json({ 
        success: true, 
        data: { 
          message: 'All messages deleted successfully',
          totalDeleted: result.modifiedCount
        } 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};