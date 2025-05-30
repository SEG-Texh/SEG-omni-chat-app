const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const path = require('path');

app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from 'public' folder FIRST
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/whatsapp', require('./routes/whatsapp'));
app.use('/facebook', require('./routes/facebook'));
app.use('/email', require('./routes/email'));

// API status route (fallback)
app.get('/api/status', (req, res) => {
    res.send('🌐 Omni Chat API is running');
});

// Catch-all route for SPA (FIXED - removed the problematic * pattern)
app.get('/*', (req, res) => {
    // If you have an index.html in public folder
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            // Fallback to API status if no frontend
            res.status(404).send('🌐 Omni Chat API is running - No frontend found');
        }
    });
});

module.exports = app;
