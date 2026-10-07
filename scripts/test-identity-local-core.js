'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { encodeDeterministic } = require('../src/identity/identity-cbor.cjs');
const { createIdentitySecureStore, protectedStorageStatus } = require('../src/identity/identity-secure-store.cjs');
const {
  createIdentityController,
  registerIdentityIpc,
  identityInternals
} = require('../src/identity/identity-core-main.cjs');

function fakeSafeStorage(backend = 'gnome_libsecret') {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => backend,
    encryptString: (value) => Buffer.from(`TEST:${value}`, 'utf8'),
    decryptString: (value) => {
      const text = Buffer.from(value).toString('utf8');
      if (!text.startsWith('TEST:')) throw new Error('bad fake ciphertext');
      return text.slice(5);
    }
  };
}

function fakeApp(root) {
  return { getPath: (name) => {
    assert.equal(name, 'userData');
    return root;
  }};
}

function deterministicRandom() {
  let counter = 1;
  return (n) => {
    const out = Buffer.alloc(n);
    for (let i = 0; i < n; i += 1) out[i] = (counter + i) & 0xff;
    counter += n;
    return out;
  };
}

test('deterministic CBOR uses RFC 8949 core map ordering for string keys', () => {
  assert.equal(encodeDeterministic({ b: 2, a: 1 }).toString('hex'), 'a2616101616202');
  assert.equal(encodeDeterministic({ aa: 2, z: 1 }).toString('hex'), 'a2617a0162616102');
});

test('Linux basic_text is rejected for Identity persistent secrets', () => {
  const status = protectedStorageStatus(fakeSafeStorage('basic_text'), 'linux');
  assert.equal(status.available, false);
  assert.equal(status.reason, 'UNPROTECTED_LINUX_BASIC_TEXT');
});

test('Identity create persists and reopen returns the same IdentityID/head', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-'));
  const options = {
    app: fakeApp(root),
    safeStorage: fakeSafeStorage(),
    platform: 'linux',
    now: () => 1_800_000_000_000,
    randomBytes: deterministicRandom()
  };
  const first = createIdentityController(options);
  const created = first.create();
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  assert.equal(created.exists, true);
  assert.equal(created.status, 'RECOVERY_NOT_PROVISIONED');

  const reopened = createIdentityController(options).getStatus();
  assert.equal(reopened.identity_id, created.identity_id);
  assert.equal(reopened.device_id, created.device_id);
  assert.equal(reopened.head_hash, created.head_hash);
  assert.equal(reopened.recovery_provisioned, false);
});

test('Create is idempotent once Identity exists and does not silently replace it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-'));
  const controller = createIdentityController({
    app: fakeApp(root),
    safeStorage: fakeSafeStorage(),
    platform: 'linux',
    randomBytes: deterministicRandom()
  });
  const one = controller.create();
  const two = controller.create();
  assert.equal(two.created, false);
  assert.equal(two.identity_id, one.identity_id);
});

test('Service subjects are stable per sector and different across services', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-'));
  const controller = createIdentityController({
    app: fakeApp(root),
    safeStorage: fakeSafeStorage(),
    platform: 'linux',
    randomBytes: deterministicRandom()
  });
  controller.create();

  const account1 = controller.deriveServiceSubjectForMain('account', 'prod', 'v1');
  const account2 = createIdentityController({
    app: fakeApp(root),
    safeStorage: fakeSafeStorage(),
    platform: 'linux'
  }).deriveServiceSubjectForMain('account', 'prod', 'v1');
  const chat = controller.deriveServiceSubjectForMain('chat', 'prod', 'v1');
  const workshop = controller.deriveServiceSubjectForMain('workshop', 'prod', 'v1');

  assert.equal(account1, account2);
  assert.notEqual(account1, chat);
  assert.notEqual(account1, workshop);
  assert.notEqual(chat, workshop);
  assert.match(account1, /^[a-z2-7]{52}$/);
});

test('Public journal and Renderer-facing summary contain no private key or ServiceSubjectSeed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-'));
  const controller = createIdentityController({
    app: fakeApp(root),
    safeStorage: fakeSafeStorage(),
    platform: 'linux',
    randomBytes: deterministicRandom()
  });
  const summary = controller.create();
  const journal = controller.getPublicJournalForMain();

  const text = JSON.stringify({ summary, journal });
  assert.equal(text.includes('private_jwk'), false);
  assert.equal(text.includes('service_subject_seed'), false);
  assert.equal(text.includes('"d":'), false);
  assert.ok(journal.identity_id);
  assert.equal(journal.journal.length, 1);
});

