// routes/bookmarks.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bookmarkController = require('../controllers/bookmarkController');

// Save bookmark
router.post('/', auth, bookmarkController.saveBookmark);

// Get all bookmarks
router.get('/', auth, bookmarkController.getBookmarks);

// Delete bookmark
router.delete('/:id', auth, bookmarkController.deleteBookmark);

module.exports = router;