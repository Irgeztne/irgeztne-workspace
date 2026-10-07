'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createMessengerDeviceRegistry } = require('./account-device-registry.cjs');
const { createAccountDeviceEnrollment } = require('./account-device-enrollment.cjs');
const { createAccountDeviceLocalTransport } = require('./account-device-local-transport.cjs');
const { createAccountDeviceRevocation } = require('./account-device-revocation.cjs');
const { createMessengerBlobStore } = require('./messenger-blob-store.cjs');
const { createRemoteChatController } = require('./remote-chat-main.cjs');

const CONVERSATION_ID = 'green-lightning-local-v04p1';
const LOCAL_IDENTITY = 'workspace-local/device-a-v04p1';
const PEER_IDENTITY = 'workspace-loopback/device-b-v04p1';
const LOCAL_DEVICE_ID = 'device-a-v04p1';
const PEER_DEVICE_ID = 'device-b-v04p1';
const CAMEL_IDENTITY = 'workspace-loopback-camel/device-c-v04p13';
const CAMEL_DEVICE_ID = 'device-c-v04p13';
const MAX_TEXT_BYTES = 65_536;
const APP_MESSAGE_MARKER = 'irgeztne.gl.message.v1';
const MAX_REPLY_PREVIEW_CHARS = 420;
const MESSAGE_CONTENT_KINDS = Object.freeze(['text', 'attachment', 'voice-note']);
const MESSAGE_CONTENT_KIND_SET = new Set(MESSAGE_CONTENT_KINDS);
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_VOICE_NOTE_BYTES = 15 * 1024 * 1024;
const MAX_VOICE_NOTE_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_KEYRING_SERVICE_PREFIX = 'com.irgeztne.green-lightning.workspace.v04p1';
const IRGEZTNE_REACTIONS_V04P17 = Object.freeze(['👍', '❤️', '😂', '😮', '😢', '🐪']);
const IRGEZTNE_REACTION_SET_V04P17 = new Set(IRGEZTNE_REACTIONS_V04P17);

function cleanError(error) {
  const code = String(error && error.code || 'MESSENGER_ERROR').slice(0, 80);
  const message = String(error && error.message || error || 'Messenger operation failed').slice(0, 1200);
  return { ok: false, error: { code, message } };
}

function validateText(value) {
  if (typeof value !== 'string') throw new TypeError('message text must be a string');
  if (!value.trim()) throw new TypeError('message text is empty');
  if (Buffer.byteLength(value, 'utf8') > MAX_TEXT_BYTES) throw new TypeError('message text exceeds 64 KiB limit');
  return value;
}

function normalizeSender(value) {
  return value === 'camel' ? 'camel' : (value === 'peer' ? 'peer' : 'local');
}

function decodeReplySource(reply) {
  return reply && typeof reply === 'object' && typeof reply.messageId === 'string' && reply.messageId
    ? {
        messageId: String(reply.messageId),
        sender: normalizeSender(reply.sender),
        text: typeof reply.text === 'string' ? reply.text : ''
      }
    : null;
}

function validateBlobId(value) {
  const blobId = String(value == null ? '' : value);
  if (!blobId || blobId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(blobId)) {
    throw new TypeError('invalid app-owned blob id');
  }
  return blobId;
}

function validateMimeType(value, { audioOnly = false } = {}) {
  const mimeType = String(value == null ? '' : value).trim().toLowerCase();
  if (
    !mimeType ||
    mimeType.length > 127 ||
    !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mimeType) ||
    (audioOnly && !mimeType.startsWith('audio/'))
  ) {
    throw new TypeError(audioOnly ? 'invalid voice-note MIME type' : 'invalid attachment MIME type');
  }
  return mimeType;
}

function attachmentMimeTypeFromName(value) {
  const extension = path.extname(String(value || '')).toLowerCase();

  const known = Object.freeze({
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });

  return known[extension] || 'application/octet-stream';
}

function validateContentHash(value) {
  const sha256 = String(value == null ? '' : value).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError('invalid attachment SHA-256');
  return sha256;
}

function validateSizeBytes(value, maximum, label) {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maximum) {
    throw new TypeError(`${label} size is outside the allowed limit`);
  }
  return sizeBytes;
}

function validateAttachmentMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('attachment metadata must be an object');
  }

  const name = String(value.name == null ? '' : value.name).trim();
  if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(name)) {
    throw new TypeError('invalid attachment display name');
  }

  return Object.freeze({
    blobId: validateBlobId(value.blobId),
    name,
    mimeType: validateMimeType(value.mimeType),
    sizeBytes: validateSizeBytes(value.sizeBytes, MAX_ATTACHMENT_BYTES, 'attachment'),
    sha256: validateContentHash(value.sha256)
  });
}

function canonicalReplyPreview(message) {
  if (!message || typeof message !== 'object') return '';
  if (message.contentKind === 'attachment' && message.attachment) {
    return String(message.attachment.name || '').slice(0, MAX_REPLY_PREVIEW_CHARS);
  }
  if (message.contentKind === 'voice-note') return 'Voice note';
  return String(message.text || '').slice(0, MAX_REPLY_PREVIEW_CHARS);
}

function validateVoiceNoteMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('voice-note metadata must be an object');
  }

  const durationMs = Number(value.durationMs);
  if (!Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > MAX_VOICE_NOTE_DURATION_MS) {
    throw new TypeError('voice-note duration is outside the allowed limit');
  }

  return Object.freeze({
    blobId: validateBlobId(value.blobId),
    mimeType: validateMimeType(value.mimeType, { audioOnly: true }),
    sizeBytes: validateSizeBytes(value.sizeBytes, MAX_VOICE_NOTE_BYTES, 'voice-note'),
    durationMs,
    sha256: validateContentHash(value.sha256)
  });
}

function encodeMessageContentPayload(kind, content, replyTo = null) {
  if (!MESSAGE_CONTENT_KIND_SET.has(kind)) throw new TypeError('unsupported message content kind');

  if (kind === 'text') {
    return JSON.stringify({
      marker: APP_MESSAGE_MARKER,
      v: 1,
      kind: 'text',
      text: validateText(content),
      reply: replyTo || null
    });
  }

  if (kind === 'attachment') {
    return JSON.stringify({
      marker: APP_MESSAGE_MARKER,
      v: 1,
      kind: 'attachment',
      attachment: validateAttachmentMetadata(content),
      reply: replyTo || null
    });
  }

  return JSON.stringify({
    marker: APP_MESSAGE_MARKER,
    v: 1,
    kind: 'voice-note',
    voiceNote: validateVoiceNoteMetadata(content),
    reply: replyTo || null
  });
}

// IRGEZTNE_REACTIONS_V04P17
function decodeApplicationPayload(rawText) {
  const raw = typeof rawText === 'string' ? rawText : '';
  if (!raw || raw[0] !== '{') return { kind: 'text', text: raw, replyTo: null };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.marker !== APP_MESSAGE_MARKER || parsed.v !== 1) {
      return { kind: 'text', text: raw, replyTo: null };
    }

    if (
      parsed.kind === 'reaction' &&
      typeof parsed.targetMessageId === 'string' &&
      parsed.targetMessageId &&
      (parsed.emoji === null || IRGEZTNE_REACTION_SET_V04P17.has(String(parsed.emoji)))
    ) {
      return {
        kind: 'reaction',
        targetMessageId: String(parsed.targetMessageId),
        emoji: parsed.emoji === null ? null : String(parsed.emoji)
      };
    }

    // IRGEZTNE_MESSAGE_EDIT_V04P18
    if (
      parsed.kind === 'edit' &&
      typeof parsed.targetMessageId === 'string' &&
      parsed.targetMessageId &&
      typeof parsed.text === 'string'
    ) {
      return {
        kind: 'edit',
        targetMessageId: String(parsed.targetMessageId),
        text: parsed.text
      };
    }

    // IRGEZTNE_MESSAGE_LIFECYCLE_V04P19
    if (
      parsed.kind === 'delete' &&
      typeof parsed.targetMessageId === 'string' &&
      parsed.targetMessageId
    ) {
      return {
        kind: 'delete',
        targetMessageId: String(parsed.targetMessageId)
      };
    }

    if (parsed.kind === 'attachment') {
      try {
        return {
          kind: 'attachment',
          attachment: validateAttachmentMetadata(parsed.attachment),
          replyTo: decodeReplySource(parsed.reply)
        };
      } catch (_) {
        return { kind: 'text', text: raw, replyTo: null };
      }
    }

    if (parsed.kind === 'voice-note') {
      try {
        return {
          kind: 'voice-note',
          voiceNote: validateVoiceNoteMetadata(parsed.voiceNote),
          replyTo: decodeReplySource(parsed.reply)
        };
      } catch (_) {
        return { kind: 'text', text: raw, replyTo: null };
      }
    }

    if (parsed.kind !== 'text' || typeof parsed.text !== 'string') {
      return { kind: 'text', text: raw, replyTo: null };
    }

    return { kind: 'text', text: parsed.text, replyTo: decodeReplySource(parsed.reply) };
  } catch (_) {
    // Old/plain messages and user-authored JSON remain plain text.
    return { kind: 'text', text: raw, replyTo: null };
  }
}

