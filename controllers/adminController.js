// controllers/adminController.js
const User = require('../models/User');
const Message = require('../models/message');
const Email = require('../models/Email');

// Admin Service Functions
const adminService = {
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
      Message.countDocuments() + await Email.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: todayStart } }) +
      await Email.countDocuments({ createdAt: { $gte: todayStart } })
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
    return { users, total, page: parseInt(page), pages: Math.ceil(total / limit) };
  },

  getMessages: async ({ page = 1, limit = 10, filter = 'all', search = '' }) => {
    const query = {};
    
    // Apply search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    let messages = [];
    let total = 0;

    if (filter === 'all' || filter === 'messages') {
      const messageQuery = { ...query };
      const [messageResults, messageCount] = await Promise.all([
        Message.find(messageQuery)
          .sort({ createdAt: -1 })
          .limit(filter === 'all' ? limit : parseInt(limit)),
        Message.countDocuments(messageQuery)
      ]);
      messages = [...messages, ...messageResults.map(msg => ({ ...msg.toObject(), type: 'message' }))];
      total += messageCount;
    }

    if (filter === 'all' || filter === 'emails') {
      const emailQuery = { ...query };
      const [emailResults, emailCount] = await Promise.all([
        Email.find(emailQuery)
          .sort({ createdAt: -1 })
          .limit(filter === 'all' ? limit : parseInt(limit)),
        Email.countDocuments(emailQuery)
      ]);
      messages = [...messages, ...emailResults.map(email => ({ ...email.toObject(), type: 'email' }))];
      total += emailCount;
    }

    // Sort combined results by createdAt
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination to combined results
    const startIndex = (page - 1) * limit;
    const paginatedMessages = messages.slice(startIndex, startIndex + parseInt(limit));

    return { 
      messages: paginatedMessages, 
      total, 
      page: parseInt(page), 
      pages: Math.ceil(total / limit) 
    };
  },

  getRecentActivity: async (limit = 10) => {
    const [recentUsers, recentMessages, recentEmails] = await Promise.all([
      User.find()
        .select('username email createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Message.find()
        .select('name email message createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Email.find()
        .select('name email subject createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    const activities = [
      ...recentUsers.map(user => ({
        type: 'user_registered',
        description: `${user.username} registered`,
        timestamp: user.createdAt,
        data: { username: user.username, email: user.email }
      })),
      ...recentMessages.map(msg => ({
        type: 'message_received',
        description: `Message from ${msg.name}`,
        timestamp: msg.createdAt,
        data: { name: msg.name, email: msg.email }
      })),
      ...recentEmails.map(email => ({
        type: 'email_received',
        description: `Email from ${email.name}: ${email.subject}`,
        timestamp: email.createdAt,
        data: { name: email.name, email: email.email, subject: email.subject }
      }))
    ];

    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  },

  createUser: async ({ username, email, password, role = 'user' }) => {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    const newUser = new User({
      username,
      email,
      password, // Assuming password hashing is handled in User model pre-save hook
      role,
      status: 'active'
    });

    await newUser.save();
    
    // Return user without password
    const userObject = newUser.toObject();
    delete userObject.password;
    return userObject;
  },

  deleteUser: async (userId) => {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }

    await User.findByIdAndDelete(userId);
    return user;
  },

  updateUserStatus: async (userId, status) => {
    const validStatuses = ['active', 'inactive', 'banned'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be: active, inactive, or banned');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  },

  deleteMessage: async (messageId) => {
    // Try to find and delete from Message collection first
    let deletedMessage = await Message.findByIdAndDelete(messageId);
    let messageType = 'Message';

    // If not found in Message collection, try Email collection
    if (!deletedMessage) {
      deletedMessage = await Email.findByIdAndDelete(messageId);
      messageType = 'Email';
    }

    if (!deletedMessage) {
      throw new Error('Message not found');
    }

    return { deletedMessage, messageType };
  },

  clearAllMessages: async () => {
    const [messageResult, emailResult] = await Promise.all([
      Message.deleteMany({}),
      Email.deleteMany({})
    ]);

    return {
      messagesDeleted: messageResult.deletedCount,
      emailsDeleted: emailResult.deletedCount,
      totalDeleted: messageResult.deletedCount + emailResult.deletedCount
    };
  }
};

// Controller Functions
// Get all users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = req.query;
    const data = await adminService.getUsers({ page, limit, search, status });
    
    res.json({
      success: true,
      data: data.users,
      pagination: {
        page: data.page,
        pages: data.pages,
        total: data.total
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get all messages (from both Message and Email collections)
const getAllMessages = async (req, res) => {
  try {
    const { filter = 'all', search = '', page = 1, limit = 10 } = req.query;
    
    const data = await adminService.getMessages({ 
      filter, 
      search, 
      page, 
      limit 
    });

    res.json({
      success: true,
      data: data.messages,
      pagination: {
        page: data.page,
        pages: data.pages,
        total: data.total
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// Get dashboard statistics
const getStats = async (req, res) => {
  try {
    const [userStats, messageStats] = await Promise.all([
      adminService.getUserStats(),
      adminService.getMessageStats()
    ]);
    
    res.json({
      success: true,
      data: {
        ...userStats,
        ...messageStats
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};

// Get recent activity
const getRecentActivity = async (req, res) => {
  try {
    const activities = await adminService.getRecentActivity();
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity',
      error: error.message
    });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    const newUser = await adminService.createUser({
      username: name,
      email,
      password,
      role
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('userCreated', {
        user: newUser,
        message: `New user ${newUser.username} has been created`
      });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    const status = error.message.includes('already exists') ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to create user',
      error: error.message
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deletedUser = await adminService.deleteUser(userId);

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: deletedUser
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('userDeleted', {
        userId: userId,
        message: `User ${deletedUser.username} has been deleted`
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete user',
      error: error.message
    });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const updatedUser = await adminService.updateUserStatus(userId, status);

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: updatedUser
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('userStatusUpdated', {
        user: updatedUser,
        message: `User ${updatedUser.username} status changed to ${status}`
      });
    }
  } catch (error) {
    console.error('Error updating user status:', error);
    const status = error.message.includes('Invalid status') ? 400 : 
                  error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to update user status',
      error: error.message
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const { deletedMessage, messageType } = await adminService.deleteMessage(messageId);

    res.json({
      success: true,
      message: `${messageType} deleted successfully`,
      data: { id: messageId, type: messageType }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('messageDeleted', {
        messageId: messageId,
        messageType: messageType,
        message: `${messageType} has been deleted`
      });
    }
  } catch (error) {
    console.error('Error deleting message:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to delete message',
      error: error.message
    });
  }
};

// Clear all messages
const clearAllMessages = async (req, res) => {
  try {
    const result = await adminService.clearAllMessages();

    res.json({
      success: true,
      message: 'All messages cleared successfully',
      data: {
        messagesDeleted: result.messagesDeleted,
        emailsDeleted: result.emailsDeleted,
        totalDeleted: result.totalDeleted
      }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('allMessagesCleared', {
        message: 'All messages have been cleared',
        count: result.totalDeleted
      });
    }
  } catch (error) {
    console.error('Error clearing messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear messages',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  getAllMessages,
  getStats,
  getRecentActivity,
  createUser,
  deleteUser,
  updateUserStatus,
  deleteMessage,
  clearAllMessages
};