// routes/bizAgent.js - Business Intelligence Agent API proxy
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bizAgentController = require('../controllers/bizAgentController');
const { requireAuth } = require('../middleware/requireAuth');

// Generic validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, errors: errors.array() });
    }
    next();
};

// Common validation rules
const profileValidationBase = [
    body('businessType').isString().trim().isLength({ min: 1, max: 150 }).withMessage('businessType is required and must be 150 characters or fewer'),
    body('city').isString().trim().isLength({ min: 1, max: 100 }).withMessage('city is required and must be 100 characters or fewer'),
    body('items').optional().isArray({ max: 20 }).withMessage('Max 20 items'),
    body('items.*').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Each item must be 1-100 characters'),
    body('email').optional().isEmail().normalizeEmail(),
    body('gstin').optional().isString().trim().isLength({ max: 15 })
];

// ============================================================
// POST /api/biz-agent/profile/enrich
// Research public business information and suggest local inputs
// ============================================================
router.post(
    '/profile/enrich',
    [
        body('name')
            .isString()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Company or owner name must be 2-100 characters'),
        body('city')
            .isString()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Location must be 2-100 characters'),
        body('businessType').optional().isString().trim().isLength({ max: 150 }),
        body('companyRole').optional().isString().trim().isLength({ max: 100 }),
        body('items').optional().isArray({ max: 20 }),
        body('items.*').optional().isString().trim().isLength({ max: 100 }),
    ],
    validate,
    bizAgentController.enrichProfile
);

// ============================================================
// POST /api/biz-agent/news
// Fetch personalized business news based on profile
// ============================================================
router.post(
    '/news',
    profileValidationBase,
    validate,
    bizAgentController.fetchNews
);

// ============================================================
// POST /api/biz-agent/rates
// Fetch live item rates for the business
// ============================================================
router.post(
    '/rates',
    profileValidationBase,
    validate,
    bizAgentController.fetchRates
);

// ============================================================
// POST /api/biz-agent/rate-history
// Fetch saved rate history without running a live AI rate lookup
// ============================================================
router.post(
    '/rate-history',
    [
        ...profileValidationBase,
        body('days').optional().isInt({ min: 1, max: 90 }).withMessage('days must be between 1 and 90')
    ],
    validate,
    bizAgentController.fetchRateHistory
);

// ============================================================
// POST /api/biz-agent/analyst
// Full AI analysis for the business profile
// ============================================================
router.post(
    '/analyst',
    [
        body('name').isString().trim().optional(),
        body('prompt').optional().isString().isLength({ max: 10000 }),
        body('question').optional().isString().isLength({ max: 500 }),
        ...profileValidationBase
    ],
    validate,
    bizAgentController.fetchAnalyst
);

// ============================================================
// POST /api/biz-agent/profile
// Save business profile natively to database
// ============================================================
router.post(
    '/profile',
    [
        body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Profile name must be 2-100 characters'),
        ...profileValidationBase
    ],
    validate,
    requireAuth,
    bizAgentController.saveProfile
);

// ============================================================
// POST /api/biz-agent/chat
// Generic endpoint (fallback)
// ============================================================
// /chat route refactored to use centralized AI logic
router.post(
    '/chat',
    [
        body('systemPrompt')
            .isString()
            .trim()
            .isLength({ min: 10, max: 5000 })
            .withMessage('systemPrompt must be 10-5000 characters'),
        body('userPrompt')
            .isString()
            .trim()
            .isLength({ min: 2, max: 10000 })
            .withMessage('userPrompt must be 10-10000 characters'),
    ],
    validate,
    async (req, res) => {
        try {
            const { systemPrompt, userPrompt } = req.body;
            const text = await bizAgentController.callGemini(systemPrompt, userPrompt);
            res.json({ ok: true, text });
        } catch (err) {
            console.error('❌ Biz Agent error:', err.message);
            res.status(500).json({
                ok: false,
                error: process.env.NODE_ENV === 'production'
                    ? 'AI analysis failed. Please try again.'
                    : err.message,
            });
        }
    }
);

module.exports = router;
