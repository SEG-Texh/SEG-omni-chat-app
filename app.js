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

// Debug: Log all route registrations
const originalUse = app.use;
app.use = function(path, ...middleware) {
  console.log('🔍 Registering route/middleware:', typeof path === 'string' ? path : '[middleware]');
  return originalUse.call(this, path, ...middleware);
};

const originalGet = app.get;
app.get = function(path, ...handlers) {
  console.log('🔍 Registering GET route:', path);
  return originalGet.call(this, path, ...handlers);
};

const originalPost = app.post;
app.post = function(path, ...handlers) {
  console.log('🔍 Registering POST route:', path);
  return originalPost.call(this, path, ...handlers);
};

// API Routes - Load one by one to isolate the issue
try {
  console.log('📂 Loading WhatsApp routes...');
  app.use('/whatsapp', require('./routes/whatsapp'));
  console.log('✅ WhatsApp routes loaded');
} catch (error) {
  console.error('❌ Error loading WhatsApp routes:', error.message);
}

try {
  console.log('📂 Loading Facebook routes...');
  app.use('/facebook', require('./routes/facebook'));
  console.log('✅ Facebook routes loaded');
} catch (error) {
  console.error('❌ Error loading Facebook routes:', error.message);
}

try {
  console.log('📂 Loading Email routes...');
  app.use('/email', require('./routes/email'));
  console.log('✅ Email routes loaded');
} catch (error) {
  console.error('❌ Error loading Email routes:', error.message);
}

// API status route (fallback)
try {
  console.log('📂 Adding API status route...');
  app.get('/api/status', (req, res) => {
    res.send('🌐 Omni Chat API is running');
  });
  console.log('✅ API status route added');
} catch (error) {
  console.error('❌ Error adding API status route:', error.message);
}

// Catch-all route for SPA - FIXED SYNTAX
try {
  console.log('📂 Adding catch-all route...');
  app.get('*', (req, res) => {
    // If you have an index.html in public folder
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        // Fallback to API status if no frontend
        res.status(404).send('🌐 Omni Chat API is running - No frontend found');
      }
    });
  });
  console.log('✅ Catch-all route added');
} catch (error) {
  console.error('❌ Error adding catch-all route:', error.message);
}

console.log('🏁 App configuration complete');

module.exports = app;