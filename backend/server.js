/**
 * LogHawk – Express Server Entry Point
 *
 * Initializes the Express application, connects to MongoDB,
 * registers middleware, and mounts all API route handlers.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
require('dotenv').config();

// Initialize Express application
const app = express();

// ---- Connect to Database ----
connectDB();

// ---- Ensure uploads directory exists ----
// Multer diskStorage does not create directories automatically.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ---- Global Middleware ----
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, postman, or server-to-server)
    if (!origin) return callback(null, true);
    
    const isLocalhost = /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin);
    const isAllowedClient = origin === process.env.CLIENT_URL;
    
    if (isLocalhost || isAllowedClient) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// ---- Static Files ----
// Serve uploaded log files (protected by auth middleware in routes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- API Routes ----
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));
app.use('/api/alerts', require('./routes/alertRoutes'));
app.use('/api/incidents', require('./routes/incidentRoutes'));
app.use('/api/detection-rules', require('./routes/detectionRulesRoutes'));
app.use('/api/blocked-assets', require('./routes/blockedAssetsRoutes'));

// ---- Health Check ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'LogHawk API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ---- Error Handling Middleware ----
app.use(require('./middleware/errorHandler'));

// ---- Start Server ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🦅 LogHawk API Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
