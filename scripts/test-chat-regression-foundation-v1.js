'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MESSENGER_PATH = path.join(PROJECT_ROOT, 'src', 'messenger', 'messenger-main.cjs');
const PRELOAD_PATH = path.join(PROJECT_ROOT, 'preload.js');
const MAIN_PATH = path.join(PROJECT_ROOT, 'main.js');
const INDEX_PATH = path.join(PROJECT_ROOT, 'index.html');
const ROOMS_PATH = path.join(PROJECT_ROOT, 'src', 'modules', 'rooms', 'rooms-v0.js');
const ROOMS_LIVE_PATH = path.join(PROJECT_ROOT, 'src', 'modules', 'rooms', 'rooms-live-v1.js');
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src', 'messenger', 'native-runtime');
const BINARY_PATH = path.join(
  RUNTIME_DIR,
  `irgeztne-green-lightning-secure-local-service-v04n${process.platform === 'win32' ? '.exe' : ''}`
);

const messengerModule = require(MESSENGER_PATH);
const {
  createWorkspaceMessengerController,
  registerWorkspaceMessengerIpc,
  __test: envelope
} = messengerModule;

const results = [];
const skipped = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`FAIL ${name}`);
    console.error(error && error.stack || error);
  }
}

function skip(name, reason) {
  skipped.push({ name, reason });
  console.log(`SKIP ${name} — ${reason}`);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createMemoryStorage() {
  const modules = new Map();
  const secrets = new Map();

  return {
    modules,
    getModuleState(moduleId, fallback = null) {
      return modules.has(moduleId) ? clone(modules.get(moduleId)) : clone(fallback);
    },
    setModuleState(moduleId, value) {
      modules.set(moduleId, clone(value));
      return { ok: true };
    },
    hasSecret(scope, key) {
      return secrets.has(`${scope}\u0000${key}`);
    },
    saveSecret(scope, key, value) {
      secrets.set(`${scope}\u0000${key}`, String(value));
      return { ok: true };
    },
    readSecret(scope, key) {
      return secrets.get(`${scope}\u0000${key}`) || '';
    },
    clearSecret(scope, key) {
      secrets.delete(`${scope}\u0000${key}`);
      return { ok: true };
    }
  };
}

function makeRecord(wireText, overrides = {}) {
  return {
    message_id: overrides.message_id || 'm-contract-1',
    conversation_id: 'green-lightning-local-v04p1',
    plaintext: { text: wireText },
    status: overrides.status || 'delivered',
    created_at: overrides.created_at || '2026-08-21T10:00:00.000Z',
    delivered_at: overrides.delivered_at || '2026-08-21T10:00:01.000Z'
  };
}

function deleteTestKeyringRoots(prefix) {
  if (!fs.existsSync(BINARY_PATH)) return;
  for (const slot of ['local', 'loopback-peer', 'loopback-camel']) {
    spawnSync(BINARY_PATH, ['delete-root', `${prefix}.${slot}`], {
      encoding: 'utf8',
      env: process.env,
      timeout: 15_000
    });
  }
}

function createInMemoryServiceFactory() {
  const serviceStates = new Map();
  const group = {
    id: `contract-${crypto.randomUUID()}`,
    epoch: 0,
    members: new Set()
  };

  function parseHexJson(value) {
    return JSON.parse(Buffer.from(String(value || ''), 'hex').toString('utf8'));
  }

  function hexJson(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('hex');
  }

  return async function serviceFactory(options) {
    const slot = path.basename(options.dataDir);
    let state = serviceStates.get(slot);
    if (!state) {
      state = {
        identity: options.identity,
        joined: false,
        outgoing: new Map(),
        inbox: new Map()
      };
      serviceStates.set(slot, state);
    }

    return {
      async start() { return this; },
      async close() {},
      async ping() {
        return {
          service_version: 'contract-adapter-v1',
          protocol_version: 'contract-v1',
          crypto: 'test-adapter',
          mls_storage: 'isolated-memory',
          message_storage: 'isolated-memory',
          key_root: 'test-only',
          hardening: 'canonical-controller-contract'
        };
      },
      async securityStatus() {
        return {
          raw_key_export: false,
          plaintext_fallback: false,
          process: 'isolated-test-adapter',
          mls_database: 'test-only',
          message_database: 'test-only'
        };
      },
      async keyPackage() {
        return { key_package_hex: hexJson({ identity: state.identity }) };
      },
      async createGroup() {
        group.epoch = 0;
        group.members = new Set([state.identity]);
        state.joined = true;
        return { group_id_hex: group.id };
      },
      async addMember(_conversationId, keyPackageHex) {
        const member = parseHexJson(keyPackageHex);
        group.members.add(member.identity);
        group.epoch += 1;
        const snapshot = { id: group.id, epoch: group.epoch, members: Array.from(group.members) };
        return {
          welcome_hex: hexJson(snapshot),
          commit_hex: hexJson(snapshot)
        };
      },
      async joinGroup(_conversationId, welcomeHex) {
        const snapshot = parseHexJson(welcomeHex);
        group.id = snapshot.id;
        group.epoch = snapshot.epoch;
        group.members = new Set(snapshot.members);
        state.joined = true;
        return { ok: true };
      },
      async applyCommit(_conversationId, commitHex) {
        const snapshot = parseHexJson(commitHex);
        group.id = snapshot.id;
        group.epoch = snapshot.epoch;
        group.members = new Set(snapshot.members);
        return { ok: true };
      },
      async groupStatus() {
        if (!state.joined) throw new Error('group missing');
        return {
          group_id_hex: group.id,
          epoch: group.epoch,
          members: group.members.size,
          active: group.members.has(state.identity)
        };
      },
      async stageOutgoing(record) {
        state.outgoing.set(record.message_id, clone(record));
        return { ok: true };
      },
      async updateOutgoing(messageId, fields) {
        const old = state.outgoing.get(messageId);
        state.outgoing.set(messageId, { ...old, ...clone(fields) });
        return { ok: true };
      },
      async advanceOutgoingStatus(messageId, status, fields) {
        const old = state.outgoing.get(messageId);
        state.outgoing.set(messageId, { ...old, ...clone(fields), status });
        return { ok: true };
      },
      async listOutgoing() {
        return Array.from(state.outgoing.values()).map(clone);
      },
      async addInbox(messageId, record) {
        state.inbox.set(messageId, clone(record));
        return { ok: true };
      },
      async encrypt(_conversationId, plaintext) {
        if (!state.joined || !group.members.has(state.identity)) throw new Error('device is inactive');
        return { message_hex: Buffer.from(String(plaintext), 'utf8').toString('hex') };
      },
      async decrypt(_conversationId, messageHex) {
        if (!state.joined || !group.members.has(state.identity)) throw new Error('device is inactive');
        return { plaintext: Buffer.from(String(messageHex), 'hex').toString('utf8') };
      }
    };
  };
}

async function runEnvelopeContracts() {
  await check('envelope: legacy plain text remains readable', () => {
    assert.deepEqual(envelope.decodeApplicationPayload('legacy hello'), {
      kind: 'text',
      text: 'legacy hello',
      replyTo: null
    });
  });

  await check('envelope: current text wire shape remains v1-compatible', () => {
    const reply = { messageId: 'm-source', sender: 'peer', text: 'canonical source' };
    const wire = envelope.encodeApplicationPayload('hello', reply);
    assert.deepEqual(JSON.parse(wire), {
      marker: 'irgeztne.gl.message.v1',
      v: 1,
      kind: 'text',
      text: 'hello',
      reply
    });
    assert.deepEqual(envelope.decodeApplicationPayload(wire), {
      kind: 'text',
      text: 'hello',
      replyTo: reply
    });
  });

  await check('envelope: supported message kinds are frozen', () => {
    assert.deepEqual(Array.from(envelope.MESSAGE_CONTENT_KINDS), ['text', 'attachment', 'voice-note']);
    assert.equal(Object.isFrozen(envelope.MESSAGE_CONTENT_KINDS), true);
  });

  await check('envelope: attachment metadata round-trips without a filesystem path', () => {
    const metadata = {
      blobId: 'blob:chat:abc123',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 32_768,
      sha256: 'a'.repeat(64)
    };
    const wire = envelope.encodeMessageContentPayload('attachment', metadata);
    const raw = JSON.parse(wire);
    assert.equal(Object.prototype.hasOwnProperty.call(raw.attachment, 'path'), false);
    assert.deepEqual(envelope.decodeApplicationPayload(wire), {
      kind: 'attachment',
      attachment: metadata,
      replyTo: null
    });
  });

  await check('envelope: voice-note metadata round-trips without audio bytes', () => {
    const metadata = {
      blobId: 'blob:voice:def456',
      mimeType: 'audio/webm',
      sizeBytes: 98_765,
      durationMs: 12_400,
      sha256: 'b'.repeat(64)
    };
    const wire = envelope.encodeMessageContentPayload('voice-note', metadata);
    assert.deepEqual(envelope.decodeApplicationPayload(wire), {
      kind: 'voice-note',
      voiceNote: metadata,
      replyTo: null
    });
  });

  await check('envelope: invalid type, path-like name, MIME, size and hash are rejected', () => {
    const goodAttachment = {
      blobId: 'blob-ok',
      name: 'photo.png',
      mimeType: 'image/png',
      sizeBytes: 512,
      sha256: 'c'.repeat(64)
    };
    assert.throws(() => envelope.encodeMessageContentPayload('file', goodAttachment), /unsupported/);
    assert.throws(() => envelope.encodeMessageContentPayload('attachment', { ...goodAttachment, name: '../photo.png' }), /display name/);
    assert.throws(() => envelope.encodeMessageContentPayload('attachment', { ...goodAttachment, mimeType: 'not-a-mime' }), /MIME/);
    assert.throws(() => envelope.encodeMessageContentPayload('attachment', { ...goodAttachment, sizeBytes: envelope.MAX_ATTACHMENT_BYTES + 1 }), /size/);
    assert.throws(() => envelope.encodeMessageContentPayload('attachment', { ...goodAttachment, sha256: 'bad' }), /SHA-256/);
    assert.throws(() => envelope.encodeMessageContentPayload('voice-note', {
      blobId: 'voice-ok',
      mimeType: 'video/webm',
      sizeBytes: 100,
      durationMs: 1000,
      sha256: 'd'.repeat(64)
    }), /voice-note MIME/);
  });

  await check('envelope: text and future content project through one safe-message contract', () => {
    const textProjection = envelope.safeMessage(makeRecord(envelope.encodeApplicationPayload('project me')), 'local');
    assert.equal(textProjection.contentKind, 'text');
    assert.equal(textProjection.text, 'project me');
    assert.equal(textProjection.attachment, null);
    assert.equal(textProjection.voiceNote, null);

    const attachmentWire = envelope.encodeMessageContentPayload('attachment', {
      blobId: 'blob-project',
      name: 'project.txt',
      mimeType: 'text/plain',
      sizeBytes: 42,
      sha256: 'e'.repeat(64)
    });
    const attachmentProjection = envelope.safeMessage(makeRecord(attachmentWire), 'peer');
    assert.equal(attachmentProjection.contentKind, 'attachment');
    assert.equal(attachmentProjection.text, '');
    assert.equal(attachmentProjection.attachment.name, 'project.txt');
    assert.equal(attachmentProjection.direction, 'incoming');
  });

  await check('envelope: byte-size limit rejects multibyte oversized text', () => {
    assert.throws(
      () => envelope.encodeApplicationPayload('€'.repeat(30_000)),
      /64 KiB/
    );
  });
}

async function runPreloadContracts() {
  const source = fs.readFileSync(PRELOAD_PATH, 'utf8');
  const exposed = Object.create(null);
  const invocations = [];
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, value) { exposed[name] = value; }
    },
    ipcRenderer: {
      invoke(...args) { invocations.push(args); return Promise.resolve({ ok: true }); },
      sendSync() { return null; }
    },
    clipboard: {
      readText() { return ''; },
      writeText() {}
    }
  };
  const sandbox = {
    require(id) {
      if (id === 'electron') return electron;
      throw new Error(`unexpected preload dependency: ${id}`);
    },
    console
  };
  vm.runInNewContext(source, sandbox, { filename: PRELOAD_PATH });

  await check('preload: Chat renderer receives only the frozen irgeztneMessenger capability object', () => {
    const bridge = exposed.irgeztneMessenger;
    assert.ok(bridge);
    assert.equal(Object.isFrozen(bridge), true);
    assert.equal(Object.prototype.hasOwnProperty.call(bridge, 'ipcRenderer'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(bridge, 'invoke'), false);
    assert.deepEqual(Object.keys(bridge).sort(), [
      'beginDeviceEnrollment',
      'cancelDeviceEnrollment',
      'createDirectInvite',
      'deleteCamelForAll',
      'deleteLocalForAll',
      'deletePeerForAll',
      'editCamel',
      'editLocal',
      'editPeer',
      'getConversation',
      'getDeviceContext',
      'getDeviceEnrollmentStatus',
      'getDeviceEnrollmentTransportStatus',
      'getDeviceRevocationStatus',
      'getStatus',
      'joinDirectInvite',
      'openAttachment',
      'saveAttachment',
      'reactCamel',
      'reactLocal',
      'reactPeer',
      'refreshRemoteTransport',
      'revokeAccountDevice',
      'sendAttachment',
      'sendCamelText',
      'sendLocalText',
      'sendPeerText'
    ].sort());
  });

  await check('preload: invalid text, IDs, reactions and option types fail before IPC', () => {
    const bridge = exposed.irgeztneMessenger;
    const before = invocations.length;
    assert.throws(() => bridge.sendLocalText(''), /invalid Messenger text/);
    assert.throws(() => bridge.sendLocalText(7), /invalid Messenger text/);
    assert.throws(() => bridge.sendLocalText('x'.repeat(65_537)), /invalid Messenger text/);
    assert.throws(() => bridge.sendLocalText('ok', []), /send options/);
    assert.throws(() => bridge.sendLocalText('ok', { replyToId: '../forged' }), /reply target/);
    assert.throws(() => bridge.joinDirectInvite('short'), /invalid Chat invite/);
    assert.throws(() => bridge.reactLocal('bad id', '👍'), /reaction target/);
    assert.throws(() => bridge.reactLocal('m-good', '🔥'), /reaction/);
    assert.throws(() => bridge.editLocal('bad/id', 'edit'), /edit target/);
    assert.throws(() => bridge.deleteLocalForAll('bad/id'), /delete target/);
    assert.throws(() => bridge.revokeAccountDevice('bad/id'), /device id/);
    assert.throws(() => bridge.sendAttachment('forged'), /attachment sender/);
    assert.equal(invocations.length, before);
  });

  await check('preload: reply capability forwards only canonical replyToId', async () => {
    const bridge = exposed.irgeztneMessenger;
    await bridge.sendLocalText('reply', {
      replyToId: 'm-source',
      sender: 'forged',
      text: 'forged source'
    });
    assert.deepEqual(clone(invocations.at(-1)), [
      'messenger:send-local-text',
      'reply',
      { replyToId: 'm-source' }
    ]);
  });
}

