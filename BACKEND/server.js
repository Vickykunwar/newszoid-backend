// server.js - PRODUCTION READY VERSION FOR RAILWAY
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Import routes
const bizAgentRoutes = require('./routes/bizAgent');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const shouldServeFrontend = process.env.SERVE_FRONTEND === 'true' || !isProduction;
let server = null;

console.log('='.repeat(60));
console.log('🚀 Starting Newszoid Backend Server');
console.log('='.repeat(60));
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📍 PORT: ${PORT}`);
console.log(`📍 Timestamp: ${new Date().toISOString()}`);
console.log('='.repeat(60));

// TRUST PROXY (Required when Cloudflare is in front of the API)
app.set('trust proxy', 1);
console.log('✅ Step 1: Trust Proxy configured');

// Set security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Sanitize data against NoSQL injection
app.use(mongoSanitize());
// Prevent XSS attacks
app.use(xss());
// Prevent HTTP Parameter Pollution
app.use(hpp());

app.use(cors({
  origin: (origin, callback) => {
    const allowed = (process.env.FRONTEND_ORIGINS || [
      'https://newszoid.com',
      'https://www.newszoid.com',
      'https://newszoid.vercel.app',
    ].join(','))
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    // allow server-to-server, curl, and same-origin requests
    if (!origin) return callback(null, true);

    // allow localhost always (can only come from the developer's machine)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    console.error("Blocked by CORS:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { ok: false, error: 'Too many requests' },
  skip: (req) => req.path === '/api/health' || req.path === '/'
});

app.get('/api/health', (req, res) => {
  const databaseStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    ok: true,
    status: 'online',
    database: databaseStatus,
    mongodb: databaseStatus,
    timestamp: new Date().toISOString(),
  });
});
console.log('✅ Step 3: Health Check registered');

app.use('/api/', limiter);
console.log('✅ Step 4: Rate Limiter configured');

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Database Connection (Background)
if (process.env.MONGO_URI && process.env.NODE_ENV !== 'test') {
  console.log('🔌 Step 5: Attempting to connect to MongoDB...');
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Step 6: MongoDB Connected'))
    .catch(err => console.error('❌ Step 6: MongoDB Error:', err.message));
}

// Routes
console.log('🚀 Step 7: Registering Routes...');
app.use('/api/biz-agent', bizAgentRoutes);
console.log('✅ Step 8: Routes Registered');

// Static files
const frontendPath = path.join(__dirname, '../FRONTEND');
if (shouldServeFrontend && require('fs').existsSync(frontendPath)) {
  // Set no-cache for index.html and service-worker to ensure updates
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/index.html' || req.path === '/service-worker.js') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    next();
  });
  app.use(express.static(frontendPath));
}
// Also serve the backend's own public folder (for sitemaps, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Error Handling
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({ ok: false, error: isProduction ? 'Internal error' : err.message });
});

// Graceful Shutdown
const shutdown = (signal) => {
  console.log(`\n⚠️  ${signal} received - Closing server`);
  if (!server) {
    mongoose.connection.close(false, () => process.exit(0));
    return;
  }

  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('✅ Shutdown complete');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  // Start only when this file is executed directly. Tests import the app without opening a port.
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on Railway port ${PORT}`);
    console.log('='.repeat(60));
  });
}

module.exports = app;
