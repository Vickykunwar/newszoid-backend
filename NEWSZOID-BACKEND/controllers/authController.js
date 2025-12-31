// controllers/authController.js - PRODUCTION READY VERSION
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const sanitizeHtml = require('sanitize-html');

// Sanitize text input
const sanitizeInput = (text) => {
  if (!text) return '';
  return sanitizeHtml(text, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate JWT token
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'newszoid'
    }
  );
};

// Set secure cookie
const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('newszoid_token', token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    let { name, email, password } = req.body;

    // Sanitize inputs
    name = sanitizeInput(name);
    email = sanitizeInput(email).toLowerCase();

    // Validation
    if (!name || name.length < 2) {
      return res.status(400).json({
        ok: false,
        error: 'Name must be at least 2 characters'
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        ok: false,
        error: 'Name must be less than 50 characters'
      });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Valid email is required'
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Password is required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: 'Password must be at least 6 characters'
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        ok: false,
        error: 'Password must be less than 128 characters'
      });
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        ok: false,
        error: 'Password must contain uppercase, lowercase, and numbers'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        ok: false,
        error: 'Email already registered'
      });
    }

    // Hash password with salt rounds
    const saltRounds = 12; // Increased from 10 for better security
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      name,
      email,
      passwordHash
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    setAuthCookie(res, token);

    // Log successful registration (without sensitive data)
    console.log(`✅ New user registered: ${email}`);

    res.status(201).json({
      ok: true,
      message: 'Registration successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        ok: false,
        error: 'Email already registered'
      });
    }

    res.status(500).json({
      ok: false,
      error: 'Registration failed'
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    // Sanitize email
    email = sanitizeInput(email).toLowerCase();

    // Validation
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Valid email is required'
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Password is required'
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      // Use generic error message to prevent user enumeration
      return res.status(401).json({
        ok: false,
        error: 'Invalid credentials'
      });
    }

    // Check password with timing-safe comparison
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Log failed attempt for security monitoring
      console.warn(`⚠️  Failed login attempt for: ${email}`);
      
      return res.status(401).json({
        ok: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    setAuthCookie(res, token);

    // Log successful login
    console.log(`✅ User logged in: ${email}`);

    res.json({
      ok: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      ok: false,
      error: 'Login failed'
    });
  }
};

// Logout user
exports.logout = (req, res) => {
  res.clearCookie('newszoid_token', {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'strict',
    path: '/'
  });

  res.json({
    ok: true,
    message: 'Logged out successfully'
  });
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    // User is already attached by auth middleware
    res.json({
      ok: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to get user'
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    let { name } = req.body;

    // Sanitize input
    name = sanitizeInput(name);

    // Validation
    if (!name || name.length < 2) {
      return res.status(400).json({
        ok: false,
        error: 'Name must be at least 2 characters'
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        ok: false,
        error: 'Name must be less than 50 characters'
      });
    }

    // Update user
    req.user.name = name;
    await req.user.save();

    console.log(`✅ Profile updated: ${req.user.email}`);

    res.json({
      ok: true,
      message: 'Profile updated',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to update profile'
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'Current password is required'
      });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'New password is required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        ok: false,
        error: 'New password must be at least 6 characters'
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        ok: false,
        error: 'New password must be less than 128 characters'
      });
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        ok: false,
        error: 'New password must contain uppercase, lowercase, and numbers'
      });
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        ok: false,
        error: 'New password must be different from current password'
      });
    }

    // Get user with password hash
    const user = await User.findById(req.user._id).select('+passwordHash');

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      console.warn(`⚠️  Failed password change attempt: ${req.user.email}`);
      return res.status(401).json({
        ok: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordHash = newPasswordHash;
    await user.save();

    console.log(`✅ Password changed: ${req.user.email}`);

    res.json({
      ok: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to change password'
    });
  }
};

// Get user statistics (admin endpoint)
exports.getUserStats = async (req, res) => {
  try {
    // Get total count
    const totalUsers = await User.countDocuments();

    // Get recent users (last 20)
    const recentUsers = await User.find()
      .select('name email createdAt lastLogin')
      .sort({ createdAt: -1 })
      .limit(20);

    // Get users registered today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await User.countDocuments({
      createdAt: { $gte: today }
    });

    // Get users registered this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekCount = await User.countDocuments({
      createdAt: { $gte: weekAgo }
    });

    // Get users registered this month
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthCount = await User.countDocuments({
      createdAt: { $gte: monthAgo }
    });

    // Get active users (logged in within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: thirtyDaysAgo }
    });

    res.json({
      ok: true,
      stats: {
        total: totalUsers,
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        active: activeUsers
      },
      recent: recentUsers
    });
  } catch (err) {
    console.error('Get user stats error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve user statistics'
    });
  }
};

// Request password reset (send email with reset token)
exports.requestPasswordReset = async (req, res) => {
  try {
    let { email } = req.body;
    email = sanitizeInput(email).toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Valid email is required'
      });
    }

    const user = await User.findOne({ email });
    
    // Always return success to prevent user enumeration
    if (!user) {
      return res.json({
        ok: true,
        message: 'If email exists, password reset instructions have been sent'
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user._id, type: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    // const resetLink = `${process.env.FRONTEND_ORIGIN}/reset-password?token=${resetToken}`;
    // await sendEmail(user.email, 'Password Reset', resetLink);

    console.log(`🔐 Password reset requested: ${email}`);

    res.json({
      ok: true,
      message: 'If email exists, password reset instructions have been sent'
    });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to process password reset request'
    });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: 'Token and new password are required'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid or expired reset token'
      });
    }

    if (decoded.type !== 'password-reset') {
      return res.status(400).json({
        ok: false,
        error: 'Invalid token type'
      });
    }

    // Validate new password
    if (newPassword.length < 6 || newPassword.length > 128) {
      return res.status(400).json({
        ok: false,
        error: 'Password must be 6-128 characters'
      });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        ok: false,
        error: 'Password must contain uppercase, lowercase, and numbers'
      });
    }

    // Update password
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({
        ok: false,
        error: 'User not found'
      });
    }

    const saltRounds = 12;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    console.log(`✅ Password reset completed: ${user.email}`);

    res.json({
      ok: true,
      message: 'Password reset successful'
    });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to reset password'
    });
  }
};