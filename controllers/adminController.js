// controllers/adminController.js
const User = require('../models/User');
const Message = require('../models/message'); // You'll need to create this model
const Email = require('../models/Email'); // You'll need to create this model

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 }); // Sort by newest first
    
    res.json({
      success: true,
      data: users,
      count: users.length
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
    const { filter = 'all', search = '' } = req.query;
    
    // Date filtering
    let dateFilter = {};
    const now = new Date();
    
    switch (filter) {
      case 'today':
        dateFilter = {
          createdAt: {
            $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        };
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { createdAt: { $gte: weekAgo } };
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        dateFilter = { createdAt: { $gte: monthAgo } };
        break;
    }

    // Search filter
    let searchFilter = {};
    if (search) {
      searchFilter = {
        $or: [
          { content: { $regex: search, $options: 'i' } },
          { sender: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const combinedFilter = { ...dateFilter, ...searchFilter };

    // Fetch messages from Message collection
    const messages = await Message.find(combinedFilter)
      .populate('sender', 'username email')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to prevent overwhelming

    // Fetch emails from Email collection
    const emails = await Email.find(combinedFilter)
      .sort({ createdAt: -1 })
      .limit(100);

    // Combine and format messages
    const allMessages = [
      ...messages.map(msg => ({
        _id: msg._id,
        type: 'message',
        content: msg.content,
        sender: msg.sender?.username || msg.sender?.email || 'Unknown',
        senderEmail: msg.sender?.email || '',
        recipient: msg.recipient,
        platform: msg.platform || 'chat',
        createdAt: msg.createdAt,
        status: msg.status || 'sent'
      })),
      ...emails.map(email => ({
        _id: email._id,
        type: 'email',
        content: email.body || email.text || email.html,
        sender: email.from,
        senderEmail: email.from,
        recipient: email.to,
        subject: email.subject,
        platform: 'email',
        createdAt: email.createdAt || email.date,
        status: email.status || 'received'
      }))
    ];

    // Sort combined messages by date
    allMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: allMessages,
      count: allMessages.length
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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });

    // Count messages from both collections
    const totalMessages = await Message.countDocuments() + await Email.countDocuments();
    const todayMessages = await Message.countDocuments({ createdAt: { $gte: todayStart } }) +
                         await Email.countDocuments({ createdAt: { $gte: todayStart } });

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
    // Get recent users (last 10)
    const recentUsers = await User.find({})
      .select('username email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent messages (last 10)
    const recentMessages = await Message.find({})
      .populate('sender', 'username email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent emails (last 5)
    const recentEmails = await Email.find({})
      .sort({ createdAt: -1 })
      .limit(5);

    const activities = [
      ...recentUsers.map(user => ({
        type: 'user_joined',
        description: `${user.username} joined the platform`,
        timestamp: user.createdAt,
        icon: 'fa-user-plus',
        color: 'text-green-600'
      })),
      ...recentMessages.map(msg => ({
        type: 'message_sent',
        description: `${msg.sender?.username || 'Unknown'} sent a message`,
        timestamp: msg.createdAt,
        icon: 'fa-comment',
        color: 'text-blue-600'
      })),
      ...recentEmails.map(email => ({
        type: 'email_received',
        description: `Email received from ${email.from}`,
        timestamp: email.createdAt || email.date,
        icon: 'fa-envelope',
        color: 'text-purple-600'
      }))
    ];

    // Sort by timestamp and limit to 10 most recent
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentActivity = activities.slice(0, 10);

    res.json({
      success: true,
      data: recentActivity
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

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const newUser = new User({
      username: name,
      email: email.toLowerCase(),
      password: password,
      role: role,
      status: 'active'
    });

    await newUser.save();

    // Send success response (password will be automatically excluded)
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
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'banned', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be active, banned, or suspended'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status: status },
      { new: true, select: '-password' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

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
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    // Try to delete from Message collection first
    let deletedMessage = await Message.findByIdAndDelete(messageId);
    let messageType = 'message';

    // If not found in Message collection, try Email collection
    if (!deletedMessage) {
      deletedMessage = await Email.findByIdAndDelete(messageId);
      messageType = 'email';
    }

    if (!deletedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

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
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// Clear all messages
const clearAllMessages = async (req, res) => {
  try {
    const messagesDeleted = await Message.deleteMany({});
    const emailsDeleted = await Email.deleteMany({});

    res.json({
      success: true,
      message: 'All messages cleared successfully',
      data: {
        messagesDeleted: messagesDeleted.deletedCount,
        emailsDeleted: emailsDeleted.deletedCount,
        totalDeleted: messagesDeleted.deletedCount + emailsDeleted.deletedCount
      }
    });

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('allMessagesCleared', {
        message: 'All messages have been cleared',
        count: messagesDeleted.deletedCount + emailsDeleted.deletedCount
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