// routes/history.js
const express = require('express');
const router = express.Router();

const historyController = require('../controllers/historyController');
const auth = require('../middleware/auth');

// Add reading history entry
router.post('/', auth, historyController.addReadingHistory);

// Get user's reading history
router.get('/', auth, historyController.getReadingHistory);

// Get reading statistics
router.get('/stats', auth, historyController.getReadingStats);

// Delete specific history entry
router.delete('/:id', auth, historyController.deleteReadingHistory);

// Clear all history
router.delete('/', auth, historyController.clearReadingHistory);

module.exports = router;
