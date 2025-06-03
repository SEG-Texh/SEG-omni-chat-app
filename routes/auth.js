// ============================================================================
// SERVER/ROUTES/AUTH.JS
// ============================================================================
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Register (Admin can create users)
router.post('/register', auth, async (req, res) => {
  try {
    const { name, email, password, role, supervisor_id } = req.body;

    // Only admin can create users, or supervisor can create users under them
    if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const userData = { name, email, password, role: role || 'user' };
    
    // If supervisor is creating user, set supervisor_id
    if (req.user.role === 'supervisor') {
      userData.supervisor_id = req.user._id;
      userData.role = 'user'; // Supervisors can only create users
    } else if (supervisor_id && role !== 'admin') {
      userData.supervisor_id = supervisor_id;
    }

    const user = new User(userData);
    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        supervisor_id: user.supervisor_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        supervisor_id: user.supervisor_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', auth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      supervisor_id: req.user.supervisor_id,
      isOnline: req.user.isOnline
    }
  });
});

module.exports = router;
