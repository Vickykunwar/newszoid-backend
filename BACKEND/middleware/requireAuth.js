const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const error = new Error('JWT authentication is not configured');
    error.status = 500;
    throw error;
  }
  return process.env.JWT_SECRET;
}

function requireAuth(req, res, next) {
  const [scheme, token] = String(req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (!payload?.sub || !payload?.email) {
      return res.status(401).json({ ok: false, error: 'Invalid authentication token' });
    }

    req.user = { id: String(payload.sub), email: payload.email, name: payload.name || '' };
    return next();
  } catch (error) {
    if (error.status === 500) return next(error);
    return res.status(401).json({ ok: false, error: 'Invalid or expired authentication token' });
  }
}

module.exports = { requireAuth, getJwtSecret };
