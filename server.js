// server.js - PRODUCTION READY VERSION
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
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// =============================================================
// SECURITY MIDDLEWARE
// =============================================================

// Set security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.anthropic.com", "https://gnews.io", "https://content.guardianapis.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Sanitize data against NoSQL injection
app.use(mongoSanitize());

// Prevent XSS attacks
app.use(xss());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.FRONTEND_ORIGIN
      ? process.env.FRONTEND_ORIGIN.split(',')
      : [];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin && !isProduction) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || !isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing
app.use(cookieParser());

// Rate limiting - more strict in production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '50', 10),
  message: {
    ok: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    ok: false,
    error: 'Too many authentication attempts, please try again later.'
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging in development
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// =============================================================
// DATABASE CONNECTION
// =============================================================

const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
};

mongoose.connect(process.env.MONGO_URI, mongoOptions)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    if (!isProduction) {
      console.log(`📊 Database: ${mongoose.connection.name}`);
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Handle MongoDB connection errors after initial connection
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

// =============================================================
// ROUTES
// =============================================================

// Apply auth limiter to authentication routes
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };

  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json(healthCheck);
});

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================================
// ERROR HANDLING
// =============================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error details
  console.error('Error:', {
    message: err.message,
    stack: isProduction ? undefined : err.stack,
    path: req.path,
    method: req.method
  });

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      ok: false,
      error: 'CORS policy violation'
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
      error: 'Invalid token'
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      ok: false,
      error: 'Duplicate entry'
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    ok: false,
    error: isProduction ? 'Internal server error' : err.message
  });
});

// =============================================================
// START SERVER
// =============================================================

const server = app.listen(PORT, () => {
  console.log(`🚀 Newszoid server running on port ${PORT}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_ORIGIN || 'all origins (dev mode)'}`);

  if (!isProduction) {
    console.log(`📍 Local: http://localhost:${PORT}`);
  }
});

// =============================================================
// GRACEFUL SHUTDOWN
// =============================================================

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);

  server.close(() => {
    console.log('HTTP server closed');

    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;