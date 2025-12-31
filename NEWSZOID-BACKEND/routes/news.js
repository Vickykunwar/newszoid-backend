// routes/news.js - PRODUCTION READY
const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator');
const newsController = require('../controllers/newsController');

// ============================================================
// Validation middleware
// ============================================================
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            ok: false,
            errors: errors.array()
        });
    }
    next();
};

// ============================================================
// GET /api/news - Fetch category-wise news
// Query params:
//   - category: string (optional, default: 'general')
//   - page: number (optional, default: 1)
//   - pageSize: number (optional, default: 10, max: 50)
// ============================================================
router.get(
    '/',
    [
        query('category')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 1, max: 50 })
            .withMessage('Category must be 1-50 characters'),
        query('page')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Page must be between 1 and 100'),
        query('pageSize')
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage('Page size must be between 1 and 50')
    ],
    validate,
    newsController.getNews
);

// ============================================================
// GET /api/news/local - Fetch city-wise local news
// Query params:
//   - location: string (required)
//   - page: number (optional, default: 1)
//   - pageSize: number (optional, default: 5, max: 20)
// ============================================================
router.get(
    '/local',
    [
        query('location')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Location must be 2-100 characters'),
        query('page')
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage('Page must be between 1 and 50'),
        query('pageSize')
            .optional()
            .isInt({ min: 1, max: 20 })
            .withMessage('Page size must be between 1 and 20')
    ],
    validate,
    newsController.getLocalNews
);

// ============================================================
// POST /api/news/summary - Generate article summary
// Body:
//   - url: string (optional)
//   - text: string (optional)
//   (at least one required)
// ============================================================
router.post(
    '/summary',
    [
        body('url')
            .optional()
            .isURL()
            .withMessage('Invalid URL format'),
        body('text')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 10, max: 5000 })
            .withMessage('Text must be 10-5000 characters')
    ],
    validate,
    newsController.summary
);

module.exports = router;