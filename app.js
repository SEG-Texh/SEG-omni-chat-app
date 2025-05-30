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

// API Routes - Comment out one by one to find the problematic one
try {
    app.use('/whatsapp', require('./routes/whatsapp'));
    console.log('✅ WhatsApp routes loaded');
} catch (error) {
    console.error('❌ Error loading WhatsApp routes:', error.message);
}

try {
    app.use('/facebook', require('./routes/facebook'));
    console.log('✅ Facebook routes loaded');
} catch (error) {
    console.error('❌ Error loading Facebook routes:', error.message);
}

try {
    app.use('/email', require('./routes/email'));
    console.log('✅ Email routes loaded');
} catch (error) {
    console.error('❌ Error loading Email routes:', error.message);
}

// API status route (fallback)
app.get('/api/status', (req, res) => {
    res.send('🌐 Omni Chat API is running');
});

// Catch-all route for SPA
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