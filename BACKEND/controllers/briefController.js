const sanitizeHtml = require('sanitize-html');
const crypto = require('crypto');
const { callAIWithFallback } = require('./bizAgentController');

function sanitizeBrief(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br'],
    allowedAttributes: {},
  });
}

function compactText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeBriefRate(rate) {
  const history = Array.isArray(rate?.history)
    ? rate.history
        .slice(-3)
        .map(point => ({
          date: compactText(point?.date, 20),
          price: Number.isFinite(Number(point?.rate)) ? Number(point.rate) : null,
          source: compactText(point?.source, 80),
        }))
        .filter(point => point.price !== null)
    : [];

  return {
    item: compactText(rate?.item || rate?.material || rate?.name, 100),
    currentPrice: compactText(rate?.currentPrice, 40),
    unit: compactText(rate?.unit, 40),
    deltaPercent: Number.isFinite(Number(rate?.deltaPercent))
      ? Number(rate.deltaPercent)
      : null,
    market: compactText(rate?.market || rate?.location, 100),
    sourceName: compactText(rate?.sourceName, 100),
    // Oldest -> newest, capped to 3 points (today, yesterday, day-before).
    history,
  };
}

function normalizeBriefNews(item) {
  return {
    headline: compactText(item?.headline || item?.title, 240),
    summary: compactText(item?.summary || item?.description, 360),
    category: compactText(item?.category, 40),
    source: compactText(item?.source, 100),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      businessType = 'your business',
      city = '',
      items = [],
      name = 'Business Owner',
      currentRates = [],
      recentNews = [],
    } = req.body || {};
    const safeItems = Array.isArray(items)
      ? items.map(item => compactText(item, 100)).filter(Boolean).slice(0, 10)
      : [];
    const safeRates = Array.isArray(currentRates)
      ? currentRates.map(normalizeBriefRate).filter(rate => rate.item).slice(0, 20)
      : [];
    const safeNews = Array.isArray(recentNews)
      ? recentNews.map(normalizeBriefNews).filter(item => item.headline).slice(0, 20)
      : [];
    const context = {
      rates: safeRates,
      news: safeNews,
      businessName: String(name || 'Business Owner').slice(0, 100),
      businessType: String(businessType || 'your business').slice(0, 150),
      city: String(city || '').slice(0, 100),
      items: safeItems,
    };

    const systemPrompt = `You are a senior business analyst at Newszoid writing a morning briefing for a ${context.businessType} business in ${context.city}. Use ONLY the supplied rate history and news evidence — never invent prices, dates, sources, or reasons for a price move. Return clean HTML only, under 260 words, with exactly these sections in this order:
<h2>Today's Rates</h2> — one <ul><li> per tracked material. Each line must state: material name, today's price, yesterday's price and day-before price if available (write "no prior snapshot yet" if history has fewer than 2 points), the % change, and a one-sentence WHY. The WHY must be drawn only from the supplied news array — pick the closest matching headline. If nothing in the news evidence plausibly explains the move, write exactly: "No verified reason in today's sources" — do not guess or generalize.
<h2>What This Means For You</h2> — 1-2 sentences translating the rate moves into a business impact.
<h2>Recommended Action</h2> — one concrete, time-bound action.
Do not repeat the business name as a heading. Do not add a section if there is no rate or news data to support it — say so briefly instead.`;
    const userPrompt = `Build today's briefing from this verified context only.

Tracked materials: ${JSON.stringify(safeItems)}

Rate history (oldest to newest per item, this is your ONLY source for today/yesterday/day-before prices): ${JSON.stringify(safeRates)}

Publisher-backed news (this is your ONLY source for reasons): ${JSON.stringify(safeNews)}`;
    const contentHash = crypto
      .createHash('sha1')
      .update(JSON.stringify({ rates: safeRates, news: safeNews }))
      .digest('hex')
      .slice(0, 10);
    const result = await callAIWithFallback(systemPrompt, userPrompt, {
      context,
      cacheKey: `brief_v2_${String(businessType).slice(0, 150)}_${String(city).slice(0, 100)}_${contentHash}`,
    });

    return res.status(200).json({
      brief: sanitizeBrief(result.text),
      provider: result.provider,
      bothAiFailed: result.bothAiFailed,
      suggestRssFallback: result.bothAiFailed,
    });
  } catch (error) {
    console.error('Brief generation failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
