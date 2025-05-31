const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate user token
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token is not valid.' 
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated.' 
      });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Token is not valid.' 
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
    });
  }
  next();
};

// Check if user is admin or moderator
const requireModerator = (req, res, next) => {
  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Moderator privileges required.' 
    });
  }
  next();
};

// Check if user can access resource (self or admin)
const requireOwnershipOrAdmin = (req, res, next) => {
  const targetUserId = req.params.id || req.params.userId;
  
  if (req.user.role === 'admin' || req.user._id.toString() === targetUserId) {
    return next();
  }
  
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. You can only access your own resources.' 
  });
};

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );
};

module.exports = {
  authenticate,
  requireAdmin,
  requireModerator,
  requireOwnershipOrAdmin,
  generateToken
};