// Multi-source, regex-only market-rate consensus. This module deliberately
// does not import the AI router: callers provide an optional referee function
// so the helpers remain independently testable and avoid controller cycles.

const SOURCE_WHITELIST = {
  steel: [
    'https://www.steelmint.com/steel-prices',
    'https://www.steelonthenet.com/steel-prices.html',
    'https://www.commodityonline.com/commodity/steel.html',
    'https://www.metal.com/Steel/price',
    'https://www.bigmint.co/steel-prices',
    'https://www.indiainfoline.com/commodities/steel',
    'https://www.mcxindia.com/market-data/spot-market-price',
    'https://www.ibef.org/industry/steel',
  ],
  copper: [
    'https://www.mcxindia.com/market-data/spot-market-price',
    'https://www.metal.com/Copper/price',
    'https://www.commodityonline.com/commodity/copper.html',
    'https://www.moneycontrol.com/commodity/copper-price.html',
    'https://www.goodreturns.in/copper-price.html',
    'https://www.investing.com/commodities/copper',
    'https://www.lme.com/en/Metals/Non-ferrous/Copper',
    'https://www.indiainfoline.com/commodities/copper',
  ],
  cement: [
    'https://www.cementstockmarket.com/cement-prices',
    'https://www.99acres.com/articles/cement-price-in-india.html',
    'https://www.magicbricks.com/blog/cement-price-in-india/',
    'https://www.indiamart.com/proddetail/cement.html',
    'https://www.tradeindia.com/manufacturers/cement.html',
    'https://www.justdial.com/India/Cement-Dealers/nct-10155678',
    'https://www.ibef.org/industry/cement-india',
    'https://www.commodityonline.com/commodity/cement.html',
  ],
};

const CATEGORY_ALIASES = {
  steel: ['steel', 'iron', 'ms sheet', 'tmt', 'rebar'],
  copper: ['copper', 'copper wire', 'copper cable'],
  cement: ['cement', 'opc', 'ppc'],
};

function normalizeItemKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function categoryForItem(item) {
  const normalized = normalizeItemKey(item);
  return Object.entries(CATEGORY_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalized.includes(alias))
  )?.[0] || null;
}

function candidateUrlsForItem(item) {
  const category = categoryForItem(item);
  return category ? SOURCE_WHITELIST[category] : [];
}

function sourceNameFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return 'Consensus web source';
  }
}

function extractCandidatePrices(pageText, item) {
  const text = String(pageText || '').toLowerCase();
  const itemTokens = normalizeItemKey(item).split(' ').filter(token => token.length >= 3);

  if (!itemTokens.some(token => text.includes(token))) return [];

  const priceRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:\/-|\/\s*(?:kg|ton|tonne|piece|litre)|rs\.?|per\s*(?:kg|ton|tonne|piece|litre))/gi;
  const found = [];
  let match;

  while ((match = priceRegex.exec(text)) !== null) {
    const price = Number((match[1] || match[2] || '').replace(/,/g, ''));
    if (Number.isFinite(price) && price > 0) found.push(price);
  }

  return found;
}

function median(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clusterPrices(candidates, tolerancePercent = 2) {
  const sorted = [...candidates].sort((a, b) => a.price - b.price);
  const clusters = [];

  for (const candidate of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      const clusterMedian = median(cluster.map(entry => entry.price));
      const difference = (Math.abs(candidate.price - clusterMedian) / clusterMedian) * 100;
      if (difference <= tolerancePercent) {
        cluster.push(candidate);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([candidate]);
  }

  return clusters.sort((a, b) => b.length - a.length);
}

function resolveConsensusRate(candidates, totalSourcesChecked) {
  if (!candidates.length) {
    return {
      price: null,
      confidence: 'LOW',
      agreementCount: 0,
      totalSourcesChecked,
      agreeingSources: [],
      needsAiReferee: false,
    };
  }

  const clusters = clusterPrices(candidates);
  const winner = clusters[0];
  const agreementCount = winner.length;
  const agreementRatio = totalSourcesChecked > 0 ? agreementCount / totalSourcesChecked : 0;
  const confidence = agreementRatio >= 0.6 ? 'HIGH' : agreementRatio >= 0.35 ? 'MEDIUM' : 'LOW';

  return {
    price: median(winner.map(entry => entry.price)),
    confidence,
    agreementCount,
    totalSourcesChecked,
    agreeingSources: winner.map(entry => entry.source),
    needsAiReferee: clusters.length > 1 && clusters[1].length >= agreementCount * 0.6,
  };
}

async function fetchAndExtract(url, item) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewszoidRateBot/1.0)' },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = await response.text();
    const text = body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 500000);
    const prices = extractCandidatePrices(text, item);
    if (!prices.length) return null;

    return { source: sourceNameFromUrl(url), price: median(prices), url };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchConsensusRate(item, candidateUrls, { aiReferee } = {}) {
  const urls = Array.isArray(candidateUrls) ? candidateUrls.slice(0, 12) : [];
  const results = await Promise.all(urls.map(url => fetchAndExtract(url, item)));
  const candidates = results.filter(Boolean);
  const consensus = resolveConsensusRate(candidates, urls.length);

  if (consensus.needsAiReferee && typeof aiReferee === 'function') {
    try {
      consensus.aiAdjudication = await aiReferee(
        'You are a data-quality referee. Given price candidates from multiple sources, pick which cluster is more credible and explain briefly in one sentence.',
        JSON.stringify(candidates)
      );
    } catch (error) {
      console.warn(`[Rates] Consensus AI referee unavailable: ${error.message}`);
    }
  }

  return consensus;
}

exports.SOURCE_WHITELIST = SOURCE_WHITELIST;
exports.candidateUrlsForItem = candidateUrlsForItem;
exports.fetchConsensusRate = fetchConsensusRate;
exports._internal = {
  normalizeItemKey,
  categoryForItem,
  extractCandidatePrices,
  median,
  clusterPrices,
  resolveConsensusRate,
  fetchAndExtract,
};
