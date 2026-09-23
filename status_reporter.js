// ============================================================
// status_reporter.js
// Pushes a heartbeat to a GitHub repo on a fixed interval via
// the GitHub Contents API. Used by CoreLine bots to feed the
// public status page.
//
// Env vars:
//   STATUS_GH_TOKEN      — GitHub PAT with contents:write on the repo
//   STATUS_GH_OWNER      — repo owner (org or user)
//   STATUS_GH_REPO       — repo name
//   STATUS_BOT_ID        — file name under _data/ (e.g. "tixal")
//   STATUS_INTERVAL_MS   — optional, defaults to 300000 (5 min)
//   STATUS_ENABLED       — optional, set to "0" to disable
// ============================================================

const START_TIME = Date.now();

const GH_TOKEN = process.env.STATUS_GH_TOKEN;
const GH_OWNER = process.env.STATUS_GH_OWNER;
const GH_REPO = process.env.STATUS_GH_REPO;
const BOT_ID = process.env.STATUS_BOT_ID;
const INTERVAL_MS = parseInt(process.env.STATUS_INTERVAL_MS || '300000', 10);
const ENABLED = process.env.STATUS_ENABLED !== '0';

let logger = console.log;
let intervalHandle = null;

function log(msg) {
  try { logger(`[status] ${msg}`); } catch { /* noop */ }
}

// ---------- Payload builder ----------

function buildPayload(client, extras) {
  const uptime = Math.floor((Date.now() - START_TIME) / 1000);
  const latency = client?.ws?.ping ?? null;
  const guilds = client?.guilds?.cache?.size ?? 0;

  let users = 0;
  if (client?.guilds?.cache) {
    for (const g of client.guilds.cache.values()) {
      users += g.memberCount || 0;
    }
  }

  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const checks = [
    {
      name: 'Gateway',
      status: latency != null && latency >= 0 && latency < 500 ? 'operational' : 'degraded',
      detail: latency != null ? `${latency} ms` : 'unknown'
    }
  ];
  if (Array.isArray(extras.checks)) {
    for (const c of extras.checks) {
      checks.push({
        name: String(c.name || 'Check'),
        status: ['operational', 'degraded', 'outage'].includes(c.status) ? c.status : 'unknown',
        detail: c.detail ? String(c.detail) : ''
      });
    }
  }

  // Aggregate status: worst of the checks.
  let status = 'operational';
  if (checks.some(c => c.status === 'outage')) status = 'outage';
  else if (checks.some(c => c.status === 'degraded')) status = 'degraded';
  else if (checks.some(c => c.status === 'unknown')) status = 'unknown';

  return {
    id: extras.id || BOT_ID,
    name: extras.name || BOT_ID,
    status,
    version: extras.version || '1.0.0',
    uptime_seconds: uptime,
    last_heartbeat: new Date().toISOString(),
    last_restart: extras.lastRestart || null,
    latency_ms: latency,
    guilds,
    users,
    commands_registered: extras.commandsRegistered || 0,
    memory_mb: memoryMb,
    shard: { id: 0, count: 1 },
    checks
  };
}

// ---------- GitHub API ----------

function ghUrl() {
  return `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/_data/${BOT_ID}.json`;
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'coreline-status-reporter'
  };
}

async function getCurrentSha() {
  try {
    const res = await fetch(ghUrl(), { headers: ghHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha || null;
  } catch {
    return null;
  }
}

async function putPayload(payload) {
  const url = ghUrl();
  const sha = await getCurrentSha();
  const content = Buffer.from(JSON.stringify(payload, null, 2) + '\n').toString('base64');

  const body = {
    message: `heartbeat ${payload.last_heartbeat}`,
    content,
    committer: {
      name: 'CoreLine Status',
      email: 'hadtoberxr@gmail.com'
    }
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ---------- Public API ----------

async function pushOnce(client, extras) {
  const payload = buildPayload(client, extras);
  await putPayload(payload);
  return payload;
}

function startStatusReporter(client, extras = {}, opts = {}) {
  if (opts.logger && typeof opts.logger === 'function') logger = opts.logger;

  if (!ENABLED) {
    log('disabled (STATUS_ENABLED=0)');
    return null;
  }

  if (!GH_TOKEN || !GH_OWNER || !GH_REPO || !BOT_ID) {
    log('missing env vars — reporter not started');
    log('required: STATUS_GH_TOKEN, STATUS_GH_OWNER, STATUS_GH_REPO, STATUS_BOT_ID');
    return null;
  }

  if (intervalHandle) return intervalHandle;

  const extrasFinal = {
    id: extras.id || BOT_ID,
    name: extras.name || BOT_ID,
    version: extras.version || '1.0.0',
    commandsRegistered: extras.commandsRegistered || 0,
    lastRestart: extras.lastRestart || new Date().toISOString(),
    checks: extras.checks || []
  };

  const tick = async () => {
    try {
      const payload = await pushOnce(client, extrasFinal);
      log(`pushed — status=${payload.status} guilds=${payload.guilds} users=${payload.users} latency=${payload.latency_ms}ms`);
    } catch (err) {
      log(`push failed: ${err.message}`);
    }
  };

  // First push after the client is fully ready, then every INTERVAL_MS.
  setTimeout(tick, 10000);
  intervalHandle = setInterval(tick, INTERVAL_MS);
  log(`started — every ${Math.round(INTERVAL_MS / 1000)}s to ${GH_OWNER}/${GH_REPO}/_data/${BOT_ID}.json`);
  return intervalHandle;
}

function stopStatusReporter() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    log('stopped');
  }
}

module.exports = {
  startStatusReporter,
  stopStatusReporter,
  pushOnce,
  buildPayload
};
