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
  return {
    item: compactText(rate?.item || rate?.material || rate?.name, 100),
    currentPrice: compactText(rate?.currentPrice, 40),
    unit: compactText(rate?.unit, 40),
    deltaPercent: Number.isFinite(Number(rate?.deltaPercent))
      ? Number(rate.deltaPercent)
      : null,
    market: compactText(rate?.market || rate?.location, 100),
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

    const systemPrompt = `You are a senior business analyst at Newszoid. Create a polished morning briefing for a ${context.businessType} business in ${context.city}. Use ONLY the supplied rate and news evidence. Do not invent prices, sources, policy changes, or demand claims. Keep it under 220 words and return clean HTML only. Use exactly these sections: <h2>Market snapshot</h2>, <h2>What to watch</h2>, and <h2>Recommended action</h2>. Under each heading use one concise <p> or a short <ul>. Do not repeat the business name as a heading.`;
    const userPrompt = `Create today's briefing from this verified context. If a section has no evidence, say that no verified update is available rather than guessing.\n\nTracked materials: ${JSON.stringify(safeItems)}\n\nCurrent rates: ${JSON.stringify(safeRates)}\n\nPublisher-backed news: ${JSON.stringify(safeNews)}`;
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
