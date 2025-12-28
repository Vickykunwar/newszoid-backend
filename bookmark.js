// =============================================================
// BOOKMARK / SAVED ARTICLES
// =============================================================

/**
 * Storage key
 */
const BOOKMARK_KEY = 'newszoid_bookmarks_v1';

/**
 * Return array of saved bookmarks
 */
function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
  } catch (e) {
    console.warn('Failed to parse bookmarks', e);
    return [];
  }
}

/**
 * Save bookmarks array to localStorage and update UI
 * @param {Array} arr - Array of bookmarks to save
 */
function setBookmarks(arr) {
  try {
    if (!Array.isArray(arr)) {
      console.error('setBookmarks: Expected an array, got:', typeof arr);
      return false;
    }
    
    const jsonString = JSON.stringify(arr);
    if (jsonString.length > 5000000) { // ~5MB limit for most browsers
      console.error('setBookmarks: Bookmarks data too large to save');
      return false;
    }
    
    localStorage.setItem(BOOKMARK_KEY, jsonString);
    console.log(`Saved ${arr.length} bookmarks to localStorage`);
    
    // Notify UI listeners of the update
    const event = new CustomEvent('newszoid:bookmarks-updated', { 
      detail: { 
        count: arr.length,
        timestamp: new Date().toISOString()
      } 
    });
    document.dispatchEvent(event);
    
    return true;
  } catch (e) {
    console.error('Failed to save bookmarks:', e);
    // Try to recover by clearing corrupted data
    try {
      localStorage.removeItem(BOOKMARK_KEY);
      console.warn('Cleared potentially corrupted bookmarks data');
    } catch (cleanupError) {
      console.error('Failed to clear bookmarks after error:', cleanupError);
    }
    return false;
  }
}

/**
 * Generate stable article id (if not present) from headline or timestamp.
 * Reuses any existing data-article-id attribute if present.
 */
function ensureArticleId(articleEl) {
  if (!articleEl) return null;
  if (articleEl.dataset && articleEl.dataset.articleId) return articleEl.dataset.articleId;
  const headline = (articleEl.querySelector('h2, h3, .story-headline')?.textContent || '').trim();
  const slug = headline ? headline.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').slice(0,60) : `a${Date.now()}`;
  const id = `article_${slug}`;
  articleEl.dataset.articleId = id;
  return id;
}

/**
 * Toggle bookmark for an article element (server-backed).
 * Tries server API first, falls back to localStorage if offline/unauthenticated.
 * Returns true if saved, false if removed.
 */
async function toggleBookmarkForArticle(articleEl) {
  const id = ensureArticleId(articleEl);
  if (!id) return false;

  const title = articleEl.querySelector('h2, h3, .story-headline')?.textContent?.trim() || 'Untitled';
  const snippet = articleEl.querySelector('p')?.textContent?.trim().slice(0, 200) || '';
  const url = articleEl.querySelector('a[href]')?.getAttribute('href') || window.location.href;
  const img = articleEl.querySelector('img')?.src || '';

  // Try server API if available
  if (window.AuthClient && window.AuthClient.apiToggleBookmark) {
    try {
      const res = await window.AuthClient.apiToggleBookmark({
        articleId: id,
        title,
        snippet,
        url,
        img
      });

      if (res.added) {
        // Update local cache for offline access
        const bookmarks = getBookmarks();
        if (!bookmarks.some(b => b.id === id)) {
          bookmarks.unshift({ id, title, snippet, url, img, savedAt: Date.now() });
          setBookmarks(bookmarks);
        }
        renderSavedArticles();
        return true;
      } else if (res.removed) {
        // Remove from local cache
        const bookmarks = getBookmarks().filter(b => b.id !== id);
        setBookmarks(bookmarks);
        renderSavedArticles();
        return false;
      }
      return false;
    } catch (err) {
      if (err.message === 'unauthenticated') {
        // Show login modal
        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.style.display = 'block';
        return false;
      }
      // API error - fall back to localStorage
      console.warn('Bookmark API error, using localStorage:', err.message);
    }
  }

  // Fallback: use localStorage only
  const bookmarks = getBookmarks();
  const idx = bookmarks.findIndex(b => b.id === id);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    setBookmarks(bookmarks);
    renderSavedArticles();
    return false;
  } else {
    bookmarks.unshift({ id, title, snippet, url, img, savedAt: Date.now() });
    setBookmarks(bookmarks);
    renderSavedArticles();
    return true;
  }
}

