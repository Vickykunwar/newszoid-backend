// controllers/newsController.js
const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_TTL_SECONDS || '300', 10)
});

const { initGemini, enhanceWithGemini } = require('../utils/gemini');
const HARDCODED_DATA = require('../utils/hardcodedData');
const geminiModel = initGemini();

// ============================================================
// CATEGORY MAPPING - Maps frontend categories to API queries
// ============================================================
const CATEGORY_MAP = {
  general: 'latest news',
  india: 'India news',
  world: 'international world news',
  business: 'business finance economy',
  technology: 'technology AI innovation',
  sports: 'sports cricket football',
  environment: 'climate environment pollution',
  education: 'education schools universities',
  health: 'health medicine healthcare',
  science: 'science research space',
  economy: 'inflation economy GDP',
  legal: 'court law judiciary',
  culture: 'culture arts entertainment',
  'global-politics': 'international politics diplomacy',
  'global-finance': 'global markets finance'
};

// ============================================================
// LOCATION MAPPING - Indian cities for local news
// ============================================================
const INDIAN_CITIES = {
  'delhi': { name: 'Delhi', query: 'Delhi NCR news' },
  'mumbai': { name: 'Mumbai', query: 'Mumbai news' },
  'bangalore': { name: 'Bangalore', query: 'Bangalore Bengaluru news' },
  'chennai': { name: 'Chennai', query: 'Chennai news' },
  'kolkata': { name: 'Kolkata', query: 'Kolkata news' },
  'hyderabad': { name: 'Hyderabad', query: 'Hyderabad news' },
  'pune': { name: 'Pune', query: 'Pune news' },
  'ahmedabad': { name: 'Ahmedabad', query: 'Ahmedabad news' }
};

// ============================================================
// HELPER: Fetch with timeout and retry
// ============================================================
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await axios({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        data: options.body,
        timeout: 8000,
        responseType: 'json'
      });
      return response.data;
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// ============================================================
// NORMALIZE ARTICLES from different sources
// ============================================================
function normalizeArticle(source, raw) {
  try {
    switch (source) {
      case 'gnews':
        return {
          id: raw.url || `gnews_${Date.now()}_${Math.random()}`,
          title: raw.title || 'Untitled',
          snippet: raw.description || raw.content || '',
          url: raw.url || '#',
          image: raw.image || 'https://via.placeholder.com/600x400?text=News',
          publishedAt: raw.publishedAt || new Date().toISOString(),
          source: raw.source?.name || 'GNews',
          category: raw.category || 'general',
          aiSummary: null
        };

      case 'guardian':
        return {
          id: raw.id || `guardian_${Date.now()}_${Math.random()}`,
          title: raw.webTitle || 'Untitled',
          snippet: raw.fields?.trailText || raw.fields?.bodyText?.substring(0, 200) || '',
          url: raw.webUrl || '#',
          image: raw.fields?.thumbnail || 'https://via.placeholder.com/600x400?text=News',
          publishedAt: raw.webPublicationDate || new Date().toISOString(),
          source: 'The Guardian',
          category: raw.sectionName || 'general',
          aiSummary: null
        };

      default:
        return {
          id: raw.url || raw.id || `news_${Date.now()}_${Math.random()}`,
          title: raw.title || 'Untitled',
          snippet: raw.description || raw.snippet || '',
          url: raw.url || '#',
          image: raw.image || 'https://via.placeholder.com/600x400?text=News',
          publishedAt: raw.publishedAt || new Date().toISOString(),
          source: raw.source || 'Newszoid',
          category: raw.category || 'general',
          aiSummary: null
        };
    }
  } catch (error) {
    console.error('Error normalizing article:', error);
    return null;
  }
}

// ============================================================
// BUILD API REQUESTS for multiple providers
// ============================================================
function buildAPIRequests(searchQuery, page = 1, pageSize = 10) {
  const requests = [];
  const gnewsKey = process.env.GNEWS_API_KEY;
  const guardianKey = process.env.GUARDIAN_API_KEY;

  // GNews API
  if (gnewsKey && gnewsKey !== 'your_gnews_api_key_here') {
    requests.push({
      provider: 'gnews',
      url: `https://gnews.io/api/v4/search?q=${encodeURIComponent(searchQuery)}&lang=en&max=${Math.min(pageSize, 10)}&page=${page}&token=${gnewsKey}`
    });
  }

  // Guardian API
  if (guardianKey && guardianKey !== 'your_guardian_api_key_here') {
    requests.push({
      provider: 'guardian',
      url: `https://content.guardianapis.com/search?api-key=${guardianKey}&q=${encodeURIComponent(searchQuery)}&show-fields=trailText,thumbnail,bodyText&page=${page}&page-size=${Math.min(pageSize, 20)}`
    });
  }

  return requests;
}

