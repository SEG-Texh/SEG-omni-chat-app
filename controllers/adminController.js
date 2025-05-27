// controllers/adminController.js
const User = require('../models/User'); // Assuming you have a User model
const Message = require('../models/message'); // Assuming you have a Message model

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password') // Exclude password field
      .sort({ createdAt: -1 }); // Sort by newest first
    
    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get all messages
exports.getAllMessages = async (req, res) => {
  try {
    const { filter } = req.query;
    let dateFilter = {};
    
    // Apply date filters
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (filter === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (filter === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const messages = await Message.find(dateFilter)
      .populate('sender', 'name email') // Populate sender info
      .sort({ createdAt: -1 })
      .limit(100); // Limit to prevent overwhelming the frontend

    res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

// Get dashboard statistics
exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    
    // Count active users (logged in within last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: oneDayAgo }
    });

    // Count today's messages
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMessages = await Message.countDocuments({
      createdAt: { $gte: today }
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalMessages,
        todayMessages
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password, // Make sure to hash this in your User model pre-save hook
      role: role || 'user'
    });

    await newUser.save();

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Get recent activity
exports.getRecentActivity = async (req, res) => {
  try {
    // Get recent messages and user registrations
    const recentMessages = await Message.find()
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5);

    // Combine and format activities
    const activities = [];

    recentMessages.forEach(message => {
      activities.push({
        type: 'message',
        description: `${message.sender?.name || 'Unknown'} sent a message`,
        timestamp: message.createdAt,
        icon: 'fas fa-comment'
      });
    });

    recentUsers.forEach(user => {
      activities.push({
        type: 'user',
        description: `${user.name} joined the platform`,
        timestamp: user.createdAt,
        icon: 'fas fa-user-plus'
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      activities: activities.slice(0, 10) // Return top 10 activities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activity',
      error: error.message
    });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Update user status (ban/unban)
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true, select: '-password' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User status updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const deletedMessage = await Message.findByIdAndDelete(messageId);
    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting message',
      error: error.message
    });
  }
};

// Clear all messages
exports.clearAllMessages = async (req, res) => {
  try {
    await Message.deleteMany({});
    
    res.json({
      success: true,
      message: 'All messages cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing messages',
      error: error.message
    });
  }
};