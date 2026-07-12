/* IRGEZTNE Live API v1 — foundation Worker
   Rooms / Chat v1 + Private Analytics v1
   Local-first app companion layer. No accounts required.

   Storage:
   - Production: bind KV as IRGEZTNE_LIVE_KV.
   - Local/dev fallback: in-memory Map, useful only for testing.

   Privacy:
   - No raw IP storage.
   - No full User-Agent storage.
   - Analytics stores approximate browser/device/country only.
*/

const API_VERSION = 'v1';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_ROOM_MESSAGES = 250;
const MAX_RECENT_EVENTS = 80;

const memoryStore = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    try {
      const route = matchRoute(request.method, url.pathname);

      if (route.name === 'health') {
        return json({
          ok: true,
          service: 'IRGEZTNE Live API',
          version: API_VERSION,
          time: new Date().toISOString()
        });
      }

      if (route.name === 'createRoom') {
        return createRoom(request, env);
      }

      if (route.name === 'getRoom') {
        return getRoom(request, env, route.params.roomId);
      }

      if (route.name === 'sendMessage') {
        return sendMessage(request, env, route.params.roomId);
      }

      if (route.name === 'getMessages') {
        return getMessages(request, env, route.params.roomId);
      }

      if (route.name === 'createAnalyticsSite') {
        return createAnalyticsSite(request, env);
      }

      if (route.name === 'trackAnalyticsEvent') {
        return trackAnalyticsEvent(request, env);
      }

      if (route.name === 'getAnalyticsSummary') {
        return getAnalyticsSummary(request, env, route.params.siteId);
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      return json({
        ok: false,
        error: 'Internal error',
        message: safeError(error)
      }, 500);
    }
  }
};

function matchRoute(method, pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (method === 'GET' && path === '/health') return { name: 'health', params: {} };
  if (method === 'GET' && path === '/v1/health') return { name: 'health', params: {} };

  if (method === 'POST' && path === '/v1/rooms') return { name: 'createRoom', params: {} };

  let m = path.match(/^\/v1\/rooms\/([^/]+)$/);
  if (m && method === 'GET') return { name: 'getRoom', params: { roomId: m[1] } };

  m = path.match(/^\/v1\/rooms\/([^/]+)\/messages$/);
  if (m && method === 'POST') return { name: 'sendMessage', params: { roomId: m[1] } };
  if (m && method === 'GET') return { name: 'getMessages', params: { roomId: m[1] } };

  if (method === 'POST' && path === '/v1/analytics/sites') return { name: 'createAnalyticsSite', params: {} };
  if (method === 'POST' && path === '/v1/analytics/events') return { name: 'trackAnalyticsEvent', params: {} };

  m = path.match(/^\/v1\/analytics\/sites\/([^/]+)\/summary$/);
  if (m && method === 'GET') return { name: 'getAnalyticsSummary', params: { siteId: m[1] } };

  return { name: 'notFound', params: {} };
}

/* ---------------------------
   Rooms / Chat v1
---------------------------- */

async function createRoom(request, env) {
  const body = await readJson(request);
  const now = nowIso();

  const roomId = createId('room');
  const roomSecret = createSecret();

  const room = {
    id: roomId,
    secretHash: await sha256(roomSecret),
    title: cleanText(body.title || 'IRGEZTNE room', 120),
    projectId: cleanText(body.projectId || '', 160),
    createdAt: now,
    updatedAt: now,
    closedAt: '',
    messageCount: 0
  };

  await putJson(env, keyRoom(roomId), room);
  await putJson(env, keyRoomMessages(roomId), []);

  return json({
    ok: true,
    room: publicRoom(room),
    token: roomSecret
  }, 201);
}

async function getRoom(request, env, roomId) {
  const room = await getJson(env, keyRoom(roomId));
  if (!room) return json({ ok: false, error: 'Room not found' }, 404);

  return json({
    ok: true,
    room: publicRoom(room)
  });
}

