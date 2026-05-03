const { GoogleGenerativeAI } = require('@google/generative-ai');
const NodeCache = require('node-cache');
const sanitizeHtml = require('sanitize-html');
const BusinessProfile = require('../models/BusinessProfile');
const RateSnapshot = require('../models/RateSnapshot');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL_CANDIDATES = (
  process.env.GEMINI_MODEL_CANDIDATES || 'gemini-2.5-flash,gemini-2.0-flash'
)
  .split(',')
  .map(model => model.trim())
  .filter(Boolean);

const newsCache = new NodeCache({ stdTTL: 1800 });
const ratesCache = new NodeCache({ stdTTL: 900 });
const analystCache = new NodeCache({ stdTTL: 7200 });

const ALERT_THRESHOLDS = {
  highPercent: 5,
  mediumPercent: 2,
};

function today() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function cacheKey(...parts) {
  return parts.map(part => String(part).toLowerCase().trim()).join('|');
}

function snapshotDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeItemKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toPositiveNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const cleaned = String(value || '')
    .replace(/[^0-9.-]+/g, '')
    .trim();
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function findBestRequestedItemMatch(candidate, requestedItems) {
  if (!requestedItems.length) return String(candidate || '').trim();
  if (requestedItems.length === 1) return requestedItems[0];

  const candidateKey = normalizeItemKey(candidate);
  if (!candidateKey) return '';

  let bestItem = '';
  let bestScore = -1;

  for (const requestedItem of requestedItems) {
    const requestedKey = normalizeItemKey(requestedItem);
    if (!requestedKey) continue;

    if (requestedKey === candidateKey) {
      return requestedItem;
    }

    let score = 0;
    if (requestedKey.includes(candidateKey) || candidateKey.includes(requestedKey)) {
      score += 3;
    }

    const requestedTokens = new Set(requestedKey.split(' '));
    const candidateTokens = candidateKey.split(' ');
    score += candidateTokens.filter(token => requestedTokens.has(token)).length;

    if (score > bestScore) {
      bestScore = score;
      bestItem = requestedItem;
    }
  }

  return bestScore > 0 ? bestItem : '';
}

function resolveRateItemLabel(entry, requestedItems, index) {
  const directMatch = findBestRequestedItemMatch(entry.item, requestedItems);

  if (directMatch) {
    const candidateKey = normalizeItemKey(entry.item);
    const requestedKey = normalizeItemKey(directMatch);
    const candidateTokens = candidateKey ? candidateKey.split(' ') : [];
    const looksLikeWholeList =
      requestedItems.length > 1 &&
      candidateTokens.length > Math.max(requestedKey.split(' ').length + 3, 6) &&
      requestedItems.filter(item => candidateKey.includes(normalizeItemKey(item))).length > 1;

    if (!looksLikeWholeList) {
      return directMatch;
    }
  }

  return requestedItems[index] || directMatch || String(entry.item || '').trim();
}

function toConfidence(value, hasSourceUrl) {
  const normalized = String(value || '').toUpperCase();
  if (['HIGH', 'MEDIUM', 'LOW'].includes(normalized)) return normalized;
  return hasSourceUrl ? 'MEDIUM' : 'LOW';
}

function sanitizeSourceUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return '';
  return raw;
}

function computeDelta(currentPrice, previousPrice) {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice) || previousPrice <= 0) {
    return {
      prevPrice: currentPrice,
      delta: 0,
      deltaPercent: 0,
      trend: 'FLAT',
    };
  }

  const delta = +(currentPrice - previousPrice).toFixed(2);
  const deltaPercent = +((delta / previousPrice) * 100).toFixed(1);
  let trend = 'FLAT';

  if (delta > 0.001) trend = 'UP';
  if (delta < -0.001) trend = 'DOWN';

  return {
    prevPrice: previousPrice,
    delta,
    deltaPercent,
    trend,
  };
}

function severityRank(severity) {
  return { HIGH: 3, MEDIUM: 2, LOW: 1 }[severity] || 0;
}

