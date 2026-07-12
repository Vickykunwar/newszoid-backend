const sanitizeHtml = require('sanitize-html');
const { getAIResponse } = require('../../lib/ai-router');

function sanitizeBrief(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br'],
    allowedAttributes: {},
  });
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
    const safeItems = Array.isArray(items) ? items.slice(0, 10) : [];
    const safeRates = Array.isArray(currentRates) ? currentRates.slice(0, 20) : [];
    const safeNews = Array.isArray(recentNews) ? recentNews.slice(0, 20) : [];
    const context = {
      rates: safeRates,
      news: safeNews,
      businessName: String(name || 'Business Owner').slice(0, 100),
    };

    const systemPrompt = `You are a senior business analyst at Newszoid. Write a BUSINESS INTELLIGENCE BRIEF for a ${businessType} in ${city} focusing on ${safeItems.slice(0, 3).join(', ')}. Keep it extremely concise (max 200 words). Format as HTML with <h2> headers.`;
    const userPrompt = 'Generate today\'s morning brief based on the supplied rate and news context.';
    const result = await getAIResponse(userPrompt, context, {
      systemPrompt,
      cacheKey: `brief_${businessType}_${city}`,
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
