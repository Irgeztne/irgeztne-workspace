'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROFILE = 'irgeztne.identity-account.desktop.v0.3';
const ACCOUNT_AUDIENCE = 'account';
const ACCOUNT_ENVIRONMENT = 'prod';
const ACCOUNT_SUBJECT_PROFILE = 'v1';
const ACCOUNT_CREATE_SCOPE = 'account.create';
const ACCOUNT_READ_SCOPE = 'account.read';
const ACCOUNT_PROFILE_SCOPE = 'account.profile';
const ACCOUNT_SERVICE_GRANT_SCOPE = 'account.services.grant';
const SERVICE_GRANT_DEFINITIONS = Object.freeze({
  CHAT: Object.freeze({ service:'CHAT', scopes:Object.freeze(['chat:access']) }),
  WORKSHOP: Object.freeze({ service:'WORKSHOP', scopes:Object.freeze(['workshop:access']) })
});
const REQUEST_TIMEOUT_MS = 15_000;
const BODY_DIGEST_DOMAIN = Buffer.from('IRGEZTNE_HTTP_BODY_V1\0','utf8');

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function serializeJsonBody(value) {
  return JSON.stringify(value);
}

function requestBodyDigestFromText(text) {
  return crypto.createHash('sha256').update(BODY_DIGEST_DOMAIN).update(Buffer.from(String(text),'utf8')).digest('base64url');
}

function cleanBase(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  let url;
  try { url = new URL(raw); }
  catch (_) { throw typedError('ACCOUNT_NETWORK_CONFIG_INVALID', 'Account/Identity API URL is invalid.'); }
  const local = url.protocol === 'http:' && ['localhost','127.0.0.1','::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    throw typedError('ACCOUNT_NETWORK_CONFIG_INVALID', 'Account/Identity API must use HTTPS except localhost development.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw typedError('ACCOUNT_NETWORK_CONFIG_INVALID', 'Account/Identity API URL must be an origin/base path without credentials, query or fragment.');
  }
  return raw;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function atomicWriteJson(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding:'utf8', mode:0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch (_) {}
  fs.renameSync(tmp, file);
  try { fs.chmodSync(file, 0o600); } catch (_) {}
}

function cleanAccount(value) {
  const account = value && typeof value === 'object' ? value : null;
  if (!account) return null;
  const status = String(account.status || '');
  if (!String(account.account_id || '') || !status) return null;
  return Object.freeze({
    account_id: String(account.account_id),
    status,
    security_version: Number(account.security_version || 0),
    profile: Object.freeze({
      display_name: String(account.profile?.display_name || ''),
      handle: account.profile?.handle ? String(account.profile.handle) : null
    })
  });
}

function publicIdentity(value) {
  const x = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    exists: Boolean(x.exists),
    status: String(x.status || ''),
    identity_id: x.identity_id ? String(x.identity_id) : null,
    device_id: x.device_id ? String(x.device_id) : null,
    recovery_epoch: Number(x.recovery_epoch || 0),
    sequence: Number(x.sequence || 0),
    head_hash: x.head_hash ? String(x.head_hash) : null,
    recovery_provisioned: Boolean(x.recovery_provisioned),
    recovery_restore_tested: Boolean(x.recovery_restore_tested),
    recovery_package_fingerprint: x.recovery_package_fingerprint ? String(x.recovery_package_fingerprint) : null,
    recovery_provisioned_at: Number(x.recovery_provisioned_at || 0) || null,
    recovery_restore_tested_at: Number(x.recovery_restore_tested_at || 0) || null,
    protected_storage: Object.freeze({
      available: Boolean(x.protected_storage?.available),
      backend: String(x.protected_storage?.backend || 'unknown'),
      reason: x.protected_storage?.reason ? String(x.protected_storage.reason) : null
    })
  });
}

function isAccountActive(account) {
  return Boolean(account && account.status === 'ACTIVE');
}


function serviceGrantDefinition(value) {
  const service = String(value || '').trim().toUpperCase();
  const definition = SERVICE_GRANT_DEFINITIONS[service];
  if (!definition) throw typedError('SERVICE_UNSUPPORTED', 'Unsupported Account service grant.');
  return definition;
}