function buildHistorySeries(historyDocs) {
  const chronological = historyDocs.slice().reverse();

  return chronological.map((doc, index) => {
    const previous = chronological[index - 1];
    const deltaInfo = previous ? computeDelta(doc.currentPrice, previous.currentPrice) : null;

    return {
      snapshotDate: doc.snapshotDate,
      price: doc.currentPrice,
      unit: doc.unit,
      market: doc.market,
      fetchedAt: doc.fetchedAt,
      sourceName: doc.sourceName,
      delta: deltaInfo ? deltaInfo.delta : 0,
      deltaPercent: deltaInfo ? deltaInfo.deltaPercent : 0,
      trend: deltaInfo ? deltaInfo.trend : 'FLAT',
    };
  });
}

function buildHistoryStats(history) {
  const prices = history
    .map(point => Number(point.price))
    .filter(price => Number.isFinite(price));

  if (!prices.length) {
    return {
      points: 0,
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      rangePercent: 0,
    };
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = +(prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
  const rangePercent = minPrice > 0 ? +(((maxPrice - minPrice) / minPrice) * 100).toFixed(1) : 0;

  return {
    points: prices.length,
    minPrice,
    maxPrice,
    avgPrice,
    rangePercent,
  };
}

function buildPriceAlert({ rate, deltaInfo, previousSnapshot, historyStats, now }) {
  const absPercent = Math.abs(deltaInfo.deltaPercent || 0);

  if (!previousSnapshot) {
    return {
      triggered: false,
      type: 'FIRST_SNAPSHOT',
      severity: 'LOW',
      title: `${rate.item} tracking started`,
      message: `First saved rate snapshot for ${rate.item}. Alerts will activate after the next verified snapshot.`,
      action: 'Keep this item in your tracker',
      createdAt: now.toISOString(),
    };
  }

  if (absPercent >= ALERT_THRESHOLDS.highPercent) {
    const rising = deltaInfo.trend === 'UP';

    return {
      triggered: true,
      type: rising ? 'PRICE_SPIKE' : 'PRICE_DROP',
      severity: 'HIGH',
      title: `${rate.item} ${rising ? 'price spike' : 'price drop'}`,
      message: `${rate.item} moved ${rising ? 'up' : 'down'} ${absPercent.toFixed(1)}% from the last saved snapshot.`,
      action: rising ? 'Review buying plan before costs climb further' : 'Check if this is a buying opportunity',
      createdAt: now.toISOString(),
    };
  }

  if (absPercent >= ALERT_THRESHOLDS.mediumPercent) {
    const rising = deltaInfo.trend === 'UP';

    return {
      triggered: true,
      type: rising ? 'PRICE_RISING' : 'PRICE_SOFTENING',
      severity: 'MEDIUM',
      title: `${rate.item} moved ${rising ? 'higher' : 'lower'}`,
      message: `${rate.item} changed ${absPercent.toFixed(1)}% against your last saved rate.`,
      action: rising ? 'Monitor quotes before the next purchase' : 'Compare supplier offers today',
      createdAt: now.toISOString(),
    };
  }

  return {
    triggered: false,
    type: 'STABLE',
    severity: historyStats.rangePercent >= ALERT_THRESHOLDS.highPercent ? 'MEDIUM' : 'LOW',
    title: `${rate.item} is stable`,
    message: `${rate.item} stayed within ${ALERT_THRESHOLDS.mediumPercent}% of the last saved snapshot.`,
    action: 'No urgent action needed',
    createdAt: now.toISOString(),
  };
}

function buildNotificationSummary(rates) {
  return rates
    .filter(rate => rate.alert && rate.alert.triggered)
    .map(rate => ({
      id: `${rate.itemKey || normalizeItemKey(rate.item)}-${rate.snapshotDate}`,
      item: rate.item,
      unit: rate.unit,
      currentPrice: rate.currentPrice,
      prevPrice: rate.prevPrice,
      delta: rate.delta,
      deltaPercent: rate.deltaPercent,
      trend: rate.trend,
      alert: rate.alert,
    }))
    .sort((a, b) => severityRank(b.alert.severity) - severityRank(a.alert.severity));
}

function normalizeRatesResponse(raw, requestedItems, city) {
  const parsed = parseJSON(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry, index) => {
      const itemLabel = resolveRateItemLabel(entry, requestedItems, index);
      const currentPrice = toPositiveNumber(entry.currentPrice);
      const sourceUrl = sanitizeSourceUrl(entry.sourceUrl);

      if (!itemLabel || currentPrice == null) {
        return null;
      }

      return {
        item: String(itemLabel).trim(),
        itemKey: normalizeItemKey(itemLabel),
        unit: String(entry.unit || 'Rs/unit').trim(),
        currentPrice,
        market: String(entry.market || city).trim(),
        note: String(entry.note || '').trim(),
        confidence: toConfidence(entry.confidence, Boolean(sourceUrl)),
        sourceName: String(entry.sourceName || entry.source || 'Web source').trim(),
        sourceUrl,
        sourceDate: String(entry.sourceDate || '').trim(),
      };
    })
    .filter(Boolean);
}

async function buildTrackedRates({ businessType, city, items, fetchedRates }) {
  const todayKey = snapshotDateKey();
  const now = new Date();

  const trackedRates = await Promise.all(
    fetchedRates.map(async rate => {
      await RateSnapshot.findOneAndUpdate(
        {
          itemKey: rate.itemKey,
          businessType,
          city,
          snapshotDate: todayKey,
        },
        {
          itemName: rate.item,
          itemKey: rate.itemKey,
          businessType,
          city,
          snapshotDate: todayKey,
          fetchedAt: now,
          unit: rate.unit,
          currentPrice: rate.currentPrice,
          market: rate.market,
          note: rate.note,
          confidence: rate.confidence,
          sourceName: rate.sourceName,
          sourceUrl: rate.sourceUrl,
          sourceDate: rate.sourceDate,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const previousSnapshot = await RateSnapshot.findOne({
        itemKey: rate.itemKey,
        businessType,
        city,
        snapshotDate: { $lt: todayKey },
      }).sort({ snapshotDate: -1, fetchedAt: -1 });

      const historyDocs = await RateSnapshot.find({
        itemKey: rate.itemKey,
        businessType,
        city,
      })
        .sort({ snapshotDate: -1, fetchedAt: -1 })
        .limit(7)
        .lean();

      const history = buildHistorySeries(historyDocs);
      const historyStats = buildHistoryStats(history);

      const deltaInfo = computeDelta(
        rate.currentPrice,
        previousSnapshot ? previousSnapshot.currentPrice : rate.currentPrice
      );
      const alert = buildPriceAlert({
        rate,
        deltaInfo,
        previousSnapshot,
        historyStats,
        now,
      });

      return {
        item: rate.item,
        itemKey: rate.itemKey,
        unit: rate.unit,
        currentPrice: rate.currentPrice,
        prevPrice: deltaInfo.prevPrice,
        delta: deltaInfo.delta,
        deltaPercent: deltaInfo.deltaPercent,
        trend: deltaInfo.trend,
        market: rate.market,
        note: rate.note,
        confidence: previousSnapshot ? rate.confidence : 'LOW',
        sourceName: rate.sourceName,
        sourceUrl: rate.sourceUrl,
        sourceDate: rate.sourceDate,
        fetchedAt: now.toISOString(),
        snapshotDate: todayKey,
        comparisonLabel: previousSnapshot
          ? `Compared with ${previousSnapshot.snapshotDate}`
          : 'First verified snapshot',
        history,
        historyStats,
        alert,
        verified: Boolean(rate.sourceUrl),
      };
    })
  );

  return trackedRates;
}

function sanitizeOutput(htmlStr) {
  if (!htmlStr) return htmlStr;

  return sanitizeHtml(htmlStr, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style'],
    },
  });
}

function parseJSON(raw) {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');

    if (start === -1 || end === -1) {
      throw new Error('No JSON array found');
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function classifyError(err) {
  const msg = (err.message || '').toLowerCase();

  if (msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand')) {
    return 'overloaded';
  }

  if (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('too many requests') ||
    msg.includes('resource_exhausted')
  ) {
    return 'quota';
  }

  if (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('not supported for generatecontent') ||
    msg.includes('is not found for api version')
  ) {
    return 'invalid_model';
  }

  return 'fatal';
}

async function generateWithGemini({ systemPrompt, userPrompt, useSearch = false }) {
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const options = {
          model: modelName,
          systemInstruction: systemPrompt,
        };

        if (useSearch) {
          options.tools = [{ googleSearch: {} }];
        }

        const model = genAI.getGenerativeModel(options);
        const result = await model.generateContent(userPrompt);

        console.log(`Gemini request succeeded with ${modelName}`);
        return result.response.text();
      } catch (err) {
        const kind = classifyError(err);

        if (kind === 'overloaded' && attempt < 3) {
          console.warn(`${modelName} overloaded, retry ${attempt}/3 in ${attempt * 2}s...`);
          await sleep(attempt * 2000);
          continue;
        }

        if (kind === 'overloaded' || kind === 'quota' || kind === 'invalid_model') {
          console.warn(`${modelName} skipped (${kind}), trying next model...`);
          break;
        }

        throw err;
      }
    }
  }

  throw new Error('All configured Gemini models are unavailable right now. Please try again shortly.');
}

