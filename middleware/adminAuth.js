// middleware/adminAuth.js - PRODUCTION READY VERSION
const adminAuth = (req, res, next) => {
    // Get admin emails from environment variable
    const adminEmailsStr = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsStr.split(',').map(email => email.trim()).filter(Boolean);

    // Security: If no admin emails configured, deny all access
    if (adminEmails.length === 0) {
        console.error('⚠️  ADMIN_EMAILS not configured in environment');
        return res.status(403).json({
            ok: false,
            error: 'Admin access not configured'
        });
    }

    // Check if user is authenticated
    if (!req.user) {
        return res.status(401).json({
            ok: false,
            error: 'Authentication required'
        });
    }

    // Check if user email is in admin list
    if (adminEmails.includes(req.user.email)) {
        // Log admin access for security auditing
        console.log(`🔐 Admin access granted: ${req.user.email} - ${req.method} ${req.path}`);
        return next();
    }

    // Log unauthorized access attempts
    console.warn(`⚠️  Unauthorized admin access attempt: ${req.user.email} - ${req.method} ${req.path}`);

    return res.status(403).json({
        ok: false,
        error: 'Admin privileges required'
    });
};

module.exports = adminAuth;