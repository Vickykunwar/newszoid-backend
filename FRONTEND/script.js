let STATE = {
  name: '',
  city: '',
  email: '',
  gstin: '',
  biz: '',
  items: []
};

const API_BASE_URL = (window.NEWSZOID_CONFIG?.API_BASE_URL || '').replace(/\/$/, '');

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('bizProfile');
  if (saved) {
    try {
      STATE = JSON.parse(saved);
      document.getElementById('setup-screen').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      setupDashboard();
      fetchNews();
    } catch (e) {
      console.error('Error loading saved profile', e);
    }
  }
});

function today() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function todayShort() {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase() || '?';
}

function parseItems(raw) {
  const itemEndWords = new Set([
    'acid',
    'bar',
    'board',
    'cement',
    'chemical',
    'coil',
    'compound',
    'granule',
    'granules',
    'ingot',
    'oil',
    'paint',
    'pipe',
    'plate',
    'powder',
    'primer',
    'rod',
    'sand',
    'sheet',
    'strip',
    'wire',
    'wood',
    'yarn',
  ]);

  return raw
    .split(/[\n,;]+/)
    .flatMap(part => {
      const cleaned = part.replace(/\betc\.?$/i, '').trim();
      const words = cleaned.split(/\s+/).filter(Boolean);

      if (words.length <= 4) return cleaned ? [cleaned] : [];

      const items = [];
      let current = [];

      words.forEach(word => {
        current.push(word);

        if (itemEndWords.has(word.toLowerCase())) {
          items.push(current.join(' '));
          current = [];
        }
      });

      if (current.length) {
        if (items.length) {
          items[items.length - 1] = `${items[items.length - 1]} ${current.join(' ')}`.trim();
        } else {
          items.push(current.join(' '));
        }
      }

      return items;
    })
    .map(s => s.trim())
    .filter(Boolean);
}

function buildSparklineBars(history, trend) {
  const points = Array.isArray(history)
    ? history.filter(point => Number.isFinite(+point.price))
    : [];

  if (!points.length) return '';

  const prices = points.map(point => +point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 1);
  const color = trend === 'UP' ? '#c8401a' : trend === 'DOWN' ? '#1a6b3c' : '#b4b2a9';

  return points
    .map(point => {
      const height = 35 + Math.round(((+point.price - min) / range) * 45);
      return `<div class="spark-bar" style="height:${height}%;background:${color};opacity:0.72" title="${point.snapshotDate}: ₹${(+point.price).toLocaleString('en-IN')}"></div>`;
    })
    .join('');
}

function formatPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price)) return 'N/A';
  return `Rs ${price.toLocaleString('en-IN')}`;
}

function formatPercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return '0.0';
  return Math.abs(percent).toFixed(1);
}

function compactText(value, maxLength = 72) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

function alertClass(severity) {
  if (severity === 'HIGH') return 'price-alert-high';
  if (severity === 'MEDIUM') return 'price-alert-medium';
  return 'price-alert-low';
}

function renderRateNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return `
      <div class="price-alerts empty-alerts">
        <div class="price-alert-title">No urgent price alerts</div>
        <div class="price-alert-copy">Tracked items are stable against your saved snapshots.</div>
      </div>`;
  }

  return `
    <div class="price-alerts">
      <div class="price-alerts-head">
        <div>
          <div class="price-alert-title">Price Alert Notifications</div>
          <div class="price-alert-copy">${notifications.length} item${notifications.length === 1 ? '' : 's'} need attention</div>
        </div>
      </div>
      <div class="price-alert-list">
        ${notifications
          .map(note => {
            const rising = note.trend === 'UP';
            return `
              <div class="price-alert ${alertClass(note.alert.severity)}">
                <div class="price-alert-main">
                  <span class="price-alert-severity">${note.alert.severity}</span>
                  <strong>${compactText(note.alert.title, 58)}</strong>
                  <span>${compactText(note.alert.message, 110)}</span>
                </div>
                <div class="price-alert-side">
                  <span class="${rising ? 'delta-up' : 'delta-down'}">${rising ? '+' : '-'}${formatPercent(note.deltaPercent)}%</span>
                  <small>${note.alert.action}</small>
                </div>
              </div>`;
          })
          .join('')}
      </div>
    </div>`;
}