function encodeApplicationPayload(text, replyTo = null) {
  return encodeMessageContentPayload('text', text, replyTo);
}

function encodeReactionPayload(targetMessageId, emoji) {
  return JSON.stringify({
    marker: APP_MESSAGE_MARKER,
    v: 1,
    kind: 'reaction',
    targetMessageId,
    emoji: emoji || null
  });
}

function encodeEditPayload(targetMessageId, text) {
  return JSON.stringify({
    marker: APP_MESSAGE_MARKER,
    v: 1,
    kind: 'edit',
    targetMessageId,
    text
  });
}

function encodeDeletePayload(targetMessageId) {
  return JSON.stringify({
    marker: APP_MESSAGE_MARKER,
    v: 1,
    kind: 'delete',
    targetMessageId
  });
}

function validateDeleteTarget(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid delete target message id');
  }
  return messageId;
}

function validateEditTarget(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid edit target message id');
  }
  return messageId;
}

function validateReactionTarget(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid reaction target message id');
  }
  return messageId;
}

function validateAttachmentTarget(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid attachment target message id');
  }
  return messageId;
}

function validateReactionEmoji(value) {
  const emoji = String(value == null ? '' : value);
  if (!IRGEZTNE_REACTION_SET_V04P17.has(emoji)) {
    throw new TypeError('invalid reaction emoji');
  }
  return emoji;
}

function validateSendOptions(value) {
  if (value == null) return { replyToId: null };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('message send options must be an object');
  }

  const replyToId = value.replyToId == null ? '' : String(value.replyToId);
  if (!replyToId) return { replyToId: null };
  if (replyToId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(replyToId)) {
    throw new TypeError('invalid reply target message id');
  }
  return { replyToId };
}

function safeMessage(record, sender = 'local') {
  if (!record || typeof record !== 'object') return null;
  const storedText = record.plaintext && typeof record.plaintext.text === 'string'
    ? record.plaintext.text
    : '';
  const application = decodeApplicationPayload(storedText);
  if (!MESSAGE_CONTENT_KIND_SET.has(application.kind)) return null;

  const normalizedSender = normalizeSender(sender);

  return {
    id: String(record.message_id || ''),
    conversationId: String(record.conversation_id || CONVERSATION_ID),
    sender: normalizedSender,
    direction: normalizedSender === 'local' ? 'outgoing' : 'incoming',
    contentKind: application.kind,
    text: application.kind === 'text' ? application.text : '',
    attachment: application.kind === 'attachment' ? application.attachment : null,
    voiceNote: application.kind === 'voice-note' ? application.voiceNote : null,
    replyTo: application.replyTo,
    reactions: [],
    edited: false,
    editedAt: '',
    deleted: false,
    deletedAt: '',
    status: String(record.status || (record.received_at ? 'delivered' : 'unknown')),
    createdAt: String(record.created_at || record.received_at || ''),
    deliveredAt: String(record.delivered_at || record.received_at || '')
  };
}

function safeReaction(record, sender = 'local') {
  if (!record || typeof record !== 'object') return null;

  const status = String(record.status || 'unknown');
  if (status !== 'delivered' && status !== 'read') return null;

  const storedText = record.plaintext && typeof record.plaintext.text === 'string'
    ? record.plaintext.text
    : '';
  const application = decodeApplicationPayload(storedText);
  if (application.kind !== 'reaction') return null;

  return {
    eventId: String(record.message_id || ''),
    targetMessageId: String(application.targetMessageId || ''),
    sender: normalizeSender(sender),
    emoji: application.emoji === null ? null : String(application.emoji || ''),
    createdAt: String(record.created_at || record.received_at || '')
  };
}

function safeEdit(record, sender = 'local') {
  if (!record || typeof record !== 'object') return null;

  const status = String(record.status || 'unknown');
  if (status !== 'delivered' && status !== 'read') return null;

  const storedText = record.plaintext && typeof record.plaintext.text === 'string'
    ? record.plaintext.text
    : '';
  const application = decodeApplicationPayload(storedText);
  if (application.kind !== 'edit') return null;

  return {
    eventId: String(record.message_id || ''),
    targetMessageId: String(application.targetMessageId || ''),
    sender: normalizeSender(sender),
    text: String(application.text || ''),
    createdAt: String(record.created_at || record.received_at || '')
  };
}

function safeDelete(record, sender = 'local') {
  if (!record || typeof record !== 'object') return null;

  const status = String(record.status || 'unknown');
  if (status !== 'delivered' && status !== 'read') return null;

  const storedText = record.plaintext && typeof record.plaintext.text === 'string'
    ? record.plaintext.text
    : '';
  const application = decodeApplicationPayload(storedText);
  if (application.kind !== 'delete') return null;

  return {
    eventId: String(record.message_id || ''),
    targetMessageId: String(application.targetMessageId || ''),
    sender: normalizeSender(sender),
    createdAt: String(record.created_at || record.received_at || '')
  };
}