function cleanServiceGrant(value, definition, nowSec) {
  const grant = value && typeof value === 'object' ? value : null;
  if (!grant) throw typedError('SERVICE_GRANT_RESPONSE_INVALID', 'Account returned an invalid service grant.');
  const token = String(grant.token || '');
  const service = String(grant.service || '').toUpperCase();
  const scopes = Array.isArray(grant.scopes) ? grant.scopes.map((x)=>String(x||'')).sort() : [];
  const expected = [...definition.scopes].sort();
  const expiresAt = Number(grant.expires_at || 0);
  if (service !== definition.service || String(grant.token_type || '') !== 'Bearer' ||
      !/^[A-Za-z0-9_-]{20,}$/.test(token) || scopes.length !== expected.length ||
      scopes.some((scope,index)=>scope !== expected[index]) || !Number.isFinite(expiresAt) || expiresAt <= nowSec) {
    throw typedError('SERVICE_GRANT_RESPONSE_INVALID', 'Account returned an invalid service grant.');
  }
  return Object.freeze({
    grant_id:String(grant.grant_id || ''), token, token_type:'Bearer', service,
    scopes:Object.freeze(expected), created_at:Number(grant.created_at || nowSec),
    expires_at:expiresAt, expires_in_seconds:Math.max(0, expiresAt-nowSec)
  });
}