test('Tampered stored Identity fails closed on reopen', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-'));
  const safeStorage = fakeSafeStorage();
  const controller = createIdentityController({
    app: fakeApp(root),
    safeStorage,
    platform: 'linux',
    randomBytes: deterministicRandom()
  });
  controller.create();

  const filePath = path.join(root, 'data', 'identity-secure-v1.json');
  const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const state = JSON.parse(safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64')));
  state.journal[0].body.payload.initial_device.label = 'tampered';
  envelope.ciphertext = safeStorage.encryptString(JSON.stringify(state)).toString('base64');
  fs.writeFileSync(filePath, JSON.stringify(envelope));

  assert.throws(
    () => createIdentityController({ app: fakeApp(root), safeStorage, platform: 'linux' }).getStatus(),
    (error) => error && error.code === 'IDENTITY_STATE_INVALID'
  );
});

test('Genesis verifier detects event/signature mutation', () => {
  const state = identityInternals.createGenesisState({ randomBytes: deterministicRandom(), nowSeconds: 123 });
  assert.equal(identityInternals.verifyGenesisState(state), true);

  const changed = structuredClone(state);
  const originalSignature = changed.journal[0].signatures[0].signature;
  changed.journal[0].signatures[0].signature =
    (originalSignature[0] === 'A' ? 'B' : 'A') + originalSignature.slice(1);
  assert.equal(identityInternals.verifyGenesisState(changed), false);
});

test('Different freshly created Identities produce different IdentityIDs', () => {
  const one = identityInternals.createGenesisState();
  const two = identityInternals.createGenesisState();
  assert.notEqual(one.identity.identity_id, two.identity.identity_id);
});

test('Identity IPC exposes only public status and explicit create operations', async () => {
  const handlers = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn) };
  let senderChecks = 0;
  const controller = {
    getStatus: () => ({ ok: true, exists: false }),
    create: () => ({ ok: true, exists: true, created: true })
  };

  registerIdentityIpc({
    ipcMain,
    assertTrustedSender: () => { senderChecks += 1; },
    getController: () => controller
  });

  assert.deepEqual([...handlers.keys()].sort(), ['identity:create', 'identity:status']);
  assert.deepEqual(await handlers.get('identity:status')({}), { ok: true, exists: false });
  assert.deepEqual(await handlers.get('identity:create')({}), { ok: true, exists: true, created: true });
  assert.equal(senderChecks, 2);
});

test('Identity Recovery IPC stays high-level and supports provision, test and fresh restore through dialogs', async () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-recovery-ipc-source-'));
  const recoveryPath = path.join(sourceRoot, 'offline-recovery.json');
  const passphrase = 'correct horse battery staple';
  const options = {
    app: fakeApp(sourceRoot),
    safeStorage: fakeSafeStorage(),
    platform: 'linux',
    now: () => 1_800_000_000_000,
    randomBytes: deterministicRandom()
  };
  const source = createIdentityController(options);
  const created = source.create();
  let activeController = source;
  const handlers = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn) };
  let senderChecks = 0;
  const dialog = {
    showSaveDialog: async () => ({ canceled:false, filePath:recoveryPath }),
    showOpenDialog: async () => ({ canceled:false, filePaths:[recoveryPath] })
  };

  registerIdentityIpc({
    ipcMain,
    dialog,
    assertTrustedSender: () => { senderChecks += 1; },
    getController: () => activeController
  });

  assert.deepEqual([...handlers.keys()].sort(), [
    'identity:create',
    'identity:recovery:provision',
    'identity:recovery:restore',
    'identity:recovery:test',
    'identity:status'
  ]);

  const provisioned = await handlers.get('identity:recovery:provision')({}, { passphrase });
  assert.equal(provisioned.ok, true);
  assert.equal(provisioned.recovery_provisioned, true);
  assert.equal(provisioned.recovery_restore_tested, false);
  assert.equal(fs.existsSync(recoveryPath), true);

  const tested = await handlers.get('identity:recovery:test')({}, { passphrase });
  assert.equal(tested.ok, true);
  assert.equal(tested.recovery_restore_tested, true);
  assert.equal(tested.identity_id, created.identity_id);

  const freshRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-recovery-ipc-target-'));
  activeController = createIdentityController({
    app: fakeApp(freshRoot),
    safeStorage: fakeSafeStorage(),
    platform: 'linux',
    now: () => 1_800_000_100_000,
    randomBytes: deterministicRandom()
  });
  const restored = await handlers.get('identity:recovery:restore')({}, { passphrase });
  assert.equal(restored.ok, true);
  assert.equal(restored.identity_id, created.identity_id);
  assert.equal(restored.recovery_epoch, 1);
  assert.notEqual(restored.device_id, created.device_id);

  const rendererText = JSON.stringify({ provisioned, tested, restored });
  assert.equal(rendererText.includes('private_jwk'), false);
  assert.equal(rendererText.includes('service_subject_seed'), false);
  assert.equal(senderChecks, 3);
});

test('Secure store uses a separate Identity file and not Account secure state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-id-'));
  const store = createIdentitySecureStore({ safeStorage: fakeSafeStorage(), dataDir: root });
  assert.equal(path.basename(store.status().filePath), 'identity-secure-v1.json');
  assert.notEqual(path.basename(store.status().filePath), 'account-secure-v1.json');
});
