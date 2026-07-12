// newsProxyController.js
// Self-hosted RSS proxy. Fetches Google News RSS directly server-side,
// parses the XML, and returns clean, XSS-sanitized JSON. Replaces the old
// dependency on the third-party rss2json.com service: no external quota
// limits, no third-party uptime dependency, no CORS issue (fetch happens
// server-side), and all untrusted feed text is escaped before it can reach
// the DOM. Zero third-party API key required.

const NodeCache = require('node-cache');

// Cache RSS results for 30 minutes to stay well under Google News' request
// tolerance and keep serverless invocations cheap.
const proxyCache = new NodeCache({ stdTTL: 1800 });

// HTTP cache headers for any CDN/edge in front of the API.
const RSS_CACHE_CONTROL = 's-maxage=1800, stale-while-revalidate=3600';

/**
 * GET /api/news-proxy?industry=&city=&materials=
 *
 * Query params:
 *   industry  — business type / industry label
 *   city      — city to localise the search
 *   materials — space- or comma-separated items/materials to track
 *
 * Response:
 *   200 { ok, news: [{headline, summary, source, link, time, category, impact, sentiment, signal, relevantItem, url}], provider }
 *   Always returns 200 even on failure so the frontend's fallback chain
 *   degrades gracefully; a `provider` of "rss-proxy-failed" signals trouble.
 */
exports.fetchNewsProxy = async (req, res) => {
  const result = await fetchGoogleNewsRss({
    industry: req.query.industry,
    city: req.query.city,
    materials: req.query.materials,
  });

  if (result.invalidQuery) {
    return res.status(400).json({
      ok: false,
      error: 'At least one of industry, city, or materials is required.',
    });
  }

  res.setHeader('Cache-Control', RSS_CACHE_CONTROL);
  // A failed RSS request deliberately returns an empty list: callers must
  // fall back to their clearly-labelled cache, never generated "news".
  return res.status(200).json({
    ok: true,
    news: result.news,
    provider: result.provider,
    cached: result.cached,
    ...(result.error ? { error: result.error } : {}),
  });
};

/**
 * Fetches only publisher-backed RSS entries. This helper is shared by the
 * dashboard news route, so the primary feed cannot be replaced by an AI
 * generated article when a model is unavailable or wrong.
 */
async function fetchGoogleNewsRss({ industry = '', city = '', materials = '' } = {}) {
  const normalizedIndustry = String(industry || '').trim();
  const normalizedCity = String(city || '').trim();
  const materialsList = (Array.isArray(materials) ? materials.join(' ') : String(materials || ''))
    .split(/[,\s]+/)
    .map(material => material.trim())
    .filter(Boolean)
    .slice(0, 12);

  // Cap query length so a hostile/oversized request can't build a huge URL.
  const querySeed = [
    normalizedIndustry,
    materialsList.slice(0, 4).join(' '),
    'business',
    'India',
    normalizedCity,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 200);

  if (!querySeed) {
    return { news: [], provider: 'rss-proxy-failed', cached: false, invalidQuery: true };
  }

  const cacheKey = [normalizedIndustry, normalizedCity, materialsList.join(',')]
    .map(part => String(part).toLowerCase().trim())
    .join('|');
  const cached = proxyCache.get(cacheKey);
  if (cached && cached.length) {
    return { news: cached, provider: 'rss-proxy', cached: true };
  }

  const query = encodeURIComponent(querySeed);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewszoidBot/1.0)' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status}`);
    }

    const xml = await response.text();
    const itemsList = parseRssXml(xml).slice(0, 15).map(item => {
      const headline = sanitizeText(item.title);
      const source = sanitizeText(item.source || 'Google News');
      const link = sanitizeExternalUrl(item.link);

      return {
        headline,
        summary: headline, // RSS <item> has no summary; never invent one.
        source,
        link,
        url: link,
        time: item.pubDate,
        category: categorize(item.title),
        impact: classifyImpact(item.title),
        sentiment: classifySentiment(item.title),
        signal: `Read more from ${source}`,
        relevantItem: findRelevantItem(item.title, materialsList),
      };
    });

    proxyCache.set(cacheKey, itemsList);
    return { news: itemsList, provider: 'rss-proxy', cached: false };
  } catch (error) {
    console.error('[News Proxy] Failed:', error.message);
    return {
      news: [],
      provider: 'rss-proxy-failed',
      cached: false,
      error: 'News feed temporarily unavailable',
    };
  }
}

