const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const User = require('../models/User'); // Comment out if User model doesn't exist yet

const router = express.Router();

// Test route to make sure router works
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working!' });
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    // For testing purposes, create a mock user check
    // Replace this with your actual User model when it's ready
    if (email === 'admin@omnichat.com' && password === 'admin123') {
      const token = jwt.sign(
        {
          userId: 'mock-user-id',
          email: email,
          role: 'admin'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      console.log('Login successful for:', email);
      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: 'mock-user-id',
          name: 'Admin User',
          email: email,
          role: 'admin'
        }
      });
    }

    // If User model is available, uncomment and use this instead:
    /*
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log('Login successful for:', email);
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    */

    console.log('Invalid credentials for:', email);
    res.status(400).json({ message: 'Invalid credentials' });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Make sure to export the router
module.exports = router;