async function callGemini(systemPrompt, userPrompt) {
  return generateWithGemini({ systemPrompt, userPrompt });
}

async function callGeminiWithSearch(systemPrompt, userPrompt) {
  return generateWithGemini({ systemPrompt, userPrompt, useSearch: true });
}

exports.fetchNews = async (req, res) => {
  try {
    const { businessType, city, items = [] } = req.body;
    const key = cacheKey('news', businessType, city);
    const cached = newsCache.get(key);

    if (cached) {
      return res.json({ ok: true, news: cached, cached: true });
    }

    const systemPrompt = `You are the Newszoid Business Intelligence Agent. You provide highly personalized industry news to Indian business owners. Use Google Search to find the latest real news from today or this week. Always focus on actionable, relevant news. Return structured data only with no preamble and no markdown headers.`;

    const userPrompt = `Search Google for today's latest real news (${today()}) relevant to a ${businessType} business owner in ${city}, India.
${items.length > 0 ? `This owner uses these materials/items: ${items.join(', ')}. Search for real news about price changes, supply issues, or policy changes for these specific items.` : ''}

Search for real recent news articles and return only a valid JSON array of exactly 6 news objects. Each object must have:
- headline: string (catchy, informative, max 12 words)
- summary: string (2-3 sentences explaining what happened and how it affects this specific business)
- category: one of "PRICE" | "POLICY" | "TRADE" | "INDUSTRY" | "GLOBAL" | "DEMAND"
- impact: one of "HIGH" | "MEDIUM" | "LOW"
- sentiment: one of "BULLISH" | "BEARISH" | "WATCH"
- signal: short action phrase like "Buy before price rise" or "Hold inventory" or "Monitor closely"
- source: publication name and date
- relevantItem: which of their materials this most affects (or "General" if none specific)

Return only the JSON array and no other text.`;

    const raw = await callGeminiWithSearch(systemPrompt, userPrompt);
    const newsArr = parseJSON(raw);

    if (newsArr && newsArr.length > 0) {
      newsCache.set(key, newsArr);
      return res.json({ ok: true, news: newsArr, cached: false });
    }

    return res.json({ ok: true, news: [], rawAnalysis: raw, cached: false });
  } catch (err) {
    console.error('Biz Agent News error:', err.message);
    return res.status(500).json({
      ok: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Could not fetch business news. Please try again.'
          : err.message,
    });
  }
};