function renderHistoryTrail(history) {
  const points = Array.isArray(history) ? history.slice(-5) : [];

  if (!points.length) {
    return '<div class="history-empty">No saved history yet</div>';
  }

  return `
    <div class="rate-history">
      <div class="rate-history-title">Rate History</div>
      ${points
        .map(point => `
          <div class="history-row">
            <span>${point.snapshotDate}</span>
            <strong>${formatPrice(point.price)}</strong>
            <em class="${point.trend === 'UP' ? 'delta-up' : point.trend === 'DOWN' ? 'delta-down' : 'delta-flat'}">
              ${point.trend === 'UP' ? '+' : point.trend === 'DOWN' ? '-' : ''}${formatPercent(point.deltaPercent)}%
            </em>
          </div>`)
        .join('')}
    </div>`;
}

function selectBiz(el) {
  document.querySelectorAll('.biz-card').forEach(card => card.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('custom-biz').value = '';
}

function updateTagPreview() {
  const raw = document.getElementById('items-input').value;
  const tags = parseItems(raw);
  const preview = document.getElementById('tag-preview');
  preview.innerHTML = tags.slice(0, 20).map(tag => `<span class="tag">${tag}</span>`).join('');
}

function addSampleItem(item) {
  const input = document.getElementById('items-input');
  const existing = parseItems(input.value);

  if (!existing.some(value => value.toLowerCase() === item.toLowerCase())) {
    input.value = [...existing, item].join('\n');
  }

  updateTagPreview();
  input.focus();
}

function openDashboard(profile, { fetchInitialNews = false } = {}) {
  STATE = profile;
  localStorage.setItem('bizProfile', JSON.stringify(STATE));

  setupDashboard();
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  window.scrollTo({ top: 0 });

  if (fetchInitialNews) {
    fetchNews();
  }
}

function loadDemoDashboard() {
  openDashboard({
    name: 'Demo Steel Traders',
    city: 'Delhi',
    email: '',
    gstin: '',
    biz: 'Iron & Sheet Metal',
    items: ['MS Sheet', 'HR Coil', 'CR Sheet', 'Zinc', 'Welding Electrodes']
  });
}

function launchDashboard() {
  const name = document.getElementById('owner-name').value.trim() || 'Business Owner';
  const city = document.getElementById('owner-city').value.trim() || 'India';
  const email = document.getElementById('owner-email')?.value.trim() || '';
  const gstin = document.getElementById('owner-gstin')?.value.trim() || '';
  const customBiz = document.getElementById('custom-biz').value.trim();
  const selectedCard = document.querySelector('.biz-card.selected');
  const biz = customBiz || (selectedCard ? selectedCard.dataset.biz : '');
  const itemsRaw = document.getElementById('items-input').value;
  const items = parseItems(itemsRaw);

  if (!biz) {
    alert('Please select or enter your business type in Step 2.');
    return;
  }

  const profile = { name, city, email, gstin, biz, items };
  callAPI('profile', { name, city, email, gstin, businessType: biz, items }).catch(e =>
    console.error('Failed to sync profile to DB', e)
  );

  openDashboard(profile);
}

function setupDashboard() {
  const { name, city, biz, items } = STATE;
  document.getElementById('dash-avatar').textContent = initials(name);
  document.getElementById('dash-name').textContent = name;
  document.getElementById('dash-city').textContent = city;
  document.getElementById('dash-biz-label').textContent = biz;
  document.getElementById('dash-date').textContent = todayShort();
  document.getElementById('fb-biz').textContent = biz;
  document.getElementById('fb-city').textContent = city;
  document.getElementById('fb-items-count').textContent = `${items.length} items`;
  document.getElementById('rates-badge').textContent = items.length;
}

function resetToSetup() {
  localStorage.removeItem('bizProfile');
  document.getElementById('setup-screen').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function switchPanel(name, tabEl) {
  document.querySelectorAll('.dash-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.dash-tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  tabEl.classList.add('active');
}

async function callAPI(endpoint, payload) {
  const res = await fetch(`${API_BASE_URL}/api/biz-agent/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `API error: ${res.status}`);
  }

  return res.json();
}

async function fetchNews() {
  const { city, biz, items } = STATE;
  const btn = document.getElementById('btn-news');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-inline"></span>  Searching news...';

  const container = document.getElementById('news-container');
  container.innerHTML = `<div class="loading-block"><div class="loading-spinner"></div><div class="loading-text">Finding business news for your industry...</div><div class="loading-sub">Looking for useful ${biz} updates, market signals, and policy changes near ${city}</div></div>`;

  try {
    const data = await callAPI('news', { businessType: biz, city, items });
    const newsArr = data.news || [];
    const raw = data.rawAnalysis;

    document.getElementById('news-badge').textContent = newsArr.length;

    if (newsArr.length === 0 && raw) {
      container.innerHTML = `<div class="analyst-block"><div class="analyst-header"><div class="analyst-icon">📰</div><div><div class="analyst-title">Today's Industry Intelligence</div><div class="analyst-sub">Newszoid AI • ${todayShort()}</div></div></div><div class="analyst-text">${raw}</div></div>`;
    } else if (newsArr.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📰</div><div class="empty-title">No specific news found today</div><div class="empty-desc">Try a broader industry name or check again later. We only show stories that look relevant to your business.</div></div>`;
    } else {
      const catMap = {
        PRICE: 'cat-price',
        POLICY: 'cat-policy',
        TRADE: 'cat-trade',
        INDUSTRY: 'cat-industry',
        GLOBAL: 'cat-global',
        DEMAND: 'cat-demand'
      };
      const impMap = { HIGH: 'impact-high', MEDIUM: 'impact-med', LOW: 'impact-low' };
      const sigMap = { BULLISH: 'signal-bull', BEARISH: 'signal-bear', WATCH: 'signal-watch' };
      const cardMap = { BULLISH: 'bullish', BEARISH: 'bearish', WATCH: 'neutral', undefined: 'neutral' };

      container.innerHTML = `
        <div class="alert-strip">Showing ${newsArr.length} stories curated for <strong>${biz}</strong> businesses in ${city} • ${today()}</div>
        <div class="news-section-title">Today's Feed <span class="sub">Personalized for ${biz}</span></div>
        <div class="news-grid">
          ${newsArr
            .map(
              item => `
            <div class="news-card ${cardMap[item.sentiment] || 'neutral'} anim anim-1">
              <div class="news-meta">
                <span class="news-cat ${catMap[item.category] || 'cat-demand'}">${item.category}</span>
                <span class="news-impact ${impMap[item.impact] || 'impact-low'}">${item.impact} IMPACT</span>
                <span class="news-time">${item.relevantItem !== 'General' ? `🔗 ${item.relevantItem}` : ''}</span>
              </div>
              <div class="news-headline">${item.headline}</div>
              <div class="news-summary">${item.summary}</div>
              <span class="news-signal ${sigMap[item.sentiment] || 'signal-watch'}">
                ${item.sentiment === 'BULLISH' ? '▲' : item.sentiment === 'BEARISH' ? '▼' : '◎'} ${item.signal}
              </span>
              <div class="news-source">📌 ${item.source}</div>
            </div>`
            )
            .join('')}
        </div>`;
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">We could not load news right now</div><div class="empty-desc">Please check your internet connection or try again in a moment. Details: ${e.message}</div></div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '⚡ Refresh News';
}

async function fetchRates() {
  const { city, biz, items } = STATE;
  if (items.length === 0) {
    alert('Please go back to setup and add your items/materials list in Step 3.');
    return;
  }

  const btn = document.getElementById('btn-rates');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-inline"></span>  Verifying rates...';

  const container = document.getElementById('rates-container');
  container.innerHTML = `<div class="loading-block"><div class="loading-spinner"></div><div class="loading-text">Checking latest market prices...</div><div class="loading-sub">Verifying sources and saving today's snapshot for ${items.length} tracked materials</div></div>`;

  try {
    const data = await callAPI('rates', { businessType: biz, city, items });
    const ratesArr = data.rates || [];
    const notifications = data.notifications || [];
    const raw = data.rawAnalysis;
    const meta = data.meta || {};

    document.getElementById('rates-badge').textContent = ratesArr.length || items.length;

    if (ratesArr.length === 0 && raw) {
      container.innerHTML = `<div class="analyst-block"><div class="analyst-header"><div class="analyst-icon">📊</div><div><div class="analyst-title">Rate Intelligence Report</div><div class="analyst-sub">Newszoid AI • ${todayShort()}</div></div></div><div class="analyst-text">${raw}</div></div>`;
    } else if (ratesArr.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">No verified rates found yet</div><div class="empty-desc">Try simpler material names such as "MS Sheet" or "Copper Wire". We avoid showing prices when a usable source is not found.</div></div>`;
    } else {
      const ups = ratesArr.filter(rate => rate.trend === 'UP').length;
      const downs = ratesArr.filter(rate => rate.trend === 'DOWN').length;
      const flats = ratesArr.filter(rate => rate.trend === 'FLAT').length;

      container.innerHTML = `
        <div class="summary-bar">
          <div class="summary-card"><div class="summary-val">${ratesArr.length}</div><div class="summary-label">Items Tracked</div></div>
          <div class="summary-card"><div class="summary-val" style="color:var(--nz-accent)">▲${ups}</div><div class="summary-label">Rising</div><div class="summary-sub" style="color:var(--nz-accent);font-size:11px">prices up</div></div>
          <div class="summary-card"><div class="summary-val" style="color:var(--nz-green)">▼${downs}</div><div class="summary-label">Falling</div><div class="summary-sub" style="color:var(--nz-green);font-size:11px">prices down</div></div>
          <div class="summary-card"><div class="summary-val" style="color:var(--nz-muted)">—${flats}</div><div class="summary-label">Stable</div></div>
        </div>
        ${renderRateNotifications(notifications)}
        <div class="alert-strip">Verified snapshot mode • ${meta.comparisonMode === 'tracked-history' ? 'Comparing with your last saved snapshot' : 'Using current source-backed rates'} • Updated ${formatDateTime(meta.fetchedAt || ratesArr[0].fetchedAt)}</div>
        <div class="news-section-title">Verified Rate Tracker <span class="sub">Today vs previous saved snapshot • ${meta.snapshotDate || todayShort()}</span></div>
        <div class="rate-grid">
          ${ratesArr
            .map(rate => {
              const dUp = rate.trend === 'UP';
              const dDown = rate.trend === 'DOWN';
              const pct = rate.deltaPercent != null ? Math.abs(+rate.deltaPercent).toFixed(1) : '—';
              const deltaSign = dUp ? '+' : dDown ? '-' : '±';
              const trendCls = dUp ? 'trend-up' : dDown ? 'trend-down' : 'trend-flat';
              const deltaCls = dUp ? 'delta-up' : dDown ? 'delta-down' : 'delta-flat';
              const sparkline = buildSparklineBars(rate.history, rate.trend);
              const alert = rate.alert || {};
              const confBg =
                rate.confidence === 'HIGH'
                  ? 'var(--nz-green-light)'
                  : rate.confidence === 'MEDIUM'
                    ? 'var(--nz-gold-light)'
                    : 'var(--nz-accent-light)';
              const confCol =
                rate.confidence === 'HIGH'
                  ? 'var(--nz-green)'
                  : rate.confidence === 'MEDIUM'
                    ? 'var(--nz-gold)'
                    : 'var(--nz-accent)';

              return `<div class="rate-card anim anim-2">
                <div class="rate-card-top-row">
                  <span class="rate-unit">${rate.unit || '₹/kg'}</span>
                  <span class="rate-trend-label ${trendCls}">${rate.trend === 'UP' ? '▲ UP' : rate.trend === 'DOWN' ? '▼ DOWN' : '— FLAT'}</span>
                </div>
                <div class="rate-item-name">${rate.item}</div>
                <div class="rate-main"><span class="currency">₹</span>${(+rate.currentPrice).toLocaleString('en-IN')}</div>
                <div class="rate-compare">
                  <span class="prev-rate">Prev: ${formatPrice(rate.prevPrice)}</span>
                  <span class="rate-delta ${deltaCls}">${deltaSign}${pct}%</span>
                  <span style="margin-left:auto;font-size:10px;padding:2px 6px;border-radius:3px;background:${confBg};color:${confCol};font-weight:600;">${rate.confidence}</span>
                </div>
                <div class="inline-alert ${alert.triggered ? alertClass(alert.severity) : 'price-alert-low'}">
                  <strong>${alert.triggered ? 'Alert' : 'Status'}:</strong> ${alert.title || 'Rate checked'}.
                  <span>${alert.action || 'Keep tracking this item'}</span>
                </div>
                <div style="font-size:11px;color:var(--nz-muted);margin-top:6px;">${rate.comparisonLabel || 'Compared with previous saved snapshot'}</div>
                <div class="rate-sparkline">${sparkline || '<div style="font-size:11px;color:var(--nz-muted);padding-top:10px;">Need more snapshots for a trendline</div>'}</div>
                ${renderHistoryTrail(rate.history)}
                ${rate.note ? `<div class="rate-note">💡 ${rate.note}</div>` : ''}
                <div style="font-size:11px;color:var(--nz-muted);margin-top:6px;">📍 ${rate.market || city}</div>
                <div style="font-size:11px;color:var(--nz-muted);margin-top:4px;">🕒 Updated ${formatDateTime(rate.fetchedAt)}</div>
                <div style="font-size:11px;color:var(--nz-muted);margin-top:4px;">
                  ${rate.sourceUrl ? `🔗 <a href="${rate.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--nz-accent);">${rate.sourceName || 'Source'}</a>` : '🔗 Source not verified yet'}
                  ${rate.sourceDate ? ` • ${rate.sourceDate}` : ''}
                </div>
              </div>`;
            })
            .join('')}
        </div>`;
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">We could not load rates right now</div><div class="empty-desc">Please check your internet connection or try again. Details: ${e.message}</div></div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '📊 Refresh Verified Rates';
}

async function fetchAnalyst() {
  const { name, city, biz, items } = STATE;
  const btn = document.getElementById('btn-analyst');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin-inline"></span>  Analyzing your business...';

  const container = document.getElementById('analyst-container');
  container.innerHTML = `<div class="loading-block"><div class="loading-spinner"></div><div class="loading-text">Preparing your AI market summary...</div><div class="loading-sub">Reviewing your industry, city, and tracked materials. This may take 15-20 seconds.</div></div>`;

  try {
    const data = await callAPI('analyst', { name, businessType: biz, city, items });
    const text = data.analysis;

    container.innerHTML = `
      <div class="analyst-block anim anim-1">
        <div class="analyst-header">
          <div class="analyst-icon" style="background: transparent; box-shadow: none;">
            <img src="logo-icon.png" alt="Newszoid" style="width: 48px; height: 48px; object-fit: contain; filter: brightness(0) saturate(100%) invert(48%) sepia(85%) saturate(2795%) hue-rotate(346deg) brightness(101%) contrast(97%) drop-shadow(0 2px 4px rgba(255, 87, 34, 0.4));">
          </div>
          <div>
            <div class="analyst-title">Newszoid AI Market Summary — ${name}</div>
            <div class="analyst-sub">${biz} &nbsp;|&nbsp; ${city} &nbsp;|&nbsp; ${todayShort()}</div>
          </div>
        </div>
        <div class="ai-disclaimer">AI-generated summary. Verify sources before making purchase, pricing, or inventory decisions.</div>
        <div class="analyst-text">${text}</div>
      </div>
      <div style="margin-top:16px;">
        <button class="btn-fetch" onclick="fetchNews()">📰 View My News Feed</button>
        &nbsp;
        <button class="btn-fetch accent" onclick="fetchRates()">📊 View Rate Tracker</button>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">We could not prepare the summary</div><div class="empty-desc">Please try again in a moment. Details: ${e.message}</div></div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '🤖 Refresh Analysis';
}
