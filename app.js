const express = require('express');
const app = express();
const bodyParser = require('body-parser');
require('dotenv').config();

app.use(bodyParser.json());

app.use('/facebook', require('./routes/facebook'));
app.use('/whatsapp', require('./routes/whatsapp'));
app.use('/email', require('./routes/email')); // You’ll define this

module.exports = app;
