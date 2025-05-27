// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
  // Get token from multiple possible headers
  let token = req.header('x-auth-token') || 
              req.header('Authorization') ||
              req.headers.authorization;
  
  // Handle Bearer token format
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7); // Remove 'Bearer ' prefix
  }
  
  // Check if no token
  if (!token) {
    console.log('No token found in headers:', {
      'x-auth-token': req.header('x-auth-token'),
      'Authorization': req.header('Authorization'),
      'authorization': req.headers.authorization
    });
    return res.status(401).json({ error: 'No token, authorization denied' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user info to request
    req.user = decoded;
    console.log('Token verified successfully for user:', decoded.id || decoded.userId);
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    console.log('Token that failed:', token.substring(0, 20) + '...');
    res.status(401).json({ error: 'Token is not valid' });
  }
};

const adminMiddleware = (req, res, next) => {
  // Check if user exists and has admin role
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  if (req.user.role !== 'admin') {
    console.log('Access denied for user:', req.user.id || req.user.userId, 'Role:', req.user.role);
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  
  console.log('Admin access granted for user:', req.user.id || req.user.userId);
  next();
};

module.exports = { authMiddleware, adminMiddleware };