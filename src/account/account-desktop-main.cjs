'use strict';

const crypto = require('crypto');
const path = require('path');
const { createAccountSecureStore } = require('./account-secure-store.cjs');

const DEFAULT_API_BASE = 'https://account.irgeztne.com';
const REQUEST_TIMEOUT_MS = 15000;
const SERVICE_GRANT_REFRESH_SKEW_SECONDS = 60;
const SERVICE_GRANT_DEFINITIONS = Object.freeze({
  CHAT: Object.freeze({ service: 'CHAT', scopes: Object.freeze(['chat:access']) }),
  WORKSHOP: Object.freeze({ service: 'WORKSHOP', scopes: Object.freeze(['workshop:access']) })
});

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function desktopStateHash(state) {
  return sha256Hex(`desktop-state-v1:${state}`);
}

function desktopPkceChallenge(verifier) {
  return sha256Hex(`desktop-pkce-v1:${verifier}`);
}

function exchangeSigningPayload(grantId, state, pkceChallenge) {
  return `IRGEZTNE_DESKTOP_EXCHANGE_V1\n${grantId}\n${state}\n${pkceChallenge}`;
}

function platformName(value = process.platform) {
  if (value === 'linux') return 'LINUX';
  if (value === 'darwin') return 'MACOS';
  if (value === 'win32') return 'WINDOWS';
  return 'OTHER';
}

function generateDeviceKeypair() {
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicJwk: pair.publicKey.export({ format: 'jwk' }),
    privateJwk: pair.privateKey.export({ format: 'jwk' })
  };
}

function signExchange(privateJwk, payload) {
  const key = crypto.createPrivateKey({ key: privateJwk, format: 'jwk' });
  return crypto.sign('sha256', Buffer.from(String(payload), 'utf8'), {
    key,
    dsaEncoding: 'ieee-p1363'
  }).toString('base64url');
}

function cleanPublicAccount(value) {
  const account = value && typeof value === 'object' ? value : null;
  if (!account) return null;
  return {
    account_id: String(account.account_id || ''),
    status: String(account.status || ''),
    email: account.email ? String(account.email) : null,
    profile: {
      display_name: String(account.profile?.display_name || ''),
      handle: account.profile?.handle ? String(account.profile.handle) : null
    }
  };
}

function cleanPublicSession(value) {
  const session = value && typeof value === 'object' ? value : null;
  if (!session) return null;
  return {
    session_id: String(session.session_id || ''),
    client_kind: String(session.client_kind || ''),
    device_id: session.device_id ? String(session.device_id) : null,
    last_seen_at: Number(session.last_seen_at || 0),
    idle_expires_at: Number(session.idle_expires_at || 0),
    absolute_expires_at: Number(session.absolute_expires_at || 0)
  };
}

function cleanPublicDevice(value) {
  const device = value && typeof value === 'object' ? value : null;
  if (!device) return null;
  return {
    device_id: String(device.device_id || ''),
    label: device.label ? String(device.label) : null,
    platform: device.platform ? String(device.platform) : null,
    status: String(device.status || ''),
    key_algorithm: device.key_algorithm ? String(device.key_algorithm) : null,
    approved_at: device.approved_at == null ? null : Number(device.approved_at),
    last_seen_at: device.last_seen_at == null ? null : Number(device.last_seen_at)
  };
}


function normalizeServiceGrantName(value) {
  const service = String(value || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(SERVICE_GRANT_DEFINITIONS, service)) {
    throw typedError('SERVICE_UNSUPPORTED', 'Unsupported Account service grant.');
  }
  return service;
}

