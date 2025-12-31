// controllers/historyController.js
const ReadingHistory = require('../models/ReadingHistory');

exports.addReadingHistory = async (req, res) => {
    try {
        const { articleId, title, category, timeSpent } = req.body;
        
        if (!articleId)
            return res.status(400).json({ error: "Missing articleId" });

        // Check if already tracked recently (within last 5 minutes)
        const recentEntry = await ReadingHistory.findOne({
            userId: req.user._id,
            articleId,
            viewedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
        });

        if (recentEntry) {
            // Update existing entry
            recentEntry.timeSpent = (recentEntry.timeSpent || 0) + (timeSpent || 0);
            recentEntry.viewedAt = new Date();
            await recentEntry.save();
            return res.json({ ok: true, updated: true });
        }

        // Create new entry
        const entry = await ReadingHistory.create({
            userId: req.user._id,
            articleId,
            title: title || 'Untitled',
            category: category || 'General',
            timeSpent: timeSpent || 0
        });

        return res.json({ ok: true, entry });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
};

exports.getReadingHistory = async (req, res) => {
    try {
        const { limit = 100, skip = 0 } = req.query;
        
        const items = await ReadingHistory.find({ userId: req.user._id })
            .sort({ viewedAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await ReadingHistory.countDocuments({ userId: req.user._id });

        return res.json({ items, total });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
};

exports.getReadingStats = async (req, res) => {
    try {
        // Time spent per category
        const stats = await ReadingHistory.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: '$category',
                    totalTime: { $sum: '$timeSpent' },
                    articleCount: { $sum: 1 },
                    lastViewed: { $max: '$viewedAt' }
                }
            },
            { $sort: { totalTime: -1 } }
        ]);

        // Get top 5 articles
        const topArticles = await ReadingHistory.find({ userId: req.user._id })
            .sort({ timeSpent: -1 })
            .limit(5);

        // Get reading streak (days with activity)
        const recentHistory = await ReadingHistory.find({
            userId: req.user._id,
            viewedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }).sort({ viewedAt: -1 });

        const uniqueDays = new Set();
        recentHistory.forEach(entry => {
            const day = new Date(entry.viewedAt).toDateString();
            uniqueDays.add(day);
        });

        return res.json({ 
            stats,
            topArticles,
            streak: uniqueDays.size,
            totalEntries: await ReadingHistory.countDocuments({ userId: req.user._id })
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
};

exports.deleteReadingHistory = async (req, res) => {
    try {
        const { id } = req.params;
        
        await ReadingHistory.deleteOne({
            _id: id,
            userId: req.user._id
        });

        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
};

exports.clearReadingHistory = async (req, res) => {
    try {
        await ReadingHistory.deleteMany({ userId: req.user._id });
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
};