async function sendMessage(request, env, roomId) {
  const body = await readJson(request);
  const token = getBearer(request) || body.token || '';
  const room = await getJson(env, keyRoom(roomId));

  if (!room) return json({ ok: false, error: 'Room not found' }, 404);
  if (room.closedAt) return json({ ok: false, error: 'Room is closed' }, 409);

  const allowed = await verifyToken(token, room.secretHash);
  if (!allowed) return json({ ok: false, error: 'Invalid room token' }, 403);

  const text = cleanText(body.text || '', MAX_MESSAGE_LENGTH);
  if (!text) return json({ ok: false, error: 'Message is empty' }, 400);

  const now = nowIso();
  const messages = await getJson(env, keyRoomMessages(roomId)) || [];

  const message = {
    id: createId('msg'),
    roomId,
    authorName: cleanText(body.authorName || 'Guest', 80),
    text,
    createdAt: now
  };

  messages.push(message);
  const trimmed = messages.slice(-MAX_ROOM_MESSAGES);

  room.updatedAt = now;
  room.messageCount = (room.messageCount || 0) + 1;

  await putJson(env, keyRoom(roomId), room);
  await putJson(env, keyRoomMessages(roomId), trimmed);

  return json({
    ok: true,
    message
  }, 201);
}

async function getMessages(request, env, roomId) {
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get('limit'), 1, 100, 50);

  const room = await getJson(env, keyRoom(roomId));
  if (!room) return json({ ok: false, error: 'Room not found' }, 404);

  const messages = await getJson(env, keyRoomMessages(roomId)) || [];

  return json({
    ok: true,
    room: publicRoom(room),
    messages: messages.slice(-limit)
  });
}

/* ---------------------------
   Private Analytics v1
---------------------------- */

async function createAnalyticsSite(request, env) {
  const body = await readJson(request);
  const now = nowIso();

  const siteId = createId('site');
  const siteToken = createSecret();

  const site = {
    id: siteId,
    tokenHash: await sha256(siteToken),
    name: cleanText(body.name || 'IRGEZTNE site', 140),
    projectId: cleanText(body.projectId || '', 160),
    origin: cleanText(body.origin || '', 260),
    createdAt: now,
    updatedAt: now,
    eventCount: 0
  };

  const summary = {
    siteId,
    totals: {
      events: 0,
      pageViews: 0,
      sessions: 0
    },
    byPath: {},
    byDevice: {},
    byBrowser: {},
    byCountry: {},
    byDay: {},
    recent: []
  };

  await putJson(env, keyAnalyticsSite(siteId), site);
  await putJson(env, keyAnalyticsSummary(siteId), summary);

  return json({
    ok: true,
    site: publicAnalyticsSite(site),
    token: siteToken
  }, 201);
}

async function trackAnalyticsEvent(request, env) {
  const body = await readJson(request);

  const siteId = cleanText(body.siteId || '', 160);
  const token = getBearer(request) || body.token || '';

  if (!siteId) return json({ ok: false, error: 'siteId is required' }, 400);

  const site = await getJson(env, keyAnalyticsSite(siteId));
  if (!site) return json({ ok: false, error: 'Analytics site not found' }, 404);

  const allowed = await verifyToken(token, site.tokenHash);
  if (!allowed) return json({ ok: false, error: 'Invalid analytics token' }, 403);

  const now = nowIso();
  const parsed = parseClientHints(request, body);

  const event = {
    id: createId('evt'),
    siteId,
    type: cleanText(body.type || 'page_view', 60),
    path: normalizePath(body.path || '/'),
    referrer: normalizeReferrer(body.referrer || ''),
    device: parsed.device,
    browser: parsed.browser,
    country: parsed.country,
    sessionId: cleanText(body.sessionId || '', 120),
    loadTime: clampInt(body.loadTime, 0, 600000, 0),
    createdAt: now
  };

  const summary = await getJson(env, keyAnalyticsSummary(siteId)) || emptySummary(siteId);
  applyEventToSummary(summary, event);

  site.updatedAt = now;
  site.eventCount = (site.eventCount || 0) + 1;

  await putJson(env, keyAnalyticsSite(siteId), site);
  await putJson(env, keyAnalyticsSummary(siteId), summary);

  return json({ ok: true });
}

async function getAnalyticsSummary(request, env, siteId) {
  const url = new URL(request.url);
  const token = getBearer(request) || url.searchParams.get('token') || '';

  const site = await getJson(env, keyAnalyticsSite(siteId));
  if (!site) return json({ ok: false, error: 'Analytics site not found' }, 404);

  const allowed = await verifyToken(token, site.tokenHash);
  if (!allowed) return json({ ok: false, error: 'Invalid analytics token' }, 403);

  const summary = await getJson(env, keyAnalyticsSummary(siteId)) || emptySummary(siteId);

  return json({
    ok: true,
    site: publicAnalyticsSite(site),
    summary
  });
}

