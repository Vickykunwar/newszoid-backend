// routes/bizAgent.js - Business Intelligence Agent API proxy
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bizAgentController = require('../controllers/bizAgentController');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    body('businessType').isString().trim().notEmpty().withMessage('businessType is required'),
    body('city').isString().trim().notEmpty().withMessage('city is required'),
    body('items').isArray().withMessage('items must be an array of strings').optional(),
    body('items.*').isString().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('gstin').optional().isString().trim()
];

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
        body('name').isString().trim().notEmpty().withMessage('Profile name is required'),
        ...profileValidationBase
    ],
    validate,
    bizAgentController.saveProfile
);

// ============================================================
// POST /api/biz-agent/chat
// Generic endpoint (fallback)
// ============================================================
// Initialize Gemini for fallback route
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL_CANDIDATES = (
    process.env.GEMINI_MODEL_CANDIDATES || 'gemini-2.5-flash,gemini-2.0-flash'
)
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);

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
            .isLength({ min: 10, max: 10000 })
            .withMessage('userPrompt must be 10-10000 characters'),
    ],
    validate,
    async (req, res) => {
        try {
            const { systemPrompt, userPrompt } = req.body;

            const model = genAI.getGenerativeModel({
                model: GEMINI_MODEL_CANDIDATES[0],
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(userPrompt);
            const response = result.response;
            const text = response.text();

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
