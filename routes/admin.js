const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Example routes
router.get('/users', adminController.getAllUsers);
router.get('/messages', adminController.getAllMessages);
router.get('/stats', adminController.getStats);
router.post('/users', adminController.createUser); // Example POST route
router.get('/recent-activity', adminController.getRecentActivity);


module.exports = router;