async function runIpcTrustContracts() {
  const handlers = new Map();
  const calls = [];
  const ipcMain = {
    handle(channel, handler) {
      assert.equal(handlers.has(channel), false, `duplicate handler ${channel}`);
      handlers.set(channel, handler);
    }
  };
  const controller = new Proxy({}, {
    get(_target, property) {
      return async (...args) => {
        calls.push({ property: String(property), args });
        return { ok: true };
      };
    }
  });
  const expectedUrl = 'file:///opt/irgeztne/index.html';
  const assertTrustedSender = (event) => {
    const actual = String(event && event.senderFrame && event.senderFrame.url || '');
    if (actual !== expectedUrl) throw new Error('UNTRUSTED_RENDERER');
  };
  registerWorkspaceMessengerIpc({ ipcMain, assertTrustedSender, controller });

  await check('IPC: all active Chat handlers apply the trusted Workspace document guard', async () => {
    assert.ok(handlers.size >= 20);
    for (const [channel, handler] of handlers.entries()) {
      const before = calls.length;
      await assert.rejects(
        () => handler({ senderFrame: { url: 'https://evil.invalid/index.html' } }, 'm-id', '👍'),
        /UNTRUSTED_RENDERER/,
        channel
      );
      assert.equal(calls.length, before, `${channel} reached controller before trust rejection`);
    }
  });

  await check('IPC: expected Workspace document can invoke the canonical send handler', async () => {
    const handler = handlers.get('messenger:send-local-text');
    await handler({ senderFrame: { url: expectedUrl } }, 'hello', { replyToId: null });
    assert.deepEqual(calls.at(-1), {
      property: 'sendLocalText',
      args: ['hello', { replyToId: null }]
    });
  });

  await check('main: production trust contract compares sender URL with exact INDEX_URL', () => {
    const source = fs.readFileSync(MAIN_PATH, 'utf8');
    assert.match(source, /const INDEX_URL = pathToFileURL\(INDEX_FILE\)\.toString\(\)/);
    assert.match(source, /return senderUrl === INDEX_URL/);
    assert.match(source, /registerWorkspaceMessengerIpc\([\s\S]*?assertTrustedSender/);
  });
}

async function runActiveOwnerAndRendererContracts() {
  await check('owners: active index loads canonical Rooms renderer and disabled live stub', () => {
    const index = fs.readFileSync(INDEX_PATH, 'utf8');
    const live = fs.readFileSync(ROOMS_LIVE_PATH, 'utf8');
    assert.match(index, /src\/modules\/rooms\/rooms-v0\.js/);
    assert.match(index, /src\/modules\/rooms\/rooms-live-v1\.js/);
    assert.match(live, /disabled|no-op|intentionally/i);
  });

  await check('owners: active renderer uses irgeztneMessenger and not browser AES', () => {
    const rooms = fs.readFileSync(ROOMS_PATH, 'utf8');
    const messenger = fs.readFileSync(MESSENGER_PATH, 'utf8');
    assert.match(rooms, /window\.irgeztneMessenger/);
    assert.doesNotMatch(rooms, /crypto\.subtle|AES-(?:GCM|CBC|CTR)|deriveKey\s*\(/i);
    assert.doesNotMatch(messenger, /crypto\.subtle|AES-(?:GCM|CBC|CTR)|deriveKey\s*\(/i);
    assert.match(messenger, /SecureLocalServiceClient|secure-local-service-client/);
  });

  await check('renderer: remove-for-me persists only deleted tombstone IDs in local view state', () => {
    const rooms = fs.readFileSync(ROOMS_PATH, 'utf8');
    assert.match(rooms, /LOCAL_VIEW_STATE_KEY_V04P20\s*=\s*'green-lightning-chat-local-view-v04p20'/);
    assert.match(rooms, /if \(!message \|\| !message\.deleted\) return/);
    assert.match(rooms, /storageSetModuleState\(LOCAL_VIEW_STATE_KEY_V04P20/);
    assert.match(rooms, /message\.deleted\s*&&\s*isLocallyHiddenMessageId\(message\.id\)/);
  });

  await check('renderer: copy reads only the canonical projected message text', () => {
    const rooms = fs.readFileSync(ROOMS_PATH, 'utf8');
    assert.match(rooms, /async function copyMessageText\(messageId\)[\s\S]*?const text = messageCopyText\(message\)/);
    assert.match(rooms, /navigator\.clipboard\.writeText\(text\)/);
  });
}

async function runNativeMessengerContracts() {
  await check('native runtime: binary and host client are packaged in canonical runtime', () => {
    assert.equal(fs.existsSync(BINARY_PATH), true, BINARY_PATH);
    assert.equal(fs.existsSync(path.join(RUNTIME_DIR, 'secure-local-service-client.mjs')), true);
  });

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-chat-regression-'));
  const keyringPrefix = `com.irgeztne.green-lightning.contract.${process.pid}.${crypto.randomUUID()}`;
  const storage = createMemoryStorage();
  const app = { getPath(name) { assert.equal(name, 'userData'); return tempRoot; } };
  const serviceFactory = createInMemoryServiceFactory();
  let controller = null;

  deleteTestKeyringRoots(keyringPrefix);

  try {
    controller = createWorkspaceMessengerController({
      app,
      runtimeDir: RUNTIME_DIR,
      storage,
      keyringServicePrefix: keyringPrefix,
      serviceFactory
    });

    let firstMessageId = '';
    let replyMessageId = '';

    await check('canonical controller: security projection forbids raw-key export and plaintext fallback', async () => {
      const status = await controller.status();
      assert.equal(status.ok, true, JSON.stringify(status));
      assert.equal(status.security.rawKeyExport, false);
      assert.equal(status.security.plaintextFallback, false);
      assert.equal(status.network, 'disabled');
      assert.equal(status.group.active, true);
    });

    await check('canonical controller: active device sends delivered text into visible history', async () => {
      const sent = await controller.sendLocalText('accepted text');
      assert.equal(sent.ok, true, JSON.stringify(sent));
      firstMessageId = sent.messageId;
      const projected = sent.conversation.messages.find((item) => item.id === firstMessageId);
      assert.ok(projected);
      assert.equal(projected.contentKind, 'text');
      assert.equal(projected.text, 'accepted text');
      assert.equal(projected.sender, 'local');
      assert.equal(projected.status, 'delivered');
    });

    await check('canonical controller: peer receive/send projection is visible as incoming history', async () => {
      const sent = await controller.sendPeerText('peer history');
      assert.equal(sent.ok, true, JSON.stringify(sent));
      const projected = sent.conversation.messages.find((item) => item.id === sent.messageId);
      assert.ok(projected);
      assert.equal(projected.sender, 'peer');
      assert.equal(projected.direction, 'incoming');
      assert.equal(projected.text, 'peer history');
    });

    await check('canonical controller: reply source is canonicalized from accepted history', async () => {
      const sent = await controller.sendPeerText('canonical reply', {
        replyToId: firstMessageId,
        sender: 'forged',
        text: 'forged quote'
      });
      assert.equal(sent.ok, true, JSON.stringify(sent));
      replyMessageId = sent.messageId;
      const projected = sent.conversation.messages.find((item) => item.id === replyMessageId);
      assert.deepEqual(projected.replyTo, {
        messageId: firstMessageId,
        sender: 'local',
        text: 'accepted text'
      });
    });

    await check('canonical controller: reaction add and same-reaction remove project deterministically', async () => {
      const added = await controller.reactLocal(replyMessageId, '👍');
      assert.equal(added.ok, true, JSON.stringify(added));
      let projected = added.conversation.messages.find((item) => item.id === replyMessageId);
      assert.deepEqual(projected.reactions, [{ emoji: '👍', count: 1, actors: ['local'] }]);

      const removed = await controller.reactLocal(replyMessageId, '👍');
      assert.equal(removed.ok, true, JSON.stringify(removed));
      projected = removed.conversation.messages.find((item) => item.id === replyMessageId);
      assert.deepEqual(projected.reactions, []);
    });

    await check('canonical controller: only original sender can edit and latest edit projects', async () => {
      const denied = await controller.editLocal(replyMessageId, 'forged owner edit');
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, 'EDIT_NOT_OWNER');

      const edited = await controller.editPeer(replyMessageId, 'peer history edited');
      assert.equal(edited.ok, true, JSON.stringify(edited));
      const projected = edited.conversation.messages.find((item) => item.id === replyMessageId);
      assert.equal(projected.text, 'peer history edited');
      assert.equal(projected.edited, true);
      assert.ok(projected.editedAt);
    });

    await check('canonical controller: delete-for-all projects a sender-owned tombstone', async () => {
      const denied = await controller.deleteLocalForAll(replyMessageId);
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, 'DELETE_NOT_OWNER');

      const deleted = await controller.deletePeerForAll(replyMessageId);
      assert.equal(deleted.ok, true, JSON.stringify(deleted));
      const projected = deleted.conversation.messages.find((item) => item.id === replyMessageId);
      assert.equal(projected.deleted, true);
      assert.equal(projected.text, '');
      assert.equal(projected.replyTo, null);
      assert.deepEqual(projected.reactions, []);
      assert.ok(projected.deletedAt);
    });

    await check('canonical controller: accepted history and tombstones persist across restart', async () => {
      await controller.close();
      controller = createWorkspaceMessengerController({
        app,
        runtimeDir: RUNTIME_DIR,
        storage,
        keyringServicePrefix: keyringPrefix,
        serviceFactory
      });
      const history = await controller.getConversation();
      assert.equal(history.ok, true, JSON.stringify(history));
      const first = history.conversation.messages.find((item) => item.id === firstMessageId);
      const tombstone = history.conversation.messages.find((item) => item.id === replyMessageId);
      assert.equal(first.text, 'accepted text');
      assert.equal(first.status, 'delivered');
      assert.equal(tombstone.deleted, true);
      assert.equal(tombstone.text, '');
    });

    await check('canonical controller: revoked sender is blocked while accepted history remains readable', async () => {
      const registryId = 'green-lightning.account-device.v1';
      const state = storage.getModuleState(registryId, null);
      assert.ok(state && Array.isArray(state.devices));
      const peer = state.devices.find((item) => item.deviceId === 'device-b-v04p1');
      assert.ok(peer);
      peer.status = 'revoked';
      peer.updatedAt = new Date().toISOString();
      storage.setModuleState(registryId, state);

      const blocked = await controller.sendPeerText('must not send');
      assert.equal(blocked.ok, false);
      assert.equal(blocked.error.code, 'DEVICE_REVOKED');

      const history = await controller.getConversation();
      assert.equal(history.ok, true, JSON.stringify(history));
      assert.equal(history.conversation.messages.some((item) => item.id === firstMessageId && item.text === 'accepted text'), true);
      assert.equal(history.conversation.messages.some((item) => item.id === replyMessageId && item.deleted), true);

      const localStillActive = await controller.sendLocalText('active device after peer revocation gate');
      assert.equal(localStillActive.ok, true, JSON.stringify(localStillActive));
    });
  } finally {
    if (controller) {
      try { await controller.close(); } catch (_) {}
    }
    deleteTestKeyringRoots(keyringPrefix);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function runNativeKeyringProbe() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-chat-native-probe-'));
  const keyringPrefix = `com.irgeztne.green-lightning.nativeprobe.${process.pid}.${crypto.randomUUID()}`;
  const storage = createMemoryStorage();
  const app = { getPath() { return tempRoot; } };
  let controller = null;

  deleteTestKeyringRoots(keyringPrefix);
  try {
    controller = createWorkspaceMessengerController({
      app,
      runtimeDir: RUNTIME_DIR,
      storage,
      keyringServicePrefix: keyringPrefix
    });
    const status = await controller.status();
    let nativeDiagnostic = '';
    if (!status.ok && status.error && status.error.code === 'EPIPE') {
      const diagnosticService = `${keyringPrefix}.diagnostic`;
      const diagnostic = spawnSync(BINARY_PATH, [
        '--data-dir', path.join(tempRoot, 'diagnostic'),
        '--identity', 'workspace-contract/diagnostic',
        '--keyring-service', diagnosticService
      ], {
        input: '',
        encoding: 'utf8',
        env: process.env,
        timeout: 5_000
      });
      nativeDiagnostic = `${diagnostic.stderr || ''}\n${diagnostic.error && diagnostic.error.message || ''}`;
      spawnSync(BINARY_PATH, ['delete-root', diagnosticService], {
        encoding: 'utf8',
        env: process.env,
        timeout: 15_000
      });
    }
    if (
      !status.ok &&
      /keyring unavailable|zbus|\/run\/user\/\d+\/bus|secret service/i.test(
        `${String(status.error && status.error.message || '')}\n${nativeDiagnostic}`
      )
    ) {
      skip('live native MLS/keyring pipeline', 'OS Secret Service/D-Bus is unavailable in this sandbox');
      return;
    }

    await check('live native MLS/keyring pipeline', () => {
      assert.equal(status.ok, true, JSON.stringify(status));
      assert.equal(status.security.rawKeyExport, false);
      assert.equal(status.security.plaintextFallback, false);
    });
  } finally {
    if (controller) {
      try { await controller.close(); } catch (_) {}
    }
    deleteTestKeyringRoots(keyringPrefix);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  await runEnvelopeContracts();
  await runPreloadContracts();
  await runIpcTrustContracts();
  await runActiveOwnerAndRendererContracts();
  await runNativeMessengerContracts();
  await runNativeKeyringProbe();

  const failed = results.filter((result) => !result.ok);
  console.log(`\nChat regression foundation: ${results.length - failed.length}/${results.length} PASS, ${skipped.length} SKIP`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
