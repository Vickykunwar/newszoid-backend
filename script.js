// ============================================================
// NEWSZOID CHRONICLE - COMPLETE & PRODUCTION READY SCRIPT.JS
// ============================================================

(function () {
  'use strict';

  console.log('🚀 Initializing Newszoid...');

  // ============================================================
  // CONFIGURATION
  // ============================================================
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isBackendServing = window.location.port === '4000';
  const API_BASE = 'https://newszoid-backend-production.up.railway.app/api';
  window.API_BASE = API_BASE;


  // Category mapping (aligned with backend)
  const CATEGORY_MAP = {
    'environment': { query: 'environment climate change', container: 'category-environment' },
    'education': { query: 'education school university', container: 'category-education' },
    'business': { query: 'business finance market', container: 'category-business' },
    'sports': { query: 'sports cricket football', container: 'category-sports' },
    'technology': { query: 'technology AI artificial intelligence', container: 'category-technology' },
    'economy': { query: 'inflation economy', container: 'category-economy' },
    'science': { query: 'science space nasa isro', container: 'category-science' },
    'culture': { query: 'culture art tradition', container: 'category-culture' },
    'global-politics': { query: 'world politics', container: 'category-global-politics' },
    'global-finance': { query: 'world finance economy', container: 'category-global-finance' },
    'health': { query: 'health medicine doctor', container: 'category-health' }
  };

  // ============================================================
  // GLOBAL STATE
  // ============================================================
  const AppState = {
    initialized: false,
    user: null,
    location: window.userLocation || { city: 'Delhi', country: 'India' },
    language: localStorage.getItem('newszoid_language') || 'en',
    theme: localStorage.getItem('newszoid_theme') || 'light'
  };

  // ============================================================
  // NEWS API CLASS
  // ============================================================
  class NewsAPI {
    constructor(baseURL) {
      this.baseURL = baseURL;
      this.cache = new Map();
      this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    async fetchWithCache(url, options = {}) {
      const cacheKey = url + JSON.stringify(options);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.data;
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    }

    async getNews(category = 'general', page = 1, pageSize = 10) {
      return this.fetchWithCache(
        `${this.baseURL}/news?category=${encodeURIComponent(category)}&page=${page}&pageSize=${pageSize}`
      );
    }

    async getLocalNews(location) {
      return this.fetchWithCache(
        `${this.baseURL}/news/local?location=${encodeURIComponent(location)}`
      );
    }
  }

  // Initialize API
  const newsAPI = new NewsAPI(API_BASE);
  window.newsAPI = newsAPI; // Export for other scripts

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = String(str);
    return temp.innerHTML;
  }

  function formatTimeAgo(timestamp) {
    const now = Date.now();
    const date = new Date(timestamp);
    const diff = now - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

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

  window.showToast = showToast; // Export

  // ============================================================
  // BOOKMARK SYSTEM
  // ============================================================
  function getBookmarks() {
    try {
      return JSON.parse(localStorage.getItem('newszoid_bookmarks') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBookmarks(bookmarks) {
    localStorage.setItem('newszoid_bookmarks', JSON.stringify(bookmarks));
  }

  function isBookmarked(articleId) {
    return getBookmarks().some(b => b.id === articleId);
  }

  function toggleBookmark(article) {
    const bookmarks = getBookmarks();
    const index = bookmarks.findIndex(b => b.id === article.id);

    if (index > -1) {
      bookmarks.splice(index, 1);
      saveBookmarks(bookmarks);
      return false; // removed
    } else {
      bookmarks.push({
        ...article,
        savedAt: Date.now()
      });
      saveBookmarks(bookmarks);
      return true; // added
    }
  }

  window.toggleBookmark = toggleBookmark;
  window.isBookmarked = isBookmarked;

  // ============================================================
  // CONTENT RENDERING
  // ============================================================

  // Create News Card
  function createNewsCard(article, index) {
    const card = document.createElement('article');
    card.className = 'story-card';
    card.dataset.articleId = article.id || `article_${Date.now()}_${index}`;

    const imageUrl = article.image || 'https://via.placeholder.com/600x400?text=News';
    const title = sanitizeHTML(article.title || 'Untitled');
    const snippet = sanitizeHTML(article.snippet || article.description || '');
    const source = sanitizeHTML(article.source || 'Newszoid');
    const url = article.url || '#';

    card.innerHTML = `
      <img src="${imageUrl}" 
           alt="${title}" 
           class="story-image"
           onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'">
      
      <h2 class="story-headline">${title}</h2>
      
      <p class="story-text">${snippet}</p>
      
      <div class="story-meta">
        <span class="story-source">${source}</span>
        <span class="story-time">${formatTimeAgo(article.publishedAt)}</span>
        <div class="article-actions">
          <button class="action-btn bookmark" title="Save article" aria-label="Bookmark">☆</button>
          <button class="action-btn x" title="Share on X" aria-label="Share on X">𝕏</button>
          <button class="action-btn whatsapp" title="Share on WhatsApp" aria-label="Share on WhatsApp">W</button>
          <button class="action-btn facebook" title="Share on Facebook" aria-label="Share on Facebook">F</button>
        </div>
      </div>

      ${article.aiSummary ? `
        <div class="summary-panel">
          <h4>AI Summary</h4>
          <p class="summary-text">${sanitizeHTML(article.aiSummary)}</p>
        </div>
      ` : ''}
    `;

    // Bookmark handler
    const bookmarkBtn = card.querySelector('.action-btn.bookmark');
    const articleId = card.dataset.articleId;

    if (isBookmarked(articleId)) {
      bookmarkBtn.classList.add('saved');
      bookmarkBtn.textContent = '★';
    }

    bookmarkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const saved = toggleBookmark({
        id: articleId,
        title: title,
        url: url,
        image: imageUrl,
        source: source
      });
      bookmarkBtn.classList.toggle('saved', saved);
      bookmarkBtn.textContent = saved ? '★' : '☆';
      showToast(saved ? 'Article saved' : 'Article removed', 'info');
    });

    // Share handlers
    card.querySelector('.action-btn.x').addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
    });

    card.querySelector('.action-btn.whatsapp').addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + ' ' + url)}`, '_blank');
    });

    card.querySelector('.action-btn.facebook').addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    });

    // Main click handler
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.article-actions')) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });

    return card;
  }

  // Load Top Story
  async function loadTopStory() {
    const container = document.querySelector('.main-story');
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
    `;

    try {
      const response = await newsAPI.getNews('general', 1, 1);

      if (response.ok && response.data && response.data.length > 0) {
        container.innerHTML = '';
        const card = createNewsCard(response.data[0], 0);
        container.appendChild(card);
      } else {
        container.innerHTML = '<div class="error-message">No top stories available</div>';
      }
    } catch (error) {
      console.error('Top story error:', error);
      container.innerHTML = `
        <div class="error-message">
          <p>Unable to load top story</p>
          <button onclick="window.loadTopStory()">Retry</button>
        </div>
      `;
    }
  }

  // Load World Story
  async function loadWorldStory() {
    const container = document.querySelector('.world-story');
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
    `;

    try {
      const response = await newsAPI.getNews('world', 1, 1);

      if (response.ok && response.data && response.data.length > 0) {
        container.innerHTML = '';
        const card = createNewsCard(response.data[0], 0);
        container.appendChild(card);
      } else {
        container.innerHTML = '<div class="error-message">No world news available</div>';
      }
    } catch (error) {
      console.error('World story error:', error);
      container.innerHTML = `
        <div class="error-message">
          <p>Unable to load world news</p>
          <button onclick="window.loadWorldStory()">Retry</button>
        </div>
      `;
    }
  }

  // Load Category News
  async function loadCategoryNews() {
    console.log('📰 Loading category news...');

    for (const [categoryId, config] of Object.entries(CATEGORY_MAP)) {
      const container = document.getElementById(config.container);
      if (!container) {
        console.warn(`Container not found: ${config.container}`);
        continue;
      }

      container.innerHTML = `
        <div class="skeleton-category">
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
        </div>
        <div class="skeleton-category">
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
        </div>
      `;

      try {
        const response = await newsAPI.getNews(config.query, 1, 3);

        if (response.ok && response.data && response.data.length > 0) {
          container.innerHTML = '';

          response.data.forEach((article, index) => {
            const miniCard = document.createElement('article');
            miniCard.className = 'category-story-card';
            miniCard.innerHTML = `
              <h4>${sanitizeHTML(article.title)}</h4>
              <div class="meta">
                <span class="time">${formatTimeAgo(article.publishedAt)}</span>
              </div>
            `;

            miniCard.addEventListener('click', () => {
              window.open(article.url, '_blank', 'noopener,noreferrer');
            });

            container.appendChild(miniCard);
          });
        } else {
          container.innerHTML = '<div class="empty">No news available</div>';
        }
      } catch (error) {
        console.error(`Category ${categoryId} error:`, error);
        container.innerHTML = '<div class="error">Failed to load</div>';
      }
    }
  }

  // Load Local News
  async function loadLocalNews() {
    const container = document.getElementById('localNewsContent');
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-grid">
        <div class="skeleton-card small">
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-card small">
          <div class="skeleton-line long"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
    `;

    try {
      const location = AppState.location.city || 'Delhi';
      const response = await newsAPI.getLocalNews(location);

      if (response.ok && response.data && response.data.length > 0) {
        container.innerHTML = response.data.map(item => `
          <div class="local-news-item">
            <h4>${sanitizeHTML(item.title)}</h4>
            <p>${sanitizeHTML(item.snippet || item.description)}</p>
            <div class="local-news-time">${formatTimeAgo(item.publishedAt)}</div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No local news available</p>';
      }
    } catch (error) {
      console.error('Local news error:', error);
      container.innerHTML = '<p>Unable to load local news</p>';
    }
  }

  // Load Weather
  async function loadWeather() {
    const container = document.getElementById('weatherContent');
    const cityBadge = document.getElementById('weatherCity');
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-card">
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line long"></div>
      </div>
    `;

    try {
      const city = AppState.location.city || 'Delhi';
      const data = await newsAPI.fetchWithCache(
        `${API_BASE}/weather?city=${encodeURIComponent(city)}`
      );

      if (!data.ok) throw new Error(data.error || 'Failed to fetch weather');

      // Update city badge if available
      if (cityBadge) cityBadge.textContent = data.city || city;

      const weatherIconMapping = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Mist': '🌫️',
        'Smoke': '🌫️',
        'Haze': '🌫️',
        'Dust': '🌫️',
        'Fog': '🌫️'
      };

      const icon = weatherIconMapping[data.condition] || '🌡️';

      container.innerHTML = `
        <div class="weather-current">
          <span class="weather-icon">${icon}</span>
          <div class="weather-temp">${data.temp}°C</div>
          <div class="weather-desc">${sanitizeHTML(data.description)}</div>
        </div>
        <div class="weather-details">
          <div class="weather-detail">
            <span class="weather-detail-label">Feels Like</span>
            <span class="weather-detail-value">${data.feelsLike}°C</span>
          </div>
          <div class="weather-detail">
            <span class="weather-detail-label">Humidity</span>
            <span class="weather-detail-value">${data.humidity}%</span>
          </div>
          <div class="weather-detail">
            <span class="weather-detail-label">Wind</span>
            <span class="weather-detail-value">${data.wind} km/h</span>
          </div>
          <div class="weather-detail">
            <span class="weather-detail-label">Condition</span>
            <span class="weather-detail-value">${sanitizeHTML(data.condition)}</span>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Weather error:', error);
      container.innerHTML = `
        <div class="error-message">
          <p>Weather data unavailable</p>
          <button onclick="window.loadWeather()">Retry</button>
        </div>
      `;
    }
  }

  // ============================================================
  // STOCK MARKET
  // ============================================================
  async function loadMarketData() {
    const stockDataEl = document.getElementById('stockData');
    if (!stockDataEl) return;

    try {
      const res = await fetch(`${API_BASE}/market`);
      const json = await res.json();

      if (!json.ok) throw new Error();

      stockDataEl.innerHTML = json.data.map(stock => `
        <div class="stock-card">
          <div class="stock-name">${stock.symbol}</div>
          <div class="stock-price">₹${stock.price}</div>
          <div class="stock-change ${stock.change >= 0 ? 'stock-up' : 'stock-down'}">
            ${stock.change >= 0 ? '+' : ''}${stock.change}%
          </div>
        </div>
      `).join('');

    } catch {
      stockDataEl.innerHTML = '<p class="error">Market data unavailable</p>';
    }
  }

  // Refresh market data every 30 seconds
  setInterval(loadMarketData, 30000);

  // ============================================================
  // COMPETITION & INTERACTIVE FEATURES
  // ============================================================

  function initCompetition() {
    const participateBtn = document.getElementById('participateBtn');
    if (!participateBtn) return;

    const hasParticipated = localStorage.getItem('newszoid_competition_participated') === 'true';

    if (hasParticipated) {
      participateBtn.textContent = AppState.language === 'hi' ? 'पंजीकृत' : 'Registered';
      participateBtn.disabled = true;
      participateBtn.classList.add('disabled');
    } else {
      participateBtn.addEventListener('click', () => {
        const loggedInUser = localStorage.getItem('newszoid_loggedInUser');

        if (!loggedInUser) {
          showToast('Please login first!', 'warning');
          const loginModal = document.getElementById('loginModal');
          if (loginModal) loginModal.style.display = 'block';
          return;
        }

        if (confirm('Participate in competition?')) {
          localStorage.setItem('newszoid_competition_participated', 'true');
          participateBtn.textContent = 'Registered';
          participateBtn.disabled = true;
          participateBtn.classList.add('disabled');
          showToast('Successfully registered!', 'success');
        }
      });
    }
  }

  function startLiveCountdown() {
    const countdownTimer = document.getElementById('countdownTimer');
    if (!countdownTimer) return;

    function updateTimer() {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const diff = endOfMonth - now;

      if (diff <= 0) {
        countdownTimer.textContent = 'Ended!';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      countdownTimer.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
  }

  // ============================================================
  // SIDEBAR
  // ============================================================
  function initializeSidebar() {
    const menuBtn = document.getElementById('menuBtn');
    const closeSidebar = document.getElementById('closeSidebar');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (!menuBtn || !sidebar || !overlay) return;

    menuBtn.addEventListener('click', () => {
      sidebar.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    function closeSidebarMenu() {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (closeSidebar) closeSidebar.addEventListener('click', closeSidebarMenu);
    overlay.addEventListener('click', closeSidebarMenu);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('active')) {
        closeSidebarMenu();
      }
    });
  }

  // ============================================================
  // THEME & LANGUAGE
  // ============================================================

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('newszoid_theme', theme);
  }

  function updateLanguageDisplay() {
    const lang = AppState.language;

    document.querySelectorAll('[data-en]').forEach(el => {
      const text = el.dataset[lang] || el.dataset.en;
      if (text) {
        if (el.tagName === 'INPUT' && el.type === 'submit') {
          el.value = text;
        } else {
          el.textContent = text;
        }
      }
    });
  }

  function setDate() {
    const currentDate = document.getElementById('currentDate');
    if (!currentDate) return;

    const now = new Date();
    const locale = AppState.language === 'hi' ? 'hi-IN' : 'en-US';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDate.textContent = now.toLocaleDateString(locale, options);
  }

  // ============================================================
  // MODAL HANDLERS
  // ============================================================
  function initModals() {
    // Close modal handlers
    document.querySelectorAll('.modal .close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.style.display = 'none';
      });
    });

    // Close on background click
    window.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
      }
    });

    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.style.display = 'block';
      });
    }
  }

  // ============================================================
  // MAIN INITIALIZATION
  // ============================================================

  async function initialize() {
    console.log('⚙️ Starting initialization...');

    try {
      // Apply saved preferences
      applyTheme(AppState.theme);
      updateLanguageDisplay();
      setDate();

      // Initialize UI components
      initializeSidebar();
      initModals();

      // Load all content in parallel
      await Promise.allSettled([
        loadTopStory(),
        loadWorldStory(),
        loadCategoryNews(),
        loadLocalNews(),
        loadWeather()
      ]);

      // Initialize features
      loadMarketData();
      initCompetition();
      startLiveCountdown();

      AppState.initialized = true;
      console.log('✅ Initialization complete');

      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('app:ready'));

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      showToast('Some features failed to load', 'error');
    }
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function setupEventListeners() {
    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        applyTheme(newTheme);
        showToast(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'success');
      });
    }

    // Sidebar dark mode toggle
    const sidebarDarkMode = document.getElementById('sidebarDarkMode');
    if (sidebarDarkMode) {
      sidebarDarkMode.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        applyTheme(newTheme);
      });
    }

    // Language toggle - Temporarily Disabled (Coming Soon)
    const translateBtn = document.getElementById('translateBtn');
    if (translateBtn) {
      translateBtn.addEventListener('click', () => {
        showToast('Translation feature coming soon!', 'info');
      });
    }

    // Local News Translation toggle - Temporarily Disabled (Coming Soon)
    const localNewsTranslateBtn = document.getElementById('localNewsTranslateBtn');
    if (localNewsTranslateBtn) {
      localNewsTranslateBtn.addEventListener('click', () => {
        showToast('Local news translation coming soon!', 'info');
      });
    }
  }

  // ============================================================
  // START APPLICATION
  // ============================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupEventListeners();
      setTimeout(initialize, 100);
    });
  } else {
    setupEventListeners();
    setTimeout(initialize, 100);
  }

  // Export functions for global access
  window.loadTopStory = loadTopStory;
  window.loadWorldStory = loadWorldStory;
  window.loadCategoryNews = loadCategoryNews;
  window.loadMarketData = loadMarketData;
  window.NewsAPI = NewsAPI;
  window.newsAPI = newsAPI;
  window.AppState = AppState;

  console.log('✅ Complete script loaded successfully');

})();
const isFirstVisit = !localStorage.getItem('newszoid_onboarding_done');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

document.addEventListener('DOMContentLoaded', () => {
  const onboardingDone = localStorage.getItem('newszoid_onboarding_done');
  if (onboardingDone) return;

  const modal = document.getElementById('onboardingModal');
  const darkSuggest = document.getElementById('darkModeSuggestion');

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Show dark mode suggestion only if system is NOT dark
  if (prefersDark) {
    darkSuggest.style.display = 'none';
  }

  modal.style.display = 'flex';

  document.getElementById('enableDarkModeBtn')?.addEventListener('click', () => {
    document.body.classList.add('dark-mode');
    localStorage.setItem('newszoid_theme', 'dark');
    closeOnboarding();
  });

  document.getElementById('loginNowBtn').addEventListener('click', () => {
    closeOnboarding();
    document.getElementById('loginBtn')?.click();
  });

  document.getElementById('skipOnboardingBtn').addEventListener('click', () => {
    closeOnboarding();
  });

  function closeOnboarding() {
    localStorage.setItem('newszoid_onboarding_done', 'true');
    modal.style.display = 'none';
  }
});
if (localStorage.getItem('newszoid_theme') === 'dark') {
  document.body.classList.add('dark-mode');
}

function isNewYear2026() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // Jan = 0
  const date = now.getDate();

  return year === 2026 && month === 0 && (date === 1 || date === 2);
}

const hasSeenNY = localStorage.getItem('newszoid_newyear_2026_seen');

document.addEventListener('DOMContentLoaded', () => {
  if (!isNewYear2026()) return;

  if (localStorage.getItem('newszoid_newyear_2026_seen')) return;

  const modal = document.getElementById('newYearModal');
  modal.style.display = 'flex';

  function closeNewYear() {
    localStorage.setItem('newszoid_newyear_2026_seen', 'true');
    modal.style.display = 'none';
  }

  document.getElementById('enterSiteBtn').addEventListener('click', closeNewYear);
  document.getElementById('skipNewYearBtn').addEventListener('click', closeNewYear);
});



