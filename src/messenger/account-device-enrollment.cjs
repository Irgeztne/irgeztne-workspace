'use strict';

const crypto = require('crypto');

const ENROLLMENT_MODULE_ID = 'green-lightning.account-device.enrollment.v1';
const ENROLLMENT_SECRET_SCOPE = 'green-lightning.account-device.enrollment';
const ENROLLMENT_SECRET_KEY = 'active-pairing-code';
const SCHEMA = 'irgeztne.account-device.enrollment.v1';
const DEFAULT_TTL_MS = 10 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(nowFn) {
  return new Date(nowFn()).toISOString();
}

function cleanText(value, max = 500) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function canonicalInvite(value) {
  return {
    schema: value.schema,
    version: value.version,
    enrollmentId: value.enrollmentId,
    accountId: value.accountId,
    conversationId: value.conversationId,
    inviterDeviceId: value.inviterDeviceId,
    challenge: value.challenge,
    expiresAt: value.expiresAt,
  };
}

function canonicalRequest(value) {
  return {
    schema: value.schema,
    version: value.version,
    requestId: value.requestId,
    enrollmentId: value.enrollmentId,
    inviteHash: value.inviteHash,
    accountId: value.accountId,
    conversationId: value.conversationId,
    deviceId: value.deviceId,
    deviceLabel: value.deviceLabel,
    memberIdentity: value.memberIdentity,
    keyPackageHex: value.keyPackageHex,
  };
}

