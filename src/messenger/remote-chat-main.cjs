'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createChatServiceClient } = require('./chat-service-client.cjs');

const STATE_VERSION = 1;
const MAX_TEXT_BYTES = 65_536;

function publicError(error) {
  const code = String(error && error.code || 'CHAT_REMOTE_ERROR').slice(0, 80);
  const message = String(error && error.message || 'Chat operation failed.').slice(0, 600);
  return { ok: false, error: { code, message } };
}

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hexToBase64Url(value, label) {
  const hex = String(value || '');
  if (!hex || hex.length % 2 !== 0 || !/^[a-fA-F0-9]+$/.test(hex)) {
    throw typedError('CHAT_MLS_HANDSHAKE_INVALID', `${label} is invalid.`);
  }
  return Buffer.from(hex, 'hex').toString('base64url');
}

function base64UrlToHex(value, label) {
  const encoded = String(value || '');
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw typedError('CHAT_MLS_HANDSHAKE_INVALID', `${label} is invalid.`);
  }
  const bytes = Buffer.from(encoded, 'base64url');
  if (!bytes.length) throw typedError('CHAT_MLS_HANDSHAKE_INVALID', `${label} is empty.`);
  return bytes.toString('hex');
}

function safeJsonRead(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (_) { throw typedError('CHAT_LOCAL_STATE_INVALID', 'Local Chat state is damaged.'); }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filePath);
  try { fs.chmodSync(filePath, 0o600); } catch (_) {}
}

