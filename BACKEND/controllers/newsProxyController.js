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
    topic: req.query.topic,
    bypassCache: req.query.fresh === '1',
  });

  if (result.invalidQuery) {
    return res.status(400).json({
      ok: false,
      error: 'At least one of industry, city, materials, or topic is required.',
    });
  }

  res.setHeader('Cache-Control', req.query.fresh === '1' ? 'no-store' : RSS_CACHE_CONTROL);
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
async function fetchGoogleNewsRss({ industry = '', city = '', materials = '', topic = '', bypassCache = false } = {}) {
  const normalizedIndustry = String(industry || '').trim();
  const normalizedCity = String(city || '').trim();
  const normalizedTopic = String(topic || '').trim().slice(0, 200);
  const materialsList = (Array.isArray(materials) ? materials.join(' ') : String(materials || ''))
    .split(/[,\s]+/)
    .map(material => material.trim())
    .filter(Boolean)
    .slice(0, 12);

  const searchQueries = buildSearchQueries({
    industry: normalizedIndustry,
    city: normalizedCity,
    materials: materialsList,
    topic: normalizedTopic,
  });

  if (!searchQueries.length) {
    return { news: [], provider: 'rss-proxy-failed', cached: false, invalidQuery: true };
  }

  const cacheKey = [normalizedIndustry, normalizedCity, materialsList.join(','), normalizedTopic]
    .map(part => String(part).toLowerCase().trim())
    .join('|');
  const cached = proxyCache.get(cacheKey);
  if (!bypassCache && cached && cached.length) {
    return { news: cached, provider: 'rss-proxy', cached: true };
  }

  let lastError = null;
  let receivedResponse = false;
  const queryDeadline = Date.now() + 5000;

  // A fully-specific query often has zero Google News results (for example,
  // an industry + five materials + city). Try the exact query first, then a
  // broader industry/material market query so a healthy feed does not look
  // like an outage to the dashboard.
  for (const querySeed of searchQueries) {
    const timeRemaining = queryDeadline - Date.now();
    if (timeRemaining <= 0) break;

    const query = encodeURIComponent(querySeed);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(3500, timeRemaining));
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

      receivedResponse = true;
      const itemsList = parseRssXml(await response.text())
        .filter(item => isRecentPublishedItem(item.pubDate))
        .slice(0, 15)
        .map(item => {
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

      if (itemsList.length) {
        proxyCache.set(cacheKey, itemsList);
        return { news: itemsList, provider: 'rss-proxy', cached: false };
      }
    } catch (error) {
      lastError = error;
      console.error('[News Proxy] Failed:', error.message);
    }
  }

  if (receivedResponse) {
    return { news: [], provider: 'rss-proxy', cached: false };
  }

  return {
    news: [],
    provider: 'rss-proxy-failed',
    cached: false,
    error: lastError ? 'News feed temporarily unavailable' : undefined,
  };
}

function buildSearchQueries({ industry = '', city = '', materials = [], topic = '' } = {}) {
  const normalizedIndustry = String(industry || '').trim();
  const normalizedCity = String(city || '').trim();
  const normalizedTopic = String(topic || '').trim();
  const materialsList = (Array.isArray(materials) ? materials : [])
    .map(material => String(material || '').trim())
    .filter(Boolean);
  const subject = normalizedIndustry || materialsList.slice(0, 2).join(' ');

  const candidates = [
    [normalizedIndustry, materialsList.slice(0, 2).join(' '), 'business India', normalizedCity]
      .filter(Boolean)
      .join(' '),
    [subject, 'market India'].filter(Boolean).join(' '),
    [materialsList[0], 'market India'].filter(Boolean).join(' '),
  ];

  if (normalizedTopic) {
    candidates.push(
      [subject, normalizedTopic, 'India'].filter(Boolean).join(' '),
      [normalizedTopic, 'India'].filter(Boolean).join(' ')
    );
  }

  return [...new Set(candidates.map(query => query.slice(0, 200)).filter(Boolean))];
}

function isRecentPublishedItem(value) {
  const publishedAt = Date.parse(String(value || ''));
  // Keep entries with an unreadable RSS date, but reject dated reports that
  // are older than 45 days or implausibly far in the future.
  if (!Number.isFinite(publishedAt)) return true;
  const now = Date.now();
  return publishedAt >= now - 45 * 24 * 60 * 60 * 1000 && publishedAt <= now + 24 * 60 * 60 * 1000;
}

// Exposed for unit testing.
exports.fetchGoogleNewsRss = fetchGoogleNewsRss;
exports._internal = {
  parseRssXml,
  extractTag,
  sanitizeText,
  isRecentPublishedItem,
  sanitizeExternalUrl,
  categorize,
  classifyImpact,
  classifySentiment,
  findRelevantItem,
  buildSearchQueries,
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
