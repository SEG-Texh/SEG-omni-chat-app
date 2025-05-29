// controllers/adminController.js
const adminService = require('../controllers/adminService');

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