function createRemoteChatController({
  app,
  runtimeDir,
  serviceFactory = null,
  fetchImpl,
  accountServiceGrantProvider,
  chatServiceBaseUrl,
  keyringServicePrefix,
  encodeTextPayload,
  projectMessage
}) {
  if (!app || typeof app.getPath !== 'function') throw new Error('Electron app is required');
  if (!runtimeDir) throw new Error('Messenger runtimeDir is required');
  if (serviceFactory !== null && typeof serviceFactory !== 'function') throw new Error('Messenger service factory must be a function');
  if (typeof encodeTextPayload !== 'function' || typeof projectMessage !== 'function') throw new Error('Messenger message codec is required');

  const rootDir = path.join(app.getPath('userData'), 'chat-remote-v1');
  const stateFile = path.join(rootDir, 'state.json');
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(runtimeDir, `irgeztne-green-lightning-secure-local-service-v04n${suffix}`);
  const hostClientPath = path.join(runtimeDir, 'secure-local-service-client.mjs');
  let LocalServiceClass = null;
  let service = null;
  let startPromise = null;
  let syncPromise = null;
  let closing = false;

  const rawState = safeJsonRead(stateFile);
  const state = rawState && rawState.version === STATE_VERSION && /^[A-Za-z0-9._:-]{8,180}$/.test(String(rawState.deviceId || ''))
    ? {
        version: STATE_VERSION,
        deviceId: String(rawState.deviceId),
        identity: String(rawState.identity || ''),
        selectedConversationId: String(rawState.selectedConversationId || ''),
        cursors: rawState.cursors && typeof rawState.cursors === 'object' ? { ...rawState.cursors } : {},
        pendingWelcomes: rawState.pendingWelcomes && typeof rawState.pendingWelcomes === 'object' ? { ...rawState.pendingWelcomes } : {}
      }
    : {
        version: STATE_VERSION,
        deviceId: `device-${crypto.randomUUID()}`,
        identity: '',
        selectedConversationId: '',
        cursors: {},
        pendingWelcomes: {}
      };

  if (!state.identity) state.identity = `irgeztne-workspace/${state.deviceId}`;
  writeJsonAtomic(stateFile, state);

  const transport = createChatServiceClient({
    baseUrl: chatServiceBaseUrl,
    fetchImpl,
    grantProvider: accountServiceGrantProvider
  });

  function persist() { writeJsonAtomic(stateFile, state); }

  async function loadClientClass() {
    if (LocalServiceClass) return LocalServiceClass;
    if (!fs.existsSync(hostClientPath)) throw typedError('CHAT_NATIVE_CLIENT_MISSING', 'Chat native client is missing.');
    if (!fs.existsSync(binaryPath)) throw typedError('CHAT_NATIVE_RUNTIME_MISSING', 'Chat native runtime is missing.');
    const mod = await import(pathToFileURL(hostClientPath).href);
    if (!mod || typeof mod.SecureLocalServiceClient !== 'function') {
      throw typedError('CHAT_NATIVE_CLIENT_INVALID', 'Chat native client is invalid.');
    }
    LocalServiceClass = mod.SecureLocalServiceClient;
    return LocalServiceClass;
  }

  async function doStart() {
    if (closing) throw typedError('CHAT_CLOSING', 'Chat is closing.');
    if (service) {
      try { await service.ping(); return service; }
      catch (_) { try { await service.close(); } catch (_) {} service = null; }
    }
    fs.mkdirSync(rootDir, { recursive: true, mode: 0o700 });
    const options = {
      dataDir: path.join(rootDir, 'secure-local'),
      identity: state.identity,
      keyringService: `${keyringServicePrefix}.remote-v1`,
      binaryPath
    };
    service = serviceFactory ? await serviceFactory(options) : new (await loadClientClass())(options);
    if (!service || typeof service.start !== 'function') throw typedError('CHAT_NATIVE_CLIENT_INVALID', 'Chat native service is invalid.');
    await service.start();
    return service;
  }

  async function ensureStarted() {
    if (startPromise) return startPromise;
    startPromise = doStart().finally(() => { startPromise = null; });
    return startPromise;
  }

  async function maybeGroup(conversationId) {
    const local = await ensureStarted();
    try { return await local.groupStatus(conversationId); }
    catch (error) {
      const message = String(error && error.message || '');
      if (/group missing|conversation.*missing|not joined/i.test(message)) return null;
      throw error;
    }
  }

  async function ensureCreatorGroup(conversationId) {
    let group = await maybeGroup(conversationId);
    if (!group) {
      await service.createGroup(conversationId);
      group = await service.groupStatus(conversationId);
    }
    return group;
  }

  async function synchronizeHandshake(conversationId) {
    const handshake = await transport.getHandshake(conversationId);
    let group = await maybeGroup(conversationId);

    if (handshake.role === 'CREATOR') {
      if (!group) group = await ensureCreatorGroup(conversationId);
      let pendingWelcome = String(state.pendingWelcomes[conversationId] || '');
      if (handshake.ready) {
        delete state.pendingWelcomes[conversationId];
        persist();
      } else if (handshake.keyPackageB64) {
        if (!pendingWelcome) {
          if (Number(group?.members || 0) >= 2) {
            throw typedError('CHAT_MLS_WELCOME_RECOVERY_REQUIRED', 'MLS membership advanced before its welcome was published.');
          }
          const added = await service.addMember(conversationId, base64UrlToHex(handshake.keyPackageB64, 'MLS key package'));
          if (!added?.welcome_hex) throw typedError('CHAT_MLS_WELCOME_MISSING', 'MLS did not produce a welcome.');
          pendingWelcome = hexToBase64Url(added.welcome_hex, 'MLS welcome');
          state.pendingWelcomes[conversationId] = pendingWelcome;
          persist();
          group = await service.groupStatus(conversationId);
        }
        await transport.publishWelcome(conversationId, pendingWelcome);
        delete state.pendingWelcomes[conversationId];
        persist();
      }
    } else if (handshake.role === 'JOINER' && !group && handshake.welcomeB64) {
      await service.joinGroup(conversationId, base64UrlToHex(handshake.welcomeB64, 'MLS welcome'));
      group = await service.groupStatus(conversationId);
    }

    return { handshake, group, ready: Boolean(group && Number(group.members || 0) >= 2) };
  }

  async function flushOutbox(conversationId) {
    const records = await service.listOutbox();
    for (const record of Array.isArray(records) ? records : []) {
      if (String(record?.conversation_id || '') !== conversationId) continue;
      const messageId = String(record?.message_id || '');
      const messageHex = String(record?.ciphertext?.message_hex || '');
      if (!messageId || !messageHex) continue;
      await transport.postMessage(conversationId, messageId, hexToBase64Url(messageHex, 'MLS message'));
      await service.advanceOutgoingStatus(messageId, 'delivered', { delivered_at: new Date().toISOString() });
    }
  }

  async function pullMessages(conversationId) {
    let cursor = Math.max(0, Number(state.cursors[conversationId] || 0));
    const rows = await transport.getMessages(conversationId, cursor);
    for (const row of rows) {
      const seq = Number(row?.seq || 0);
      const messageId = String(row?.message_id || '');
      if (!Number.isSafeInteger(seq) || seq <= cursor || !messageId) continue;

      const outgoing = await service.getOutgoing(messageId);
      if (outgoing) {
        if (!['delivered', 'read'].includes(String(outgoing.status || ''))) {
          await service.advanceOutgoingStatus(messageId, 'delivered', { delivered_at: new Date().toISOString() });
        }
      } else if (!(await service.hasInbox(messageId))) {
        const encryptedHex = base64UrlToHex(row.envelope_b64, 'MLS message');
        const decrypted = await service.decrypt(conversationId, encryptedHex);
        if (!decrypted || typeof decrypted.plaintext !== 'string') {
          throw typedError('CHAT_MLS_DECRYPT_FAILED', 'Encrypted Chat message could not be decrypted.');
        }
        await service.addInbox(messageId, {
          message_id: messageId,
          conversation_id: conversationId,
          sender_device_id: 'remote-peer',
          recipient_device_id: state.deviceId,
          kind: 'text',
          ciphertext: { message_hex: encryptedHex },
          plaintext: { text: decrypted.plaintext },
          received_at: new Date(Number(row.created_at || 0) * 1000 || Date.now()).toISOString(),
          read_at: null
        });
      }

      cursor = seq;
      state.cursors[conversationId] = cursor;
      persist();
    }
  }

  async function projectedConversation(conversationId, ready) {
    if (!conversationId) {
      return { id: '', mode: 'remote-online', network: 'online', ready: false, participants: [], messages: [] };
    }
    if (!ready) {
      return {
        id: conversationId,
        mode: 'remote-handshake',
        network: 'connecting',
        ready: false,
        participants: [{ deviceId: state.deviceId, role: 'local', label: 'You' }],
        messages: []
      };
    }

    const [outgoing, inbox] = await Promise.all([service.listOutgoing(), service.listInbox()]);
    const messages = [
      ...(Array.isArray(outgoing) ? outgoing.map((record) => projectMessage(record, 'local')) : []),
      ...(Array.isArray(inbox) ? inbox.map((record) => projectMessage(record, 'peer')) : [])
    ].filter(Boolean).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

    return {
      id: conversationId,
      mode: 'remote-online',
      network: 'online',
      ready: true,
      participants: [
        { deviceId: state.deviceId, role: 'local', label: 'You' },
        { deviceId: 'remote-peer', role: 'peer', label: 'Contact' }
      ],
      messages
    };
  }

  async function doSync() {
    const conversations = await transport.listConversations();
    const availableIds = new Set(conversations.map((item) => String(item?.conversation_id || '')).filter(Boolean));
    if (!availableIds.has(state.selectedConversationId)) {
      state.selectedConversationId = String(conversations[0]?.conversation_id || '');
      persist();
    }
    const conversationId = state.selectedConversationId;
    if (!conversationId) return { conversations, conversation: await projectedConversation('', false), group: null, ready: false };

    const synchronized = await synchronizeHandshake(conversationId);
    if (synchronized.ready) {
      await flushOutbox(conversationId);
      await pullMessages(conversationId);
    }
    return {
      conversations,
      conversation: await projectedConversation(conversationId, synchronized.ready),
      group: synchronized.group,
      ready: synchronized.ready
    };
  }

  async function synchronize() {
    if (syncPromise) return syncPromise;
    syncPromise = doSync().finally(() => { syncPromise = null; });
    return syncPromise;
  }

  async function statusPayload() {
    const synced = await synchronize();
    let ping = null;
    let security = null;
    if (synced.conversation.id) {
      await ensureStarted();
      [ping, security] = await Promise.all([service.ping(), service.securityStatus()]);
    }
    return {
      ok: true,
      mode: synced.ready ? 'remote-online' : (synced.conversation.id ? 'remote-handshake' : 'remote-empty'),
      network: synced.ready ? 'online' : (synced.conversation.id ? 'connecting' : 'online'),
      conversationCount: synced.conversations.length,
      selectedConversationId: synced.conversation.id,
      capabilities: {
        directInvite: true,
        text: synced.ready,
        attachments: false,
        voice: false,
        calls: false,
        reactions: false,
        edit: false,
        deleteForAll: false
      },
      service: {
        version: ping?.service_version || 'remote-chat-v1',
        protocol: ping?.protocol_version || null,
        crypto: ping?.crypto || 'OpenMLS',
        mlsStorage: ping?.mls_storage || (synced.conversation.id ? 'starting' : 'not-started'),
        messageStorage: ping?.message_storage || (synced.conversation.id ? 'starting' : 'not-started'),
        keyRoot: ping?.key_root || (synced.conversation.id ? 'OS Keyring' : 'not-created'),
        hardening: ping?.hardening || 'remote-transport'
      },
      security: {
        rawKeyExport: security?.raw_key_export ?? false,
        plaintextFallback: security?.plaintext_fallback ?? false,
        process: security?.process || (synced.conversation.id ? 'starting' : 'not-started'),
        mlsDatabase: security?.mls_database || (synced.conversation.id ? 'starting' : 'not-created'),
        messageDatabase: security?.message_database || (synced.conversation.id ? 'starting' : 'not-created')
      },
      group: synced.group ? {
        conversationId: synced.conversation.id,
        epoch: Number(synced.group.epoch || 0),
        members: Number(synced.group.members || 0),
        active: Boolean(synced.group.active)
      } : null,
      messageCount: synced.conversation.messages.length
    };
  }

  async function unsupported(code, message) { return publicError(typedError(code, message)); }

  return Object.freeze({
    async status() { try { return await statusPayload(); } catch (error) { return publicError(error); } },
    async getConversation() { try { const synced = await synchronize(); return { ok: true, conversation: synced.conversation }; } catch (error) { return publicError(error); } },
    async createDirectInvite() {
      try {
        const invite = await transport.createInvite();
        await ensureStarted();
        await ensureCreatorGroup(invite.conversationId);
        state.selectedConversationId = invite.conversationId;
        state.cursors[invite.conversationId] = 0;
        persist();
        return {
          ok: true,
          invite: { conversationId: invite.conversationId, token: invite.token, expiresAt: invite.expiresAt },
          conversation: await projectedConversation(invite.conversationId, false)
        };
      } catch (error) { return publicError(error); }
    },
    async joinDirectInvite(inviteToken) {
      try {
        await ensureStarted();
        const keyPackage = await service.keyPackage();
        const joined = await transport.joinInvite(inviteToken, hexToBase64Url(keyPackage?.key_package_hex, 'MLS key package'));
        state.selectedConversationId = joined.conversationId;
        state.cursors[joined.conversationId] = 0;
        persist();
        const synced = await synchronize();
        return { ok: true, conversation: synced.conversation };
      } catch (error) { return publicError(error); }
    },
    async refreshRemoteTransport() { try { const synced = await synchronize(); return { ok: true, conversation: synced.conversation }; } catch (error) { return publicError(error); } },
    async sendLocalText(value, options = null) {
      try {
        if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > MAX_TEXT_BYTES) {
          throw typedError('CHAT_TEXT_INVALID', 'Message text is invalid.');
        }
        const synced = await synchronize();
        const conversationId = synced.conversation.id;
        if (!conversationId || !synced.ready) throw typedError('CHAT_CONVERSATION_NOT_READY', 'The secure conversation is not ready yet.');

        let reply = null;
        const replyToId = String(options && options.replyToId || '');
        if (replyToId) {
          const target = synced.conversation.messages.find((message) => message.id === replyToId && !message.deleted);
          if (!target) throw typedError('REPLY_TARGET_NOT_FOUND', 'Reply target is unavailable.');
          reply = { messageId: target.id, sender: target.sender, text: String(target.text || '').slice(0, 420) };
        }

        const wireText = encodeTextPayload(value, reply);
        const messageId = `m-${crypto.randomUUID()}`;
        const createdAt = new Date().toISOString();
        await service.stageOutgoing({
          message_id: messageId,
          conversation_id: conversationId,
          sender_device_id: state.deviceId,
          recipient_device_id: 'remote-peer',
          kind: 'text',
          plaintext: { text: wireText },
          status: 'encrypt_pending',
          created_at: createdAt
        });
        const encrypted = await service.encrypt(conversationId, wireText);
        await service.updateOutgoing(messageId, { ciphertext: { message_hex: encrypted.message_hex }, status: 'queued' });
        await transport.postMessage(conversationId, messageId, hexToBase64Url(encrypted.message_hex, 'MLS message'));
        await service.advanceOutgoingStatus(messageId, 'delivered', { delivered_at: new Date().toISOString() });
        const refreshed = await synchronize();
        return { ok: true, committed: true, messageId, conversation: refreshed.conversation };
      } catch (error) { return publicError(error); }
    },
    async sendPeerText() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async sendCamelText() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async sendStagedAttachment() { return unsupported('CHAT_MEDIA_NOT_READY', 'Encrypted media transport is not available yet.'); },
    async stageAttachmentFromSelectedPath() { return unsupported('CHAT_MEDIA_NOT_READY', 'Encrypted media transport is not available yet.'); },
    async readAttachmentForMessage() { return unsupported('CHAT_MEDIA_NOT_READY', 'Encrypted media transport is not available yet.'); },
    async reactLocal() { return unsupported('CHAT_ACTION_NOT_READY', 'Reactions are not available in online Chat yet.'); },
    async reactPeer() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async reactCamel() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async editLocal() { return unsupported('CHAT_ACTION_NOT_READY', 'Message editing is not available in online Chat yet.'); },
    async editPeer() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async editCamel() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async deleteLocalForAll() { return unsupported('CHAT_ACTION_NOT_READY', 'Delete for everyone is not available in online Chat yet.'); },
    async deletePeerForAll() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async deleteCamelForAll() { return unsupported('CHAT_LAB_DISABLED', 'Local test senders are disabled.'); },
    async getDeviceContext() { return { ok: true, context: { currentDeviceId: state.deviceId, devices: [] } }; },
    async getDeviceEnrollmentStatus() { return unsupported('CHAT_DEVICE_MANAGEMENT_NOT_READY', 'Chat device management is not available yet.'); },
    async revokeAccountDevice() { return unsupported('CHAT_DEVICE_MANAGEMENT_NOT_READY', 'Chat device management is not available yet.'); },
    async getDeviceRevocationStatus() { return unsupported('CHAT_DEVICE_MANAGEMENT_NOT_READY', 'Chat device management is not available yet.'); },
    async beginDeviceEnrollment() { return unsupported('CHAT_DEVICE_MANAGEMENT_NOT_READY', 'Chat device management is not available yet.'); },
    async cancelDeviceEnrollment() { return unsupported('CHAT_DEVICE_MANAGEMENT_NOT_READY', 'Chat device management is not available yet.'); },
    async getDeviceEnrollmentTransportStatus() { return unsupported('CHAT_DEVICE_MANAGEMENT_NOT_READY', 'Chat device management is not available yet.'); },
    async acquireAccountServiceAuthorizationForTransport() { return accountServiceGrantProvider(); },
    async close() {
      closing = true;
      try { if (service) await service.close(); }
      finally { service = null; closing = false; }
    }
  });
}

module.exports = { createRemoteChatController, __test: { hexToBase64Url, base64UrlToHex } };
