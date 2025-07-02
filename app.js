const express = require('express');
const cors = require('cors');
const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

module.exports = app;
