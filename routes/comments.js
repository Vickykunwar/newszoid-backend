// routes/comments.js
const express = require('express');
const router = express.Router();

const commentController = require('../controllers/commentController');
const auth = require('../middleware/auth');

// GET COMMENTS FOR ARTICLE
router.get('/:articleId', commentController.getComments);

// POST COMMENT
router.post('/:articleId', auth, commentController.postComment);

module.exports = router;
