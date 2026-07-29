const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../middleware/requireAuth');

function createToken(user) {
  return jwt.sign(
    { email: user.email, name: user.name },
    getJwtSecret(),
    { subject: String(user._id), expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function userPayload(user) {
  return { id: String(user._id), name: user.name, email: user.email };
}

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) return res.status(409).json({ ok: false, error: 'An account already exists for this email' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email: normalizedEmail, passwordHash });
    return res.status(201).json({ ok: true, token: createToken(user), user: userPayload(user) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ ok: false, error: 'An account already exists for this email' });
    }
    return next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    return res.json({ ok: true, token: createToken(user), user: userPayload(user) });
  } catch (error) {
    return next(error);
  }
};

exports.me = (req, res) => res.json({ ok: true, user: req.user });
