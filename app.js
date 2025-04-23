// app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());               // Allow cross-origin requests
app.use(express.json());       // Parse JSON bodies

app.use('/api/auth', require('./routes/auth'));  // Auth routes

module.exports = app;
