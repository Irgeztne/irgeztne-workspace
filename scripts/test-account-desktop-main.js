'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  createAccountDesktopController,
  accountDesktopInternals
} = require('../src/account/account-desktop-main.cjs');
const {
  createAccountSecureStore,
  protectedStorageStatus
} = require('../src/account/account-secure-store.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-account-desktop-'));
}

function fakeSafeStorage(backend = 'secret_service') {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => backend,
    encryptString(value) {
      return Buffer.from('IRGTEST:' + Buffer.from(String(value), 'utf8').toString('base64'), 'utf8');
    },
    decryptString(buffer) {
      const raw = Buffer.from(buffer).toString('utf8');
      if (!raw.startsWith('IRGTEST:')) throw new Error('bad ciphertext');
      return Buffer.from(raw.slice(8), 'base64').toString('utf8');
    }
  };
}

function fixture() {
  const dir = tempDir();
  const opened = [];
  const requests = [];
  let exchangeMode = 'success';
  let sessionToken = 'workspace-secret-session-token';
  let serviceGrantMode = 'success';
  let serviceGrantSequence = 0;
  const accountId = 'acct-test-1';
  const sessionId = 'sess-workspace-1';
  const deviceId = 'device-workspace-1';

  async function fetchImpl(url, options = {}) {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ path: parsed.pathname, method: options.method || 'GET', body, headers: options.headers || {} });

    if (parsed.pathname === '/v1/desktop/start') {
      return Response.json({
        ok: true,
        authorization: {
          authorization_id: 'grant-id-1',
          authorization_url: 'https://account.irgeztne.com/desktop-authorize.html?request=grant-id-1',
          desktop_grant: 'desktop-one-time-secret',
          expires_at: 2000000000
        }
      });
    }

    if (parsed.pathname === '/v1/desktop/exchange') {
      if (exchangeMode === 'pending') {
        return Response.json({ ok: false, error: { code: 'DESKTOP_AUTHORIZATION_PENDING', message: 'pending' } }, { status: 409 });
      }
      return Response.json({
        ok: true,
        account: {
          account_id: accountId,
          status: 'ACTIVE',
          email: 'owner@example.com',
          profile: { display_name: 'Owner', handle: 'owner' }
        },
        device: {
          device_id: deviceId,
          label: 'IRGEZTNE Workspace',
          platform: 'LINUX',
          status: 'ACTIVE',
          key_algorithm: 'P-256/ES256',
          approved_at: 1700000000,
          last_seen_at: 1700000000
        },
        session: {
          token: sessionToken,
          session_id: sessionId,
          client_kind: 'WORKSPACE',
          device_id: deviceId,
          last_seen_at: 1700000000,
          idle_expires_at: 1700600000,
          absolute_expires_at: 1702500000
        }
      });
    }

    if (parsed.pathname === '/v1/session' && (options.method || 'GET') === 'GET') {
      if (options.headers?.Authorization !== `Bearer ${sessionToken}`) {
        return Response.json({ ok: false, error: { code: 'SESSION_INVALID' } }, { status: 401 });
      }
      return Response.json({
        ok: true,
        account: {
          account_id: accountId,
          status: 'ACTIVE',
          email: 'owner@example.com',
          profile: { display_name: 'Owner', handle: 'owner' }
        },
        session: {
          session_id: sessionId,
          client_kind: 'WORKSPACE',
          device_id: deviceId,
          last_seen_at: 1700000000,
          idle_expires_at: 1700600000,
          absolute_expires_at: 1702500000
        }
      });
    }

    if (parsed.pathname === '/v1/services/grant') {
      if (options.headers?.Authorization !== `Bearer ${sessionToken}`) {
        return Response.json({ ok: false, error: { code: 'SESSION_INVALID' } }, { status: 401 });
      }
      if (serviceGrantMode === 'invalid-service') {
        return Response.json({
          ok: true,
          grant: {
            grant_id: 'grant-bad', token: 'service-grant-bad-token-1234567890', token_type: 'Bearer',
            service: 'WORKSHOP', scopes: ['workshop:access'], created_at: 1700000000, expires_at: 1700000900
          }
        });
      }
      serviceGrantSequence += 1;
      const service = String(body?.service || '');
      const scopes = Array.isArray(body?.scopes) ? body.scopes : [];
      return Response.json({
        ok: true,
        grant: {
          grant_id: `service-grant-${serviceGrantSequence}`,
          token: `service-${service.toLowerCase()}-token-${serviceGrantSequence}-abcdefghijklmnop`,
          token_type: 'Bearer',
          service,
          scopes,
          created_at: 1700000000,
          expires_at: 1700000900,
          expires_in_seconds: 900
        }
      });
    }

    if (parsed.pathname === '/v1/session/logout') {
      return Response.json({ ok: true, logged_out: true });
    }

    return Response.json({ ok: false }, { status: 404 });
  }

  const controller = createAccountDesktopController({
    app: { getPath: (name) => { assert.equal(name, 'userData'); return dir; } },
    safeStorage: fakeSafeStorage(),
    shell: { openExternal: async (url) => { opened.push(String(url)); } },
    fetchImpl,
    apiBase: 'https://account.irgeztne.test',
    now: () => 1700000000000
  });

  return {
    dir, opened, requests, controller,
    setExchangeMode(value) { exchangeMode = value; },
    setServiceGrantMode(value) { serviceGrantMode = value; },
    sessionToken,
    accountId,
    sessionId,
    deviceId
  };
}

