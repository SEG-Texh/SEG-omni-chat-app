require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Validate environment variables
const requiredEnvVars = [
  'SMTP_USER', 
  'SMTP_PASS',
  'FACEBOOK_PAGE_ACCESS_TOKEN'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Route imports
const facebookRoutes = require('./routes/facebook');
const whatsappRoutes = require('./routes/whatsapp');
const emailRoutes = require('./routes/email');

// Route mounting
app.use('/api/facebook', facebookRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/email', emailRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;