// ============================================================
// ENHANCED BOOKMARK SYSTEM WITH BACKEND SYNC
// Replace your bookmark.js with this improved version
// ============================================================

class BookmarkManager {
    constructor() {
        this.storageKey = 'newszoid_bookmarks_v2';
        this.apiURL = '/api/bookmarks';
        this.bookmarks = [];
        this.syncInProgress = false;
        this.init();
    }

    async init() {
        // Load from localStorage first
        this.loadFromStorage();
        
        // Try to sync with backend if user is logged in
        if (this.isUserLoggedIn()) {
            await this.syncWithBackend();
        }
        
        // Update UI
        this.renderBookmarks();
    }

    isUserLoggedIn() {
        return !!localStorage.getItem('newszoid_loggedInUser');
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.bookmarks = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
            this.bookmarks = [];
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Failed to save bookmarks:', error);
        }
    }

    async syncWithBackend() {
        if (this.syncInProgress) return;
        this.syncInProgress = true;

        try {
            // Fetch server bookmarks
            const response = await fetch(this.apiURL, {
                credentials: 'include'
            });

            if (response.ok) {
                const serverBookmarks = await response.json();
                
                // Merge with local bookmarks (server takes precedence)
                this.mergeBookmarks(serverBookmarks.data || []);
                this.saveToStorage();
            }
        } catch (error) {
            console.warn('Bookmark sync failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    mergeBookmarks(serverBookmarks) {
        const merged = new Map();
        
        // Add server bookmarks first
        serverBookmarks.forEach(bookmark => {
            merged.set(bookmark.id, bookmark);
        });
        
        // Add local bookmarks that aren't on server
        this.bookmarks.forEach(bookmark => {
            if (!merged.has(bookmark.id)) {
                merged.set(bookmark.id, bookmark);
            }
        });
        
        this.bookmarks = Array.from(merged.values());
    }

    async add(article) {
        const bookmark = {
            id: article.id || this.generateId(),
            title: article.title || 'Untitled',
            url: article.url || window.location.href,
            image: article.image || '',
            snippet: article.snippet || '',
            source: article.source || 'Newszoid',
            savedAt: Date.now()
        };

        // Check if already bookmarked
        const exists = this.bookmarks.find(b => b.id === bookmark.id);
        if (exists) {
            return false;
        }

        // Add to local storage
        this.bookmarks.unshift(bookmark);
        this.saveToStorage();

        // Sync with backend if logged in
        if (this.isUserLoggedIn()) {
            this.syncBookmarkToServer(bookmark);
        }

        this.renderBookmarks();
        return true;
    }

    async remove(bookmarkId) {
        const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
        if (index === -1) return false;

        // Remove from local
        this.bookmarks.splice(index, 1);
        this.saveToStorage();

        // Remove from server if logged in
        if (this.isUserLoggedIn()) {
            this.deleteBookmarkFromServer(bookmarkId);
        }

        this.renderBookmarks();
        return true;
    }

    async syncBookmarkToServer(bookmark) {
        try {
            await fetch(this.apiURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(bookmark)
            });
        } catch (error) {
            console.warn('Failed to sync bookmark to server:', error);
        }
    }

    async deleteBookmarkFromServer(bookmarkId) {
        try {
            await fetch(`${this.apiURL}/${bookmarkId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
        } catch (error) {
            console.warn('Failed to delete bookmark from server:', error);
        }
    }

    isBookmarked(articleId) {
        return this.bookmarks.some(b => b.id === articleId);
    }

    getAll() {
        return [...this.bookmarks];
    }

    generateId() {
        return `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    renderBookmarks() {
        const container = document.getElementById('savedArticlesList');
        const placeholder = document.getElementById('noSavedPlaceholder');
        
        if (!container) return;

        if (this.bookmarks.length === 0) {
            container.innerHTML = '';
            if (placeholder) placeholder.style.display = 'block';
            return;
        }

        if (placeholder) placeholder.style.display = 'none';

        container.innerHTML = this.bookmarks.map(bookmark => `
            <div class="saved-item" data-bookmark-id="${bookmark.id}">
                ${bookmark.image ? `
                    <img src="${bookmark.image}" 
                         alt="${this.escapeHTML(bookmark.title)}"
                         class="saved-item-image"
                         onerror="this.style.display='none'">
                ` : ''}
                
                <div class="saved-item-content">
                    <h4>${this.escapeHTML(bookmark.title)}</h4>
                    ${bookmark.snippet ? `
                        <p>${this.escapeHTML(bookmark.snippet.substring(0, 100))}...</p>
                    ` : ''}
                    <div class="saved-item-meta">
                        <span class="saved-item-source">${this.escapeHTML(bookmark.source)}</span>
                        <span class="saved-item-date">${this.formatDate(bookmark.savedAt)}</span>
                    </div>
                </div>
                
                <div class="saved-actions">
                    <button class="saved-action-btn open-btn" 
                            data-url="${this.escapeHTML(bookmark.url)}"
                            aria-label="Open article">
                        🔗 Open
                    </button>
                    <button class="saved-action-btn remove-btn" 
                            data-bookmark-id="${bookmark.id}"
                            aria-label="Remove bookmark">
                        🗑️ Remove
                    </button>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        this.attachBookmarkListeners(container);
    }

    attachBookmarkListeners(container) {
        // Open article
        container.querySelectorAll('.open-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const url = btn.dataset.url;
                if (url && url !== '#') {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        });

        // Remove bookmark
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const bookmarkId = btn.dataset.bookmarkId;
                
                if (confirm('Remove this saved article?')) {
                    await this.remove(bookmarkId);
                    this.showToast('Article removed from saved items', 'success');
                }
            });
        });
    }

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 3600000) { // Less than 1 hour
            const mins = Math.floor(diff / 60000);
            return `${mins} min ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.setAttribute('role', 'alert');
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ============================================================
// INITIALIZE BOOKMARK SYSTEM
// ============================================================
const bookmarkManager = new BookmarkManager();

// ============================================================
// ATTACH TO BOOKMARK BUTTONS
// ============================================================
document.addEventListener('click', async (e) => {
    const bookmarkBtn = e.target.closest('.share-btn.bookmark');
    if (!bookmarkBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const article = bookmarkBtn.closest('article, .story-card, .story-item');
    if (!article) return;

    const articleId = article.dataset.articleId;
    const isBookmarked = bookmarkManager.isBookmarked(articleId);

    if (isBookmarked) {
        // Remove bookmark
        const removed = await bookmarkManager.remove(articleId);
        if (removed) {
            bookmarkBtn.classList.remove('saved');
            bookmarkBtn.textContent = '☆';
            bookmarkBtn.setAttribute('aria-label', 'Save article');
            showBookmarkFeedback(bookmarkBtn, false);
        }
    } else {
        // Add bookmark
        const articleData = {
            id: articleId,
            title: article.querySelector('h2, h3, .story-headline')?.textContent.trim(),
            url: article.querySelector('a')?.href || window.location.href,
            image: article.querySelector('img')?.src,
            snippet: article.querySelector('p, .story-text')?.textContent.trim(),
            source: article.querySelector('.story-source')?.textContent || 'Newszoid'
        };

        const added = await bookmarkManager.add(articleData);
        if (added) {
            bookmarkBtn.classList.add('saved');
            bookmarkBtn.textContent = '★';
            bookmarkBtn.setAttribute('aria-label', 'Remove bookmark');
            showBookmarkFeedback(bookmarkBtn, true);
        }
    }
});

// ============================================================
// INITIALIZE BOOKMARK STATES ON PAGE LOAD
// ============================================================
function initializeBookmarkStates() {
    document.querySelectorAll('.share-btn.bookmark').forEach(btn => {
        const article = btn.closest('article, .story-card, .story-item');
        if (!article) return;

        const articleId = article.dataset.articleId;
        if (bookmarkManager.isBookmarked(articleId)) {
            btn.classList.add('saved');
            btn.textContent = '★';
            btn.setAttribute('aria-label', 'Remove bookmark');
        }
    });
}

// ============================================================
// BOOKMARK FEEDBACK ANIMATION
// ============================================================
function showBookmarkFeedback(button, saved) {
    const feedback = document.createElement('div');
    feedback.className = 'bookmark-feedback';
    feedback.textContent = saved ? 'Saved!' : 'Removed';
    feedback.style.cssText = `
        position: fixed;
        padding: 8px 16px;
        background: ${saved ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10000;
        pointer-events: none;
        animation: bookmarkPulse 0.8s ease-out;
    `;

    const rect = button.getBoundingClientRect();
    feedback.style.top = `${rect.top - 40}px`;
    feedback.style.left = `${rect.left + rect.width / 2 - 30}px`;

    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(-10px)';
        setTimeout(() => feedback.remove(), 300);
    }, 800);
}

// ============================================================
// AUTO-INITIALIZE
// ============================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBookmarkStates);
} else {
    initializeBookmarkStates();
}

// Export for global access
window.bookmarkManager = bookmarkManager;
