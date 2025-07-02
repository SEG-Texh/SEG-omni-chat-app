const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/whatsapp', whatsappRoutes);

module.exports = app;