exports.fetchRates = async (req, res) => {
  try {
    const { businessType, city, items = [] } = req.body;

    if (!items.length) {
      return res
        .status(400)
        .json({ ok: false, error: 'No items provided. Add your materials in the setup.' });
    }

    const key = cacheKey('rates', businessType, city, items.sort().join(','));
    const cached = ratesCache.get(key);

    if (cached) {
      if (Array.isArray(cached) && cached.length > 0) {
        return res.json({
          ok: true,
          rates: cached,
          notifications: buildNotificationSummary(cached),
          cached: true,
        });
      }

      return res.json({ ok: true, ...cached, cached: true });
    }

    const systemPrompt = `You are a market rate verification agent for Indian business owners. Use Google Search to find source-backed current prices in India. Prefer source URLs from commodity portals, exchanges, market directories, producer catalogs, or credible financial news. Return only valid JSON. Never invent URLs.`;

    const userPrompt = `Search Google right now for current market rates (${today()}) in India for these items used by a ${businessType} business in ${city}: ${items.join(', ')}.

For each item, find the best currently available quoted market price from a real web source. Return exactly one JSON object per item when possible.

Return only a valid JSON array. Each object must contain:
- item: string
- unit: string (example: "Rs/kg", "Rs/ton", "Rs/piece", "Rs/litre")
- currentPrice: number (numeric only, no symbols)
- market: string (actual market or region such as "Haridwar", "Delhi NCR", "National Average")
- note: string (1 sentence explaining what the source shows)
- confidence: "HIGH" | "MEDIUM" | "LOW"
- sourceName: string (publisher/site name)
- sourceUrl: string (full https URL of the source page)
- sourceDate: string (date shown on the source if available, otherwise empty string)

Rules:
- Do not return prevPrice, delta, or trend. The server calculates those from tracked history.
- If a direct quote is unavailable, you may return the best available current listing or report, but mark confidence LOW.
- Do not invent source URLs or prices.

Return only the JSON array with no markdown and no explanation.`;

    const raw = await callGeminiWithSearch(systemPrompt, userPrompt);
    const fetchedRates = normalizeRatesResponse(raw, items, city);
    console.log(`Rates parsed from Gemini: ${fetchedRates.length}/${items.length}`);

    if (fetchedRates.length > 0) {
      const trackedRates = await buildTrackedRates({
        businessType,
        city,
        items,
        fetchedRates,
      });

      console.log(`Rates tracked after normalization: ${trackedRates.length}/${items.length}`);

      if (trackedRates.length > 0) {
        const payload = {
          rates: trackedRates,
          notifications: buildNotificationSummary(trackedRates),
          meta: {
            snapshotDate: snapshotDateKey(),
            comparisonMode: 'tracked-history',
            fetchedAt: new Date().toISOString(),
          },
        };

        ratesCache.set(key, payload);
        return res.json({
          ok: true,
          ...payload,
          cached: false,
        });
      }
    }

    return res.json({ ok: true, rates: [], rawAnalysis: raw, cached: false });
  } catch (err) {
    console.error('Biz Agent Rates error:', err.message);
    return res.status(500).json({
      ok: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Could not fetch rates. Please try again.'
          : err.message,
    });
  }
};

