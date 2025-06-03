// ============================================================================
// SERVER/ROUTES/USERS.JS
// ============================================================================
const express = require('express');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Get all users (Admin sees all, Supervisor sees only their users)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'supervisor') {
      // Supervisor sees only users under them
      query = { supervisor_id: req.user._id };
    } else if (req.user.role === 'user') {
      // Regular users see only themselves and their supervisor
      query = { 
        $or: [
          { _id: req.user._id },
          { _id: req.user.supervisor_id }
        ]
      };
    }
    // Admin sees all users (no query filter)

    const users = await User.find(query)
      .select('-password')
      .populate('supervisor_id', 'name email')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get online users
router.get('/online', auth, async (req, res) => {
  try {
    let query = { isOnline: true };
    
    if (req.user.role === 'supervisor') {
      query.supervisor_id = req.user._id;
    } else if (req.user.role === 'user') {
      query = { 
        isOnline: true,
        $or: [
          { _id: req.user._id },
          { _id: req.user.supervisor_id }
        ]
      };
    }

    const onlineUsers = await User.find(query)
      .select('name email role isOnline lastSeen')
      .populate('supervisor_id', 'name email');

    res.json(onlineUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user (Admin only)
router.put('/:id', auth, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { name, email, role, supervisor_id } = req.body;
    const userId = req.params.id;

    // If supervisor, can only update users under them
    if (req.user.role === 'supervisor') {
      const userToUpdate = await User.findById(userId);
      if (!userToUpdate || !userToUpdate.supervisor_id.equals(req.user._id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updateData = { name, email };
    
    // Only admin can change roles and supervisor assignments
    if (req.user.role === 'admin') {
      if (role) updateData.role = role;
      if (supervisor_id !== undefined) updateData.supervisor_id = supervisor_id;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get supervisors (for dropdown when creating users)
router.get('/supervisors', auth, authorize('admin'), async (req, res) => {
  try {
    const supervisors = await User.find({ role: 'supervisor' })
      .select('name email')
      .sort({ name: 1 });
    res.json(supervisors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;