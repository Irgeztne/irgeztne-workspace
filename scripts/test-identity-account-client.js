'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createIdentityAccountController, identityAccountInternals } = require('../src/identity/identity-account-main.cjs');

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers:{'content-type':'application/json'} });
}

function fakeIdentity() {
  const calls = [];
  let exists = false;
  let proofSeq = 0;
  return {
    calls,
    getStatus() {
      return {
        ok:true, exists, status:exists ? 'RECOVERY_NOT_PROVISIONED' : 'NOT_CREATED',
        identity_id:exists ? 'ciqidentityexample0000000000000000000000000000000000000000' : null,
        device_id:exists ? 'dev_example0000000000000000000000000000000000000000' : null,
        recovery_epoch:0, sequence:0, head_hash:exists ? 'head-example' : null,
        recovery_provisioned:false, recovery_restore_tested:false,
        protected_storage:{available:true,backend:'windows-dpapi',reason:null}
      };
    },
    create() { exists = true; calls.push('create'); return this.getStatus(); },
    getPublicJournalForMain() { calls.push('journal'); return {identity_id:this.getStatus().identity_id,genesis_digest:'genesis-digest',journal:[{event_hash:'head-example',body:{event_type:'GENESIS'}}],high_water:{recovery_epoch:0,sequence:0,head_hash:'head-example'}}; },
    createAuthDelegationForMain(input) { calls.push(['delegation',input.audience,[...input.scopes]]); return {session_handle:'session-handle',delegation:{body:{audience:input.audience},signature:{signature:'sig'}}}; },
    createCapabilityProofForMain(handle,input) { calls.push(['proof',handle,input.method,input.path]); proofSeq += 1; return `proof-${proofSeq}`; },
    dropServiceSessionForMain(handle) { calls.push(['drop',handle]); return true; }
  };
}

function harness({ legacyConnected=false, allowNewAccount=true, allowUnprovisionedRecovery=true }={}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-account-v03-'));
  const identity = fakeIdentity();
  const requests = [];
  let accountProfile = { display_name:'', handle:null };
  async function fetchImpl(url, init={}) {
    const u = new URL(String(url));
    const body = init.body ? JSON.parse(String(init.body)) : null;
    requests.push({url:u.toString(),path:u.pathname,method:String(init.method||'GET'),headers:Object.fromEntries(new Headers(init.headers||{})),body});
    if (u.origin === 'https://identity.test' && u.pathname === '/v1/registry/genesis') return response(201,{ok:true,created:true,identity_id:'id'});
    if (u.origin === 'https://identity.test' && u.pathname.startsWith('/v1/registry/head/')) return response(200,{ok:true,head:{head_hash:'head-example'}});
    if (u.origin === 'https://identity.test' && u.pathname === '/v1/registry/events') return response(201,{ok:true,head_hash:String(body && body.event && body.event.event_hash || '')});
    if (u.origin === 'https://identity.test' && u.pathname === '/v1/auth/challenge') return response(201,{ok:true,challenge_id:'challenge_id_123456789',challenge:'A'.repeat(43),audience:'account',scopes:body.scopes,environment:'prod',expires_at:1700000120});
    if (u.origin === 'https://identity.test' && u.pathname === '/v1/auth/exchange') return response(201,{ok:true,capability:'c'.repeat(43),subject:'s'.repeat(52),audience:'account',scopes:['account.create'],binding_profile:'irgeztne.identity-account.v1',expires_at:1700000120});
    if (u.origin === 'https://account.test' && u.pathname === '/v1/account/identity/create') {
      assert.match(String(init.headers.Authorization || init.headers.authorization || ''), /^IRGEZTNE-Capability /);
      assert.ok(String(init.headers['IRGEZTNE-Proof'] || init.headers['irgeztne-proof'] || '').startsWith('proof-'));
      return response(201,{ok:true,created:true,account:{account_id:'acc_test_1234567890',status:'ACTIVE',security_version:1,profile:{...accountProfile}}});
    }
    if (u.origin === 'https://identity.test' && u.pathname === '/v1/auth/exchange') throw new Error('unexpected');
    if (u.origin === 'https://account.test' && u.pathname === '/v1/account/identity/me') return response(200,{ok:true,account:{account_id:'acc_test_1234567890',status:'ACTIVE',security_version:1,profile:{...accountProfile}}});
    if (u.origin === 'https://account.test' && u.pathname === '/v1/account/identity/profile') {
      accountProfile = {
        display_name: Object.prototype.hasOwnProperty.call(body || {}, 'display_name') ? String(body.display_name || '') : accountProfile.display_name,
        handle: Object.prototype.hasOwnProperty.call(body || {}, 'handle') ? (body.handle ? String(body.handle) : null) : accountProfile.handle
      };
      return response(200,{ok:true,changed:true,account:{account_id:'acc_test_1234567890',status:'ACTIVE',security_version:1,profile:{...accountProfile}}});
    }
    throw new Error(`unexpected request ${u}`);
  }
  const controller = createIdentityAccountController({
    app:{ getPath:()=>dir },
    fetchImpl,
    getIdentityController:()=>identity,
    getLegacyAccountStatus:async()=>({connected:legacyConnected,account:legacyConnected?{account_id:'acc_legacy',status:'ACTIVE',security_version:1,profile:{display_name:'Legacy',handle:'legacy'}}:null}),
    identityApiBase:'https://identity.test', accountApiBase:'https://account.test',
    serviceEnvironment:'prod', allowNewAccount, allowUnprovisionedRecovery,
    now:()=>1700000000000,
    cacheFile:path.join(dir,'cache.json')
  });
  return {controller,identity,requests,dir};
}

