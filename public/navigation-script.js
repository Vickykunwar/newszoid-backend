// ====================================================================
// NAVIGATION SCRIPT.JS - FINAL FIXED VERSION (Language Sync + Speed)
// ====================================================================

(function () {
  'use strict';

  // === CONFIG ===
  const CONFIG = {
    baseScrollDuration: 300, // base ms
    maxScrollDuration: 800, // max ms for long distances
    debounceDelay: 100,
    blinkOnScroll: true,
    blinkClass: 'section-highlight-blink',
    debug: false // Set to true to enable console logging
  };

  const CATEGORIES = [
    { id: 'top-stories', label: { en: 'Top Stories', hi: 'मुख्य समाचार' }, icon: '📰', selector: '.section-header[data-en="TOP STORY"]' },
    { id: 'world', label: { en: 'World', hi: 'विश्व' }, icon: '🌍', selector: '.section-header[data-en="WORLD"]' },
    { id: 'daily-highlights', label: { en: 'Daily Highlights', hi: 'दैनिक हाइलाइट्स' }, icon: '⭐', selector: 'h3[data-en*="Daily Highlights"]' },
    { id: 'environment', label: { en: 'Environment', hi: 'पर्यावरण' }, icon: '🌱', selector: 'h3[data-en="Environment"]' },
    { id: 'education', label: { en: 'Education', hi: 'शिक्षा' }, icon: '📚', selector: 'h3[data-en="Education"]' },
    { id: 'business', label: { en: 'Business', hi: 'व्यापार' }, icon: '🏦', selector: 'h3[data-en*="Business"]' },
    { id: 'sports', label: { en: 'Sports', hi: 'खेल' }, icon: '⚽', selector: 'h3[data-en="Sports"]' },
    { id: 'technology', label: { en: 'Technology & AI', hi: 'प्रौद्योगिकी और AI' }, icon: '💻', selector: 'h3[data-en*="Technology"]' },
    { id: 'economy', label: { en: 'Economy', hi: 'अर्थव्यवस्था' }, icon: '💰', selector: 'h3[data-en*="Inflation"]' },
    { id: 'science', label: { en: 'Science', hi: 'विज्ञान' }, icon: '🔬', selector: 'h3[data-en*="Science"]' },
    { id: 'legal', label: { en: 'Legal', hi: 'कानूनी' }, icon: '⚖️', selector: 'h3[data-en*="Legal"]' },
    { id: 'culture', label: { en: 'Culture', hi: 'संस्कृति' }, icon: '🎭', selector: 'h3[data-en="Culture"]' },
    { id: 'ai', label: { en: 'AI', hi: 'कृत्रिम बुद्धिमत्ता' }, icon: '✨', selector: 'h3[data-en*="Artificial Intelligence"]' },
    { id: 'global-finance', label: { en: 'Global Finance', hi: 'वैश्विक वित्त' }, icon: '🌍', selector: 'h3[data-en*="Global Finance"]' },
    { id: 'health', label: { en: 'Health', hi: 'स्वास्थ्य' }, icon: '🏥', selector: 'h3[data-en="Health"]' },
    { id: 'stocks', label: { en: 'Stock Market', hi: 'शेयर बाजार' }, icon: '📈', selector: '.section-header[data-en="Indian Stock Market"]' },
    { id: 'competition', label: { en: 'Competition', hi: 'प्रतियोगिता' }, icon: '🏆', selector: '.section-header[data-en="Competition Corner"]' },
    { id: 'trending', label: { en: 'Trending', hi: 'ट्रेंडिंग' }, icon: '🔥', selector: '.section-header[data-en="Trending Stories"]' }
  ];

  let sections = [];
  let currentLanguage = 'en';
  let debounceTimer;

  // === SCROLL HELPERS ===
  function getScrollDuration(distance) {
    const absDist = Math.abs(distance);
    const duration = Math.min(
      CONFIG.baseScrollDuration + absDist / 3,
      CONFIG.maxScrollDuration
    );
    return duration;
  }

  function smoothScrollTo(targetY) {
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = getScrollDuration(distance);
    const startTime = performance.now();

    function step(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startY + distance * ease);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // === SECTION HANDLING ===
  function calculateScrollOffset() {
    const header = document.querySelector('.header');
    const navWrapper = document.querySelector('.category-nav-wrapper');
    let offset = 0;
    if (header) offset += header.offsetHeight;
    if (navWrapper) offset += navWrapper.offsetHeight;
    return offset + 10;
  }

  function findSectionElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) {
        if (CONFIG.debug) console.warn(`Navigation: Section not found for selector: ${selector}`);
        return null;
      }
      const container = el.closest('article, section, .story-item, .news-section');
      const result = container || el;
      if (CONFIG.debug) console.log(`Navigation: Found section for ${selector}`, result);
      return result;
    } catch (error) {
      if (CONFIG.debug) console.error(`Navigation: Error finding section ${selector}:`, error);
      return null;
    }
  }

  function cacheSections() {
    sections = CATEGORIES.map(cat => {
      const el = findSectionElement(cat.selector);
      if (!el) return null;
      return { id: cat.id, element: el, offset: 0 };
    }).filter(Boolean);
    updateSectionOffsets();
  }

  function updateSectionOffsets() {
    const offsetBase = calculateScrollOffset();
    sections.forEach(sec => {
      const rect = sec.element.getBoundingClientRect();
      sec.offset = rect.top + window.scrollY - offsetBase;
    });
    sections.sort((a, b) => a.offset - b.offset);
  }

  // === LANGUAGE DETECTION ===
  function detectCurrentLanguage() {
    const saved = localStorage.getItem('newszoid_language');
    if (saved === 'en' || saved === 'hi') return saved;

    const btn = document.getElementById('translateBtn');
    if (btn) {
      const txt = btn.querySelector('.btn-text')?.textContent || '';
      if (txt.includes('English')) return 'hi';
      if (txt.includes('हिंदी')) return 'en';
    }
    return 'en';
  }

  // === PERSONALIZATION ===
  function getFollowedTopics() {
    return JSON.parse(localStorage.getItem('nz_followed_topics') || '[]');
  }

  const placeholders = new Map();

  function setupPlaceholders() {
    CATEGORIES.forEach(cat => {
      const el = findSectionElement(cat.selector);
      if (el && !placeholders.has(cat.id)) {
        // Create a placeholder comment to mark the original spot
        const placeholder = document.createComment(`placeholder-for-${cat.id}`);
        if (el.parentNode) {
          el.parentNode.insertBefore(placeholder, el);
          placeholders.set(cat.id, placeholder);
        }
      }
    });
  }

  function toggleFollowTopic(topicId) {
    const arr = getFollowedTopics();
    const idx = arr.indexOf(topicId);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(topicId);
    localStorage.setItem('nz_followed_topics', JSON.stringify(arr));

    renderPersonalizedFeed();
    renderNavigation(detectCurrentLanguage());
  }

  function renderPersonalizedFeed() {
    const followed = getFollowedTopics();
    const main = document.querySelector('.main-content') || document.querySelector('main');
    if (!main) return;

    // Ensure placeholders exist before we start moving things around
    if (placeholders.size === 0) setupPlaceholders();

    // 1. Restore Unfollowed items to their original placeholder positions
    CATEGORIES.forEach(cat => {
      if (!followed.includes(cat.id)) {
        const el = findSectionElement(cat.selector);
        const placeholder = placeholders.get(cat.id);
        if (el && placeholder && placeholder.parentNode) {
          // Insert back into original position (after placeholder)
          placeholder.parentNode.insertBefore(el, placeholder.nextSibling);
        }
      }
    });

    // 2. Move Followed items to top of main
    // We use config order for followed items to maintain a stable sort at the top
    const followedCats = CATEGORIES.filter(c => followed.includes(c.id));
    // Reverse iteration for prepend ensures the first config item ends up at the very top
    [...followedCats].reverse().forEach(cat => {
      const el = findSectionElement(cat.selector);
      if (el) {
        main.prepend(el);
      }
    });

    // Update offsets after layout change
    setTimeout(cacheSections, 100);
  }

  // === NAVIGATION RENDER ===
  function renderNavigation(language = detectCurrentLanguage()) {
    currentLanguage = language;
    const nav = document.querySelector('.category-nav');
    if (!nav) return;
    nav.innerHTML = '';

    const followed = getFollowedTopics();
    // Sort categories: followed first, then original order
    const cats = CATEGORIES.slice().sort((a, b) => {
      const aFollowed = followed.includes(a.id);
      const bFollowed = followed.includes(b.id);
      return (bFollowed ? 1 : 0) - (aFollowed ? 1 : 0);
    });

    cats.forEach(cat => {
      const a = document.createElement('a');
      a.href = `#${cat.id}`;
      a.className = 'category-nav-item';
      a.dataset.id = cat.id;

      const isFollowed = followed.includes(cat.id);
      a.innerHTML = `${cat.icon} ${cat.label[language]} <span class="follow-toggle" title="${isFollowed ? 'Unfollow' : 'Follow'}">${isFollowed ? '★' : '☆'}</span>`;

      a.addEventListener('click', e => {
        e.preventDefault();
        scrollToSection(cat.id);
      });

      // Toggle click handler
      const toggleBtn = a.querySelector('.follow-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', ev => {
          ev.stopPropagation();
          toggleFollowTopic(cat.id);
        });
      }

      nav.appendChild(a);
    });
  }

  // === SCROLLING ===
  function scrollToSection(id) {
    let sec = sections.find(s => s.id === id);

    // If section not found in cache, try to find it again
    if (!sec) {
      if (CONFIG.debug) console.warn(`Navigation: Section ${id} not in cache, attempting to find...`);
      const category = CATEGORIES.find(cat => cat.id === id);
      if (category) {
        const el = findSectionElement(category.selector);
        if (el) {
          const offsetBase = calculateScrollOffset();
          const rect = el.getBoundingClientRect();
          sec = {
            id: category.id,
            element: el,
            offset: rect.top + window.scrollY - offsetBase
          };
          sections.push(sec); // Add to cache
        }
      }
    }

    if (!sec) {
      if (CONFIG.debug) console.error(`Navigation: Cannot scroll to section ${id} - not found`);
      return;
    }

    if (CONFIG.debug) console.log(`Navigation: Scrolling to ${id}`, sec);
    smoothScrollTo(sec.offset);

    if (CONFIG.blinkOnScroll && sec.element) {
      // Remove any existing blink class first
      sec.element.classList.remove(CONFIG.blinkClass);
      // Force reflow to restart animation
      void sec.element.offsetWidth;
      // Add blink class
      sec.element.classList.add(CONFIG.blinkClass);
      if (CONFIG.debug) console.log(`Navigation: Applied blink to ${id}`);
      setTimeout(() => {
        sec.element.classList.remove(CONFIG.blinkClass);
      }, 2000);
    }
  }

  // === ACTIVE STATE ===
  function updateActiveNavItem() {
    const scrollY = window.scrollY + calculateScrollOffset() + 50;
    let active = sections[0]?.id;
    for (const s of sections) {
      if (scrollY >= s.offset) active = s.id;
      else break;
    }

    const navItems = document.querySelectorAll('.category-nav-item');
    let activeItem = null;

    navItems.forEach(a => {
      const isActive = a.dataset.id === active;
      a.classList.toggle('active', isActive);
      if (isActive) activeItem = a;
    });

    // Auto-scroll navigation bar to keep active item in view
    if (activeItem) {
      const nav = document.querySelector('.category-nav');
      if (nav) {
        // Calculate center position
        const scrollLeft = activeItem.offsetLeft - (nav.clientWidth / 2) + (activeItem.clientWidth / 2);

        // Only scroll if the difference is significant to avoid jitter
        if (Math.abs(nav.scrollLeft - scrollLeft) > 10) {
          nav.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
      }
    }
  }

  // === LANGUAGE SYNC ===
  function setupLanguageSync() {
    // Listen for custom event from main script
    window.addEventListener('languageChanged', (e) => {
      if (e.detail && e.detail.language) {
        renderNavigation(e.detail.language);
        cacheSections();
        updateActiveNavItem();
      }
    });

    // Listen for storage changes (cross-tab sync)
    window.addEventListener('storage', e => {
      if (e.key === 'newszoid_language') {
        renderNavigation(e.newValue || 'en');
        cacheSections();
      }
    });
  }

  // === NAVIGATION ARROWS ===
  function setupNavigationArrows() {
    const navContainer = document.querySelector('.category-nav');
    const prevBtn = document.getElementById('navPrevBtn');
    const nextBtn = document.getElementById('navNextBtn');
    const gradientLeft = document.querySelector('.nav-gradient-left');
    const gradientRight = document.querySelector('.nav-gradient-right');

    if (!navContainer || !prevBtn || !nextBtn) return;

    const scrollAmount = 300; // pixels to scroll

    function updateArrowStates() {
      const scrollLeft = navContainer.scrollLeft;
      const maxScroll = navContainer.scrollWidth - navContainer.clientWidth;

      // Disable/enable arrows and gradients based on scroll position
      if (scrollLeft <= 5) {
        prevBtn.classList.add('disabled');
        if (gradientLeft) gradientLeft.style.opacity = '0';
      } else {
        prevBtn.classList.remove('disabled');
        if (gradientLeft) gradientLeft.style.opacity = '1';
      }

      if (scrollLeft >= maxScroll - 5) {
        nextBtn.classList.add('disabled');
        if (gradientRight) gradientRight.style.opacity = '0';
      } else {
        nextBtn.classList.remove('disabled');
        if (gradientRight) gradientRight.style.opacity = '1';
      }
    }

    prevBtn.addEventListener('click', () => {
      navContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      setTimeout(updateArrowStates, 350);
    });

    nextBtn.addEventListener('click', () => {
      navContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(updateArrowStates, 350);
    });

    navContainer.addEventListener('scroll', updateArrowStates);
    window.addEventListener('resize', updateArrowStates);

    // Initial state
    setTimeout(updateArrowStates, 100);
  }

  // === INIT ===
  function init() {
    if (CONFIG.debug) console.log('🧭 Navigation system initializing...');
    setTimeout(() => {
      setupPlaceholders(); // Capture original positions FIRST
      renderPersonalizedFeed();
      renderNavigation();
      cacheSections();
      updateActiveNavItem();
      setupLanguageSync();
      setupNavigationArrows();
      window.addEventListener('scroll', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateActiveNavItem, CONFIG.debounceDelay);
      });
      window.addEventListener('resize', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateSectionOffsets, CONFIG.debounceDelay);
      });
      if (CONFIG.debug) console.log('✅ Navigation system ready.');
    }, 300);
  }

  window.NewszoidNavigation = {
    scrollToSection,
    refresh: cacheSections,
    setLanguage: renderNavigation
  };

  init();

})();



