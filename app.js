const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const path = require('path');

app.use(cors());
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
// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public1')));

module.exports = app;
