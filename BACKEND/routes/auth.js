const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });
  return next();
};

const credentialsValidation = [
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 4, max: 128 })
    .withMessage('Password must be 4-128 characters'),
];

router.post(
  '/signup',
  [body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'), ...credentialsValidation],
  validate,
  authController.signup
);
router.post('/login', credentialsValidation, validate, authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;