function canonicalApproval(value) {
  return {
    schema: value.schema,
    version: value.version,
    result: value.result,
    requestId: value.requestId,
    enrollmentId: value.enrollmentId,
    requestHash: value.requestHash,
    accountId: value.accountId,
    conversationId: value.conversationId,
    deviceId: value.deviceId,
    memberIdentity: value.memberIdentity,
    welcomeHex: value.welcomeHex,
    commitHex: value.commitHex,
    epoch: value.epoch,
    members: value.members,
  };
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function pairingProofKey(code) {
  return crypto
    .createHmac('sha256', 'IRGEZTNE-P22-PAIRING-v1')
    .update(String(code || ''))
    .digest();
}

function hmacHex(key, value) {
  return crypto.createHmac('sha256', key).update(JSON.stringify(value)).digest('hex');
}

function safeHexEqual(a, b) {
  try {
    const aa = Buffer.from(String(a || ''), 'hex');
    const bb = Buffer.from(String(b || ''), 'hex');
    return aa.length > 0 && aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch (_) {
    return false;
  }
}

function displayCode(raw) {
  return String(raw || '').match(/.{1,4}/g).join('-');
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA) {
    return {
      schema: SCHEMA,
      version: 1,
      status: 'idle',
      createdAt: '',
      updatedAt: '',
      enrollmentId: '',
      accountId: '',
      conversationId: '',
      inviterDeviceId: '',
      challenge: '',
      expiresAt: '',
      completed: null,
    };
  }

  return {
    schema: SCHEMA,
    version: 1,
    status: ['idle', 'pending', 'completed', 'cancelled', 'expired'].includes(raw.status)
      ? raw.status
      : 'idle',
    createdAt: cleanText(raw.createdAt, 80),
    updatedAt: cleanText(raw.updatedAt, 80),
    enrollmentId: cleanText(raw.enrollmentId, 180),
    accountId: cleanText(raw.accountId, 360),
    conversationId: cleanText(raw.conversationId, 300),
    inviterDeviceId: cleanText(raw.inviterDeviceId, 180),
    challenge: cleanText(raw.challenge, 300),
    expiresAt: cleanText(raw.expiresAt, 80),
    completed: raw.completed && typeof raw.completed === 'object'
      ? clone(raw.completed)
      : null,
  };
}

function createAccountDeviceEnrollment({
  storage,
  conversationId,
  currentDeviceId,
  deviceRegistry,
  commitNewMember,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
  randomUuid = crypto.randomUUID,
  ttlMs = DEFAULT_TTL_MS,
}) {
  if (!storage || typeof storage.getModuleState !== 'function' || typeof storage.setModuleState !== 'function') {
    throw new Error('Account Device Enrollment requires Storage Core');
  }
  if (typeof storage.saveSecret !== 'function' || typeof storage.readSecret !== 'function' || typeof storage.clearSecret !== 'function') {
    throw new Error('Account Device Enrollment requires encrypted secret storage');
  }
  if (!deviceRegistry) throw new Error('Account Device Enrollment requires Device Registry');
  if (typeof commitNewMember !== 'function') throw new Error('Account Device Enrollment requires MLS commit callback');

  let state = normalizeState(storage.getModuleState(ENROLLMENT_MODULE_ID, null));

  function persist() {
    state.updatedAt = nowIso(now);
    storage.setModuleState(ENROLLMENT_MODULE_ID, state);
  }

  function secretCode() {
    return storage.readSecret(ENROLLMENT_SECRET_SCOPE, ENROLLMENT_SECRET_KEY);
  }

  function clearSecret() {
    storage.clearSecret(ENROLLMENT_SECRET_SCOPE, ENROLLMENT_SECRET_KEY);
  }

  function expireIfNeeded() {
    if (state.status !== 'pending' || !state.expiresAt) return false;
    const expires = Date.parse(state.expiresAt);
    if (!Number.isFinite(expires) || now() <= expires) return false;

    state.status = 'expired';
    clearSecret();
    persist();
    return true;
  }

  function publicInvite() {
    if (!state.enrollmentId) return null;
    return {
      schema: 'irgeztne.enrollment.invite.v1',
      version: 1,
      enrollmentId: state.enrollmentId,
      accountId: state.accountId,
      conversationId: state.conversationId,
      inviterDeviceId: state.inviterDeviceId,
      challenge: state.challenge,
      expiresAt: state.expiresAt,
    };
  }

  function publicStatus({ includeCode = false } = {}) {
    expireIfNeeded();
    const invite = publicInvite();
    const expiresMs = state.expiresAt ? Date.parse(state.expiresAt) : NaN;
    const remainingSeconds = Number.isFinite(expiresMs)
      ? Math.max(0, Math.ceil((expiresMs - now()) / 1000))
      : 0;

    const out = {
      schema: 'irgeztne.account-device.enrollment.context.v1',
      status: state.status,
      active: state.status === 'pending',
      invite,
      inviteJson: invite ? JSON.stringify(invite) : '',
      expiresAt: state.expiresAt || '',
      remainingSeconds,
      completed: state.completed
        ? {
            deviceId: cleanText(state.completed.deviceId, 180),
            deviceLabel: cleanText(state.completed.deviceLabel, 200),
            memberIdentity: cleanText(state.completed.memberIdentity, 500),
            completedAt: cleanText(state.completed.completedAt, 80),
          }
        : null,
      capabilities: {
        oneTimeCode: true,
        expires: true,
        cancel: true,
        requestProof: true,
        immutableApprovalReplay: true,
        liveTransportAdapter: false,
      },
    };

    if (includeCode && state.status === 'pending') {
      const code = secretCode();
      out.code = code ? displayCode(code) : '';
    }

    return out;
  }

  function begin({ accountId } = {}) {
    expireIfNeeded();

    if (state.status === 'pending' && secretCode()) {
      return publicStatus({ includeCode: true });
    }

    clearSecret();

    const rawCode = randomBytes(15).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
    if (rawCode.length < 16) throw new Error('Pairing code generation failed');

    const createdAt = nowIso(now);
    const expiresAt = new Date(now() + Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS)).toISOString();

    state = {
      schema: SCHEMA,
      version: 1,
      status: 'pending',
      createdAt,
      updatedAt: createdAt,
      enrollmentId: randomUuid(),
      accountId: cleanText(accountId, 360) || 'workspace-local',
      conversationId,
      inviterDeviceId: currentDeviceId,
      challenge: randomBytes(24).toString('base64url'),
      expiresAt,
      completed: null,
    };

    storage.saveSecret(ENROLLMENT_SECRET_SCOPE, ENROLLMENT_SECRET_KEY, rawCode);
    persist();
    return publicStatus({ includeCode: true });
  }

  function cancel() {
    expireIfNeeded();

    if (state.status === 'pending') {
      state.status = 'cancelled';
      clearSecret();
      persist();
    }

    return publicStatus({ includeCode: false });
  }

  async function acceptRequest(request) {
    expireIfNeeded();

    const requestObject = request && typeof request === 'object' ? request : {};
    const requestId = cleanText(requestObject.requestId, 180);

    // Completed enrollment retries never require the pairing secret again.
    if (state.status === 'completed' && state.completed) {
      const requestHash = hashJson(canonicalRequest(requestObject));
      if (
        requestId &&
        requestId === state.completed.requestId &&
        requestHash === state.completed.requestHash
      ) {
        return clone(state.completed.approval);
      }
      throw typedError('ENROLLMENT_REPLAY', 'Completed enrollment was replayed with different content');
    }

    if (state.status !== 'pending') {
      throw typedError('ENROLLMENT_NOT_PENDING', 'No active device enrollment');
    }

    const invite = publicInvite();
    const code = secretCode();
    if (!code) throw typedError('PAIRING_SECRET_MISSING', 'Pairing code is unavailable');

    if (requestObject.schema !== 'irgeztne.enrollment.request.v1' || Number(requestObject.version) !== 1) {
      throw typedError('REQUEST_SCHEMA_INVALID', 'Unsupported enrollment request');
    }
    if (!requestId) throw typedError('REQUEST_ID_MISSING', 'requestId is required');
    if (cleanText(requestObject.enrollmentId, 180) !== state.enrollmentId) {
      throw typedError('ENROLLMENT_ID_MISMATCH', 'Enrollment id mismatch');
    }
    if (cleanText(requestObject.inviteHash, 128) !== hashJson(canonicalInvite(invite))) {
      throw typedError('INVITE_HASH_MISMATCH', 'Enrollment invite hash mismatch');
    }
    if (cleanText(requestObject.accountId, 360) !== state.accountId) {
      throw typedError('ACCOUNT_MISMATCH', 'Enrollment account mismatch');
    }
    if (cleanText(requestObject.conversationId, 300) !== conversationId) {
      throw typedError('CONVERSATION_MISMATCH', 'Enrollment conversation mismatch');
    }

    const deviceId = cleanText(requestObject.deviceId, 180);
    const memberIdentity = cleanText(requestObject.memberIdentity, 500);
    const deviceLabel = cleanText(requestObject.deviceLabel, 200) || 'Linked Workspace device';
    const keyPackageHex = cleanText(requestObject.keyPackageHex, 2_000_000);
    if (!deviceId || !memberIdentity || !keyPackageHex) {
      throw typedError('REQUEST_FIELDS_MISSING', 'Device identity and MLS KeyPackage are required');
    }

    const proof = cleanText(requestObject.proof, 300);
    const expectedProof = hmacHex(pairingProofKey(code), canonicalRequest(requestObject));
    if (!safeHexEqual(proof, expectedProof)) {
      throw typedError('REQUEST_PROOF_INVALID', 'Enrollment request proof is invalid');
    }

    const requestHash = hashJson(canonicalRequest(requestObject));

    // Reserve metadata before MLS mutation so conflicts are rejected first.
    const registered = deviceRegistry.registerEnrolledDevice({
      deviceId,
      memberIdentity,
      label: deviceLabel,
      ownerAccountId: state.accountId,
      status: 'enrolling',
    });

    let add;
    try {
      add = await commitNewMember({
        conversationId,
        deviceId,
        memberIdentity,
        keyPackageHex,
      });
    } catch (error) {
      // Keep the device fail-closed as non-active if MLS mutation cannot finish.
      try { deviceRegistry.setDeviceStatus(deviceId, 'revoked'); } catch (_) {}
      throw error;
    }

    if (!add || !add.welcome_hex || !add.commit_hex) {
      try { deviceRegistry.setDeviceStatus(deviceId, 'revoked'); } catch (_) {}
      throw typedError('MLS_ADD_CONTRACT_ERROR', 'MLS addMember did not return Welcome + Commit');
    }

    const approval = {
      schema: 'irgeztne.enrollment.approval.v1',
      version: 1,
      result: 'ENROLLED',
      requestId,
      enrollmentId: state.enrollmentId,
      requestHash,
      accountId: state.accountId,
      conversationId,
      deviceId,
      memberIdentity,
      welcomeHex: add.welcome_hex,
      commitHex: add.commit_hex,
      epoch: Number(add.epoch),
      members: Number(add.members),
    };
    approval.proof = hmacHex(pairingProofKey(code), canonicalApproval(approval));

    state.status = 'completed';
    state.completed = {
      requestId,
      requestHash,
      deviceId,
      deviceLabel: registered.label,
      memberIdentity,
      completedAt: nowIso(now),
      approval,
    };
    clearSecret();
    persist();

    return clone(approval);
  }

  function confirmJoined({ enrollmentId, deviceId, requestHash } = {}) {
    if (state.status !== 'completed' || !state.completed) {
      throw typedError('ENROLLMENT_NOT_COMPLETED', 'Enrollment approval is not completed');
    }
    if (
      cleanText(enrollmentId, 180) !== state.enrollmentId ||
      cleanText(deviceId, 180) !== state.completed.deviceId ||
      cleanText(requestHash, 128) !== state.completed.requestHash
    ) {
      throw typedError('ENROLLMENT_CONFIRM_MISMATCH', 'Enrollment confirmation does not match');
    }

    const device = deviceRegistry.setDeviceStatus(state.completed.deviceId, 'active');
    return {
      ok: true,
      status: 'active',
      device,
    };
  }

  return Object.freeze({
    begin,
    cancel,
    publicStatus,
    acceptRequest,
    confirmJoined,
    canonicalInvite,
    canonicalRequest,
    canonicalApproval,
    pairingProofKey,
    hmacHex,
    hashJson,
  });
}

module.exports = {
  ENROLLMENT_MODULE_ID,
  ENROLLMENT_SECRET_SCOPE,
  ENROLLMENT_SECRET_KEY,
  createAccountDeviceEnrollment,
};