// Exposed for unit testing.
exports.fetchGoogleNewsRss = fetchGoogleNewsRss;
exports._internal = {
  parseRssXml,
  extractTag,
  sanitizeText,
  sanitizeExternalUrl,
  categorize,
  classifyImpact,
  classifySentiment,
  findRelevantItem,
};

// ─── Minimal, dependency-free XML parser for RSS <item> blocks ───
// Robust against CDATA and attributes inside tags. Intentionally tiny — we
// only need <title>, <link>, <pubDate> and <source> from Google News.
function parseRssXml(xml) {
  const items = [];
  const itemBlocks = String(xml || '').split('<item>').slice(1);

  for (const block of itemBlocks) {
    const endIdx = block.indexOf('</item>');
    const slice = endIdx === -1 ? block : block.slice(0, endIdx);
    const title = extractTag(slice, 'title');
    const link = extractLink(slice);
    const pubDate = extractTag(slice, 'pubDate');
    const source = extractTag(slice, 'source');
    if (title) items.push({ title, link, pubDate, source });
  }
  return items;
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return '';
  return decodeEntities(match[1]).trim();
}

// <link> in Google News RSS is often a bare text URL after the tag (no
// closing </link> in some feeds), so handle both shapes.
function extractLink(block) {
  const selfClosed = block.match(/<link[^>]*\/>/);
  if (selfClosed) {
    return '';
  }
  const matched = extractTag(block, 'link');
  if (matched) return matched;
  const bare = block.match(/<link[^>]*>([^<\r\n]+)/);
  return bare ? bare[1].trim() : '';
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

// ─── Sanitize before ever reaching the frontend — never trust external text ───
// Escape angle brackets and cap length. The frontend also renders via
// textContent, so this is defence-in-depth against XSS from feeds.
function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

function sanitizeExternalUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function categorize(title = '') {
  const t = title.toLowerCase();
  if (/price|rate|cost|₹|cheap|expensive|hike|surge|drop/.test(t)) return 'PRICE';
  if (/policy|govt|government|scheme|tax|gst|duty|tariff|budget|regulation/.test(t)) return 'POLICY';
  if (/demand|export|import|shortage|surplus|shipment|customs/.test(t)) return 'TRADE';
  if (/infrastructure|project|construction|housing|highway/.test(t)) return 'DEMAND';
  return 'INDUSTRY';
}

function classifyImpact(title = '') {
  const t = title.toLowerCase();
  if (/surge|spike|crash|ban|crisis|alert|critical|emergency|record/.test(t)) return 'HIGH';
  if (/drop|rise|change|update|new|plan|announce|hike/.test(t)) return 'MEDIUM';
  return 'LOW';
}

function classifySentiment(title = '') {
  const t = title.toLowerCase();
  if (/drop|crash|decline|fall|risk|ban|negative|concern|worry|slump/.test(t)) return 'BEARISH';
  if (/rise|grow|boost|opportunity|positive|expansion|invest|record high/.test(t)) return 'BULLISH';
  return 'WATCH';
}

function findRelevantItem(title = '', materials = []) {
  if (!materials.length) return 'General';
  const t = title.toLowerCase();
  const matches = materials.filter(m => t.includes(String(m).toLowerCase()));
  return matches.length ? matches.join(', ') : 'General';
}
