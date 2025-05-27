// routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Get routes
router.get('/users', adminController.getAllUsers);
router.get('/messages', adminController.getAllMessages);
router.get('/stats', adminController.getStats);
router.get('/recent-activity', adminController.getRecentActivity);

// Post routes
router.post('/users', adminController.createUser);

// Delete routes
router.delete('/users/:userId', adminController.deleteUser);
router.delete('/messages/:messageId', adminController.deleteMessage);
router.delete('/messages', adminController.clearAllMessages);

// Update routes
router.patch('/users/:userId/status', adminController.updateUserStatus);

module.exports = router;