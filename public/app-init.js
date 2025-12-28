// ============================================================
// MAIN APPLICATION INITIALIZATION SCRIPT
// This script coordinates all components and ensures proper startup
// Add this as app-init.js and load it LAST in your HTML
// ============================================================

(function () {
    'use strict';

    console.log('🚀 Initializing Newszoid...');

    // ============================================================
    // APPLICATION STATE
    // ============================================================
    const AppState = {
        initialized: false,
        user: null,
        location: null,
        language: 'en'
    };

    const CATEGORY_MAP = {
        'environment': { query: 'environment climate change' },
        'education': { query: 'education school university' },
        'business': { query: 'business finance market' },
        'sports': { query: 'sports cricket football' },
        'technology': { query: 'technology AI artificial intelligence' },
        'economy': { query: 'inflation economy' },
        'science': { query: 'science space nasa isro' },
        'legal': { query: 'legal court law supreme court' },
        'culture': { query: 'culture art tradition' },
        'global-politics': { query: 'world politics' },
        'global-finance': { query: 'world finance economy' },
        'health': { query: 'health medicine doctor' }
    };

    // ============================================================
    // INITIALIZATION SEQUENCE
    // ============================================================
    class AppInitializer {
        constructor() {
            this.initPromises = [];
            this.components = new Map();
        }

        async init() {
            console.log('📋 Starting initialization sequence...');

            try {
                // Phase 1: Core Services
                await this.initCoreServices();

                // Phase 2: Authentication
                await this.initAuthentication();

                // Phase 3: User Data
                await this.initUserData();

                // Phase 4: Content
                await this.initContent();

                // Phase 5: Features
                await this.initFeatures();

                AppState.initialized = true;
                console.log('✅ Application initialized successfully');

                // Dispatch ready event
                window.dispatchEvent(new CustomEvent('app:ready'));

            } catch (error) {
                console.error('❌ Initialization failed:', error);
                this.handleInitError(error);
            }
        }

        // ============================================================
        // PHASE 1: CORE SERVICES
        // ============================================================
        async initCoreServices() {
            console.log('⚙️ Phase 1: Initializing core services...');

            // Initialize theme
            this.initTheme();

            // Initialize language
            this.initLanguage();

            // Location is handled by location-selector.js
            if (window.userLocation) {
                AppState.location = window.userLocation;
            }

            console.log('✓ Core services initialized');
        }

        initTheme() {
            const savedTheme = localStorage.getItem('newszoid_theme') || 'light';
            document.body.classList.toggle('dark-mode', savedTheme === 'dark');

            // Setup theme toggle
            const themeToggle = document.getElementById('darkModeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    const isDark = document.body.classList.toggle('dark-mode');
                    localStorage.setItem('newszoid_theme', isDark ? 'dark' : 'light');
                });
            }
        }

        initLanguage() {
            const savedLang = localStorage.getItem('newszoid_language') || 'en';
            AppState.language = savedLang;

            // Update language display
            this.updateLanguageUI(savedLang);

            // Setup language toggle
            const langToggle = document.getElementById('translateBtn');
            if (langToggle) {
                langToggle.addEventListener('click', () => {
                    AppState.language = AppState.language === 'en' ? 'hi' : 'en';
                    localStorage.setItem('newszoid_language', AppState.language);
                    this.updateLanguageUI(AppState.language);
                    window.location.reload(); // Reload to apply translations
                });
            }
        }

        updateLanguageUI(lang) {
            document.querySelectorAll('[data-en]').forEach(el => {
                const text = el.dataset[lang] || el.dataset.en;
                if (text) {
                    if (el.tagName === 'INPUT') {
                        if (el.type === 'submit') {
                            el.value = text;
                        }
                    } else {
                        el.textContent = text;
                    }
                }
            });
        }


        // ============================================================
        // PHASE 2: AUTHENTICATION
        // ============================================================
        async initAuthentication() {
            console.log('🔐 Phase 2: Initializing authentication...');

            if (typeof authManager !== 'undefined') {
                await authManager.checkSession();
                AppState.user = authManager.getUser();
                console.log('✓ Authentication initialized', AppState.user ? '(logged in)' : '(guest)');
            } else {
                console.warn('⚠️ Auth manager not available');
            }
        }

        // ============================================================
        // PHASE 3: USER DATA
        // ============================================================
        async initUserData() {
            console.log('👤 Phase 3: Loading user data...');

            if (!AppState.user) {
                console.log('ℹ️ Guest user - skipping user data');
                return;
            }

            // Initialize bookmarks
            if (typeof bookmarkManager !== 'undefined') {
                await bookmarkManager.init();
                console.log('✓ Bookmarks loaded');
            }

            // Initialize comment manager
            if (typeof commentManager !== 'undefined') {
                console.log('✓ Comments initialized');
            }

            console.log('✓ User data loaded');
        }

        // ============================================================
        // PHASE 4: CONTENT
        // ============================================================
        async initContent() {
            console.log('📰 Phase 4: Loading content...');

            try {
                // Load news if on main page
                if (typeof newsAPI !== 'undefined' && document.getElementById('newsContainer')) {
                    await this.loadNews();
                }

                // Load local news
                if (document.getElementById('localNewsContent')) {
                    await this.loadLocalNews();
                }

                // Load weather
                if (document.getElementById('weatherContent')) {
                    await this.loadWeather();
                }

                // Load category news
                await this.initCategoryNews();

                console.log('✓ Content loaded');
            } catch (error) {
                console.warn('⚠️ Some content failed to load:', error);
            }
        }

        async loadNews() {
            try {
                const container = document.getElementById('newsContainer');
                if (!container) return;

                container.innerHTML = '<div class="loading">Loading news...</div>';

                const response = await newsAPI.getNews('general', 1, 20);

                if (response.ok && response.data) {
                    container.innerHTML = '';
                    response.data.forEach((article, index) => {
                        const card = this.createNewsCard(article, index);
                        container.appendChild(card);
                    });
                }
            } catch (error) {
                console.error('News loading error:', error);
            }
        }

        async loadLocalNews() {
            try {
                const container = document.getElementById('localNewsContent');
                if (!container) return;

                container.innerHTML = '<div class="loading-local-news">Loading local news...</div>';

                const response = await newsAPI.getLocalNews(window.userLocation.city);

                if (response.ok && response.data) {
                    container.innerHTML = response.data.map(item => `
                        <div class="local-news-item">
                            <h4>${this.escapeHTML(item.title)}</h4>
                            <p>${this.escapeHTML(item.description)}</p>
                            <div class="local-news-time">${this.formatTimeAgo(item.publishedAt)}</div>
                        </div>
                    `).join('');
                }
            } catch (error) {
                console.error('Local news error:', error);
            }
        }

        async loadWeather() {
            try {
                const container = document.getElementById('weatherContent');
                if (!container) return;

                container.innerHTML = '<div class="loading-weather">Loading weather...</div>';

                const response = await newsAPI.getWeather(
                    window.userLocation.lat,
                    window.userLocation.lon
                );

                if (response.ok && response.data) {
                    const w = response.data;
                    container.innerHTML = `
                        <div class="weather-current">
                            <span class="weather-icon">${this.getWeatherIcon(w.condition)}</span>
                            <div class="weather-temp">${Math.round(w.temp)}°C</div>
                            <div class="weather-desc">${w.description}</div>
                        </div>
                        <div class="weather-details">
                            <div class="weather-detail">
                                <span class="weather-detail-label">Feels Like</span>
                                <span class="weather-detail-value">${Math.round(w.feelsLike)}°C</span>
                            </div>
                            <div class="weather-detail">
                                <span class="weather-detail-label">Humidity</span>
                                <span class="weather-detail-value">${w.humidity}%</span>
                            </div>
                            <div class="weather-detail">
                                <span class="weather-detail-label">Wind</span>
                                <span class="weather-detail-value">${w.windSpeed} km/h</span>
                            </div>
                            <div class="weather-detail">
                                <span class="weather-detail-label">Pressure</span>
                                <span class="weather-detail-value">${w.pressure} hPa</span>
                            </div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Weather error:', error);
            }
        }

        async initCategoryNews() {
            const categories = document.querySelectorAll('.category-news');

            for (const categoryEl of categories) {
                const id = categoryEl.id;
                if (!id) continue;

                // Extract slug: category-environment -> environment
                const slug = id.replace('category-', '');
                const cfg = CATEGORY_MAP[slug];

                if (!cfg) {
                    console.warn(`No configuration found for category: ${slug}`);
                    continue;
                }

                try {
                    // Fetch top 3 articles for this category using the mapped query
                    const response = await newsAPI.getNews(cfg.query, 1, 3);

                    if (response.ok && response.data && response.data.length > 0) {
                        categoryEl.innerHTML = '';
                        response.data.forEach((article, index) => {
                            // Create a mini card for category section
                            const miniCard = document.createElement('article');
                            miniCard.className = 'category-story-card';
                            miniCard.innerHTML = `
                                <h4>${this.escapeHTML(article.title)}</h4>
                                <div class="meta">
                                    <span class="time">${this.formatTimeAgo(article.publishedAt)}</span>
                                </div>
                            `;
                            // Add click to open
                            miniCard.addEventListener('click', () => {
                                window.open(article.url, '_blank');
                            });
                            categoryEl.appendChild(miniCard);
                        });
                    } else {
                        categoryEl.innerHTML = '<div class="empty">No news available</div>';
                    }
                } catch (err) {
                    console.error(`Failed to load category ${slug} (query: ${cfg.query}):`, err);
                    categoryEl.innerHTML = '<div class="error">Failed to load</div>';
                }
            }
        }

        createNewsCard(article, index) {
            const card = document.createElement('article');
            card.className = 'story-card';
            card.dataset.articleId = article.id || `article_${Date.now()}_${index}`;

            card.innerHTML = `
                <img src="${article.image || 'https://via.placeholder.com/600x400'}" 
                     alt="${this.escapeHTML(article.title)}" 
                     class="story-image">
                <h2 class="story-headline">${this.escapeHTML(article.title)}</h2>
                <p class="story-text">${this.escapeHTML(article.snippet || '')}</p>
                <div class="story-meta">
                    <span class="story-source">${this.escapeHTML(article.source || 'Newszoid')}</span>
                    <div class="story-actions">
                        <button class="share-btn bookmark" aria-label="Save">☆</button>
                        <button class="share-btn tts" aria-label="Listen">🔊</button>
                        <button class="share-btn comment" aria-label="Comment">💬</button>
                    </div>
                </div>
            `;

            return card;
        }

        // ============================================================
        // PHASE 5: FEATURES
        // ============================================================
        async initFeatures() {
            console.log('🎯 Phase 5: Initializing features...');

            // Initialize bookmark UI states
            this.initBookmarkStates();

            // Initialize service worker
            this.initServiceWorker();

            // Initialize analytics
            this.initAnalytics();

            console.log('✓ Features initialized');
        }

        initBookmarkStates() {
            if (typeof bookmarkManager === 'undefined') return;

            document.querySelectorAll('.share-btn.bookmark').forEach(btn => {
                const article = btn.closest('article, .story-card');
                if (!article) return;

                const articleId = article.dataset.articleId;
                if (bookmarkManager.isBookmarked(articleId)) {
                    btn.classList.add('saved');
                    btn.textContent = '★';
                }
            });
        }

        initServiceWorker() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(reg => console.log('✓ Service Worker registered'))
                    .catch(err => console.warn('⚠️ Service Worker registration failed:', err));
            }
        }

        initAnalytics() {
            // Initialize analytics if available
            if (typeof gtag !== 'undefined') {
                console.log('✓ Analytics initialized');
            }
        }

        // ============================================================
        // ERROR HANDLING
        // ============================================================
        handleInitError(error) {
            console.error('Initialization error:', error);

            // Show user-friendly error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #f44336;
                color: white;
                padding: 16px 24px;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            errorDiv.textContent = 'Failed to initialize app. Please refresh the page.';
            document.body.appendChild(errorDiv);

            setTimeout(() => errorDiv.remove(), 5000);
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
            const date = new Date(timestamp);
            const diff = now - date.getTime();

            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);

            if (minutes < 60) return `${minutes} min ago`;
            if (hours < 24) return `${hours}h ago`;
            return date.toLocaleDateString();
        }

        getWeatherIcon(condition) {
            const icons = {
                'clear': '☀️',
                'clouds': '☁️',
                'rain': '🌧️',
                'snow': '❄️',
                'thunderstorm': '⛈️',
                'mist': '🌫️'
            };
            return icons[condition?.toLowerCase()] || '🌤️';
        }
    }

    // ============================================================
    // START APPLICATION
    // ============================================================
    function startApp() {
        const initializer = new AppInitializer();
        initializer.init();
    }

    // Wait for DOM and critical scripts
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(startApp, 100); // Small delay to ensure all scripts loaded
        });
    } else {
        setTimeout(startApp, 100);
    }

    // Export app state for debugging
    window.AppState = AppState;

})();

console.log('📦 App initialization script loaded');