const express = require('express');
const { body, validationResult } = require('express-validator');
const briefController = require('../controllers/briefController');

const router = express.Router();
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });
  return next();
};

router.post(
  '/',
  [
    body('businessType').optional().isString().trim().isLength({ max: 150 }),
    body('city').optional().isString().trim().isLength({ max: 100 }),
    body('name').optional().isString().trim().isLength({ max: 100 }),
    body('items').optional().isArray({ max: 20 }).withMessage('Max 20 items'),
    body('items.*').optional().isString().trim().isLength({ max: 100 }),
    body('currentRates').optional().isArray({ max: 20 }).withMessage('Max 20 current rates'),
    body('currentRates.*').optional().isObject(),
    body('recentNews').optional().isArray({ max: 20 }).withMessage('Max 20 news items'),
    body('recentNews.*').optional().isObject(),
  ],
  validate,
  briefController
);

module.exports = router;