/**
 * Escape HTML to avoid XSS when reusing saved strings
 */
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/**
 * Initialize bookmark buttons by delegating click on bookmark UI
 * Adds the saved state to buttons if article is already saved.
 */
function initBookmarkUI() {
  // delegate clicks on .share-btn.bookmark
  document.addEventListener('click', async function (e) {
    const btn = e.target.closest('.share-btn.bookmark');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    
    const article = btn.closest('article, .story-item, .story-card, .main-story');
    if (!article) return;
    
    btn.disabled = true; // Prevent double-click
    const saved = await toggleBookmarkForArticle(article);
    btn.disabled = false;
    btn.classList.toggle('saved', saved);
    btn.textContent = saved ? '★' : '☆';
    
    // Show feedback
    const feedback = document.createElement('div');
    feedback.className = 'bookmark-feedback';
    feedback.textContent = saved ? 'Saved!' : 'Removed!';
    document.body.appendChild(feedback);
    
    // Position near the button
    const rect = btn.getBoundingClientRect();
    feedback.style.top = `${rect.top - 30}px`;
    feedback.style.left = `${rect.left + rect.width/2 - 30}px`;
    
    // Animate and remove
    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateY(-10px)';
      setTimeout(() => feedback.remove(), 300);
    }, 800);
  });

  // add saved class to buttons on load based on storage
  document.querySelectorAll('.share-btn.bookmark').forEach(btn => {
    const article = btn.closest('article, .story-item, .story-card, .main-story');
    if (!article) return;
    
    const id = ensureArticleId(article);
    if (id && getBookmarks().some(b => b.id === id)) {
      btn.classList.add('saved');
      btn.textContent = '★';
    } else {
      btn.classList.remove('saved');
      btn.textContent = '☆';
    }
  });
}

/**
 * Render saved articles from server API
 */
async function renderSavedArticlesFromServer() {
  const container = document.getElementById('savedArticlesList');
  const placeholder = document.getElementById('noSavedPlaceholder');
  if (!container) return;

  try {
    // Check if API is available
    if (!window.AuthClient || !window.AuthClient.apiGetBookmarks) {
      // Fall back to localStorage
      renderSavedArticles();
      return;
    }

    const data = await window.AuthClient.apiGetBookmarks();
    const bookmarks = data.items || data.bookmarks || [];

    if (!bookmarks.length) {
      container.innerHTML = '';
      if (placeholder) placeholder.style.display = 'block';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';

    container.innerHTML = bookmarks.map(b => `
      <div class="saved-item" data-id="${b._id || b.id}">
        <h4>${escapeHtml(b.title)}</h4>
        ${b.img ? `<img src="${escapeHtml(b.img)}" alt="" class="saved-item-img" loading="lazy">` : ''}
        <p>${escapeHtml(b.snippet)}</p>
        <div class="saved-actions">
          <button data-open="${b._id || b.id}" class="open-saved">Open</button>
          <button data-remove="${b._id || b.id}" class="remove-saved">Remove</button>
        </div>
      </div>
    `).join('');

    // Attach handlers
    container.querySelectorAll('.open-saved').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.open;
        const art = document.querySelector(`[data-article-id="${id}"]`);
        if (art) {
          art.scrollIntoView({ behavior: 'smooth', block: 'center' });
          art.style.transition = 'box-shadow 0.5s ease';
          art.style.boxShadow = '0 0 0 2px var(--accent-color)';
          setTimeout(() => {
            art.style.boxShadow = 'none';
          }, 2000);
        } else {
          const item = bookmarks.find(x => (x._id || x.id) === id);
          if (item && item.url) window.open(item.url, '_blank');
          else alert('Article not present on this page. It will be available in your profile.');
        }
      });
    });

    container.querySelectorAll('.remove-saved').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.remove;
        try {
          if (window.AuthClient && window.AuthClient.apiDeleteBookmark) {
            await window.AuthClient.apiDeleteBookmark(id);
          }
          // Refresh the list
          renderSavedArticlesFromServer();

          // Update bookmark button on page
          const article = document.querySelector(`[data-article-id="${id}"]`);
          if (article) {
            const bookmarkBtn = article.querySelector('.share-btn.bookmark');
            if (bookmarkBtn) {
              bookmarkBtn.classList.remove('saved');
              bookmarkBtn.textContent = '☆';
            }
          }
        } catch (err) {
          console.error('Failed to remove bookmark:', err);
          alert('Failed to remove bookmark');
        }
      });
    });
  } catch (err) {
    console.error('Failed to fetch bookmarks from server:', err);
    // Fall back to localStorage
    renderSavedArticles();
  }
}

