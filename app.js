const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

app.use(bodyParser.json());

// Import route handlers
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');
const emailRoutes = require('./routes/email');

// Register routes
app.use('/facebook', facebookRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/email', emailRoutes);

module.exports = app;
