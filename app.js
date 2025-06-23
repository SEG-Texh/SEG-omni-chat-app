const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');
const emailRoutes = require('./routes/email');

app.use('/api/facebook', facebookRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/email', emailRoutes);

module.exports = app;
