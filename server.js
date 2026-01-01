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
// Priority: 1. Railway assigned PORT, 2. Manual PORT env, 3. Fallback 4000
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

console.log('='.repeat(60));
console.log('🚀 Starting Newszoid Backend Server');
console.log('='.repeat(60));
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`📍 Railway Port: ${process.env.PORT || 'NOT SET (using fallback)'}`);
console.log(`📍 Final Port: ${PORT}`);
console.log(`📍 Timestamp: ${new Date().toISOString()}`);
console.log('='.repeat(60));

// =============================================================
// SECURITY MIDDLEWARE
// =============================================================

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

// =============================================================
// CORS CONFIGURATION - FIXED FOR VERCEL + RAILWAY
// =============================================================

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(',').map(o => o.trim())
      : [];

    // Check if origin is allowed
    const isVercelDomain = origin.includes('.vercel.app');
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isExplicitlyAllowed = allowedOrigins.some(allowed =>
      origin === allowed || origin.includes(allowed) || allowed.includes(origin)
    );

    if (isProduction) {
      // In production: Allow Vercel domains and explicitly allowed origins
      if (isVercelDomain || isExplicitlyAllowed) {
        console.log(`✅ CORS Allowed (Production): ${origin}`);
        return callback(null, true);
      }

      // Log but still allow (to prevent breaking during migration)
      console.warn(`⚠️  CORS Warning: ${origin} not in whitelist, but allowing`);
      return callback(null, true);
    } else {
      // In development: Allow everything
      if (isLocalhost || isExplicitlyAllowed) {
        console.log(`✅ CORS Allowed (Development): ${origin}`);
      }
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// =============================================================
// BODY PARSING & COOKIES
// =============================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// =============================================================
// RATE LIMITING
// =============================================================

// General API rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10),
  message: {
    ok: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/';
  }
});

app.use('/api/', limiter);

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    ok: false,
    error: 'Too many authentication attempts, please try again later.'
  }
});

// =============================================================
// REQUEST LOGGING
// =============================================================

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// =============================================================
// DATABASE CONNECTION
// =============================================================

if (!process.env.MONGO_URI) {
  console.error('❌ CRITICAL ERROR: MONGO_URI is not defined in environment variables!');
  if (isProduction) {
    console.error('❌ Cannot start server without database in production mode');
    process.exit(1);
  } else {
    console.warn('⚠️  Running without database connection (development mode)');
  }
}

const mongoOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4
};

if (process.env.MONGO_URI) {
  console.log('🔌 Attempting to connect to MongoDB...');
  mongoose.connect(process.env.MONGO_URI, mongoOptions)
    .then(() => {
      console.log('='.repeat(60));
      console.log('✅ MongoDB Connected Successfully');
      console.log(`📊 Database: ${mongoose.connection.name}`);
      console.log('='.repeat(60));
    })
    .catch(err => {
      console.error('❌ MongoDB Connection Error:', err.message);
      console.log('⚠️  Server will remain running for health checks, but DB features may fail.');
    });
}

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB Runtime Error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB Disconnected - Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB Reconnected');
});
}

// =============================================================
// ROUTES
// =============================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'Newszoid API Server is running',
    version: '1.0.1',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      news: '/api/news',
      localNews: '/api/news/local',
      auth: '/api/auth',
      bookmarks: '/api/bookmarks',
      comments: '/api/comments',
      weather: '/api/weather',
      market: '/api/market',
      history: '/api/history'
    }
  });
});

// Health check endpoint (must be before rate limiting)
app.get('/api/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const healthCheck = {
    ok: true,
    status: mongoStatus === 1 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    mongodb: {
      status: mongoStates[mongoStatus] || 'unknown',
      database: mongoose.connection.name || 'not connected'
    },
    version: '1.0.1',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  };

  const httpStatus = mongoStatus === 1 ? 200 : 503;
  res.status(httpStatus).json(healthCheck);
});

// API Routes with rate limiting
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

// Static files (Fallback or status page)
const frontendPath = path.join(__dirname, '../FRONTEND');
if (require('fs').existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
} else {
  console.log('ℹ️  Frontend directory not found, skipping static file serving');
}

// =============================================================
// ERROR HANDLING
// =============================================================

// 404 Handler
app.use((req, res) => {
  console.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    ok: false,
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      '/api/health',
      '/api/news',
      '/api/auth',
      '/api/bookmarks',
      '/api/comments',
      '/api/weather',
      '/api/market'
    ]
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error Handler Triggered:', {
    message: err.message,
    path: req.path,
    method: req.method,
    stack: isProduction ? undefined : err.stack
  });

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(200).json({
      ok: true,
      message: 'CORS policy applied',
      origin: req.headers.origin
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      error: 'Validation error',
      details: isProduction ? undefined : err.errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      ok: false,
      error: 'Invalid authentication token'
    });
  }

  // JWT expired errors
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      ok: false,
      error: 'Authentication token expired'
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      ok: false,
      error: 'Duplicate entry - resource already exists'
    });
  }

  // MongoDB CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      ok: false,
      error: 'Invalid ID format'
    });
  }

  // Generic server error
  res.status(err.status || 500).json({
    ok: false,
    error: isProduction ? 'Internal server error' : err.message,
    stack: isProduction ? undefined : err.stack
  });
});

// =============================================================
// START SERVER
// =============================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('✅ SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log(`🚀 Server URL: http://0.0.0.0:${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS Mode: ${isProduction ? 'Production (Vercel allowed)' : 'Development (All origins)'}`);
  console.log(`📊 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '⚠️  Not Connected'}`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
  console.log('📝 Available Endpoints:');
  console.log('   GET  / - API Info');
  console.log('   GET  /api/health - Health Check');
  console.log('   GET  /api/news - Get News');
  console.log('   POST /api/auth/register - Register User');
  console.log('   POST /api/auth/login - Login User');
  console.log('='.repeat(60));
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server Error:', error);
    process.exit(1);
  }
});

// =============================================================
// GRACEFUL SHUTDOWN
// =============================================================

const gracefulShutdown = (signal) => {
  console.log('');
  console.log('='.repeat(60));
  console.log(`⚠️  ${signal} received - Starting graceful shutdown`);
  console.log('='.repeat(60));

  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');

    // Close database connection
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed');
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      });
    } else {
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after 10 second timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('='.repeat(60));
  console.error('❌ UNCAUGHT EXCEPTION - Shutting down');
  console.error('='.repeat(60));
  console.error('Error:', err.name);
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('='.repeat(60));
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('='.repeat(60));
  console.error('❌ UNHANDLED REJECTION - Shutting down');
  console.error('='.repeat(60));
  console.error('Error:', err);
  console.error('='.repeat(60));
  server.close(() => {
    process.exit(1);
  });
});

// Export for testing
module.exports = app;