const { Redis } = require('@upstash/redis');

let redisClient;
let redisInitialized = false;

function getRedisClient() {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[AI Router] Upstash Redis is not configured; cache disabled.');
    redisClient = null;
    return redisClient;
  }

  try {
    redisClient = Redis.fromEnv();
  } catch (error) {
    console.warn('[AI Router] Redis initialization failed; cache disabled:', error.message);
    redisClient = null;
  }
  return redisClient;
}

async function getAIResponse(prompt, context = {}, options = {}) {
  const cacheKey = options.cacheKey || 'ai_cache_default';
  const systemPrompt = options.systemPrompt ||
    'You are a business intelligence analyst for Indian MSME owners. ' +
    'Be direct, specific, and actionable. Use plain language. Max 200 words.';

  let result = null;
  let usedProvider = null;
  const aiFailed = {
    gemini: !process.env.GEMINI_API_KEY,
    groq: !process.env.GROQ_API_KEY,
  };

  // LAYER 1: Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      result = await withTimeout(signal =>
        callGemini(prompt, systemPrompt, process.env.GEMINI_API_KEY, signal)
      );
      usedProvider = 'gemini';
    } catch (error) {
      aiFailed.gemini = true;
      console.log('[AI Router] Gemini failed:', error.message);
    }
  }

  // LAYER 2: Groq
  if (!result && process.env.GROQ_API_KEY) {
    try {
      result = await withTimeout(signal =>
        callGroq(prompt, systemPrompt, process.env.GROQ_API_KEY, signal)
      );
      usedProvider = 'groq';
    } catch (error) {
      aiFailed.groq = true;
      console.log('[AI Router] Groq failed:', error.message);
    }
  }

  // LAYER 3: Cached AI response
  if (!result) {
    try {
      const redis = getRedisClient();
      const cached = redis ? await redis.get(cacheKey) : null;
      if (cached) {
        result = cached;
        usedProvider = 'cache';
      }
    } catch (error) {
      console.log('[AI Router] Cache read failed:', error.message);
    }
  }

  // LAYER 4: Rule-based engine (zero API key, instant)
  if (!result) {
    result = generateRuleBasedAnalysis(context);
    usedProvider = 'rule-engine';
  }

  if (usedProvider === 'gemini' || usedProvider === 'groq') {
    try {
      const redis = getRedisClient();
      if (redis) await redis.set(cacheKey, result, { ex: 21600 });
    } catch (error) {
      console.log('[AI Router] Cache write failed:', error.message);
    }
  }

  const bothAiFailed = aiFailed.gemini && aiFailed.groq;
  return { text: result, provider: usedProvider, bothAiFailed };
}

async function withTimeout(operation, ms = 8000) {
  const controller = new AbortController();
  let timeout;

  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Provider timeout')), ms);
    });
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function callGemini(prompt, systemPrompt, apiKey, signal) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
      }),
      signal,
    }
  );
  if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty response');
  return text;
}

async function callGroq(prompt, systemPrompt, apiKey, signal) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.4,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Groq returned ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq empty response');
  return text;
}

function generateRuleBasedAnalysis(context = {}) {
  const { rates = [], news = [], businessName = 'your business' } = context;
  const lines = [];
  const normalizedRates = (Array.isArray(rates) ? rates : [])
    .map(rate => ({
      material: rate.material || rate.item || rate.name,
      pct: Number(rate.pct ?? rate.deltaPercent),
    }))
    .filter(rate => rate.material && Number.isFinite(rate.pct));
  const rising = normalizedRates.filter(rate => rate.pct > 2);
  const falling = normalizedRates.filter(rate => rate.pct < -2);

  if (rising.length) {
    const top = rising.sort((a, b) => b.pct - a.pct)[0];
    lines.push(`${top.material} is up ${top.pct}% - consider locking purchases this week.`);
  }
  if (falling.length) {
    const top = falling.sort((a, b) => a.pct - b.pct)[0];
    lines.push(`${top.material} dropped ${Math.abs(top.pct)}% - good window to buy.`);
  }

  const headlines = (Array.isArray(news) ? news : []).map(item => item.headline || item.title || '');
  const tender = headlines.find(headline => /tender|scheme|subsidy|government/i.test(headline));
  if (tender) lines.push(`Opportunity: "${tender}" - worth checking eligibility.`);
  const policy = headlines.find(headline => /import|export|duty|tariff/i.test(headline));
  if (policy) lines.push(`Policy watch: "${policy}" - may affect input costs.`);
  if (!lines.length) lines.push(`No major changes today for ${businessName}. Markets steady.`);

  return lines.join(' ');
}

module.exports = { getAIResponse };
