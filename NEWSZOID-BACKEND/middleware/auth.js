// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async function (req, res, next) {
  try {
    const token = req.cookies.newszoid_token || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const data = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(data.userId).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