exports.fetchRateHistory = async (req, res) => {
  try {
    const { businessType, city, items = [], days = 30 } = req.body;

    if (!items.length) {
      return res
        .status(400)
        .json({ ok: false, error: 'No items provided. Add your materials in the setup.' });
    }

    const normalizedItems = items.map(item => ({
      item,
      itemKey: normalizeItemKey(item),
    }));
    const itemKeys = normalizedItems.map(item => item.itemKey).filter(Boolean);
    const limit = Math.min(Math.max(Number(days) || 30, 1), 90);

    const docs = await RateSnapshot.find({
      businessType,
      city,
      itemKey: { $in: itemKeys },
    })
      .sort({ snapshotDate: -1, fetchedAt: -1 })
      .limit(itemKeys.length * limit)
      .lean();

    const histories = normalizedItems.map(({ item, itemKey }) => {
      const itemDocs = docs.filter(doc => doc.itemKey === itemKey).slice(0, limit);
      const history = buildHistorySeries(itemDocs);
      const latest = history[history.length - 1] || null;
      const previous = history[history.length - 2] || null;
      const deltaInfo =
        latest && previous ? computeDelta(latest.price, previous.price) : computeDelta(0, 0);

      return {
        item,
        itemKey,
        unit: latest ? latest.unit : 'Rs/unit',
        currentPrice: latest ? latest.price : null,
        prevPrice: previous ? previous.price : null,
        delta: latest && previous ? deltaInfo.delta : 0,
        deltaPercent: latest && previous ? deltaInfo.deltaPercent : 0,
        trend: latest && previous ? deltaInfo.trend : 'FLAT',
        history,
        historyStats: buildHistoryStats(history),
      };
    });

    return res.json({
      ok: true,
      histories,
      meta: {
        days: limit,
        snapshotDate: snapshotDateKey(),
      },
    });
  } catch (err) {
    console.error('Biz Agent Rate History error:', err.message);
    return res.status(500).json({
      ok: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'Could not fetch rate history. Please try again.'
          : err.message,
    });
  }
};

