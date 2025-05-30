const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/whatsapp', require('./routes/whatsapp'));
app.use('/facebook', require('./routes/facebook'));
app.use('/email', require('./routes/email'));

app.get('/', (req, res) => {
  res.send('🌐 Omni Chat API is running');
});

module.exports = app;
