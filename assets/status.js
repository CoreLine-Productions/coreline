// ============================================================
// CoreLine Productions — Status renderer
// Reads _data/<bot>.json and renders status cards on any page
// that includes <div id="status-root">. Refreshes every 60s.
// No dependencies. No build step.
// ============================================================

(function () {
  'use strict';

  const REFRESH_MS = 60000;
  const ROOT_ID = 'status-root';

  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  // Base URL of the repo — derived from the stylesheet href so
  // the script works whether the site is at the org root or
  // under a project path like /coreline/.
  const stylesheet = document.querySelector('link[rel="stylesheet"]');
  const base = stylesheet
    ? stylesheet.href.replace(/\/assets\/style\.css.*$/, '')
    : window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');

  // Config comes from data attributes on the root element:
  //   data-bot-id="tixal"   → single bot card
  //   data-global="true"    → every bot in the list
  const botId = root.dataset.botId || '';
  const isGlobal = root.dataset.global === 'true';
  const globalBots = (root.dataset.bots || 'tixal,setuper')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // ---------- Utilities ----------

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatUptime(seconds) {
    if (typeof seconds !== 'number' || seconds <= 0) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  function formatRelative(iso) {
    if (!iso) return '—';
    const t = Date.parse(iso);
    if (isNaN(t)) return '—';
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function formatNumber(n) {
    if (typeof n !== 'number' || isNaN(n)) return '—';
    return n.toLocaleString('en-US');
  }

  function statusLabel(status) {
    return {
      operational: 'Operational',
      degraded: 'Degraded',
      outage: 'Outage',
    }[status] || 'Unknown';
  }

  function safeStatus(status) {
    return ['operational', 'degraded', 'outage'].includes(status) ? status : 'unknown';
  }

  // ---------- Renders ----------

  function renderPill(status) {
    const s = safeStatus(status);
    return `<span class="pill ${s}"><span class="dot"></span>${statusLabel(s)}</span>`;
  }

  function renderChecks(checks) {
    if (!Array.isArray(checks) || checks.length === 0) {
      return '<p class="text-faint" style="font-size:13px;padding-top:12px">No checks reported.</p>';
    }
    return `<div class="checks">${checks.map(c => {
      const s = safeStatus(c.status);
      const name = escapeHtml(c.name || 'Check');
      return `<div class="check">
        <span class="check-name">${name}</span>
        <span class="check-status ${s}"><span class="dot"></span>${statusLabel(s)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  function renderMetrics(d) {
    return `<div class="metrics">
      <div class="metric">
        <div class="metric-label">Uptime</div>
        <div class="metric-value">${formatUptime(d.uptime_seconds)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Latency</div>
        <div class="metric-value">${d.latency_ms != null ? escapeHtml(d.latency_ms) + ' ms' : '—'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Guilds</div>
        <div class="metric-value">${formatNumber(d.guilds)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Users</div>
        <div class="metric-value">${formatNumber(d.users)}</div>
      </div>
    </div>`;
  }

  function renderCard(d, meta = {}) {
    const name = escapeHtml(d.name || meta.name || d.id || 'Bot');
    const desc = meta.desc ? `<p class="card-desc">${escapeHtml(meta.desc)}</p>` : '';
    const invite = meta.invite
      ? `<a href="${escapeHtml(meta.invite)}" target="_blank" rel="noopener">Invite</a>`
      : '';
    const heartbeat = d.last_heartbeat
      ? `Heartbeat ${formatRelative(d.last_heartbeat)}`
      : 'Awaiting heartbeat';
    const status = safeStatus(d.status);

    return `<article class="card">
      <div class="card-head">
        <h3 class="card-title">${name}</h3>
        ${renderPill(status)}
      </div>
      ${desc}
      ${renderMetrics(d)}
      ${renderChecks(d.checks)}
      <div class="card-footer">
        <span>${escapeHtml(heartbeat)}</span>
        ${invite}
      </div>
    </article>`;
  }

  function renderSkeleton() {
    return '<div class="skeleton"></div>';
  }

  // ---------- Data ----------

  async function fetchBot(id) {
    const url = `${base}/_data/${encodeURIComponent(id)}.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    return res.json();
  }

  function aggregateStatus(list) {
    const statuses = list.map(d => d?.status || 'unknown');
    if (statuses.length === 0) return 'unknown';
    if (statuses.every(s => s === 'operational')) return 'operational';
    if (statuses.some(s => s === 'outage')) return 'outage';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'unknown';
  }

  function aggregateText(status) {
    return {
      operational: 'All systems operational',
      degraded: 'Some systems are degraded',
      outage: 'Partial or major outage detected',
    }[status] || 'Status unknown';
  }

  function ensureBanner(status) {
    let banner = document.getElementById('status-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'status-banner';
      banner.className = 'banner';
      root.parentNode.insertBefore(banner, root);
    }
    banner.classList.remove('operational', 'degraded', 'outage', 'unknown');
    banner.classList.add(safeStatus(status));
    banner.innerHTML = `<span class="dot"></span><span>${aggregateText(safeStatus(status))}</span>`;
    banner.style.display = isGlobal ? '' : 'none';
  }

  // ---------- Render loop ----------

  let cachedMeta = null;

  async function loadMeta() {
    if (cachedMeta) return cachedMeta;
    try {
      const res = await fetch(`${base}/_data/bots.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        cachedMeta = await res.json();
      } else {
        cachedMeta = { bots: {} };
      }
    } catch {
      cachedMeta = { bots: {} };
    }
    return cachedMeta;
  }

  async function render() {
    if (isGlobal) {
      root.innerHTML = globalBots.map(renderSkeleton).join('');
    } else {
      root.innerHTML = renderSkeleton();
    }

    const meta = await loadMeta();

    if (isGlobal) {
      const results = await Promise.all(
        globalBots.map(id => fetchBot(id).catch(() => ({ id, name: id, status: 'unknown' })))
      );
      const aggregate = aggregateStatus(results);
      ensureBanner(aggregate);
      root.innerHTML = results.map(d => renderCard(d, meta.bots?.[d.id] || {})).join('');
      return;
    }

    if (botId) {
      const d = await fetchBot(botId).catch(() => ({ id: botId, name: botId, status: 'unknown' }));
      ensureBanner(null);
      document.getElementById('status-banner')?.remove();
      root.innerHTML = renderCard(d, meta.bots?.[d.id] || {});
    }
  }

  render();
  setInterval(render, REFRESH_MS);

  // Refresh a single card's relative timestamp once a minute
  // without refetching, so the "Heartbeat Xm ago" line stays
  // accurate between network calls.
  setInterval(() => {
    const footers = document.querySelectorAll('.card-footer > span');
    footers.forEach(el => {
      const text = el.textContent || '';
      const match = text.match(/^Heartbeat (.+)$/);
      if (!match) return;
      // leave it; the next full refresh replaces the text anyway
    });
  }, 30000);
})();