function createWorkspaceMessengerController({
  app,
  runtimeDir,
  storage,
  safeStorage = null,
  keyringServicePrefix = DEFAULT_KEYRING_SERVICE_PREFIX,
  serviceFactory = null,
  accountServiceGrantProvider = null,
  fetchImpl = null,
  chatServiceBaseUrl = '',
  localLabEnabled = true
}) {
  if (!app || typeof app.getPath !== 'function') throw new Error('Electron app is required');
  if (!runtimeDir) throw new Error('Messenger runtimeDir is required');
  if (!storage) throw new Error('Messenger Storage Core is required');
  if (
    typeof keyringServicePrefix !== 'string' ||
    !keyringServicePrefix ||
    keyringServicePrefix.length > 220 ||
    !/^[A-Za-z0-9._-]+$/.test(keyringServicePrefix)
  ) {
    throw new Error('Messenger keyring service prefix is invalid');
  }
  if (serviceFactory !== null && typeof serviceFactory !== 'function') {
    throw new Error('Messenger service factory must be a function');
  }
  if (accountServiceGrantProvider !== null && typeof accountServiceGrantProvider !== 'function') {
    throw new Error('Messenger Account service grant provider must be a function');
  }
  if (typeof localLabEnabled !== 'boolean') {
    throw new Error('Messenger localLabEnabled must be boolean');
  }

  if (!localLabEnabled && typeof fetchImpl === 'function' && String(chatServiceBaseUrl || '').trim()) {
    return createRemoteChatController({
      app,
      runtimeDir,
      serviceFactory,
      fetchImpl,
      accountServiceGrantProvider,
      chatServiceBaseUrl,
      keyringServicePrefix,
      encodeTextPayload: encodeApplicationPayload,
      projectMessage: safeMessage
    });
  }

  const suffix = process.platform === 'win32' ? '.exe' : '';
  const binaryPath = path.join(runtimeDir, `irgeztne-green-lightning-secure-local-service-v04n${suffix}`);
  const hostClientPath = path.join(runtimeDir, 'secure-local-service-client.mjs');
  const rootDataDir = path.join(app.getPath('userData'), 'green-lightning-v04p1');

  const attachmentBlobStore = safeStorage
    ? createMessengerBlobStore({
        rootDir: path.join(rootDataDir, 'blobs'),
        safeStorage
      })
    : null;

  let LocalServiceClass = null;
  let localService = null;
  let peerService = null;
  let camelService = null;
  const group3ReadyMarker = path.join(rootDataDir, '.group3-v04p13-ready');
  const group3BackupDir = `${rootDataDir}-before-group3-v04p13`;
  let startPromise = null;
  let closing = false;

  // P21 Account↔Device foundation. The current live topology is still the
  // accepted local MLS test trio. Registry metadata and authorization now live
  // in main process / Storage Core; renderer sender controls cannot bypass it.
  const deviceDefinitions = [
    {
      deviceId: LOCAL_DEVICE_ID,
      memberIdentity: LOCAL_IDENTITY,
      label: 'This Workspace',
      role: 'local',
      ownerKind: 'workspace-device',
      ownerAccountId: 'workspace-local',
      labPeer: false
    }
  ];

  if (localLabEnabled) {
    deviceDefinitions.push(
      {
        deviceId: PEER_DEVICE_ID,
        memberIdentity: PEER_IDENTITY,
        label: 'Mirror',
        role: 'peer',
        ownerKind: 'lab-peer',
        ownerAccountId: 'workspace-loopback',
        labPeer: true
      },
      {
        deviceId: CAMEL_DEVICE_ID,
        memberIdentity: CAMEL_IDENTITY,
        label: 'Camel',
        role: 'camel',
        ownerKind: 'lab-peer',
        ownerAccountId: 'workspace-loopback-camel',
        labPeer: true
      }
    );
  }

  const deviceRegistry = createMessengerDeviceRegistry({
    storage,
    conversationId: CONVERSATION_ID,
    currentDeviceId: LOCAL_DEVICE_ID,
    definitions: deviceDefinitions,
    // Production starts clean while the real remote transport is being wired.
    // The old local MLS trio remains available only behind an explicit dev flag.
    persistOnCreate: localLabEnabled
  });

  // P22 production enrollment owner. The renderer may start/cancel/view an
  // invitation, but it cannot submit arbitrary remote enrollment requests.
  // The acceptRequest/confirmJoined path remains main-process only until a
  // transport adapter is connected in a later stage.
  const deviceEnrollment = createAccountDeviceEnrollment({
    storage,
    conversationId: CONVERSATION_ID,
    currentDeviceId: LOCAL_DEVICE_ID,
    deviceRegistry,
    commitNewMember: async ({ keyPackageHex }) => {
      await ensureStarted();

      const add = await localService.addMember(CONVERSATION_ID, keyPackageHex);
      if (!add || !add.welcome_hex || !add.commit_hex) {
        const error = new Error('MLS add-member did not return Welcome + Commit');
        error.code = 'MLS_ADD_CONTRACT_ERROR';
        throw error;
      }

      // Existing live members must advance to the same epoch as the committer.
      await Promise.all([
        peerService.applyCommit(CONVERSATION_ID, add.commit_hex),
        camelService.applyCommit(CONVERSATION_ID, add.commit_hex),
      ]);

      return add;
    },
  });

  const localEnrollmentTransport = createAccountDeviceLocalTransport({
    enrollment: deviceEnrollment,
  });

  function enrollmentNeedsLocalTransport() {
    const status = deviceEnrollment.publicStatus({ includeCode: false });

    if (status.status === 'pending') return true;

    // After A1 approved the new member, keep the listener alive until A2 sends
    // the joined receipt. The Device Registry remains fail-closed as enrolling.
    if (status.status === 'completed' && status.completed && status.completed.deviceId) {
      const device = deviceRegistry.getDevice(status.completed.deviceId);
      return Boolean(device && device.status !== 'active');
    }

    return false;
  }

  async function ensureLocalEnrollmentTransport() {
    if (!enrollmentNeedsLocalTransport()) {
      if (localEnrollmentTransport.publicStatus().active) {
        await localEnrollmentTransport.stop();
      }
      return localEnrollmentTransport.publicStatus();
    }

    const current = localEnrollmentTransport.publicStatus();
    if (current.active) return current;
    return localEnrollmentTransport.start();
  }

  const deviceRevocation = createAccountDeviceRevocation({
    storage,
    deviceRegistry,
    currentDeviceId: LOCAL_DEVICE_ID,

    removeMember: async ({ memberIdentity }) => {
      await ensureStarted();

      const result = await localService.removeMember(CONVERSATION_ID, memberIdentity);
      if (!result || !['REMOVED', 'NOT_PRESENT'].includes(result.result)) {
        const error = new Error('MLS removeMember returned an invalid product result');
        error.code = 'MLS_REMOVE_CONTRACT_ERROR';
        throw error;
      }

      return result;
    },

    applyCommit: async ({ commitHex }) => {
      await ensureStarted();

      // The revoked member must NOT receive this Commit. The remaining accepted
      // local members B/C advance to the same epoch as A.
      await Promise.all([
        peerService.applyCommit(CONVERSATION_ID, commitHex),
        camelService.applyCommit(CONVERSATION_ID, commitHex),
      ]);

      return { ok: true };
    },
  });

  async function loadClientClass() {
    if (LocalServiceClass) return LocalServiceClass;
    if (!fs.existsSync(hostClientPath)) throw new Error(`Green Lightning host client missing: ${hostClientPath}`);
    if (!fs.existsSync(binaryPath)) throw new Error(`Green Lightning secure-local-service binary missing: ${binaryPath}`);

    const mod = await import(pathToFileURL(hostClientPath).href);
    if (!mod || typeof mod.SecureLocalServiceClient !== 'function') {
      throw new Error('Green Lightning host client contract unavailable');
    }
    LocalServiceClass = mod.SecureLocalServiceClient;
    return LocalServiceClass;
  }

  function keyringService(slot) {
    return `${keyringServicePrefix}.${slot}`;
  }

  async function openService(slot, identity) {
    const options = {
      dataDir: path.join(rootDataDir, slot),
      identity,
      keyringService: keyringService(slot),
      binaryPath
    };
    const service = serviceFactory
      ? await serviceFactory(options)
      : new (await loadClientClass())(options);
    if (!service || typeof service.start !== 'function') {
      throw new Error('Messenger service factory returned an invalid service');
    }
    await service.start();
    return service;
  }


  function snapshotBeforeGroup3Migration() {
    if (fs.existsSync(group3ReadyMarker)) return null;
    if (!fs.existsSync(rootDataDir)) return null;

    const localDir = path.join(rootDataDir, 'local');
    const peerDir = path.join(rootDataDir, 'loopback-peer');
    if (!fs.existsSync(localDir) || !fs.existsSync(peerDir)) return null;

    if (!fs.existsSync(group3BackupDir)) {
      fs.cpSync(rootDataDir, group3BackupDir, {
        recursive: true,
        errorOnExist: true,
        force: false
      });
    }

    return group3BackupDir;
  }

  async function closeServices() {
    const services = [localService, peerService, camelService].filter(Boolean);
    localService = null;
    peerService = null;
    camelService = null;
    await Promise.allSettled(services.map((service) => service.close()));
  }

  async function maybeGroup(service) {
    try {
      return await service.groupStatus(CONVERSATION_ID);
    } catch (error) {
      const message = String(error && error.message || error || '');
      if (/group missing|conversation.*missing|MLS group missing|not joined on this device|conversation is not joined/i.test(message)) return null;
      throw error;
    }
  }

  async function ensureGroupTrio() {
    let [localGroup, peerGroup, camelGroup] = await Promise.all([
      maybeGroup(localService),
      maybeGroup(peerService),
      maybeGroup(camelService)
    ]);

    // Fresh profile: build the accepted A+B pair first.
    if (!localGroup && !peerGroup && !camelGroup) {
      await localService.createGroup(CONVERSATION_ID);
      const peerKp = await peerService.keyPackage();
      const peerAdd = await localService.addMember(CONVERSATION_ID, peerKp.key_package_hex);
      if (!peerAdd || !peerAdd.welcome_hex) {
        const error = new Error('MLS add-member did not return peer welcome');
        error.code = 'MLS_WELCOME_MISSING';
        throw error;
      }
      await peerService.joinGroup(CONVERSATION_ID, peerAdd.welcome_hex);

      [localGroup, peerGroup] = await Promise.all([
        localService.groupStatus(CONVERSATION_ID),
        peerService.groupStatus(CONVERSATION_ID)
      ]);
    }

    // Never silently reconstruct an existing accepted A+B state.
    if (!localGroup || !peerGroup) {
      const error = new Error('Green Lightning A/B MLS state mismatch; refusing silent recreation');
      error.code = 'MLS_STATE_MISMATCH';
      throw error;
    }

    if (String(localGroup.group_id_hex || '') !== String(peerGroup.group_id_hex || '')) {
      const error = new Error('Green Lightning A/B MLS group IDs differ; refusing unsafe continuation');
      error.code = 'MLS_GROUP_MISMATCH';
      throw error;
    }

    // Existing accepted P12 profile: migrate A+B -> A+B+C exactly once.
    if (!camelGroup) {
      const camelKp = await camelService.keyPackage();
      const add = await localService.addMember(CONVERSATION_ID, camelKp.key_package_hex);

      if (!add || !add.welcome_hex || !add.commit_hex) {
        const error = new Error('MLS add-member did not return both welcome_hex and commit_hex');
        error.code = 'MLS_GROUP3_HANDSHAKE_INCOMPLETE';
        throw error;
      }

      // A is the committer and its native add_member owner advances A.
      // B is an existing member and must process the new commit.
      // C is the new member and joins from Welcome.
      await peerService.applyCommit(CONVERSATION_ID, add.commit_hex);
      await camelService.joinGroup(CONVERSATION_ID, add.welcome_hex);

      [localGroup, peerGroup, camelGroup] = await Promise.all([
        localService.groupStatus(CONVERSATION_ID),
        peerService.groupStatus(CONVERSATION_ID),
        camelService.groupStatus(CONVERSATION_ID)
      ]);
    }

    if (!localGroup || !peerGroup || !camelGroup) {
      const error = new Error('Green Lightning three-member MLS state incomplete; refusing unsafe continuation');
      error.code = 'MLS_GROUP3_STATE_MISMATCH';
      throw error;
    }

    const localId = String(localGroup.group_id_hex || '');
    const peerId = String(peerGroup.group_id_hex || '');
    const camelId = String(camelGroup.group_id_hex || '');

    if (!localId || localId !== peerId || localId !== camelId) {
      const error = new Error('Green Lightning three-member MLS group IDs differ; refusing unsafe continuation');
      error.code = 'MLS_GROUP3_ID_MISMATCH';
      throw error;
    }

    try {
      fs.writeFileSync(
        group3ReadyMarker,
        JSON.stringify({
          version: '0.4P13',
          readyAt: new Date().toISOString(),
          groupId: localId
        }) + '\n',
        { encoding: 'utf8', mode: 0o600 }
      );
    } catch (_) {
      // Marker is operational metadata only; never downgrade a healthy MLS group
      // because this convenience marker could not be written.
    }

    return { localGroup, peerGroup, camelGroup };
  }

  async function doStart() {
    if (closing) throw new Error('Messenger is closing');

    if (localService && peerService && camelService) {
      try {
        await Promise.all([
          localService.ping(),
          peerService.ping(),
          camelService.ping()
        ]);
        return ensureGroupTrio();
      } catch (_) {
        await closeServices();
      }
    }

    // Cold encrypted snapshot before opening SQLCipher databases for the first
    // A+B -> A+B+C migration. No plaintext or key export is performed.
    snapshotBeforeGroup3Migration();

    fs.mkdirSync(rootDataDir, { recursive: true, mode: 0o700 });
    localService = await openService('local', LOCAL_IDENTITY);

    try {
      peerService = await openService('loopback-peer', PEER_IDENTITY);
      camelService = await openService('loopback-camel', CAMEL_IDENTITY);
      return await ensureGroupTrio();
    } catch (error) {
      await closeServices();
      throw error;
    }
  }

  function remotePendingConversation() {
    return {
      id: CONVERSATION_ID,
      mode: 'remote-pending',
      network: 'pending',
      participants: [
        { deviceId: LOCAL_DEVICE_ID, role: 'local', label: 'You' }
      ],
      messages: []
    };
  }

  async function ensureStarted() {
    if (!localLabEnabled) {
      const error = new Error('Remote Chat transport is not connected yet');
      error.code = 'CHAT_REMOTE_TRANSPORT_PENDING';
      throw error;
    }
    if (startPromise) return startPromise;
    startPromise = doStart().finally(() => { startPromise = null; });
    return startPromise;
  }

  async function conversationPayload() {
    if (!localLabEnabled) return remotePendingConversation();
    await ensureStarted();

    const [localOutgoing, peerOutgoing, camelOutgoing] = await Promise.all([
      localService.listOutgoing(),
      peerService.listOutgoing(),
      camelService.listOutgoing()
    ]);

    const sources = [
      { sender: 'local', records: Array.isArray(localOutgoing) ? localOutgoing : [] },
      { sender: 'peer', records: Array.isArray(peerOutgoing) ? peerOutgoing : [] },
      { sender: 'camel', records: Array.isArray(camelOutgoing) ? camelOutgoing : [] }
    ];

    const messages = sources
      .flatMap(({ sender, records }) => records.map((record) => safeMessage(record, sender)).filter(Boolean))
      .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

    const messageIds = new Set(messages.map((message) => message.id).filter(Boolean));
    const messageById = new Map(messages.map((message) => [message.id, message]));

    // P18: edits are immutable encrypted application events. Only the latest
    // valid edit from the original sender is projected onto the visible message.
    const editEvents = sources
      .flatMap(({ sender, records }) => records.map((record) => safeEdit(record, sender)).filter(Boolean))
      .filter((event) => messageIds.has(event.targetMessageId))
      .sort((a, b) => {
        const byTime = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        return byTime || String(a.eventId || '').localeCompare(String(b.eventId || ''));
      });

    const latestEditByMessage = new Map();
    for (const event of editEvents) {
      const target = messageById.get(event.targetMessageId);
      if (!target || target.sender !== event.sender) continue;
      latestEditByMessage.set(event.targetMessageId, event);
    }

    for (const [messageId, event] of latestEditByMessage.entries()) {
      const message = messageById.get(messageId);
      if (!message) continue;
      message.text = event.text;
      message.edited = true;
      message.editedAt = event.createdAt;
    }

    // P19: delete-for-all is another immutable encrypted application event.
    // A valid tombstone may only be authored by the original message sender.
    const deleteEvents = sources
      .flatMap(({ sender, records }) => records.map((record) => safeDelete(record, sender)).filter(Boolean))
      .filter((event) => messageIds.has(event.targetMessageId))
      .sort((a, b) => {
        const byTime = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        return byTime || String(a.eventId || '').localeCompare(String(b.eventId || ''));
      });

    const latestDeleteByMessage = new Map();
    for (const event of deleteEvents) {
      const target = messageById.get(event.targetMessageId);
      if (!target || target.sender !== event.sender) continue;
      latestDeleteByMessage.set(event.targetMessageId, event);
    }

    for (const [messageId, event] of latestDeleteByMessage.entries()) {
      const message = messageById.get(messageId);
      if (!message) continue;
      message.deleted = true;
      message.deletedAt = event.createdAt;
      message.text = '';
      message.attachment = null;
      message.voiceNote = null;
      message.replyTo = null;
      message.edited = false;
      message.editedAt = '';
      message.reactions = [];
    }

    const reactionEvents = sources
      .flatMap(({ sender, records }) => records.map((record) => safeReaction(record, sender)).filter(Boolean))
      .filter((event) => messageIds.has(event.targetMessageId))
      .sort((a, b) => {
        const byTime = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        return byTime || String(a.eventId || '').localeCompare(String(b.eventId || ''));
      });

    // One current reaction per actor per message. New reaction replaces the old;
    // choosing the same reaction again emits emoji:null and removes it.
    const reactionState = new Map();
    for (const event of reactionEvents) {
      const key = `${event.targetMessageId}\u0000${event.sender}`;
      if (event.emoji === null) reactionState.delete(key);
      else reactionState.set(key, event);
    }

    for (const event of reactionState.values()) {
      const message = messageById.get(event.targetMessageId);
      if (!message || message.deleted) continue;

      let bucket = message.reactions.find((reaction) => reaction.emoji === event.emoji);
      if (!bucket) {
        bucket = { emoji: event.emoji, count: 0, actors: [] };
        message.reactions.push(bucket);
      }
      if (!bucket.actors.includes(event.sender)) bucket.actors.push(event.sender);
    }

    for (const message of messages) {
      message.reactions.sort(
        (a, b) => IRGEZTNE_REACTIONS_V04P17.indexOf(a.emoji) - IRGEZTNE_REACTIONS_V04P17.indexOf(b.emoji)
      );
      for (const reaction of message.reactions) {
        reaction.actors.sort(
          (a, b) => ['local', 'peer', 'camel'].indexOf(a) - ['local', 'peer', 'camel'].indexOf(b)
        );
        reaction.count = reaction.actors.length;
      }
    }

    return {
      id: CONVERSATION_ID,
      mode: 'local-secure-group',
      network: 'disabled',
      participants: [
        { deviceId: LOCAL_DEVICE_ID, role: 'local', label: 'You' },
        { deviceId: PEER_DEVICE_ID, role: 'peer', label: 'Mirror' },
        { deviceId: CAMEL_DEVICE_ID, role: 'camel', label: 'Camel' }
      ],
      messages
    };
  }

  async function sendReactionFromDevice(sender, targetValue, emojiValue) {
    const targetMessageId = validateReactionTarget(targetValue);
    const emoji = validateReactionEmoji(emojiValue);
    await ensureStarted();

    const specs = {
      local: {
        service: localService,
        deviceId: LOCAL_DEVICE_ID,
        recipients: [
          { service: peerService, deviceId: PEER_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      peer: {
        service: peerService,
        deviceId: PEER_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      camel: {
        service: camelService,
        deviceId: CAMEL_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: peerService, deviceId: PEER_DEVICE_ID }
        ]
      }
    };

    const spec = specs[sender];
    if (!spec) {
      const error = new Error('Unknown local MLS reaction sender');
      error.code = 'MLS_REACTION_SENDER_UNKNOWN';
      throw error;
    }

    deviceRegistry.assertDeviceActive(spec.deviceId);

    const current = await conversationPayload();
    const target = current.messages.find((message) => message.id === targetMessageId);
    if (!target) {
      const error = new Error('Reaction target message is not present in this conversation');
      error.code = 'REACTION_TARGET_NOT_FOUND';
      throw error;
    }

    if (target.deleted) {
      const error = new Error('Cannot react to a deleted message');
      error.code = 'REACTION_TARGET_DELETED';
      throw error;
    }

    const currentBucket = Array.isArray(target.reactions)
      ? target.reactions.find((reaction) =>
          reaction &&
          reaction.emoji === emoji &&
          Array.isArray(reaction.actors) &&
          reaction.actors.includes(sender)
        )
      : null;

    const nextEmoji = currentBucket ? null : emoji;
    const wireText = encodeReactionPayload(targetMessageId, nextEmoji);

    if (Buffer.byteLength(wireText, 'utf8') > MAX_TEXT_BYTES) {
      const error = new Error('reaction application payload exceeds 64 KiB limit');
      error.code = 'REACTION_PAYLOAD_LIMIT';
      throw error;
    }

    const eventId = `r-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    await spec.service.stageOutgoing({
      message_id: eventId,
      conversation_id: CONVERSATION_ID,
      sender_device_id: spec.deviceId,
      recipient_device_id: spec.recipients[0].deviceId,
      kind: 'text',
      plaintext: { text: wireText },
      status: 'encrypt_pending',
      created_at: createdAt
    });

    const encrypted = await spec.service.encrypt(CONVERSATION_ID, wireText);

    await spec.service.updateOutgoing(eventId, {
      ciphertext: { message_hex: encrypted.message_hex },
      status: 'queued'
    });

    const deliveredAt = new Date().toISOString();

    for (const recipient of spec.recipients) {
      const decrypted = await recipient.service.decrypt(CONVERSATION_ID, encrypted.message_hex);
      if (!decrypted || decrypted.plaintext !== wireText) {
        const error = new Error(`Group reaction decrypt mismatch for ${recipient.deviceId}`);
        error.code = 'MLS_GROUP_REACTION_DECRYPT_MISMATCH';
        throw error;
      }

      await recipient.service.addInbox(eventId, {
        message_id: eventId,
        conversation_id: CONVERSATION_ID,
        sender_device_id: spec.deviceId,
        recipient_device_id: recipient.deviceId,
        kind: 'text',
        ciphertext: { message_hex: encrypted.message_hex },
        plaintext: { text: decrypted.plaintext },
        received_at: deliveredAt,
        read_at: null
      });
    }

    await spec.service.advanceOutgoingStatus(eventId, 'delivered', {
      delivered_at: deliveredAt
    });

    return {
      ok: true,
      eventId,
      targetMessageId,
      emoji: nextEmoji,
      conversation: await conversationPayload()
    };
  }

  async function sendEditFromDevice(sender, targetValue, value) {
    const targetMessageId = validateEditTarget(targetValue);
    const text = validateText(value);
    await ensureStarted();

    const specs = {
      local: {
        service: localService,
        deviceId: LOCAL_DEVICE_ID,
        recipients: [
          { service: peerService, deviceId: PEER_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      peer: {
        service: peerService,
        deviceId: PEER_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      camel: {
        service: camelService,
        deviceId: CAMEL_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: peerService, deviceId: PEER_DEVICE_ID }
        ]
      }
    };

    const spec = specs[sender];
    if (!spec) {
      const error = new Error('Unknown local MLS edit sender');
      error.code = 'MLS_EDIT_SENDER_UNKNOWN';
      throw error;
    }

    deviceRegistry.assertDeviceActive(spec.deviceId);

    const current = await conversationPayload();
    const target = current.messages.find((message) => message.id === targetMessageId);
    if (!target) {
      const error = new Error('Edit target message is not present in this conversation');
      error.code = 'EDIT_TARGET_NOT_FOUND';
      throw error;
    }

    if (target.sender !== sender) {
      const error = new Error('Only the original sender may edit this message');
      error.code = 'EDIT_NOT_OWNER';
      throw error;
    }

    if (target.deleted) {
      const error = new Error('Deleted messages cannot be edited');
      error.code = 'EDIT_TARGET_DELETED';
      throw error;
    }

    if (target.contentKind !== 'text') {
      const error = new Error('Only text messages can be edited');
      error.code = 'EDIT_TARGET_NOT_TEXT';
      throw error;
    }

    if (String(target.text || '') === text) {
      return {
        ok: true,
        noOp: true,
        targetMessageId,
        conversation: current
      };
    }

    const wireText = encodeEditPayload(targetMessageId, text);
    if (Buffer.byteLength(wireText, 'utf8') > MAX_TEXT_BYTES) {
      const error = new Error('edit application payload exceeds 64 KiB limit');
      error.code = 'EDIT_PAYLOAD_LIMIT';
      throw error;
    }

    const eventId = `e-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    await spec.service.stageOutgoing({
      message_id: eventId,
      conversation_id: CONVERSATION_ID,
      sender_device_id: spec.deviceId,
      recipient_device_id: spec.recipients[0].deviceId,
      kind: 'text',
      plaintext: { text: wireText },
      status: 'encrypt_pending',
      created_at: createdAt
    });

    const encrypted = await spec.service.encrypt(CONVERSATION_ID, wireText);

    await spec.service.updateOutgoing(eventId, {
      ciphertext: { message_hex: encrypted.message_hex },
      status: 'queued'
    });

    const deliveredAt = new Date().toISOString();

    for (const recipient of spec.recipients) {
      const decrypted = await recipient.service.decrypt(CONVERSATION_ID, encrypted.message_hex);
      if (!decrypted || decrypted.plaintext !== wireText) {
        const error = new Error(`Group edit decrypt mismatch for ${recipient.deviceId}`);
        error.code = 'MLS_GROUP_EDIT_DECRYPT_MISMATCH';
        throw error;
      }

      await recipient.service.addInbox(eventId, {
        message_id: eventId,
        conversation_id: CONVERSATION_ID,
        sender_device_id: spec.deviceId,
        recipient_device_id: recipient.deviceId,
        kind: 'text',
        ciphertext: { message_hex: encrypted.message_hex },
        plaintext: { text: decrypted.plaintext },
        received_at: deliveredAt,
        read_at: null
      });
    }

    await spec.service.advanceOutgoingStatus(eventId, 'delivered', {
      delivered_at: deliveredAt
    });

    return {
      ok: true,
      eventId,
      targetMessageId,
      conversation: await conversationPayload()
    };
  }

  async function sendDeleteForAllFromDevice(sender, targetValue) {
    const targetMessageId = validateDeleteTarget(targetValue);
    await ensureStarted();

    const specs = {
      local: {
        service: localService,
        deviceId: LOCAL_DEVICE_ID,
        recipients: [
          { service: peerService, deviceId: PEER_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      peer: {
        service: peerService,
        deviceId: PEER_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      camel: {
        service: camelService,
        deviceId: CAMEL_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: peerService, deviceId: PEER_DEVICE_ID }
        ]
      }
    };

    const spec = specs[sender];
    if (!spec) {
      const error = new Error('Unknown local MLS delete sender');
      error.code = 'MLS_DELETE_SENDER_UNKNOWN';
      throw error;
    }

    deviceRegistry.assertDeviceActive(spec.deviceId);

    const current = await conversationPayload();
    const target = current.messages.find((message) => message.id === targetMessageId);

    if (!target) {
      const error = new Error('Delete target message is not present in this conversation');
      error.code = 'DELETE_TARGET_NOT_FOUND';
      throw error;
    }

    if (target.sender !== sender) {
      const error = new Error('Only the original sender may delete this message for everyone');
      error.code = 'DELETE_NOT_OWNER';
      throw error;
    }

    if (target.deleted) {
      return {
        ok: true,
        noOp: true,
        targetMessageId,
        conversation: current
      };
    }

    const deletedAttachment = target.contentKind === 'attachment' && target.attachment
      ? validateAttachmentMetadata(target.attachment)
      : null;

    const wireText = encodeDeletePayload(targetMessageId);
    const eventId = `d-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    await spec.service.stageOutgoing({
      message_id: eventId,
      conversation_id: CONVERSATION_ID,
      sender_device_id: spec.deviceId,
      recipient_device_id: spec.recipients[0].deviceId,
      kind: 'text',
      plaintext: { text: wireText },
      status: 'encrypt_pending',
      created_at: createdAt
    });

    const encrypted = await spec.service.encrypt(CONVERSATION_ID, wireText);

    await spec.service.updateOutgoing(eventId, {
      ciphertext: { message_hex: encrypted.message_hex },
      status: 'queued'
    });

    const deliveredAt = new Date().toISOString();

    for (const recipient of spec.recipients) {
      const decrypted = await recipient.service.decrypt(CONVERSATION_ID, encrypted.message_hex);
      if (!decrypted || decrypted.plaintext !== wireText) {
        const error = new Error(`Group delete decrypt mismatch for ${recipient.deviceId}`);
        error.code = 'MLS_GROUP_DELETE_DECRYPT_MISMATCH';
        throw error;
      }

      await recipient.service.addInbox(eventId, {
        message_id: eventId,
        conversation_id: CONVERSATION_ID,
        sender_device_id: spec.deviceId,
        recipient_device_id: recipient.deviceId,
        kind: 'text',
        ciphertext: { message_hex: encrypted.message_hex },
        plaintext: { text: decrypted.plaintext },
        received_at: deliveredAt,
        read_at: null
      });
    }

    await spec.service.advanceOutgoingStatus(eventId, 'delivered', {
      delivered_at: deliveredAt
    });

    if (deletedAttachment && attachmentBlobStore) {
      try {
        attachmentBlobStore.remove(deletedAttachment.blobId);
      } catch (cleanupError) {
        console.warn(
          '[Green Lightning] attachment blob cleanup warning:',
          cleanupError && cleanupError.message ? cleanupError.message : cleanupError
        );
      }
    }

    return {
      ok: true,
      eventId,
      targetMessageId,
      conversation: await conversationPayload()
    };
  }

  async function sendContentFromDevice(sender, kind, content, options = null) {
    const contentKind = String(kind || '');
    if (!MESSAGE_CONTENT_KIND_SET.has(contentKind)) {
      throw new TypeError('unsupported message content kind');
    }

    const sendOptions = validateSendOptions(options);
    await ensureStarted();

    const specs = {
      local: {
        service: localService,
        deviceId: LOCAL_DEVICE_ID,
        recipients: [
          { service: peerService, deviceId: PEER_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      peer: {
        service: peerService,
        deviceId: PEER_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: camelService, deviceId: CAMEL_DEVICE_ID }
        ]
      },
      camel: {
        service: camelService,
        deviceId: CAMEL_DEVICE_ID,
        recipients: [
          { service: localService, deviceId: LOCAL_DEVICE_ID },
          { service: peerService, deviceId: PEER_DEVICE_ID }
        ]
      }
    };

    const spec = specs[sender];
    if (!spec) {
      const error = new Error('Unknown local MLS sender');
      error.code = 'MLS_SENDER_UNKNOWN';
      throw error;
    }

    deviceRegistry.assertDeviceActive(spec.deviceId);

    let replyTo = null;
    if (sendOptions.replyToId) {
      const current = await conversationPayload();
      const target = current.messages.find((message) => message.id === sendOptions.replyToId);
      if (!target) {
        const error = new Error('Reply target message is not present in this conversation');
        error.code = 'REPLY_TARGET_NOT_FOUND';
        throw error;
      }

      if (target.deleted) {
        const error = new Error('Cannot reply to a deleted message');
        error.code = 'REPLY_TARGET_DELETED';
        throw error;
      }

      replyTo = {
        messageId: target.id,
        sender: normalizeSender(target.sender),
        text: canonicalReplyPreview(target)
      };
    }

    const wireText = encodeMessageContentPayload(
      contentKind,
      content,
      replyTo
    );
    if (Buffer.byteLength(wireText, 'utf8') > MAX_TEXT_BYTES) {
      const error = new Error('message application payload exceeds 64 KiB limit');
      error.code = 'MESSAGE_PAYLOAD_LIMIT';
      throw error;
    }

    const messageId = `m-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();

    await spec.service.stageOutgoing({
      message_id: messageId,
      conversation_id: CONVERSATION_ID,
      sender_device_id: spec.deviceId,
      recipient_device_id: spec.recipients[0].deviceId,
      kind: 'text',
      plaintext: { text: wireText },
      status: 'encrypt_pending',
      created_at: createdAt
    });

    const encrypted = await spec.service.encrypt(CONVERSATION_ID, wireText);

    await spec.service.updateOutgoing(messageId, {
      ciphertext: { message_hex: encrypted.message_hex },
      status: 'queued'
    });

    const deliveredAt = new Date().toISOString();

    for (const recipient of spec.recipients) {
      const decrypted = await recipient.service.decrypt(CONVERSATION_ID, encrypted.message_hex);
      if (!decrypted || decrypted.plaintext !== wireText) {
        const error = new Error(`Group decrypt mismatch for ${recipient.deviceId}`);
        error.code = 'MLS_GROUP_DECRYPT_MISMATCH';
        throw error;
      }

      await recipient.service.addInbox(messageId, {
        message_id: messageId,
        conversation_id: CONVERSATION_ID,
        sender_device_id: spec.deviceId,
        recipient_device_id: recipient.deviceId,
        kind: 'text',
        ciphertext: { message_hex: encrypted.message_hex },
        plaintext: { text: decrypted.plaintext },
        received_at: deliveredAt,
        read_at: null
      });
    }

    await spec.service.advanceOutgoingStatus(messageId, 'delivered', {
      delivered_at: deliveredAt
    });

    let conversation = null;

    try {
      conversation = await conversationPayload();
    } catch (projectionError) {
      console.warn(
        '[Green Lightning] message committed; post-send conversation projection warning:',
        projectionError && projectionError.message
          ? projectionError.message
          : projectionError
      );
    }

    return {
      ok: true,
      committed: true,
      messageId,
      conversation,
      projectionPending: !conversation
    };
  }

  async function sendFromDevice(sender, value, options = null) {
    return sendContentFromDevice(sender, 'text', value, options);
  }

  async function sendAttachmentFromDevice(sender, metadata, options = null) {
    return sendContentFromDevice(sender, 'attachment', metadata, options);
  }

  return Object.freeze({
    async status() {
      try {
        if (!localLabEnabled) {
          return {
            ok: true,
            mode: 'remote-pending',
            network: 'pending',
            service: {
              version: 'remote-transport-pending',
              protocol: null,
              crypto: 'OpenMLS',
              mlsStorage: 'not-started',
              messageStorage: 'not-started',
              keyRoot: 'not-created',
              hardening: 'local-lab-disabled'
            },
            security: {
              rawKeyExport: false,
              plaintextFallback: false,
              process: 'not-started',
              mlsDatabase: 'not-created',
              messageDatabase: 'not-created'
            },
            group: null,
            messageCount: 0,
            attachmentStorage: attachmentBlobStore
              ? attachmentBlobStore.status()
              : { ok: false, reason: 'safe-storage-not-provided', backend: null, rootReady: false }
          };
        }
        const groups = await ensureStarted();
        const [ping, security, conversation] = await Promise.all([
          localService.ping(),
          localService.securityStatus(),
          conversationPayload()
        ]);

        return {
          ok: true,
          mode: 'local-secure-group',
          network: 'disabled',
          service: {
            version: ping.service_version,
            protocol: ping.protocol_version,
            crypto: ping.crypto,
            mlsStorage: ping.mls_storage,
            messageStorage: ping.message_storage,
            keyRoot: ping.key_root,
            hardening: ping.hardening
          },
          security: {
            rawKeyExport: security.raw_key_export,
            plaintextFallback: security.plaintext_fallback,
            process: security.process,
            mlsDatabase: security.mls_database,
            messageDatabase: security.message_database
          },
          group: {
            conversationId: CONVERSATION_ID,
            epoch: groups.localGroup.epoch,
            members: groups.localGroup.members,
            active: groups.localGroup.active
          },
          messageCount: conversation.messages.length,
          attachmentStorage: attachmentBlobStore
            ? attachmentBlobStore.status()
            : {
                ok: false,
                reason: 'safe-storage-not-provided',
                backend: null,
                rootReady: false
              }
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async getConversation() {
      try {
        return { ok: true, conversation: await conversationPayload() };
      } catch (error) {
        return cleanError(error);
      }
    },

    // P25 recipient attachment access. Renderer supplies only a message id;
    // blob ids, filesystem paths and decrypted bytes remain main-process-only.
    async readAttachmentForMessage(messageId) {
      try {
        const targetMessageId = validateAttachmentTarget(messageId);
        await ensureStarted();

        if (!attachmentBlobStore) {
          const error = new Error('Secure attachment storage is not configured');
          error.code = 'ATTACHMENT_SECURE_STORAGE_UNAVAILABLE';
          throw error;
        }

        const current = await conversationPayload();
        const target = current.messages.find((message) => message.id === targetMessageId);

        if (!target) {
          const error = new Error('Attachment message is not present in this conversation');
          error.code = 'ATTACHMENT_MESSAGE_NOT_FOUND';
          throw error;
        }

        if (target.deleted) {
          const error = new Error('Deleted attachment is unavailable');
          error.code = 'ATTACHMENT_MESSAGE_DELETED';
          throw error;
        }

        if (target.contentKind !== 'attachment' || !target.attachment) {
          const error = new Error('Message does not contain an attachment');
          error.code = 'ATTACHMENT_MESSAGE_INVALID';
          throw error;
        }

        const attachment = validateAttachmentMetadata(target.attachment);

        if (!attachmentBlobStore.has(attachment.blobId)) {
          const error = new Error('Encrypted attachment blob is missing');
          error.code = 'ATTACHMENT_BLOB_NOT_FOUND';
          throw error;
        }

        const bytes = attachmentBlobStore.readBuffer(
          attachment.blobId,
          attachment
        );

        return {
          ok: true,
          messageId: targetMessageId,
          attachment,
          bytes
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async sendLocalText(value, options = null) {
      try {
        return await sendFromDevice('local', value, options);
      } catch (error) {
        return cleanError(error);
      }
    },

    async sendPeerText(value, options = null) {
      try {
        return await sendFromDevice('peer', value, options);
      } catch (error) {
        return cleanError(error);
      }
    },

    async sendCamelText(value, options = null) {
      try {
        return await sendFromDevice('camel', value, options);
      } catch (error) {
        return cleanError(error);
      }
    },

    // Main-process-only attachment staging owner.
    // The renderer never supplies or receives an external filesystem path.
    async stageAttachmentFromSelectedPath(filePath, sender = 'local') {
      let stored = null;

      try {
        const senderKind = String(sender || '');
        const senderDeviceIds = {
          local: LOCAL_DEVICE_ID,
          peer: PEER_DEVICE_ID,
          camel: CAMEL_DEVICE_ID
        };
        const senderDeviceId = senderDeviceIds[senderKind];

        if (!senderDeviceId) {
          const error = new Error('Unknown attachment sender');
          error.code = 'MLS_SENDER_UNKNOWN';
          throw error;
        }

        await ensureStarted();
        deviceRegistry.assertDeviceActive(senderDeviceId);

        if (!attachmentBlobStore) {
          const error = new Error('Secure attachment storage is not configured');
          error.code = 'ATTACHMENT_SECURE_STORAGE_UNAVAILABLE';
          throw error;
        }

        const secureStatus = attachmentBlobStore.status();
        if (!secureStatus.ok) {
          const error = new Error(
            `Secure attachment storage unavailable: ${secureStatus.reason || 'unknown'}`
          );
          error.code = 'ATTACHMENT_SECURE_STORAGE_UNAVAILABLE';
          throw error;
        }

        if (typeof filePath !== 'string' || !filePath) {
          const error = new Error('Attachment selection did not provide a file');
          error.code = 'ATTACHMENT_SELECTION_INVALID';
          throw error;
        }

        const selectedPath = path.resolve(filePath);

        let stat;
        try {
          stat = fs.statSync(selectedPath);
        } catch (_) {
          const error = new Error('Selected attachment is unavailable');
          error.code = 'ATTACHMENT_FILE_UNAVAILABLE';
          throw error;
        }

        if (!stat.isFile()) {
          const error = new Error('Selected attachment is not a file');
          error.code = 'ATTACHMENT_NOT_FILE';
          throw error;
        }

        if (stat.size < 1 || stat.size > MAX_ATTACHMENT_BYTES) {
          const error = new Error('Selected attachment is outside the 25 MiB limit');
          error.code = 'ATTACHMENT_SIZE_LIMIT';
          throw error;
        }

        const name = path.basename(selectedPath);

        if (
          !name ||
          name.length > 255 ||
          /[\\/\u0000-\u001f\u007f]/.test(name)
        ) {
          const error = new Error('Selected attachment has an invalid display name');
          error.code = 'ATTACHMENT_NAME_INVALID';
          throw error;
        }

        const mimeType = validateMimeType(
          attachmentMimeTypeFromName(name)
        );

        const bytes = fs.readFileSync(selectedPath);

        if (
          bytes.length < 1 ||
          bytes.length > MAX_ATTACHMENT_BYTES
        ) {
          const error = new Error('Selected attachment changed outside the allowed limit');
          error.code = 'ATTACHMENT_SIZE_LIMIT';
          throw error;
        }

        stored = attachmentBlobStore.putBuffer(bytes);

        const attachment = validateAttachmentMetadata({
          blobId: stored.blobId,
          name,
          mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256
        });

        return {
          ok: true,
          attachment
        };
      } catch (error) {
        if (stored && stored.blobId && attachmentBlobStore) {
          try { attachmentBlobStore.remove(stored.blobId); } catch (_) {}
        }
        return cleanError(error);
      }
    },

    async sendStagedAttachment(sender, metadata, options = null) {
      try {
        const senderKind = String(sender || '');

        if (!['local', 'peer', 'camel'].includes(senderKind)) {
          const error = new Error('Unknown attachment sender');
          error.code = 'MLS_SENDER_UNKNOWN';
          throw error;
        }

        if (!attachmentBlobStore) {
          const error = new Error('Secure attachment storage is not configured');
          error.code = 'ATTACHMENT_SECURE_STORAGE_UNAVAILABLE';
          throw error;
        }

        const attachment = validateAttachmentMetadata(metadata);

        if (!attachmentBlobStore.has(attachment.blobId)) {
          const error = new Error('Encrypted attachment blob is missing');
          error.code = 'ATTACHMENT_BLOB_NOT_FOUND';
          throw error;
        }

        // Verify authenticated encryption + SHA-256 before publishing metadata.
        attachmentBlobStore.readBuffer(
          attachment.blobId,
          attachment
        );

        return await sendAttachmentFromDevice(
          senderKind,
          attachment,
          options
        );
      } catch (error) {
        return cleanError(error);
      }
    },

    async reactLocal(messageId, emoji) {
      try {
        return await sendReactionFromDevice('local', messageId, emoji);
      } catch (error) {
        return cleanError(error);
      }
    },

    async reactPeer(messageId, emoji) {
      try {
        return await sendReactionFromDevice('peer', messageId, emoji);
      } catch (error) {
        return cleanError(error);
      }
    },

    async reactCamel(messageId, emoji) {
      try {
        return await sendReactionFromDevice('camel', messageId, emoji);
      } catch (error) {
        return cleanError(error);
      }
    },

    async editLocal(messageId, value) {
      try {
        return await sendEditFromDevice('local', messageId, value);
      } catch (error) {
        return cleanError(error);
      }
    },

    async editPeer(messageId, value) {
      try {
        return await sendEditFromDevice('peer', messageId, value);
      } catch (error) {
        return cleanError(error);
      }
    },

    async editCamel(messageId, value) {
      try {
        return await sendEditFromDevice('camel', messageId, value);
      } catch (error) {
        return cleanError(error);
      }
    },

    async deleteLocalForAll(messageId) {
      try {
        return await sendDeleteForAllFromDevice('local', messageId);
      } catch (error) {
        return cleanError(error);
      }
    },

    async deletePeerForAll(messageId) {
      try {
        return await sendDeleteForAllFromDevice('peer', messageId);
      } catch (error) {
        return cleanError(error);
      }
    },

    async deleteCamelForAll(messageId) {
      try {
        return await sendDeleteForAllFromDevice('camel', messageId);
      } catch (error) {
        return cleanError(error);
      }
    },

    async getDeviceContext() {
      try {
        await ensureStarted();
        return {
          ok: true,
          context: deviceRegistry.publicContext()
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async revokeAccountDevice(deviceId) {
      try {
        await ensureStarted();
        deviceRegistry.assertDeviceActive(LOCAL_DEVICE_ID);

        const result = await deviceRevocation.revokeDevice(deviceId);

        return {
          ok: true,
          revocation: result,
          context: deviceRegistry.publicContext(),
          status: deviceRevocation.publicStatus()
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async getDeviceRevocationStatus() {
      try {
        return {
          ok: true,
          status: deviceRevocation.publicStatus()
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async getDeviceEnrollmentStatus() {
      try {
        const transport = await ensureLocalEnrollmentTransport();

        return {
          ok: true,
          enrollment: deviceEnrollment.publicStatus({ includeCode: true }),
          transport
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async beginDeviceEnrollment() {
      try {
        await ensureStarted();
        deviceRegistry.assertDeviceActive(LOCAL_DEVICE_ID);
        const account = deviceRegistry.accountSession();
        const enrollment = deviceEnrollment.begin({ accountId: account.accountId });
        const transport = await ensureLocalEnrollmentTransport();

        return {
          ok: true,
          enrollment,
          transport
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async cancelDeviceEnrollment() {
      try {
        const enrollment = deviceEnrollment.cancel();
        await localEnrollmentTransport.stop();

        return {
          ok: true,
          enrollment,
          transport: localEnrollmentTransport.publicStatus()
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    async getDeviceEnrollmentTransportStatus() {
      try {
        return {
          ok: true,
          transport: localEnrollmentTransport.publicStatus()
        };
      } catch (error) {
        return cleanError(error);
      }
    },

    // Main-process-only Account service authorization for a future remote Chat
    // transport. The raw grant never becomes a renderer IPC capability.
    async acquireAccountServiceAuthorizationForTransport() {
      if (typeof accountServiceGrantProvider !== 'function') {
        const error = new Error('Account Chat service authorization is not configured');
        error.code = 'ACCOUNT_SERVICE_GRANT_UNAVAILABLE';
        throw error;
      }
      return accountServiceGrantProvider();
    },

    // Main-process-only future transport hooks. They are deliberately not
    // registered as renderer IPC capabilities in P22.
    async acceptDeviceEnrollmentRequestForTransport(request) {
      return deviceEnrollment.acceptRequest(request);
    },

    confirmDeviceEnrollmentJoinedForTransport(receipt) {
      return deviceEnrollment.confirmJoined(receipt);
    },

    async close() {
      closing = true;
      try {
        try { await localEnrollmentTransport.stop(); } catch (error) {}
        await closeServices();
      }
      finally { closing = false; }
    }
  });
}

function registerWorkspaceMessengerIpc({
  ipcMain,
  assertTrustedSender,
  controller,
  pickAttachmentFile = null,
  openAttachmentFile = null,
  saveAttachmentFile = null
}) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('ipcMain is required');
  if (typeof assertTrustedSender !== 'function') throw new Error('trusted sender validator is required');
  if (!controller) throw new Error('Messenger controller is required');
  if (pickAttachmentFile !== null && typeof pickAttachmentFile !== 'function') {
    throw new Error('Messenger attachment picker must be a function');
  }
  if (openAttachmentFile !== null && typeof openAttachmentFile !== 'function') {
    throw new Error('Messenger attachment opener must be a function');
  }
  if (saveAttachmentFile !== null && typeof saveAttachmentFile !== 'function') {
    throw new Error('Messenger attachment saver must be a function');
  }

  ipcMain.handle('messenger:status', async (event) => {
    assertTrustedSender(event);
    return controller.status();
  });

  ipcMain.handle('messenger:get-conversation', async (event) => {
    assertTrustedSender(event);
    return controller.getConversation();
  });

  ipcMain.handle('messenger:create-direct-invite', async (event) => {
    assertTrustedSender(event);
    if (typeof controller.createDirectInvite !== 'function') {
      return cleanError(Object.assign(new Error('Online Chat is unavailable'), { code: 'CHAT_REMOTE_UNAVAILABLE' }));
    }
    return controller.createDirectInvite();
  });

  ipcMain.handle('messenger:join-direct-invite', async (event, inviteToken) => {
    assertTrustedSender(event);
    if (typeof controller.joinDirectInvite !== 'function') {
      return cleanError(Object.assign(new Error('Online Chat is unavailable'), { code: 'CHAT_REMOTE_UNAVAILABLE' }));
    }
    return controller.joinDirectInvite(inviteToken);
  });

  ipcMain.handle('messenger:refresh-remote-transport', async (event) => {
    assertTrustedSender(event);
    if (typeof controller.refreshRemoteTransport !== 'function') return controller.getConversation();
    return controller.refreshRemoteTransport();
  });

  ipcMain.handle('messenger:send-attachment', async (event, sender, options) => {
    assertTrustedSender(event);

    const senderKind = String(sender || '');
    if (!['local', 'peer', 'camel'].includes(senderKind)) {
      return cleanError(Object.assign(
        new Error('Invalid attachment sender'),
        { code: 'MLS_SENDER_UNKNOWN' }
      ));
    }

    if (typeof pickAttachmentFile !== 'function') {
      return {
        ok: false,
        error: {
          code: 'ATTACHMENT_PICKER_UNAVAILABLE',
          message: 'Attachment picker is unavailable'
        }
      };
    }

    try {
      const picked = await pickAttachmentFile(event);

      if (!picked || picked.canceled || !picked.filePath) {
        return { ok: false, canceled: true };
      }

      const staged = await controller.stageAttachmentFromSelectedPath(
        picked.filePath,
        senderKind
      );

      if (!staged || !staged.ok || !staged.attachment) {
        return staged || {
          ok: false,
          error: {
            code: 'ATTACHMENT_STAGE_FAILED',
            message: 'Attachment staging failed'
          }
        };
      }

      return controller.sendStagedAttachment(
        senderKind,
        staged.attachment,
        options
      );
    } catch (error) {
      return cleanError(error);
    }
  });

  ipcMain.handle('messenger:open-attachment', async (event, messageId) => {
    assertTrustedSender(event);

    if (typeof openAttachmentFile !== 'function') {
      return {
        ok: false,
        error: {
          code: 'ATTACHMENT_OPEN_UNAVAILABLE',
          message: 'Attachment opening is unavailable'
        }
      };
    }

    try {
      const resolved = await controller.readAttachmentForMessage(messageId);
      if (!resolved || !resolved.ok) return resolved;

      return await openAttachmentFile(
        event,
        resolved.attachment,
        resolved.bytes
      );
    } catch (error) {
      return cleanError(error);
    }
  });

  ipcMain.handle('messenger:save-attachment', async (event, messageId) => {
    assertTrustedSender(event);

    if (typeof saveAttachmentFile !== 'function') {
      return {
        ok: false,
        error: {
          code: 'ATTACHMENT_SAVE_UNAVAILABLE',
          message: 'Attachment saving is unavailable'
        }
      };
    }

    try {
      const resolved = await controller.readAttachmentForMessage(messageId);
      if (!resolved || !resolved.ok) return resolved;

      return await saveAttachmentFile(
        event,
        resolved.attachment,
        resolved.bytes
      );
    } catch (error) {
      return cleanError(error);
    }
  });

  ipcMain.handle('messenger:get-device-context', async (event) => {
    assertTrustedSender(event);
    return controller.getDeviceContext();
  });

  ipcMain.handle('messenger:device-enrollment-status', async (event) => {
    assertTrustedSender(event);
    return controller.getDeviceEnrollmentStatus();
  });

  ipcMain.handle('messenger:device-revoke', async (event, deviceId) => {
    assertTrustedSender(event);
    return controller.revokeAccountDevice(deviceId);
  });

  ipcMain.handle('messenger:device-revocation-status', async (event) => {
    assertTrustedSender(event);
    return controller.getDeviceRevocationStatus();
  });

  ipcMain.handle('messenger:device-enrollment-begin', async (event) => {
    assertTrustedSender(event);
    return controller.beginDeviceEnrollment();
  });

  ipcMain.handle('messenger:device-enrollment-cancel', async (event) => {
    assertTrustedSender(event);
    return controller.cancelDeviceEnrollment();
  });

  ipcMain.handle('messenger:device-enrollment-transport-status', async (event) => {
    assertTrustedSender(event);
    return controller.getDeviceEnrollmentTransportStatus();
  });

  ipcMain.handle('messenger:send-local-text', async (event, text, options) => {
    assertTrustedSender(event);
    return controller.sendLocalText(text, options);
  });

  ipcMain.handle('messenger:send-peer-text', async (event, text, options) => {
    assertTrustedSender(event);
    return controller.sendPeerText(text, options);
  });

  ipcMain.handle('messenger:send-camel-text', async (event, text, options) => {
    assertTrustedSender(event);
    return controller.sendCamelText(text, options);
  });

  ipcMain.handle('messenger:react-local', async (event, messageId, emoji) => {
    assertTrustedSender(event);
    return controller.reactLocal(messageId, emoji);
  });

  ipcMain.handle('messenger:react-peer', async (event, messageId, emoji) => {
    assertTrustedSender(event);
    return controller.reactPeer(messageId, emoji);
  });

  ipcMain.handle('messenger:react-camel', async (event, messageId, emoji) => {
    assertTrustedSender(event);
    return controller.reactCamel(messageId, emoji);
  });

  ipcMain.handle('messenger:edit-local', async (event, messageId, text) => {
    assertTrustedSender(event);
    return controller.editLocal(messageId, text);
  });

  ipcMain.handle('messenger:edit-peer', async (event, messageId, text) => {
    assertTrustedSender(event);
    return controller.editPeer(messageId, text);
  });

  ipcMain.handle('messenger:edit-camel', async (event, messageId, text) => {
    assertTrustedSender(event);
    return controller.editCamel(messageId, text);
  });

  ipcMain.handle('messenger:delete-local-for-all', async (event, messageId) => {
    assertTrustedSender(event);
    return controller.deleteLocalForAll(messageId);
  });

  ipcMain.handle('messenger:delete-peer-for-all', async (event, messageId) => {
    assertTrustedSender(event);
    return controller.deletePeerForAll(messageId);
  });

  ipcMain.handle('messenger:delete-camel-for-all', async (event, messageId) => {
    assertTrustedSender(event);
    return controller.deleteCamelForAll(messageId);
  });
}

module.exports = {
  createWorkspaceMessengerController,
  registerWorkspaceMessengerIpc,
  __test: Object.freeze({
    APP_MESSAGE_MARKER,
    MESSAGE_CONTENT_KINDS,
    MAX_TEXT_BYTES,
    MAX_ATTACHMENT_BYTES,
    MAX_VOICE_NOTE_BYTES,
    MAX_VOICE_NOTE_DURATION_MS,
    decodeApplicationPayload,
    encodeApplicationPayload,
    encodeMessageContentPayload,
    safeMessage,
    validateSendOptions,
    validateAttachmentMetadata,
    validateVoiceNoteMetadata
  })
};