function createIdentityAccountController({
  app,
  fetchImpl,
  getIdentityController,
  getLegacyAccountStatus,
  identityApiBase = process.env.IRGEZTNE_IDENTITY_API_URL || '',
  accountApiBase = process.env.IRGEZTNE_ACCOUNT_API_URL || '',
  serviceEnvironment = process.env.IRGEZTNE_IDENTITY_SERVICE_ENVIRONMENT || ACCOUNT_ENVIRONMENT,
  allowUnprovisionedRecovery = String(process.env.IRGEZTNE_ACCOUNT_ALLOW_UNPROVISIONED_RECOVERY || '').toLowerCase() === 'true',
  allowNewAccount = String(process.env.IRGEZTNE_ACCOUNT_IDENTITY_ALLOW_NEW_ACCOUNT || '').toLowerCase() === 'true',
  now = () => Date.now(),
  cacheFile
} = {}) {
  if (!app || typeof app.getPath !== 'function') throw new Error('Identity Account controller requires Electron app.');
  if (typeof getIdentityController !== 'function') throw new Error('Identity Account controller requires Identity Core.');
  if (typeof fetchImpl !== 'function') throw new Error('Identity Account controller requires a fetch implementation.');

  const identityBase = cleanBase(identityApiBase);
  const accountBase = cleanBase(accountApiBase);
  const dataDir = path.join(app.getPath('userData'), 'data');
  const publicCacheFile = cacheFile || path.join(dataDir, 'identity-account-public-v1.json');

  function readCache() {
    try {
      if (!fs.existsSync(publicCacheFile)) return null;
      const parsed = JSON.parse(fs.readFileSync(publicCacheFile, 'utf8'));
      if (!parsed || parsed.version !== 1 || parsed.profile !== PROFILE) return null;
      return {
        account: cleanAccount(parsed.account),
        last_sync_at: Number(parsed.last_sync_at || 0)
      };
    } catch (_) { return null; }
  }

  function writeCache(account) {
    const clean = cleanAccount(account);
    if (!clean) return;
    atomicWriteJson(publicCacheFile, {
      version: 1,
      profile: PROFILE,
      account: clean,
      last_sync_at: Math.floor(now() / 1000)
    });
  }

  async function legacyStatus() {
    if (typeof getLegacyAccountStatus !== 'function') return null;
    try { return await getLegacyAccountStatus(); }
    catch (_) { return null; }
  }

  function networkStatus() {
    return Object.freeze({
      configured: Boolean(identityBase && accountBase),
      identity_api_configured: Boolean(identityBase),
      account_api_configured: Boolean(accountBase),
      service_environment: String(serviceEnvironment || ACCOUNT_ENVIRONMENT),
      new_account_enabled: Boolean(allowNewAccount),
      allow_unprovisioned_recovery: Boolean(allowUnprovisionedRecovery)
    });
  }

  async function getStatus() {
    const identity = publicIdentity(await Promise.resolve(getIdentityController().getStatus()));
    const cache = readCache();
    const legacy = await legacyStatus();
    const account = cache?.account || null;
    return Object.freeze({
      ok: true,
      mode: isAccountActive(account) ? 'account' : (identity.exists ? 'identity-only' : 'local'),
      connected: isAccountActive(account),
      identity,
      account,
      recovery_status: identity.exists && !identity.recovery_provisioned ? 'RECOVERY_NOT_PROVISIONED' : (identity.exists ? 'RECOVERY_READY' : 'NOT_CREATED'),
      network: networkStatus(),
      legacy_connected: Boolean(legacy?.connected),
      legacy_account: legacy?.connected ? cleanAccount(legacy.account) : null,
      last_sync_at: Number(cache?.last_sync_at || 0)
    });
  }

  async function requestJson(base, pathname, { method='GET', body, headers={} } = {}) {
    if (!base) throw typedError('ACCOUNT_NETWORK_NOT_CONFIGURED', 'IRGEZTNE Identity/Account network endpoint is not configured.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const requestHeaders = { Accept:'application/json', ...headers };
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    try {
      const response = await fetchImpl(`${base}${pathname}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : serializeJsonBody(body),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = String(payload?.error?.code || 'ACCOUNT_NETWORK_REQUEST_FAILED');
        const message = String(payload?.error?.message || `IRGEZTNE network request failed (${response.status}).`);
        throw typedError(code, message, { status: response.status, pathname });
      }
      return payload;
    } catch (error) {
      if (error?.code) throw error;
      if (error?.name === 'AbortError') throw typedError('ACCOUNT_NETWORK_TIMEOUT', 'IRGEZTNE Account/Identity service did not respond in time.');
      throw typedError('ACCOUNT_NETWORK_UNREACHABLE', 'IRGEZTNE Account/Identity service is currently unreachable.');
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureNetwork() {
    if (!identityBase || !accountBase) throw typedError('ACCOUNT_NETWORK_NOT_CONFIGURED', 'Identity and Account API URLs must both be configured.');
  }

  async function ensureIdentityCreated() {
    const controller = getIdentityController();
    let status = await Promise.resolve(controller.getStatus());
    if (!status?.exists) status = await Promise.resolve(controller.create());
    if (!status?.exists) throw typedError('IDENTITY_CREATE_FAILED', 'IRGEZTNE Identity was not created.');
    return status;
  }

  async function requireExistingIdentity() {
    const status = await Promise.resolve(getIdentityController().getStatus());
    if (!status?.exists) {
      throw typedError('IDENTITY_NOT_CREATED', 'IRGEZTNE Identity does not exist on this Workspace installation.');
    }
    return status;
  }

  async function syncIdentityJournal() {
    const controller = getIdentityController();
    const publicJournal = controller.getPublicJournalForMain();
    const genesisEvent = publicJournal?.journal?.[0];
    if (!genesisEvent) throw typedError('IDENTITY_PUBLIC_JOURNAL_INVALID', 'Identity public journal has no Genesis event.');
    const genesisOnly = {
      identity_id: publicJournal.identity_id,
      genesis_digest: publicJournal.genesis_digest,
      journal: [genesisEvent],
      high_water: { recovery_epoch:0, sequence:0, head_hash:genesisEvent.event_hash }
    };
    await requestJson(identityBase, '/v1/registry/genesis', { method:'POST', body:{ public_journal:genesisOnly } });
    if (publicJournal.journal.length === 1) return { ok:true, head_hash:genesisEvent.event_hash };

    const headPayload = await requestJson(identityBase, `/v1/registry/head/${encodeURIComponent(publicJournal.identity_id)}`);
    let expected = String(headPayload?.head?.head_hash || '');
    let index = publicJournal.journal.findIndex((event) => String(event?.event_hash || '') === expected);
    if (index < 0) throw typedError('IDENTITY_REGISTRY_FORK_OR_ROLLBACK', 'Registry head is not an ancestor of the local Identity journal.');
    for (let i = index + 1; i < publicJournal.journal.length; i += 1) {
      const event = publicJournal.journal[i];
      const result = await requestJson(identityBase, '/v1/registry/events', {
        method:'POST',
        body:{ identity_id:publicJournal.identity_id, expected_head:expected, event }
      });
      expected = String(result?.head_hash || '');
      if (expected !== String(event.event_hash || '')) throw typedError('IDENTITY_REGISTRY_APPEND_INVALID', 'Registry returned an unexpected Identity head after append.');
    }
    if (expected !== String(publicJournal.high_water?.head_hash || '')) throw typedError('IDENTITY_REGISTRY_SYNC_INCOMPLETE', 'Registry did not reach the local Identity journal head.');
    return { ok:true, head_hash:expected };
  }

  async function acquireCapability(scopes) {
    const controller = getIdentityController();
    const challengePayload = await requestJson(identityBase, '/v1/auth/challenge', {
      method:'POST',
      body:{
        audience: ACCOUNT_AUDIENCE,
        scopes,
        environment: String(serviceEnvironment || ACCOUNT_ENVIRONMENT),
        ttl_seconds: 120
      }
    });
    const challenge = challengePayload || {};
    const created = controller.createAuthDelegationForMain({
      challengeId: challenge.challenge_id,
      challenge: challenge.challenge,
      audience: ACCOUNT_AUDIENCE,
      scopes,
      serviceEnvironment: String(serviceEnvironment || ACCOUNT_ENVIRONMENT),
      subjectProfileVersion: ACCOUNT_SUBJECT_PROFILE,
      expiresAt: Number(challenge.expires_at || 0),
      nowSeconds: Math.floor(now() / 1000)
    });
    const exchanged = await requestJson(identityBase, '/v1/auth/exchange', {
      method:'POST',
      body:{ delegation: created.delegation }
    });
    if (!exchanged?.capability || !exchanged?.subject || !exchanged?.expires_at) {
      controller.dropServiceSessionForMain(created.session_handle);
      throw typedError('IDENTITY_CAPABILITY_RESPONSE_INVALID', 'Identity verifier returned an incomplete capability.');
    }
    return {
      session_handle: created.session_handle,
      capability: String(exchanged.capability),
      subject: String(exchanged.subject),
      expires_at: Number(exchanged.expires_at)
    };
  }

  async function accountRequest(pathname, method, requiredScopes, requestBody) {
    const controller = getIdentityController();
    const cap = await acquireCapability(requiredScopes);
    try {
      const body = method === 'POST' ? (requestBody === undefined ? {} : requestBody) : undefined;
      const bodyText = body === undefined ? '' : serializeJsonBody(body);
      const proof = controller.createCapabilityProofForMain(cap.session_handle, {
        capability: cap.capability,
        method,
        path: pathname,
        bodyDigest: body === undefined ? '' : requestBodyDigestFromText(bodyText),
        nowSeconds: Math.floor(now() / 1000)
      });
      return await requestJson(accountBase, pathname, {
        method,
        body,
        headers:{
          Authorization:`IRGEZTNE-Capability ${cap.capability}`,
          'IRGEZTNE-Proof':proof
        }
      });
    } finally {
      controller.dropServiceSessionForMain(cap.session_handle);
    }
  }

  async function createAccount() {
    await ensureNetwork();
    if (!allowNewAccount) {
      throw typedError('ACCOUNT_IDENTITY_NEW_ACCOUNT_DISABLED', 'New Identity-based Account creation is disabled in this environment.');
    }
    // Historical pre-Identity Account state is not an ownership authority and does not
    // block the new Identity-first Account path. No automatic linking or deletion occurs.
    await legacyStatus();
    const local = await ensureIdentityCreated();
    if (!local.recovery_provisioned && !allowUnprovisionedRecovery) {
      throw typedError('IDENTITY_RECOVERY_NOT_PROVISIONED', 'Recovery package must be provisioned before Account activation in this environment.');
    }
    await syncIdentityJournal();
    const payload = await accountRequest('/v1/account/identity/create', 'POST', [ACCOUNT_CREATE_SCOPE]);
    const account = cleanAccount(payload?.account);
    if (!account) throw typedError('ACCOUNT_CREATE_RESPONSE_INVALID', 'Account service returned an invalid Account record.');
    writeCache(account);
    return { ...(await getStatus()), created:Boolean(payload?.created) };
  }

  async function refreshAccount() {
    await ensureNetwork();
    const identity = await requireExistingIdentity();
    if (!identity.recovery_provisioned && !allowUnprovisionedRecovery) {
      throw typedError('IDENTITY_RECOVERY_NOT_PROVISIONED', 'Recovery package must be provisioned before Account network authentication in this environment.');
    }
    await syncIdentityJournal();
    const payload = await accountRequest('/v1/account/identity/me', 'GET', [ACCOUNT_READ_SCOPE]);
    const account = cleanAccount(payload?.account);
    if (!account) throw typedError('ACCOUNT_READ_RESPONSE_INVALID', 'Account service returned an invalid Account record.');
    writeCache(account);
    return getStatus();
  }

  async function updateProfile(input = {}) {
    await ensureNetwork();
    const identity = await requireExistingIdentity();
    if (!identity.recovery_provisioned && !allowUnprovisionedRecovery) {
      throw typedError('IDENTITY_RECOVERY_NOT_PROVISIONED', 'Recovery package must be provisioned before Account profile changes in this environment.');
    }
    const payload = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const body = {};
    if (Object.prototype.hasOwnProperty.call(payload, 'display_name')) {
      const displayName = String(payload.display_name ?? '').normalize('NFC').trim();
      if (displayName.length > 80) throw typedError('DISPLAY_NAME_INVALID', 'Display name must be 80 characters or fewer.');
      body.display_name = displayName;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'handle')) {
      const rawHandle = payload.handle === null ? '' : String(payload.handle || '').trim().toLowerCase();
      if (rawHandle && !/^[a-z0-9_]{3,30}$/.test(rawHandle)) {
        throw typedError('HANDLE_INVALID', 'Handle must be 3-30 lowercase ASCII letters, digits, or underscores.');
      }
      body.handle = rawHandle || null;
    }
    if (!Object.keys(body).length) throw typedError('PROFILE_UPDATE_EMPTY', 'No profile fields were supplied.');
    await syncIdentityJournal();
    const response = await accountRequest('/v1/account/identity/profile', 'POST', [ACCOUNT_PROFILE_SCOPE], body);
    const account = cleanAccount(response?.account);
    if (!account) throw typedError('ACCOUNT_PROFILE_RESPONSE_INVALID', 'Account service returned an invalid updated profile.');
    writeCache(account);
    return { ...(await getStatus()), changed:Boolean(response?.changed) };
  }

  async function acquireServiceGrant(serviceName) {
    await ensureNetwork();
    const identity = await requireExistingIdentity();
    if (!identity.recovery_provisioned && !allowUnprovisionedRecovery) {
      throw typedError('IDENTITY_RECOVERY_NOT_PROVISIONED', 'Recovery package must be provisioned before connected service authorization.');
    }
    const definition = serviceGrantDefinition(serviceName);
    await syncIdentityJournal();
    const response = await accountRequest(
      '/v1/account/identity/services/grant',
      'POST',
      [ACCOUNT_SERVICE_GRANT_SCOPE],
      { service:definition.service, scopes:[...definition.scopes] }
    );
    return cleanServiceGrant(response?.grant, definition, Math.floor(now()/1000));
  }

  async function disconnectLocal() {
    try { if (fs.existsSync(publicCacheFile)) fs.rmSync(publicCacheFile, { force:true }); }
    catch (error) { throw typedError('ACCOUNT_LOCAL_DISCONNECT_FAILED', 'Could not disconnect Account from this Workspace installation.'); }
    return getStatus();
  }

  return Object.freeze({ getStatus, createAccount, refreshAccount, updateProfile, disconnectLocal, networkStatus, syncIdentityJournalForMain:syncIdentityJournal, acquireServiceGrantForMain:acquireServiceGrant });
}

function registerIdentityAccountIpc({ ipcMain, assertTrustedSender, getController }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('Identity Account IPC requires ipcMain.');
  if (typeof assertTrustedSender !== 'function') throw new Error('Identity Account IPC requires sender guard.');
  if (typeof getController !== 'function') throw new Error('Identity Account IPC requires controller factory.');

  const guarded = (fn) => async (event, payload) => {
    assertTrustedSender(event);
    try { return await fn(getController(), payload); }
    catch (error) {
      return {
        ok:false,
        code:error?.code || 'IDENTITY_ACCOUNT_ERROR',
        message:String(error?.message || 'IRGEZTNE Account operation failed.'),
        details:error?.details || null
      };
    }
  };

  ipcMain.handle('identity-account:status', guarded((controller) => controller.getStatus()));
  ipcMain.handle('identity-account:create', guarded((controller) => controller.createAccount()));
  ipcMain.handle('identity-account:refresh', guarded((controller) => controller.refreshAccount()));
  ipcMain.handle('identity-account:update-profile', guarded((controller, payload) => controller.updateProfile(payload)));
  ipcMain.handle('identity-account:disconnect-local', guarded((controller) => controller.disconnectLocal()));
}

module.exports = {
  createIdentityAccountController,
  registerIdentityAccountIpc,
  identityAccountInternals:Object.freeze({
    PROFILE,
    ACCOUNT_AUDIENCE,
    ACCOUNT_CREATE_SCOPE,
    ACCOUNT_READ_SCOPE,
    ACCOUNT_PROFILE_SCOPE,
    ACCOUNT_SERVICE_GRANT_SCOPE,
    SERVICE_GRANT_DEFINITIONS,
    cleanBase,
    cleanAccount
  })
};
