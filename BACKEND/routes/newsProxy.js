// routes/newsProxy.js - Self-hosted RSS proxy (replaces rss2json.com)
// GET /api/news-proxy?industry=&city=&materials=
const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const newsProxyController = require('../controllers/newsProxyController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, errors: errors.array() });
  }
  next();
};

// All params are optional strings — the controller decides when the query is
// too empty to act on. Length caps stop oversized/abusive requests.
router.get(
  '/',
  [
    query('industry').optional().isString().trim().isLength({ max: 150 }),
    query('city').optional().isString().trim().isLength({ max: 100 }),
    query('materials').optional().isString().trim().isLength({ max: 300 }),
  ],
  validate,
  newsProxyController.fetchNewsProxy
);

module.exports = router;
