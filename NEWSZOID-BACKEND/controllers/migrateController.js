// controllers/migrateController.js
const Bookmark = require('../models/Bookmark');
const ReadingHistory = require('../models/ReadingHistory');

// Migrate local bookmarks to server
exports.migrateBookmarks = async (req, res) => {
  try {
    const { bookmarks } = req.body;

    // Validation
    if (!Array.isArray(bookmarks)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'bookmarks must be an array' 
      });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const bm of bookmarks) {
      try {
        // Validate bookmark data
        if (!bm.id || !bm.title || !bm.url) {
          skipped++;
          continue;
        }

        // Check if already exists
        const existing = await Bookmark.findOne({
          userId: req.user._id,
          articleId: bm.id
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create new bookmark
        await Bookmark.create({
          userId: req.user._id,
          articleId: bm.id,
          title: bm.title,
          url: bm.url,
          snippet: bm.snippet || '',
          image: bm.image || '',
          createdAt: bm.savedAt ? new Date(bm.savedAt) : new Date()
        });

        imported++;
      } catch (err) {
        console.error('Failed to import bookmark:', err);
        errors++;
      }
    }

    res.json({ 
      ok: true, 
      imported,
      skipped,
      errors,
      message: `Imported ${imported} bookmarks, skipped ${skipped}, errors ${errors}`
    });
  } catch (err) {
    console.error('Migrate bookmarks error:', err);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to migrate bookmarks' 
    });
  }
};

// Migrate reading history
exports.migrateHistory = async (req, res) => {
  try {
    const { history } = req.body;

    // Validation
    if (!Array.isArray(history)) {
      return res.status(400).json({ 
        ok: false, 
        error: 'history must be an array' 
      });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of history) {
      try {
        // Validate entry data
        if (!entry.id || !entry.title) {
          skipped++;
          continue;
        }

        // Check if already exists
        const existing = await ReadingHistory.findOne({
          userId: req.user._id,
          articleId: entry.id
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create new history entry
        await ReadingHistory.create({
          userId: req.user._id,
          articleId: entry.id,
          title: entry.title,
          category: entry.category || 'General',
          timeSpent: 0,
          views: 1,
          createdAt: entry.time ? new Date(entry.time) : new Date()
        });

        imported++;
      } catch (err) {
        console.error('Failed to import history:', err);
        errors++;
      }
    }

    res.json({ 
      ok: true, 
      imported,
      skipped,
      errors,
      message: `Imported ${imported} history entries, skipped ${skipped}, errors ${errors}`
    });
  } catch (err) {
    console.error('Migrate history error:', err);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to migrate reading history' 
    });
  }
};

// Get migration status
exports.getMigrationStatus = async (req, res) => {
  try {
    const bookmarkCount = await Bookmark.countDocuments({ 
      userId: req.user._id 
    });
    
    const historyCount = await ReadingHistory.countDocuments({ 
      userId: req.user._id 
    });

    res.json({
      ok: true,
      status: {
        bookmarks: bookmarkCount,
        history: historyCount,
        hasMigrated: bookmarkCount > 0 || historyCount > 0
      }
    });
  } catch (err) {
    console.error('Get migration status error:', err);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get migration status' 
    });
  }
};