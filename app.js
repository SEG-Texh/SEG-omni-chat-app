const express = require('express');
const app = express();
const bodyParser = require('body-parser');
require('dotenv').config();

app.use(bodyParser.json());

const facebookRoutes = require('./routes/facebook');
app.use('/facebook', facebookRoutes);

app.use('/whatsapp', require('./routes/whatsapp'));
app.use('/email', require('./routes/email')); // You’ll define this

module.exports = app;
