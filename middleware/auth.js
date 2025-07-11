const jwt = require('jsonwebtoken');
const User = require('../models/user');
const createError = require('http-errors');

const auth = async (req, res, next) => {
  try {
    // 1. Token Extraction (Multiple Sources)
    const token = extractToken(req);
    if (!token) {
      throw createError(401, 'Authentication required');
    }

    // 2. Token Verification
    const decoded = verifyToken(token);
    
    // 3. User Verification
    const user = await User.findById(decoded.userId)
      .select('-password -__v -refreshToken')
      .lean();
    
    if (!user || user.isDisabled) {
      throw createError(401, 'Account not found or disabled');
    }

    // 4. Attach User to Request
    req.user = user;
    next();
  } catch (error) {
    // 5. Error Handling
    if (error.name === 'TokenExpiredError') {
      error = createError(401, 'Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      error = createError(401, 'Invalid token');
    }
    
    // Log only server errors (500)
    if (error.status >= 500) {
      console.error('Auth Middleware Error:', error);
    }
    
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw createError(401, 'Authentication required');
      }
      
      if (!roles.includes(req.user.role)) {
        throw createError(403, 'Insufficient permissions');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Helper Functions
function extractToken(req) {
  return (
    req.header('Authorization')?.replace('Bearer ', '') ||
    req.cookies?.token ||
    req.query?.token
  );
}

function verifyToken(token) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { auth, authorize };