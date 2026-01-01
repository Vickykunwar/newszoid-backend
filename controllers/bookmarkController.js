// controllers/bookmarkController.js
const Bookmark = require('../models/Bookmark');

exports.getBookmarks = async (req, res) => {
    try {
        const items = await Bookmark.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        return res.json({ ok: true, data: items });
    } catch (err) {
        console.error('Get bookmarks error:', err);
        return res.status(500).json({ ok: false, error: 'Failed to fetch bookmarks' });
    }
};

exports.saveBookmark = async (req, res) => {
    try {
        const { articleId, title, url, snippet, image } = req.body;

        if (!articleId || !title || !url) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required fields'
            });
        }

        const existing = await Bookmark.findOne({
            userId: req.user._id,
            articleId
        });

        if (existing) {
            return res.status(400).json({
                ok: false,
                error: 'Already bookmarked'
            });
        }

        const bookmark = await Bookmark.create({
            userId: req.user._id,
            articleId,
            title,
            url,
            snippet: snippet || '',
            image: image || ''
        });

        return res.json({ ok: true, bookmark });
    } catch (err) {
        console.error('Save bookmark error:', err);
        return res.status(500).json({ ok: false, error: 'Failed to save bookmark' });
    }
};

exports.toggleBookmark = async (req, res) => {
    try {
        const { articleId, title, snippet, url, image } = req.body;

        const existing = await Bookmark.findOne({
            userId: req.user._id,
            articleId
        });

        if (existing) {
            await Bookmark.deleteOne({ _id: existing._id });
            return res.json({ ok: true, removed: true });
        }

        const newBookmark = await Bookmark.create({
            userId: req.user._id,
            articleId,
            title,
            snippet,
            url,
            image
        });

        return res.json({ ok: true, added: true, item: newBookmark });
    } catch (err) {
        console.error('Toggle bookmark error:', err);
        return res.status(500).json({ ok: false, error: 'Failed to toggle bookmark' });
    }
};

exports.deleteBookmark = async (req, res) => {
    try {
        const bookmark = await Bookmark.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!bookmark) {
            return res.status(404).json({ ok: false, error: 'Bookmark not found' });
        }

        return res.json({ ok: true, message: 'Bookmark deleted' });
    } catch (err) {
        console.error('Delete bookmark error:', err);
        return res.status(500).json({ ok: false, error: 'Failed to delete bookmark' });
    }
};
