const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
// Your routes go here
// Import route handlers
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');
const emailRoutes = require('./routes/email');

// Register routes
app.use('/api/facebook', require('./routes/facebook'));
app.use('/whatsapp', whatsappRoutes);
app.use('/email', emailRoutes);

module.exports = app;
