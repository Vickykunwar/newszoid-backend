// routes/migrate.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const migrateController = require('../controllers/migrateController');

// Migrate local bookmarks to server
router.post('/bookmarks', auth, migrateController.migrateBookmarks);

// Migrate reading history to server
router.post('/history', auth, migrateController.migrateHistory);

// Get migration status
router.get('/status', auth, migrateController.getMigrationStatus);

module.exports = router;