function findSecureFile(dir) {
  return path.join(dir, 'data', 'account-secure-v1.json');
}

test('protected storage refuses unavailable encryption and Linux basic_text', () => {
  assert.equal(protectedStorageStatus({ isEncryptionAvailable: () => false }).available, false);
  const basic = protectedStorageStatus(fakeSafeStorage('basic_text'));
  assert.equal(basic.available, false);
  assert.equal(basic.reason, 'UNPROTECTED_LINUX_BASIC_TEXT');
  const good = protectedStorageStatus(fakeSafeStorage('secret_service'));
  assert.equal(good.available, true);
});

test('secure store encrypts persistent Account state and does not use same-disk fallback', () => {
  const dir = tempDir();
  const store = createAccountSecureStore({ safeStorage: fakeSafeStorage(), dataDir: dir });
  const secret = {
    session: { token: 'raw-session-secret' },
    device: { privateJwk: { d: 'raw-private-key-component' } }
  };
  store.write(secret);
  assert.deepEqual(store.read(), secret);
  const raw = fs.readFileSync(path.join(dir, 'account-secure-v1.json'), 'utf8');
  assert.equal(raw.includes('raw-session-secret'), false);
  assert.equal(raw.includes('raw-private-key-component'), false);
  assert.equal(fs.existsSync(path.join(dir, 'storage-secret.key')), false);
});

test('desktop start sends only public device key and hashes of state/PKCE while keeping raw secrets in protected Main state', async () => {
  const f = fixture();
  const result = await f.controller.startConnection({ label: 'My Workspace' });
  assert.equal(result.ok, true);
  assert.equal(result.connected, false);
  assert.equal(f.opened.length, 1);

  const request = f.requests.find((item) => item.path === '/v1/desktop/start');
  assert.ok(request);
  assert.match(request.body.state_hash, /^[a-f0-9]{64}$/);
  assert.match(request.body.pkce_challenge, /^[a-f0-9]{64}$/);
  assert.equal(request.body.public_key_jwk.kty, 'EC');
  assert.equal(Object.hasOwn(request.body.public_key_jwk, 'd'), false);
  assert.equal(JSON.stringify(request.body).includes('desktop-one-time-secret'), false);

  const rendered = JSON.stringify(result);
  assert.equal(rendered.includes('desktop-one-time-secret'), false);
  assert.equal(rendered.includes('privateJwk'), false);
  assert.equal(rendered.includes('pkce'), false);

  const fileRaw = fs.readFileSync(findSecureFile(f.dir), 'utf8');
  assert.equal(fileRaw.includes('desktop-one-time-secret'), false);
  assert.equal(fileRaw.includes('"d"'), false);
});

test('pending browser approval does not consume local request and public status leaks no exchange secret', async () => {
  const f = fixture();
  await f.controller.startConnection();
  f.setExchangeMode('pending');
  const result = await f.controller.completeConnection();
  assert.equal(result.pending_approval, true);
  assert.ok(result.pending);
  const publicJson = JSON.stringify(result);
  assert.equal(publicJson.includes('desktop-one-time-secret'), false);
  assert.equal(publicJson.includes('privateJwk'), false);
});

test('successful exchange proves the device key, stores Workspace bearer token only in protected Main state, and returns public status', async () => {
  const f = fixture();
  await f.controller.startConnection();
  const result = await f.controller.completeConnection();
  assert.equal(result.connected, true);
  assert.equal(result.connected_now, true);
  assert.equal(result.account.account_id, f.accountId);
  assert.equal(result.session.client_kind, 'WORKSPACE');
  assert.equal(result.device.device_id, f.deviceId);

  const exchange = f.requests.find((item) => item.path === '/v1/desktop/exchange');
  assert.ok(exchange);
  assert.equal(typeof exchange.body.desktop_grant, 'string');
  assert.equal(typeof exchange.body.state, 'string');
  assert.equal(typeof exchange.body.pkce_verifier, 'string');
  assert.match(exchange.body.signature, /^[A-Za-z0-9_-]+$/);
  assert.equal(exchange.body.public_key_jwk, undefined);

  const raw = fs.readFileSync(findSecureFile(f.dir), 'utf8');
  assert.equal(raw.includes(f.sessionToken), false);
  assert.equal(raw.includes('desktop-one-time-secret'), false);

  const publicJson = JSON.stringify(result);
  assert.equal(publicJson.includes(f.sessionToken), false);
  assert.equal(publicJson.includes('desktop-one-time-secret'), false);
  assert.equal(publicJson.includes('privateJwk'), false);

  const refreshed = await f.controller.getStatus();
  assert.equal(refreshed.connected, true);
  assert.equal(refreshed.account.account_id, f.accountId);
  const sessionRequest = f.requests.find((item) => item.path === '/v1/session' && item.method === 'GET');
  assert.equal(sessionRequest.headers.Authorization, `Bearer ${f.sessionToken}`);
});

