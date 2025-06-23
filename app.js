// app.js
const express = require('express');
const cors = require('cors');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Route imports
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');
const emailRoutes = require('./routes/email');

// Route mounting
app.use('/api/facebook', facebookRoutes);    // Mounts webhook at /api/facebook/webhook
app.use('/api/whatsapp', whatsappRoutes);    // Optional: clean consistent base path
app.use('/api/email', emailRoutes);          // Optional: clean consistent base path

module.exports = app;
