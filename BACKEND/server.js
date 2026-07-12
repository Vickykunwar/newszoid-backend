// server.js - PRODUCTION READY VERSION FOR VERCEL
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

// Import routes
const bizAgentRoutes = require('./routes/bizAgent');
const newsProxyRoutes = require('./routes/newsProxy');
const whatsappAlertController = require('./controllers/whatsappAlertController');
const briefController = require('./controllers/briefController');

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
// Prevent XSS attacks (Handled by sanitize-html in controllers)
// Prevent HTTP Parameter Pollution
app.use(hpp());

// BUG FIX: Support both FRONTEND_ORIGINS (plural) and FRONTEND_ORIGIN (singular legacy)
// so the .env value is actually respected instead of being silently ignored.
const corsOptions = {
  origin: (origin, callback) => {
    const rawOrigins =
      process.env.FRONTEND_ORIGINS ||
      process.env.FRONTEND_ORIGIN ||
      'https://newszoid.com,https://www.newszoid.com,https://newszoid.vercel.app';
    const allowed = rawOrigins
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

    // allow server-to-server, curl, and same-origin requests
    if (!origin) return callback(null, true);

    // Local file/PWA previews use the opaque "null" origin.
    if (origin === 'null') return callback(null, true);

    // allow localhost always (can only come from the developer's machine)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);

    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    console.error('Blocked by CORS:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

app.options('*', cors(corsOptions));

app.use(compression());

// Vercel may pre-parse the body before Express sees it. If that happened,
// req.body is already populated and the raw stream is consumed, so calling
// express.json() again would fail or overwrite it with undefined.
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return next();
  }
  express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});
app.use(cookieParser());

// BUG FIX: Rate Limiter now reads windowMs and max from env vars so .env values
// (RATE_LIMIT_WINDOW_MS=900000, RATE_LIMIT_MAX_REQUESTS=50) are actually applied.
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 300,
  message: { ok: false, error: 'Too many requests' },
  skip: (req) => req.path === '/api/health' || req.path === '/'
});

app.get('/api/health', (req, res) => {
  const readyState = mongoose.connection.readyState;
  let databaseStatus = 'disconnected';
  if (readyState === 1) databaseStatus = 'connected';
  else if (readyState === 2) databaseStatus = 'connecting';
  
  res.status(200).json({
    ok: true,
    status: 'online',
    database: databaseStatus,
    mongodb: databaseStatus,
    readyState: readyState,
    hasMongoUri: !!process.env.MONGO_URI,
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

// Database Connection Middleware for Serverless
let isConnected = false;
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return next();
  }

  if (process.env.MONGO_URI && process.env.NODE_ENV !== 'test') {
    try {
      console.log('🔌 Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
      console.log('✅ MongoDB Connected');
    } catch (err) {
      console.error('❌ MongoDB Connection Error:', err.message);
      return res.status(500).json({ ok: false, error: 'Database connection failed' });
    }
  }
  next();
});

// Routes
console.log('🚀 Step 7: Registering Routes...');
app.use('/api/biz-agent', bizAgentRoutes);
app.use('/api/news-proxy', newsProxyRoutes);
app.all('/api/whatsapp-alert', whatsappAlertController.handler);
app.post('/api/brief', briefController);
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

// BUG FIX: 404 catch-all must come before the 4-argument error handler.
// The error handler must be the VERY last middleware so Express recognises
// it as an error handler (requires exactly 4 arguments: err, req, res, next).
app.use((req, res, _next) => res.status(404).json({ ok: false, error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
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

if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start only when this file is executed directly. Tests import the app without opening a port.
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${PORT}`);
    console.log('='.repeat(60));
  });
}

module.exports = app;