function applyEventToSummary(summary, event) {
  summary.totals.events += 1;
  if (event.type === 'page_view') summary.totals.pageViews += 1;

  inc(summary.byPath, event.path || '/');
  inc(summary.byDevice, event.device || 'unknown');
  inc(summary.byBrowser, event.browser || 'unknown');
  inc(summary.byCountry, event.country || 'unknown');
  inc(summary.byDay, event.createdAt.slice(0, 10));

  summary.recent.unshift(event);
  summary.recent = summary.recent.slice(0, MAX_RECENT_EVENTS);
}

function emptySummary(siteId) {
  return {
    siteId,
    totals: { events: 0, pageViews: 0, sessions: 0 },
    byPath: {},
    byDevice: {},
    byBrowser: {},
    byCountry: {},
    byDay: {},
    recent: []
  };
}

/* ---------------------------
   Storage helpers
---------------------------- */

async function getJson(env, key) {
  const raw = await kvGet(env, key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function putJson(env, key, value) {
  await kvPut(env, key, JSON.stringify(value));
}

async function kvGet(env, key) {
  if (env && env.IRGEZTNE_LIVE_KV && typeof env.IRGEZTNE_LIVE_KV.get === 'function') {
    return env.IRGEZTNE_LIVE_KV.get(key);
  }

  return memoryStore.get(key) || null;
}

async function kvPut(env, key, value) {
  if (env && env.IRGEZTNE_LIVE_KV && typeof env.IRGEZTNE_LIVE_KV.put === 'function') {
    return env.IRGEZTNE_LIVE_KV.put(key, value);
  }

  memoryStore.set(key, value);
}

function keyRoom(roomId) {
  return `room:${roomId}`;
}

function keyRoomMessages(roomId) {
  return `room:${roomId}:messages`;
}

function keyAnalyticsSite(siteId) {
  return `analytics:site:${siteId}`;
}

function keyAnalyticsSummary(siteId) {
  return `analytics:site:${siteId}:summary`;
}

/* ---------------------------
   Utilities
---------------------------- */

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: corsHeaders()
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function getBearer(request) {
  const auth = request.headers.get('Authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function createId(prefix) {
  const uuid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  return `${prefix}_${uuid.replace(/-/g, '').slice(0, 24)}`;
}

function createSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  const data = new TextEncoder().encode(String(value || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyToken(token, storedHash) {
  if (!token || !storedHash) return false;
  return await sha256(token) === storedHash;
}

function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 500);
}

function normalizePath(value) {
  const text = cleanText(value || '/', 500);
  if (!text) return '/';

  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      return (url.pathname || '/') + (url.search || '');
    }
  } catch {}

  return text.startsWith('/') ? text : '/' + text;
}

function normalizeReferrer(value) {
  const text = cleanText(value || '', 500);
  if (!text) return '';

  try {
    const url = new URL(text);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function parseClientHints(request, body) {
  const ua = request.headers.get('User-Agent') || '';
  const country = cleanText(
    body.country ||
    request.headers.get('CF-IPCountry') ||
    (request.cf && request.cf.country) ||
    '',
    80
  ) || 'unknown';

  return {
    device: inferDevice(ua),
    browser: inferBrowser(ua),
    country
  };
}

function inferDevice(ua) {
  const text = String(ua || '').toLowerCase();
  if (!text) return 'unknown';
  if (/ipad|tablet/.test(text)) return 'tablet';
  if (/mobile|iphone|android/.test(text)) return 'mobile';
  return 'desktop';
}

function inferBrowser(ua) {
  const text = String(ua || '');
  if (!text) return 'unknown';
  if (/Edg\//.test(text)) return 'edge';
  if (/Chrome\//.test(text) && !/Edg\//.test(text)) return 'chrome';
  if (/Firefox\//.test(text)) return 'firefox';
  if (/Safari\//.test(text) && !/Chrome\//.test(text)) return 'safari';
  return 'other';
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function inc(obj, key) {
  const safeKey = cleanText(key || 'unknown', 240) || 'unknown';
  obj[safeKey] = (obj[safeKey] || 0) + 1;
}

function nowIso() {
  return new Date().toISOString();
}

function publicRoom(room) {
  return {
    id: room.id,
    title: room.title,
    projectId: room.projectId || '',
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    closedAt: room.closedAt || '',
    messageCount: room.messageCount || 0
  };
}

function publicAnalyticsSite(site) {
  return {
    id: site.id,
    name: site.name,
    projectId: site.projectId || '',
    origin: site.origin || '',
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
    eventCount: site.eventCount || 0
  };
}

function safeError(error) {
  const message = error && error.message ? String(error.message) : 'Unknown error';
  return message.slice(0, 200);
}