test('new Account flow is explicit and creates Identity lazily', async () => {
  const h=harness();
  const before=await h.controller.getStatus();
  assert.equal(before.identity.exists,false);
  assert.equal(before.account,null);
  const result=await h.controller.createAccount();
  assert.equal(result.ok,true);
  assert.equal(result.created,true);
  assert.equal(result.connected,true);
  assert.equal(result.account.account_id,'acc_test_1234567890');
  assert.equal(h.identity.calls[0],'create');
  assert.ok(h.requests.some(x=>x.path==='/v1/registry/genesis'));
  assert.ok(h.requests.some(x=>x.path==='/v1/auth/challenge'));
  assert.ok(h.requests.some(x=>x.path==='/v1/auth/exchange'));
  assert.ok(h.requests.some(x=>x.path==='/v1/account/identity/create'));
});

test('historical legacy test Account does not block the Identity-first Account path', async () => {
  const h=harness({legacyConnected:true});
  const result=await h.controller.createAccount();
  assert.equal(result.connected,true);
  assert.equal(result.account.account_id,'acc_test_1234567890');
  assert.equal(h.identity.calls[0],'create');
});

test('new Account creation is fail-closed unless explicitly enabled', async () => {
  const h=harness({allowNewAccount:false});
  await assert.rejects(()=>h.controller.createAccount(), e=>e && e.code==='ACCOUNT_IDENTITY_NEW_ACCOUNT_DISABLED');
});

test('Recovery provisioning policy is explicit', async () => {
  const h=harness({allowUnprovisionedRecovery:false});
  await assert.rejects(()=>h.controller.createAccount(), e=>e && e.code==='IDENTITY_RECOVERY_NOT_PROVISIONED');
});

test('network URL contract rejects insecure remote HTTP', () => {
  assert.throws(()=>identityAccountInternals.cleanBase('http://example.com'), e=>e && e.code==='ACCOUNT_NETWORK_CONFIG_INVALID');
  assert.equal(identityAccountInternals.cleanBase('http://localhost:8787'),'http://localhost:8787');
});

test('refresh never creates Identity implicitly', async () => {
  const h = harness();
  await assert.rejects(
    () => h.controller.refreshAccount(),
    (e) => e && e.code === 'IDENTITY_NOT_CREATED'
  );
  assert.equal(h.identity.calls.includes('create'), false);
});

test('recovered multi-event Identity journal sync appends from the Registry ancestor head', async () => {
  const h = harness();
  h.identity.create();
  h.identity.getPublicJournalForMain = () => ({
    identity_id:h.identity.getStatus().identity_id,
    genesis_digest:'genesis-digest',
    journal:[
      { event_hash:'head-example', body:{event_type:'GENESIS'} },
      { event_hash:'head-recovered', body:{event_type:'RECOVERY_ROTATE_ROOT'} }
    ],
    high_water:{ recovery_epoch:1, sequence:0, head_hash:'head-recovered' }
  });

  const result = await h.controller.syncIdentityJournalForMain();
  assert.equal(result.ok, true);
  assert.equal(result.head_hash, 'head-recovered');
  const headRequest = h.requests.find((x) => x.path.startsWith('/v1/registry/head/'));
  const appendRequest = h.requests.find((x) => x.path === '/v1/registry/events');
  assert.ok(headRequest);
  assert.ok(appendRequest);
  assert.equal(appendRequest.body.expected_head, 'head-example');
  assert.equal(appendRequest.body.event.event_hash, 'head-recovered');
});



test('profile update uses a dedicated capability path and persists only public profile cache', async () => {
  const h = harness();
  await h.controller.createAccount();
  const result = await h.controller.updateProfile({ display_name:'Workspace User', handle:'workspace_user' });
  assert.equal(result.ok, true);
  assert.equal(result.account.profile.display_name, 'Workspace User');
  assert.equal(result.account.profile.handle, 'workspace_user');
  const profileRequest = h.requests.find((x) => x.path === '/v1/account/identity/profile');
  assert.ok(profileRequest);
  assert.deepEqual(profileRequest.body, { display_name:'Workspace User', handle:'workspace_user' });
  const delegation = h.identity.calls.find((x) => Array.isArray(x) && x[0] === 'delegation' && x[2].includes('account.profile'));
  assert.ok(delegation);
});

test('local disconnect removes Account cache without deleting Identity and refresh reconnects', async () => {
  const h = harness();
  await h.controller.createAccount();
  const disconnected = await h.controller.disconnectLocal();
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.account, null);
  assert.equal(disconnected.identity.exists, true);
  const reconnected = await h.controller.refreshAccount();
  assert.equal(reconnected.connected, true);
  assert.equal(reconnected.account.account_id, 'acc_test_1234567890');
});

test('profile input validation fails before network mutation', async () => {
  const h = harness();
  await h.controller.createAccount();
  const before = h.requests.length;
  await assert.rejects(
    () => h.controller.updateProfile({ handle:'Bad-Handle' }),
    (e) => e && e.code === 'HANDLE_INVALID'
  );
  assert.equal(h.requests.length, before);
});