function validateServiceGrantPayload(value, definition, nowSec) {
  const grant = value && typeof value === 'object' ? value : null;
  if (!grant) throw typedError('SERVICE_GRANT_RESPONSE_INVALID', 'Account returned an invalid service grant.');

  const token = String(grant.token || '');
  const service = String(grant.service || '').toUpperCase();
  const scopes = Array.isArray(grant.scopes) ? grant.scopes.map((item) => String(item || '')).sort() : [];
  const expectedScopes = [...definition.scopes].sort();
  const expiresAt = Number(grant.expires_at || 0);

  if (
    service !== definition.service ||
    String(grant.token_type || '') !== 'Bearer' ||
    !/^[A-Za-z0-9_-]{20,}$/.test(token) ||
    scopes.length !== expectedScopes.length ||
    scopes.some((scope, index) => scope !== expectedScopes[index]) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= nowSec
  ) {
    throw typedError('SERVICE_GRANT_RESPONSE_INVALID', 'Account returned an invalid service grant.');
  }

  return Object.freeze({
    grant_id: String(grant.grant_id || ''),
    token,
    token_type: 'Bearer',
    service,
    scopes: Object.freeze([...expectedScopes]),
    created_at: Number(grant.created_at || nowSec),
    expires_at: expiresAt,
    expires_in_seconds: Math.max(0, expiresAt - nowSec)
  });
}