/**
 * Render saved articles in the sidebar/profile saved list (localStorage fallback).
 */
function renderSavedArticles() {
  const container = document.getElementById('savedArticlesList');
  const placeholder = document.getElementById('noSavedPlaceholder');
  if (!container) return;
  
  const bookmarks = getBookmarks();
  if (!bookmarks.length) {
    container.innerHTML = '';
    if (placeholder) placeholder.style.display = 'block';
    return;
  }
  
  if (placeholder) placeholder.style.display = 'none';
  
  container.innerHTML = bookmarks.map(b => `
    <div class="saved-item" data-id="${b.id}">
      <h4>${escapeHtml(b.title)}</h4>
      ${b.img ? `<img src="${escapeHtml(b.img)}" alt="" class="saved-item-img" loading="lazy">` : ''}
      <p>${escapeHtml(b.snippet)}</p>
      <div class="saved-actions">
        <button data-open="${b.id}" class="open-saved">Open</button>
        <button data-remove="${b.id}" class="remove-saved">Remove</button>
      </div>
    </div>
  `).join('');

  // attach handlers
  container.querySelectorAll('.open-saved').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.open;
      // try scroll to article if on same page
      const art = document.querySelector(`[data-article-id="${id}"]`);
      if (art) {
        art.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add highlight effect
        art.style.transition = 'box-shadow 0.5s ease';
        art.style.boxShadow = '0 0 0 2px var(--accent-color)';
        setTimeout(() => {
          art.style.boxShadow = 'none';
        }, 2000);
      } else {
        // otherwise navigate to saved url (if stored)
        const item = getBookmarks().find(x => x.id === id);
        if (item && item.url) window.open(item.url, '_blank');
        else alert('Article not present on this page. It will be available in your profile.');
      }
    });
  });
  
  container.querySelectorAll('.remove-saved').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.remove;
      const arr = getBookmarks().filter(x => x.id !== id);
      setBookmarks(arr);
      renderSavedArticles();
      
      // Also update any bookmark buttons on the page
      const article = document.querySelector(`[data-article-id="${id}"]`);
      if (article) {
        const btn = article.querySelector('.share-btn.bookmark');
        if (btn) {
          btn.classList.remove('saved');
          btn.textContent = '☆';
        }
      }
    });
  });
}

// Initialize bookmark functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initBookmarkUI();
  
  // Try server API first, fall back to localStorage
  if (window.AuthClient && window.AuthClient.apiGetBookmarks) {
    renderSavedArticlesFromServer();
  } else {
    renderSavedArticles();
  }
  
  // Listen for bookmark updates
  document.addEventListener('newszoid:bookmarks-updated', () => {
    if (window.AuthClient && window.AuthClient.apiGetBookmarks) {
      renderSavedArticlesFromServer();
    } else {
      renderSavedArticles();
    }
  });
});


