// controllers/commentController.js - PRODUCTION READY VERSION
const Comment = require('../models/Comment');
const sanitizeHtml = require('sanitize-html');

// Sanitize comment text - remove all HTML, only allow plain text
const sanitizeComment = (text) => {
    return sanitizeHtml(text, {
        allowedTags: [],
        allowedAttributes: {},
        disallowedTagsMode: 'discard'
    }).trim();
};

exports.getComments = async (req, res) => {
    try {
        const { articleId } = req.params;
        
        // Validate articleId
        if (!articleId || articleId.trim().length === 0) {
            return res.status(400).json({ 
                ok: false,
                error: 'Article ID is required' 
            });
        }

        const items = await Comment.find({ articleId })
            .sort({ createdAt: -1 })
            .limit(200)
            .select('-__v'); // Exclude version field

        return res.json({ 
            ok: true,
            count: items.length,
            items 
        });
    } catch (err) {
        console.error('Get comments error:', err);
        return res.status(500).json({ 
            ok: false,
            error: 'Failed to fetch comments' 
        });
    }
};

exports.postComment = async (req, res) => {
    try {
        const { articleId } = req.params;
        const { text } = req.body;

        // Validate articleId
        if (!articleId || articleId.trim().length === 0) {
            return res.status(400).json({ 
                ok: false,
                error: 'Article ID is required' 
            });
        }

        // Validate comment text
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ 
                ok: false,
                error: 'Comment text is required' 
            });
        }

        // Sanitize comment text
        const sanitizedText = sanitizeComment(text);

        // Check if comment is empty after sanitization
        if (sanitizedText.length === 0) {
            return res.status(400).json({ 
                ok: false,
                error: 'Comment cannot be empty' 
            });
        }

        // Check comment length (max 1000 characters)
        if (sanitizedText.length > 1000) {
            return res.status(400).json({ 
                ok: false,
                error: 'Comment must be less than 1000 characters' 
            });
        }

        // Check for rate limiting - user can post max 10 comments per hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentComments = await Comment.countDocuments({
            userId: req.user._id,
            createdAt: { $gte: oneHourAgo }
        });

        if (recentComments >= 10) {
            return res.status(429).json({
                ok: false,
                error: 'Too many comments. Please wait before posting again.'
            });
        }

        // Create comment
        const comment = await Comment.create({
            userId: req.user._id,
            userName: req.user.name,
            articleId,
            text: sanitizedText
        });

        return res.status(201).json({ 
            ok: true, 
            comment: {
                _id: comment._id,
                userId: comment.userId,
                userName: comment.userName,
                articleId: comment.articleId,
                text: comment.text,
                createdAt: comment.createdAt
            }
        });
    } catch (err) {
        console.error('Post comment error:', err);
        
        // Handle validation errors
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                error: 'Invalid comment data'
            });
        }

        return res.status(500).json({ 
            ok: false,
            error: 'Failed to post comment' 
        });
    }
};

// Optional: Delete comment (only by comment owner or admin)
exports.deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return res.status(404).json({
                ok: false,
                error: 'Comment not found'
            });
        }

        // Check if user owns the comment
        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                ok: false,
                error: 'Unauthorized to delete this comment'
            });
        }

        await Comment.deleteOne({ _id: commentId });

        return res.json({
            ok: true,
            message: 'Comment deleted successfully'
        });
    } catch (err) {
        console.error('Delete comment error:', err);
        return res.status(500).json({
            ok: false,
            error: 'Failed to delete comment'
        });
    }
};