test('logout attempts server revocation then clears local Workspace session even if renderer never sees bearer token', async () => {
  const f = fixture();
  await f.controller.startConnection();
  await f.controller.completeConnection();
  const result = await f.controller.logout();
  assert.equal(result.signed_out, true);
  assert.equal(result.connected, false);
  assert.equal(result.server_revocation_confirmed, true);
  const state = JSON.parse(fakeSafeStorage().decryptString(Buffer.from(JSON.parse(fs.readFileSync(findSecureFile(f.dir), 'utf8')).ciphertext, 'base64')));
  assert.equal(state.session, undefined);
});

test('Main-only service grant broker refuses use before Account connection', async () => {
  const f = fixture();
  await assert.rejects(
    () => f.controller.acquireServiceGrantForMain('CHAT'),
    (error) => error && error.code === 'ACCOUNT_NOT_CONNECTED'
  );
});

test('Main-only service grant broker mints fixed Chat and Workshop scopes with the master session hidden', async () => {
  const f = fixture();
  await f.controller.startConnection();
  await f.controller.completeConnection();

  const chat1 = await f.controller.acquireServiceGrantForMain('CHAT');
  const chat2 = await f.controller.acquireServiceGrantForMain('CHAT');
  assert.equal(chat1.token, chat2.token, 'valid Chat grant should be cached in Main until near expiry');
  assert.equal(chat1.service, 'CHAT');
  assert.deepEqual([...chat1.scopes], ['chat:access']);
  assert.notEqual(chat1.token, f.sessionToken);

  const workshop = await f.controller.acquireServiceGrantForMain('WORKSHOP');
  assert.equal(workshop.service, 'WORKSHOP');
  assert.deepEqual([...workshop.scopes], ['workshop:access']);
  assert.notEqual(workshop.token, f.sessionToken);
  assert.notEqual(workshop.token, chat1.token);

  const grantRequests = f.requests.filter((item) => item.path === '/v1/services/grant');
  assert.equal(grantRequests.length, 2, 'one request per service because Main cache reuses the Chat grant');
  assert.deepEqual(grantRequests[0].body, { service: 'CHAT', scopes: ['chat:access'] });
  assert.deepEqual(grantRequests[1].body, { service: 'WORKSHOP', scopes: ['workshop:access'] });
  for (const request of grantRequests) {
    assert.equal(request.headers.Authorization, `Bearer ${f.sessionToken}`);
  }

  const rendererSafeAccountStatus = await f.controller.getStatus();
  const statusJson = JSON.stringify(rendererSafeAccountStatus);
  assert.equal(statusJson.includes(f.sessionToken), false);
  assert.equal(statusJson.includes(chat1.token), false);
  assert.equal(statusJson.includes(workshop.token), false);
});

test('service grant broker rejects a cross-service or malformed grant response', async () => {
  const f = fixture();
  await f.controller.startConnection();
  await f.controller.completeConnection();
  f.setServiceGrantMode('invalid-service');
  await assert.rejects(
    () => f.controller.acquireServiceGrantForMain('CHAT'),
    (error) => error && error.code === 'SERVICE_GRANT_RESPONSE_INVALID'
  );
});

test('desktop hash/signing helpers are deterministic and distinct by domain separation', () => {
  assert.equal(accountDesktopInternals.desktopStateHash('x'), accountDesktopInternals.desktopStateHash('x'));
  assert.notEqual(accountDesktopInternals.desktopStateHash('x'), accountDesktopInternals.desktopPkceChallenge('x'));
  const pair = accountDesktopInternals.generateDeviceKeypair();
  assert.equal(pair.publicJwk.kty, 'EC');
  assert.equal(Object.hasOwn(pair.publicJwk, 'd'), false);
  assert.equal(typeof pair.privateJwk.d, 'string');
  const payload = accountDesktopInternals.exchangeSigningPayload('g', 's', 'p');
  const signature = accountDesktopInternals.signExchange(pair.privateJwk, payload);
  const pub = crypto.createPublicKey({ key: pair.publicJwk, format: 'jwk' });
  assert.equal(crypto.verify('sha256', Buffer.from(payload), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
});
