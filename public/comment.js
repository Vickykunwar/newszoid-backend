// ============================================================
// COMPLETE COMMENT SYSTEM
// Handles article comments with backend sync
// ============================================================

class CommentManager {
    constructor() {
        this.apiURL = '/api/comments';
        this.storageKey = 'newszoid_comments_v2';
        this.comments = new Map(); // articleId -> comments[]
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setupEventListeners();
    }

    // ============================================================
    // STORAGE MANAGEMENT
    // ============================================================
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.comments = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
            this.comments = new Map();
        }
    }

    saveToStorage() {
        try {
            const data = Object.fromEntries(this.comments);
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save comments:', error);
        }
    }

    // ============================================================
    // COMMENT OPERATIONS
    // ============================================================
    async loadComments(articleId) {
        try {
            // Try to fetch from server first
            const response = await fetch(`${this.apiURL}?articleId=${articleId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.comments) {
                    this.comments.set(articleId, data.comments);
                    this.saveToStorage();
                    return data.comments;
                }
            }
        } catch (error) {
            console.warn('Failed to load comments from server:', error);
        }

        // Fallback to local storage
        return this.comments.get(articleId) || [];
    }

    async addComment(articleId, commentText) {
        if (!commentText || !commentText.trim()) {
            throw new Error('Comment text is required');
        }

        // Check if user is logged in
        const user = authManager.getUser();
        const author = user ? user.name : 'Guest';

        const comment = {
            id: this.generateId(),
            articleId,
            author,
            text: commentText.trim(),
            timestamp: Date.now(),
            likes: 0
        };

        // Add to local storage
        const existingComments = this.comments.get(articleId) || [];
        existingComments.unshift(comment);
        this.comments.set(articleId, existingComments);
        this.saveToStorage();

        // Sync with server
        try {
            await fetch(this.apiURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(comment)
            });
        } catch (error) {
            console.warn('Failed to sync comment to server:', error);
        }

        return comment;
    }

    async deleteComment(articleId, commentId) {
        const comments = this.comments.get(articleId) || [];
        const index = comments.findIndex(c => c.id === commentId);
        
        if (index === -1) return false;

        // Remove from local
        comments.splice(index, 1);
        this.comments.set(articleId, comments);
        this.saveToStorage();

        // Delete from server
        try {
            await fetch(`${this.apiURL}/${commentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Failed to delete comment from server:', error);
        }

        return true;
    }

    async likeComment(articleId, commentId) {
        const comments = this.comments.get(articleId) || [];
        const comment = comments.find(c => c.id === commentId);
        
        if (!comment) return false;

        comment.likes = (comment.likes || 0) + 1;
        this.saveToStorage();

        // Sync with server
        try {
            await fetch(`${this.apiURL}/${commentId}/like`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Failed to sync like:', error);
        }

        return true;
    }

    getCommentCount(articleId) {
        const comments = this.comments.get(articleId) || [];
        return comments.length;
    }

    generateId() {
        return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ============================================================
    // UI MANAGEMENT
    // ============================================================
    async openCommentBox(articleElement) {
        const articleId = articleElement.dataset.articleId;
        if (!articleId) return;

        // Check if comment box already exists
        let commentBox = articleElement.querySelector('.comment-box-inline');
        
        if (commentBox) {
            commentBox.remove();
            return;
        }

        // Create comment box
        commentBox = document.createElement('div');
        commentBox.className = 'comment-box-inline';
        commentBox.setAttribute('role', 'region');
        commentBox.setAttribute('aria-label', 'Comment section');

        commentBox.innerHTML = `
            <div class="comment-input-wrapper">
                <textarea class="comment-input" 
                          placeholder="Write a comment..." 
                          aria-label="Comment input"
                          rows="3"></textarea>
                <div class="comment-actions">
                    <button type="button" class="submit-comment-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                        Post
                    </button>
                    <button type="button" class="close-comment-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Close
                    </button>
                </div>
            </div>
            <div class="comments-list" aria-live="polite"></div>
        `;

        articleElement.appendChild(commentBox);

        // Load and render comments
        await this.renderComments(articleId, commentBox);

        // Setup event listeners
        this.setupCommentBoxListeners(commentBox, articleId);

        // Focus textarea
        const textarea = commentBox.querySelector('.comment-input');
        if (textarea) textarea.focus();
    }

    async renderComments(articleId, commentBox) {
        const commentsList = commentBox.querySelector('.comments-list');
        if (!commentsList) return;

        const comments = await this.loadComments(articleId);

        if (comments.length === 0) {
            commentsList.innerHTML = `
                <div class="comment-empty">
                    <p>No comments yet. Be the first to comment!</p>
                </div>
            `;
            return;
        }

        commentsList.innerHTML = comments.map(comment => this.renderCommentHTML(comment, articleId)).join('');
        
        // Attach event listeners to comment actions
        this.setupCommentActionListeners(commentsList, articleId);
    }

    renderCommentHTML(comment, articleId) {
        const date = new Date(comment.timestamp);
        const timeAgo = this.formatTimeAgo(comment.timestamp);
        const isOwn = authManager.getUser()?.name === comment.author;

        return `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <div class="comment-author-info">
                        <span class="comment-avatar">${comment.author[0].toUpperCase()}</span>
                        <div>
                            <span class="comment-author">${this.escapeHTML(comment.author)}</span>
                            <span class="comment-time" title="${date.toLocaleString()}">${timeAgo}</span>
                        </div>
                    </div>
                    ${isOwn ? `
                        <button class="comment-delete-btn" 
                                data-comment-id="${comment.id}"
                                aria-label="Delete comment">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <div class="comment-body">${this.escapeHTML(comment.text)}</div>
                <div class="comment-footer">
                    <button class="comment-like-btn" data-comment-id="${comment.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                        </svg>
                        <span class="like-count">${comment.likes || 0}</span>
                    </button>
                </div>
            </div>
        `;
    }

    setupCommentBoxListeners(commentBox, articleId) {
        // Submit comment
        const submitBtn = commentBox.querySelector('.submit-comment-btn');
        const textarea = commentBox.querySelector('.comment-input');
        
        if (submitBtn && textarea) {
            submitBtn.addEventListener('click', async () => {
                await this.handleSubmitComment(articleId, textarea, commentBox);
            });

            // Submit on Ctrl+Enter
            textarea.addEventListener('keydown', async (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    await this.handleSubmitComment(articleId, textarea, commentBox);
                }
            });
        }

        // Close button
        const closeBtn = commentBox.querySelector('.close-comment-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                commentBox.remove();
            });
        }
    }

    setupCommentActionListeners(commentsList, articleId) {
        // Delete comment
        commentsList.querySelectorAll('.comment-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const commentId = btn.dataset.commentId;
                if (confirm('Delete this comment?')) {
                    await this.deleteComment(articleId, commentId);
                    const commentBox = commentsList.closest('.comment-box-inline');
                    await this.renderComments(articleId, commentBox);
                    this.showToast('Comment deleted', 'success');
                }
            });
        });

        // Like comment
        commentsList.querySelectorAll('.comment-like-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const commentId = btn.dataset.commentId;
                const success = await this.likeComment(articleId, commentId);
                if (success) {
                    const likeCount = btn.querySelector('.like-count');
                    if (likeCount) {
                        likeCount.textContent = parseInt(likeCount.textContent) + 1;
                    }
                }
            });
        });
    }

    async handleSubmitComment(articleId, textarea, commentBox) {
        const text = textarea.value.trim();
        
        if (!text) {
            this.showToast('Please write a comment', 'warning');
            return;
        }

        // Check if logged in
        if (!authManager.isLoggedIn()) {
            this.showToast('Please login to comment', 'warning');
            authManager.openLoginModal();
            return;
        }

        try {
            await this.addComment(articleId, text);
            textarea.value = '';
            await this.renderComments(articleId, commentBox);
            this.showToast('Comment posted!', 'success');
            
            // Update comment count
            this.updateCommentCount(articleId);
        } catch (error) {
            this.showToast(error.message || 'Failed to post comment', 'error');
        }
    }

    updateCommentCount(articleId) {
        const count = this.getCommentCount(articleId);
        const article = document.querySelector(`[data-article-id="${articleId}"]`);
        if (!article) return;

        const commentBtn = article.querySelector('.share-btn.comment');
        if (commentBtn) {
            // Add count badge
            let badge = commentBtn.querySelector('.comment-count');
            if (!badge && count > 0) {
                badge = document.createElement('span');
                badge.className = 'comment-count';
                commentBtn.appendChild(badge);
            }
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline' : 'none';
            }
        }
    }

    // ============================================================
    // EVENT LISTENERS SETUP
    // ============================================================
    setupEventListeners() {
        document.addEventListener('click', async (e) => {
            const commentBtn = e.target.closest('.share-btn.comment');
            if (!commentBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const article = commentBtn.closest('article, .story-card, .story-item');
            if (!article) return;

            await this.openCommentBox(article);
        });
    }

    // ============================================================
    // UTILITIES
    // ============================================================
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return new Date(timestamp).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideInUp 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ============================================================
// INITIALIZE COMMENT MANAGER
// ============================================================
const commentManager = new CommentManager();

// Export for global access
window.commentManager = commentManager;

console.log('✅ Comment Manager initialized');