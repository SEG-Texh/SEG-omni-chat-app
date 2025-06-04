// ============================================================================
// SERVER/ROUTES/USERS.JS
// ============================================================================
const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET users
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add user (Admin or Supervisor)
router.post('/', auth, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { name, email, password, role, supervisor_id } = req.body;

    if (req.user.role === 'supervisor' && (role === 'admin' || role === 'supervisor')) {
      return res.status(403).json({ error: 'Supervisors cannot create admins or other supervisors' });
    }

    const assignedSupervisorId = req.user.role === 'supervisor' ? req.user._id : supervisor_id;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const newUser = new User({
      name,
      email,
      password,
      role: role || 'user',
      supervisor_id: assignedSupervisorId || null
    });

    await newUser.save();

    const resultUser = newUser.toObject();
    delete resultUser.password;

    res.status(201).json({ message: 'User created', user: resultUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