exports.fetchAnalyst = async (req, res) => {
  try {
    const { name, businessType, city, items = [] } = req.body;
    const ownerName = name || 'Business Owner';
    const key = cacheKey('analyst', businessType, city, items.sort().join(','));
    const cached = analystCache.get(key);

    if (cached) {
      return res.json({ ok: true, analysis: cached, cached: true });
    }

    const systemPrompt = `You are a senior business analyst at Newszoid, India's premier business intelligence platform. You provide clear, actionable, personalized analysis for Indian business owners. Be thorough and professional.`;

    const userPrompt = `Business Profile:
- Owner: ${ownerName}
- City: ${city}
- Industry: ${businessType}
- Items/Materials used: ${items.length > 0 ? items.join(', ') : 'general business inputs'}
- Date: ${today()}

Analyze:
1. Current market conditions for ${businessType} in India
2. Price trends for ${items.slice(0, 5).join(', ')} (if listed)
3. Government policy changes affecting ${businessType}
4. Import/export news relevant to ${businessType}
5. Demand outlook for ${businessType} products next 30 days

Write a BUSINESS INTELLIGENCE BRIEF formatted as strict HTML. Do not use Markdown styling. Use <h2> for section headers, <p> for paragraphs, <ul>/<li> for lists, and <strong> for emphasis. Do not wrap the response in code blocks, just return the raw HTML string. Use these exact sections:

<h2>MARKET OVERVIEW</h2>
<p>[2-3 sentences on overall market condition for ${businessType} in India today]</p>

<h2>PRICE ALERT SUMMARY</h2>
<p>[Quick status on key materials: which are rising, falling, stable - and why]</p>

<h2>TOP OPPORTUNITY THIS WEEK</h2>
<p>[1 specific opportunity this business can act on right now]</p>

<h2>TOP RISK THIS WEEK</h2>
<p>[1 specific risk they should watch for]</p>

<h2>YOUR 5-POINT ACTION PLAN</h2>
<ol>
  <li>[Action with specific timing]</li>
  <li>[Action with specific timing]</li>
  <li>[Action with specific timing]</li>
  <li>[Action with specific timing]</li>
  <li>[Action with specific timing]</li>
</ol>

<h2>MARKET OUTLOOK: NEXT 30 DAYS</h2>
<p>[2-3 sentences forecast for ${businessType} sector]</p>

<h2>ZOIDRA RATING</h2>
<p><strong>Business Conditions Score: X/10</strong><br>Reason: [1 sentence reason]</p>`;

    const analysisRaw = await callGemini(systemPrompt, userPrompt);
    const analysis = sanitizeOutput(analysisRaw);

    analystCache.set(key, analysis);
    return res.json({ ok: true, analysis, cached: false });
  } catch (err) {
    console.error('Biz Agent Analyst error:', err.message);
    return res.status(500).json({
      ok: false,
      error:
        process.env.NODE_ENV === 'production'
          ? 'AI analysis failed. Please try again.'
          : err.message,
    });
  }
};

exports.saveProfile = async (req, res) => {
  try {
    const { name, email, gstin, city, businessType, items = [] } = req.body;

    let profile = null;

    if (email) {
      profile = await BusinessProfile.findOne({ email });
    }

    if (profile) {
      profile.ownerName = name;
      profile.gstin = gstin;
      profile.city = city;
      profile.businessType = businessType;
      profile.items = items;
      await profile.save();
    } else {
      profile = await BusinessProfile.create({
        ownerName: name,
        email,
        gstin,
        city,
        businessType,
        items,
      });
    }

    return res.json({
      ok: true,
      profileId: profile._id,
      message: 'Profile saved successfully',
    });
  } catch (err) {
    console.error('Biz Agent Profile Save error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
