// server.js - PRODUCTION READY VERSION FOR RAILWAY
require('dotenv').config();
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

// Import routes
const authRoutes = require('./routes/auth');
const bookmarkRoutes = require('./routes/bookmarks');
const commentRoutes = require('./routes/comments');
const migrateRoutes = require('./routes/migrate');
const historyRoutes = require('./routes/history');
const newsRoutes = require('./routes/news');
const weatherRoutes = require('./routes/weather');
const marketRoutes = require('./routes/market');

const app = express();
const PORT = Number(process.env.PORT);

if (!PORT) {
  console.error('❌ PORT not provided by Railway');
  process.exit(1);
}
const isProduction = process.env.NODE_ENV === 'production';

console.log('='.repeat(60));
console.log('🚀 Starting Newszoid Backend Server');
console.log('='.repeat(60));
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📍 PORT: ${PORT}`);
console.log(`📍 Timestamp: ${new Date().toISOString()}`);
console.log('='.repeat(60));

// TRUST PROXY (Required for Railway/Vercel)
app.set('trust proxy', 1);
console.log('✅ Step 1: Trust Proxy configured');

// START SERVER IMMEDIATELY (To satisfy Railway health check)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on Railway port ${PORT}`);
  console.log('='.repeat(60));
});

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
    const allowed = [
      "https://newszoid.com",
      "https://www.newszoid.com",
      "https://newszoid.vercel.app"
    ];

    // allow server-to-server & curl
    if (!origin) return callback(null, true);

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
  res.status(200).json({ ok: true, status: 'online', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});
console.log('✅ Step 3: Health Check registered');

app.use('/api/', limiter);
console.log('✅ Step 4: Rate Limiter configured');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: 'Too many auth attempts' }
});

// Request Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Database Connection (Background)
if (process.env.MONGO_URI) {
  console.log('🔌 Step 5: Attempting to connect to MongoDB...');
  mongoose.connect(process.env.MONGO_URI, { family: 4 })
    .then(() => console.log('✅ Step 6: MongoDB Connected'))
    .catch(err => console.error('❌ Step 6: MongoDB Error:', err.message));
}

// Routes
console.log('🚀 Step 7: Registering Routes...');
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/market', marketRoutes);
console.log('✅ Step 8: Routes Registered');

// Static files
const frontendPath = path.join(__dirname, '../FRONTEND');
if (require('fs').existsSync(frontendPath)) {
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
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('✅ Shutdown complete');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;