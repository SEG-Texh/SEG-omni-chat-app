// ============================================================================
// SERVER/ROUTES/USERS.JS
// ============================================================================
const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();


// @desc    Get All Users
// @access  Public
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ type: 'internal' });
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST api/users
// @desc    Create A User
// @access  Public
// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private (or Public, as you wish)
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ type: 'internal' });
    const activeUsers = await User.countDocuments({ type: 'internal', status: 'active' });
    const inactiveUsers = await User.countDocuments({ type: 'internal', status: 'inactive' });
    const admins = await User.countDocuments({ type: 'internal', role: 'admin' });
    const supervisors = await User.countDocuments({ type: 'internal', role: 'supervisor' });
    const users = await User.countDocuments({ type: 'internal', role: 'user' });
    res.json({ totalUsers, activeUsers, inactiveUsers, admins, supervisors, users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
router.post('/', async (req, res) => {
  const newUser = new User({
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
    supervisor: req.body.supervisor,
    status: req.body.status
  });

  try {
    const user = await newUser.save();
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE api/users/:id
// @desc    Delete A User
// @access  Public
router.delete('/:id', async (req, res) => {
  try {
    let user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ msg: 'User not found' });

    await User.findByIdAndRemove(req.params.id);

    res.json({ msg: 'User removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
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