// ============================================================
// GET NEWS - Category-wise with fallback
// ============================================================
exports.getNews = async (req, res) => {
  try {
    const category = (req.query.category || 'general').toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || '10', 10)));

    // Build cache key
    const cacheKey = `news:${category}:p${page}:s${pageSize}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        ok: true,
        fromCache: true,
        aiEnabled: !!geminiModel,
        category,
        data: cached
      });
    }

    // Get search query for category
    const searchQuery = CATEGORY_MAP[category] || category;
    const requests = buildAPIRequests(searchQuery, page, pageSize);

    // If no API keys configured, use fallback
    if (requests.length === 0) {
      console.warn('⚠️ No news API keys configured. Using fallback data.');
      const fallback = HARDCODED_DATA.news[category] || HARDCODED_DATA.news.general || [];
      return res.json({
        ok: true,
        fromCache: false,
        isFallback: true,
        category,
        data: fallback
      });
    }

    // Fetch from all providers
    const responses = await Promise.allSettled(
      requests.map(async req => {
        try {
          const data = await fetchWithRetry(req.url);

          if (req.provider === 'gnews' && Array.isArray(data.articles)) {
            return data.articles
              .map(a => normalizeArticle('gnews', a))
              .filter(Boolean);
          }

          if (req.provider === 'guardian' && data.response?.results) {
            return data.response.results
              .map(a => normalizeArticle('guardian', a))
              .filter(Boolean);
          }

          return [];
        } catch (error) {
          console.error(`API Error (${req.provider}):`, error.message);
          return [];
        }
      })
    );

    // Merge results
    let articles = responses
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(Boolean);

    // Deduplicate by URL
    const seen = new Set();
    articles = articles.filter(article => {
      const key = article.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Use fallback if no articles found
    if (articles.length === 0) {
      console.warn('⚠️ APIs returned no results. Using fallback data.');
      articles = HARDCODED_DATA.news[category] || HARDCODED_DATA.news.general || [];
    }

    // Sort by date
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    // Limit results
    articles = articles.slice(0, pageSize);

    // Optional: Enhance with AI summaries (async, don't wait)
    if (geminiModel && articles.length > 0) {
      Promise.all(
        articles.slice(0, 5).map(async article => {
          try {
            const aiText = await enhanceWithGemini(
              `${article.title}\n${article.snippet || ''}`
            );
            article.aiSummary = aiText || null;
          } catch (error) {
            console.error('Gemini enhancement error:', error.message);
          }
        })
      ).catch(err => console.error('AI enhancement batch error:', err));
    }

    // Cache results
    cache.set(cacheKey, articles);

    res.json({
      ok: true,
      fromCache: false,
      aiEnabled: !!geminiModel,
      category,
      total: articles.length,
      page,
      pageSize,
      data: articles
    });

  } catch (error) {
    console.error('News fetch error:', error);

    // Final fallback
    const category = (req.query.category || 'general').toLowerCase();
    const fallback = HARDCODED_DATA.news[category] || HARDCODED_DATA.news.general || [];

    res.json({
      ok: true,
      isFallback: true,
      error: 'Using fallback data due to server error',
      category,
      data: fallback
    });
  }
};

// ============================================================
// GET LOCAL NEWS - City-wise news
// ============================================================
exports.getLocalNews = async (req, res) => {
  try {
    const location = (req.query.location || 'Delhi').toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize || '5', 10)));

    // Build cache key
    const cacheKey = `local:${location}:p${page}:s${pageSize}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      return res.json({
        ok: true,
        fromCache: true,
        location,
        data: cached
      });
    }

    // Get city configuration
    const cityKey = Object.keys(INDIAN_CITIES).find(key =>
      location.toLowerCase().includes(key) || key.includes(location.toLowerCase())
    );

    const cityConfig = cityKey ? INDIAN_CITIES[cityKey] : null;
    const searchQuery = cityConfig ? cityConfig.query : `${location} India local news`;

    const requests = buildAPIRequests(searchQuery, page, pageSize);

    // If no API keys, return fallback
    if (requests.length === 0) {
      return res.json({
        ok: true,
        isFallback: true,
        location,
        data: [
          {
            id: 'local_fallback_1',
            title: `${location} Metro expansion plans announced`,
            snippet: 'Local authorities have approved new infrastructure projects.',
            url: '#',
            image: 'https://via.placeholder.com/600x400?text=Local+News',
            publishedAt: new Date().toISOString(),
            source: 'Newszoid Local'
          }
        ]
      });
    }

    // Fetch from providers
    const responses = await Promise.allSettled(
      requests.map(async req => {
        try {
          const data = await fetchWithRetry(req.url);

          if (req.provider === 'gnews' && Array.isArray(data.articles)) {
            return data.articles
              .map(a => normalizeArticle('gnews', a))
              .filter(Boolean);
          }

          if (req.provider === 'guardian' && data.response?.results) {
            return data.response.results
              .map(a => normalizeArticle('guardian', a))
              .filter(Boolean);
          }

          return [];
        } catch (error) {
          console.error(`Local news API error (${req.provider}):`, error.message);
          return [];
        }
      })
    );

    // Merge and deduplicate
    let articles = responses
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .filter(Boolean);

    const seen = new Set();
    articles = articles.filter(article => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    });

    // Sort and limit
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    articles = articles.slice(0, pageSize);

    // Cache results
    cache.set(cacheKey, articles);

    res.json({
      ok: true,
      fromCache: false,
      location,
      total: articles.length,
      data: articles
    });

  } catch (error) {
    console.error('Local news fetch error:', error);

    res.status(500).json({
      ok: false,
      error: 'Failed to fetch local news',
      location: req.query.location || 'Delhi',
      data: []
    });
  }
};

// ============================================================
// SUMMARY ENDPOINT (for future AI enhancement)
// ============================================================
exports.summary = async (req, res) => {
  try {
    const { url, text } = req.body;

    if (!url && !text) {
      return res.status(400).json({
        ok: false,
        error: 'Provide url or text to summarize'
      });
    }

    // If Gemini is available, use it
    if (geminiModel && text) {
      const summary = await enhanceWithGemini(text);
      return res.json({
        ok: true,
        summary: summary || 'Summary generation in progress...'
      });
    }

    return res.json({
      ok: true,
      summary: 'AI summary feature available with Gemini API key'
    });

  } catch (error) {
    console.error('Summary error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Summary generation failed'
    });
  }
};