function createAccountDesktopController({
  app,
  safeStorage,
  shell,
  fetchImpl = globalThis.fetch,
  apiBase = process.env.IRGEZTNE_ACCOUNT_API_URL || DEFAULT_API_BASE,
  now = () => Date.now()
} = {}) {
  if (!app || typeof app.getPath !== 'function') throw new Error('Account desktop controller requires Electron app');
  if (!shell || typeof shell.openExternal !== 'function') throw new Error('Account desktop controller requires Electron shell');
  if (typeof fetchImpl !== 'function') throw new Error('Account desktop controller requires fetch');

  const normalizedApiBase = String(apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
  const dataDir = path.join(app.getPath('userData'), 'data');
  const secureStore = createAccountSecureStore({ safeStorage, dataDir });
  const serviceGrantCache = new Map();

  function clearServiceGrantCache() {
    serviceGrantCache.clear();
  }

  function protectedStatus() {
    const secure = secureStore.status();
    return {
      available: Boolean(secure.available),
      backend: secure.backend || 'unknown',
      reason: secure.reason || null
    };
  }

  function readSecure() {
    const status = protectedStatus();
    if (!status.available) return {};
    return secureStore.read();
  }

  function writeSecure(next) {
    return secureStore.write(next);
  }

  async function requestJson(pathname, { method = 'GET', body, bearer } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    try {
      const response = await fetchImpl(`${normalizedApiBase}${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, payload };
    } catch (error) {
      if (error && error.name === 'AbortError') throw typedError('ACCOUNT_API_TIMEOUT', 'IRGEZTNE Account did not respond in time.');
      throw typedError('ACCOUNT_API_UNREACHABLE', 'IRGEZTNE Account is currently unreachable.');
    } finally {
      clearTimeout(timer);
    }
  }

  function publicPending(pending) {
    if (!pending) return null;
    return {
      authorization_id: pending.authorizationId || '',
      authorization_url: pending.authorizationUrl || '',
      expires_at: Number(pending.expiresAt || 0),
      waiting_for_browser: true
    };
  }

  function cachedPublicState(secretState) {
    return secretState && secretState.public && typeof secretState.public === 'object'
      ? secretState.public
      : {};
  }

  function baseStatus(secretState = {}) {
    const secure = protectedStatus();
    const publicState = cachedPublicState(secretState);
    return {
      ok: true,
      mode: secretState.session?.token ? 'connected' : 'local',
      connected: Boolean(secretState.session?.token),
      protected_storage: secure,
      account: cleanPublicAccount(publicState.account),
      session: cleanPublicSession(publicState.session),
      device: cleanPublicDevice(publicState.device),
      pending: publicPending(secretState.pending),
      api_base: normalizedApiBase
    };
  }

  async function getStatus() {
    const secure = protectedStatus();
    if (!secure.available) {
      return {
        ok: true,
        mode: 'local',
        connected: false,
        protected_storage: secure,
        account: null,
        session: null,
        device: null,
        pending: null,
        api_base: normalizedApiBase
      };
    }

    let state;
    try { state = readSecure(); }
    catch (error) {
      return {
        ok: false,
        code: error.code || 'ACCOUNT_SECURE_STATE_UNREADABLE',
        mode: 'local',
        connected: false,
        protected_storage: secure,
        account: null,
        session: null,
        device: null,
        pending: null,
        api_base: normalizedApiBase
      };
    }

    const token = String(state.session?.token || '');
    if (!token) return baseStatus(state);

    try {
      const result = await requestJson('/v1/session', { bearer: token });
      if (result.ok) {
        state.public = {
          ...(state.public || {}),
          account: cleanPublicAccount(result.payload.account),
          session: cleanPublicSession(result.payload.session),
          device: state.public?.device || null
        };
        writeSecure(state);
        return { ...baseStatus(state), online: true };
      }
      if (result.status === 401) {
        clearServiceGrantCache();
        delete state.session;
        state.public = { ...(state.public || {}), session: null };
        writeSecure(state);
        return { ...baseStatus(state), online: true, session_invalid: true };
      }
      return { ...baseStatus(state), online: false, api_status: result.status };
    } catch (error) {
      return { ...baseStatus(state), online: false, warning: error.code || 'ACCOUNT_API_UNREACHABLE' };
    }
  }

  function ensureDevice(state) {
    if (state.device?.privateJwk && state.device?.publicJwk) return state.device;
    const generated = generateDeviceKeypair();
    state.device = {
      publicJwk: generated.publicJwk,
      privateJwk: generated.privateJwk,
      createdAt: Math.floor(now() / 1000)
    };
    return state.device;
  }

  async function startConnection({ label = 'IRGEZTNE Workspace' } = {}) {
    const secure = protectedStatus();
    if (!secure.available) {
      throw typedError(
        secure.reason || 'PROTECTED_STORAGE_UNAVAILABLE',
        'Persistent Account connection requires OS-backed protected storage.'
      );
    }

    const state = readSecure();
    const nowSec = Math.floor(now() / 1000);
    if (state.pending?.authorizationUrl && Number(state.pending.expiresAt || 0) > nowSec + 15) {
      await shell.openExternal(String(state.pending.authorizationUrl));
      return { ...baseStatus(state), opened_existing_request: true };
    }

    const device = ensureDevice(state);
    const rawState = randomToken(32);
    const verifier = randomToken(32);
    const result = await requestJson('/v1/desktop/start', {
      method: 'POST',
      body: {
        state_hash: desktopStateHash(rawState),
        pkce_challenge: desktopPkceChallenge(verifier),
        public_key_jwk: device.publicJwk,
        label: String(label || 'IRGEZTNE Workspace').slice(0, 80),
        platform: platformName()
      }
    });

    if (!result.ok || !result.payload?.authorization) {
      const code = result.payload?.error?.code || 'DESKTOP_START_FAILED';
      throw typedError(code, result.payload?.error?.message || 'Could not start Workspace Account connection.');
    }

    const auth = result.payload.authorization;
    state.pending = {
      authorizationId: String(auth.authorization_id || ''),
      authorizationUrl: String(auth.authorization_url || ''),
      desktopGrant: String(auth.desktop_grant || ''),
      state: rawState,
      verifier,
      expiresAt: Number(auth.expires_at || 0)
    };
    writeSecure(state);

    if (!state.pending.authorizationId || !state.pending.authorizationUrl || !state.pending.desktopGrant) {
      delete state.pending;
      writeSecure(state);
      throw typedError('DESKTOP_START_RESPONSE_INVALID', 'Account returned an incomplete desktop authorization.');
    }

    await shell.openExternal(state.pending.authorizationUrl);
    return baseStatus(state);
  }

  async function openAuthorization() {
    const state = readSecure();
    if (!state.pending?.authorizationUrl) {
      throw typedError('DESKTOP_AUTHORIZATION_NOT_PENDING', 'There is no pending Account authorization.');
    }
    await shell.openExternal(String(state.pending.authorizationUrl));
    return { ok: true, pending: publicPending(state.pending) };
  }

  async function completeConnection() {
    const secure = protectedStatus();
    if (!secure.available) throw typedError(secure.reason || 'PROTECTED_STORAGE_UNAVAILABLE', 'Protected storage is unavailable.');
    const state = readSecure();
    const pending = state.pending;
    const device = state.device;
    if (!pending?.desktopGrant || !pending.authorizationId || !pending.state || !pending.verifier) {
      throw typedError('DESKTOP_AUTHORIZATION_NOT_PENDING', 'There is no pending Account authorization.');
    }
    if (!device?.privateJwk || !device?.publicJwk) {
      throw typedError('DEVICE_PRIVATE_KEY_MISSING', 'Workspace device private key is unavailable.');
    }

    const challenge = desktopPkceChallenge(pending.verifier);
    const payload = exchangeSigningPayload(pending.authorizationId, pending.state, challenge);
    const signature = signExchange(device.privateJwk, payload);
    const result = await requestJson('/v1/desktop/exchange', {
      method: 'POST',
      body: {
        desktop_grant: pending.desktopGrant,
        state: pending.state,
        pkce_verifier: pending.verifier,
        signature
      }
    });

    if (!result.ok) {
      const code = result.payload?.error?.code || 'DESKTOP_EXCHANGE_FAILED';
      if (code === 'DESKTOP_AUTHORIZATION_PENDING') {
        return { ...baseStatus(state), pending_approval: true };
      }
      if (['DESKTOP_GRANT_INVALID', 'DESKTOP_SECURITY_STATE_CHANGED', 'DESKTOP_DEVICE_UNAVAILABLE'].includes(code)) {
        delete state.pending;
        writeSecure(state);
      }
      throw typedError(code, result.payload?.error?.message || 'Workspace Account connection could not be completed.');
    }

    const rawSessionToken = String(result.payload?.session?.token || '');
    if (!rawSessionToken) throw typedError('WORKSPACE_SESSION_TOKEN_MISSING', 'Account did not return a Workspace session token.');

    clearServiceGrantCache();
    state.session = {
      token: rawSessionToken,
      sessionId: String(result.payload.session.session_id || ''),
      deviceId: String(result.payload.session.device_id || ''),
      absoluteExpiresAt: Number(result.payload.session.absolute_expires_at || 0)
    };
    state.public = {
      account: cleanPublicAccount(result.payload.account),
      session: cleanPublicSession({ ...result.payload.session, token: undefined }),
      device: cleanPublicDevice(result.payload.device)
    };
    delete state.pending;
    writeSecure(state);
    return { ...baseStatus(state), connected_now: true };
  }

  async function acquireServiceGrant(serviceName) {
    const service = normalizeServiceGrantName(serviceName);
    const definition = SERVICE_GRANT_DEFINITIONS[service];
    const secure = protectedStatus();
    if (!secure.available) {
      throw typedError(
        secure.reason || 'PROTECTED_STORAGE_UNAVAILABLE',
        'Persistent Account connection requires OS-backed protected storage.'
      );
    }

    const state = readSecure();
    const parentToken = String(state.session?.token || '');
    const parentSessionId = String(state.session?.sessionId || '');
    if (!parentToken || !parentSessionId) {
      clearServiceGrantCache();
      throw typedError('ACCOUNT_NOT_CONNECTED', 'Workspace is not connected to IRGEZTNE Account.');
    }

    const nowSec = Math.floor(now() / 1000);
    const cached = serviceGrantCache.get(service);
    if (
      cached &&
      cached.parentSessionId === parentSessionId &&
      Number(cached.grant?.expires_at || 0) > nowSec + SERVICE_GRANT_REFRESH_SKEW_SECONDS
    ) {
      return cached.grant;
    }

    const result = await requestJson('/v1/services/grant', {
      method: 'POST',
      bearer: parentToken,
      body: {
        service: definition.service,
        scopes: [...definition.scopes]
      }
    });

    if (!result.ok) {
      const code = String(result.payload?.error?.code || 'SERVICE_GRANT_ISSUE_FAILED');
      if (result.status === 401 || code === 'SESSION_INVALID') {
        clearServiceGrantCache();
        delete state.session;
        state.public = { ...(state.public || {}), session: null };
        writeSecure(state);
      }
      throw typedError(
        code,
        String(result.payload?.error?.message || 'Account service authorization could not be issued.')
      );
    }

    const grant = validateServiceGrantPayload(result.payload?.grant, definition, nowSec);
    const parentAbsoluteExpiry = Number(state.session?.absoluteExpiresAt || 0);
    if (parentAbsoluteExpiry > 0 && grant.expires_at > parentAbsoluteExpiry) {
      throw typedError('SERVICE_GRANT_RESPONSE_INVALID', 'Service grant exceeds the parent Account session lifetime.');
    }

    serviceGrantCache.set(service, Object.freeze({ parentSessionId, grant }));
    return grant;
  }

  async function cancelConnection() {
    const secure = protectedStatus();
    if (!secure.available) return { ok: true, canceled: false, protected_storage: secure };
    const state = readSecure();
    const hadPending = Boolean(state.pending);
    delete state.pending;
    writeSecure(state);
    return { ...baseStatus(state), canceled: hadPending };
  }

  async function logout() {
    clearServiceGrantCache();
    const secure = protectedStatus();
    if (!secure.available) return { ok: true, signed_out: true, protected_storage: secure };
    const state = readSecure();
    const token = String(state.session?.token || '');
    let serverRevocationConfirmed = !token;
    if (token) {
      try {
        const result = await requestJson('/v1/session/logout', { method: 'POST', body: {}, bearer: token });
        serverRevocationConfirmed = Boolean(result.ok);
      } catch (_) {
        serverRevocationConfirmed = false;
      }
    }
    delete state.session;
    delete state.pending;
    state.public = { ...(state.public || {}), account: null, session: null };
    writeSecure(state);
    return { ...baseStatus(state), signed_out: true, server_revocation_confirmed: serverRevocationConfirmed };
  }

  return {
    getStatus,
    startConnection,
    openAuthorization,
    completeConnection,
    cancelConnection,
    logout,
    // Main-process transport adapters only. Raw service grants are intentionally
    // not registered on the Renderer Account IPC bridge.
    acquireServiceGrantForMain: acquireServiceGrant,
    protectedStorageStatus: protectedStatus
  };
}

function registerAccountDesktopIpc({ ipcMain, assertTrustedSender, getController }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('Account desktop IPC requires ipcMain');
  if (typeof assertTrustedSender !== 'function') throw new Error('Account desktop IPC requires sender guard');
  if (typeof getController !== 'function') throw new Error('Account desktop IPC requires controller factory');

  const guarded = (fn) => async (event, payload = {}) => {
    assertTrustedSender(event);
    try {
      return await fn(getController(), payload || {});
    } catch (error) {
      return {
        ok: false,
        code: error?.code || 'ACCOUNT_DESKTOP_ERROR',
        message: String(error?.message || 'Account desktop operation failed.'),
        details: error?.details || null
      };
    }
  };

  ipcMain.handle('account:desktop:status', guarded((controller) => controller.getStatus()));
  ipcMain.handle('account:desktop:start', guarded((controller, payload) => controller.startConnection(payload)));
  ipcMain.handle('account:desktop:open-authorization', guarded((controller) => controller.openAuthorization()));
  ipcMain.handle('account:desktop:complete', guarded((controller) => controller.completeConnection()));
  ipcMain.handle('account:desktop:cancel', guarded((controller) => controller.cancelConnection()));
  ipcMain.handle('account:desktop:logout', guarded((controller) => controller.logout()));
}

module.exports = {
  createAccountDesktopController,
  registerAccountDesktopIpc,
  accountDesktopInternals: Object.freeze({
    desktopStateHash,
    desktopPkceChallenge,
    exchangeSigningPayload,
    generateDeviceKeypair,
    signExchange,
    platformName,
    normalizeServiceGrantName,
    validateServiceGrantPayload,
    SERVICE_GRANT_DEFINITIONS
  })
};
