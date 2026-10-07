'use strict';

const REGISTRY_MODULE_ID = 'green-lightning.account-device.v1';
const ACCOUNT_STATE_MODULE_ID = 'irgeztne.connected.identity.v1';
const ACCOUNT_SECRET_SCOPE = 'irgeztne-id';
const ACCOUNT_SECRET_KEY = 'access-token';
const SCHEMA = 'irgeztne.account-device.registry.v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, max = 400) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanStatus(value) {
  const status = cleanText(value, 40);
  return ['active', 'enrolling', 'revoking', 'revoked'].includes(status)
    ? status
    : 'active';
}

function buildDefaultState({ conversationId, definitions, currentDeviceId }) {
  const createdAt = nowIso();
  return {
    schema: SCHEMA,
    version: 2,
    createdAt,
    updatedAt: createdAt,
    conversationId,
    currentDeviceId,
    devices: definitions.map((def) => ({
      deviceId: def.deviceId,
      memberIdentity: def.memberIdentity,
      label: def.label,
      role: def.role,
      ownerKind: def.ownerKind,
      ownerAccountId: def.ownerAccountId,
      current: def.deviceId === currentDeviceId,
      labPeer: Boolean(def.labPeer),
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      memberships: [conversationId],
    })),
  };
}

function normalizeStoredDevice(raw, conversationId, currentDeviceId) {
  if (!raw || typeof raw !== 'object') return null;

  const deviceId = cleanText(raw.deviceId, 180);
  const memberIdentity = cleanText(raw.memberIdentity, 500);
  if (!deviceId || !memberIdentity) return null;

  const createdAt = cleanText(raw.createdAt, 80) || nowIso();
  const memberships = Array.isArray(raw.memberships)
    ? raw.memberships.map((item) => cleanText(item, 300)).filter(Boolean).slice(0, 200)
    : [];

  return {
    deviceId,
    memberIdentity,
    label: cleanText(raw.label, 200) || deviceId,
    role: cleanText(raw.role, 80) || 'linked',
    ownerKind: cleanText(raw.ownerKind, 80) || 'account-device',
    ownerAccountId: cleanText(raw.ownerAccountId, 360) || 'workspace-local',
    current: deviceId === currentDeviceId,
    labPeer: Boolean(raw.labPeer),
    status: cleanStatus(raw.status),
    createdAt,
    updatedAt: cleanText(raw.updatedAt, 80) || createdAt,
    memberships: memberships.length ? memberships : [conversationId],
  };
}

function normalizeState(raw, options) {
  const base = buildDefaultState(options);
  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA) return base;

  const stored = Array.isArray(raw.devices)
    ? raw.devices.map((device) => normalizeStoredDevice(device, options.conversationId, options.currentDeviceId)).filter(Boolean)
    : [];

  const byId = new Map(stored.map((device) => [device.deviceId, device]));

  base.createdAt = cleanText(raw.createdAt, 80) || base.createdAt;

  // Canonical built-in devices remain owned by current application definitions,
  // but their lifecycle state survives restarts.
  base.devices = base.devices.map((fresh) => {
    const old = byId.get(fresh.deviceId);
    if (!old) return fresh;

    return {
      ...fresh,
      status: cleanStatus(old.status),
      createdAt: old.createdAt || fresh.createdAt,
      updatedAt: old.updatedAt || fresh.updatedAt,
      memberships: Array.isArray(old.memberships) && old.memberships.length
        ? old.memberships.slice()
        : fresh.memberships,
    };
  });

  const builtInIds = new Set(base.devices.map((device) => device.deviceId));

  // P22: preserve dynamically enrolled real devices. P21 previously discarded
  // every device that was not present in the hard-coded definitions array.
  for (const device of stored) {
    if (builtInIds.has(device.deviceId)) continue;
    base.devices.push({
      ...device,
      current: device.deviceId === options.currentDeviceId,
      labPeer: false,
    });
  }

  base.version = 2;
  base.updatedAt = nowIso();
  return base;
}

function createMessengerDeviceRegistry({
  storage,
  conversationId,
  definitions,
  currentDeviceId,
  persistOnCreate = true,
}) {
  if (!storage || typeof storage.getModuleState !== 'function' || typeof storage.setModuleState !== 'function') {
    throw new Error('Messenger Device Registry requires Storage Core');
  }
  if (!conversationId) throw new Error('conversationId is required');
  if (!Array.isArray(definitions) || definitions.length < 1) throw new Error('device definitions are required');
  if (!currentDeviceId) throw new Error('currentDeviceId is required');

  const options = { conversationId, definitions, currentDeviceId };
  let state = normalizeState(storage.getModuleState(REGISTRY_MODULE_ID, null), options);

  function persist() {
    state.updatedAt = nowIso();
    storage.setModuleState(REGISTRY_MODULE_ID, state);
  }

  function ensure() {
    const stored = storage.getModuleState(REGISTRY_MODULE_ID, null);
    state = normalizeState(stored, options);
    persist();
    return clone(state);
  }

  function getDevice(deviceId) {
    return state.devices.find((device) => device.deviceId === String(deviceId || '')) || null;
  }

  function getDeviceByIdentity(memberIdentity) {
    return state.devices.find((device) => device.memberIdentity === String(memberIdentity || '')) || null;
  }

  function assertDeviceActive(deviceId) {
    ensure();
    const device = getDevice(deviceId);
    if (!device) {
      const error = new Error(`Unknown Messenger device ${String(deviceId || '')}`);
      error.code = 'DEVICE_UNKNOWN';
      throw error;
    }
    if (device.status !== 'active') {
      const error = new Error(`Messenger device ${device.deviceId} is not active`);
      error.code = 'DEVICE_REVOKED';
      throw error;
    }
    return clone(device);
  }

  function accountSession() {
    const publicState = storage.getModuleState(ACCOUNT_STATE_MODULE_ID, {}) || {};
    const hasCredential = typeof storage.hasSecret === 'function'
      ? Boolean(storage.hasSecret(ACCOUNT_SECRET_SCOPE, ACCOUNT_SECRET_KEY))
      : false;

    const connected = publicState.mode === 'connected' &&
      Boolean(cleanText(publicState.userId, 300)) &&
      hasCredential;

    return {
      mode: connected ? 'connected' : 'local',
      connected,
      accountId: connected
        ? `irgeztne-id:${cleanText(publicState.userId, 300)}`
        : 'workspace-local',
      userId: connected ? cleanText(publicState.userId, 300) : '',
      displayName: connected ? cleanText(publicState.displayName, 200) : '',
      email: connected ? cleanText(publicState.email, 320) : '',
      credential: connected ? 'encrypted-storage-core' : 'none',
    };
  }

  function registerEnrolledDevice(input) {
    ensure();
    const deviceId = cleanText(input && input.deviceId, 180);
    const memberIdentity = cleanText(input && input.memberIdentity, 500);
    if (!deviceId || !memberIdentity) {
      const error = new Error('deviceId and memberIdentity are required');
      error.code = 'DEVICE_INVALID';
      throw error;
    }

    const existingById = getDevice(deviceId);
    if (existingById) {
      if (existingById.memberIdentity !== memberIdentity) {
        const error = new Error(`Messenger deviceId ${deviceId} is already bound to another identity`);
        error.code = 'DEVICE_ID_CONFLICT';
        throw error;
      }
      return clone(existingById);
    }

    const existingByIdentity = getDeviceByIdentity(memberIdentity);
    if (existingByIdentity) {
      const error = new Error('Messenger member identity is already registered');
      error.code = 'MEMBER_IDENTITY_CONFLICT';
      throw error;
    }

    const createdAt = nowIso();
    const account = accountSession();
    const device = {
      deviceId,
      memberIdentity,
      label: cleanText(input && input.label, 200) || 'Linked Workspace device',
      role: 'linked',
      ownerKind: 'account-device',
      ownerAccountId: cleanText(input && input.ownerAccountId, 360) || account.accountId,
      current: false,
      labPeer: false,
      status: cleanStatus(input && input.status || 'enrolling'),
      createdAt,
      updatedAt: createdAt,
      memberships: [conversationId],
    };

    state.devices.push(device);
    persist();
    return clone(device);
  }

  function setDeviceStatus(deviceId, status) {
    ensure();
    const device = getDevice(deviceId);
    if (!device) {
      const error = new Error(`Unknown Messenger device ${String(deviceId || '')}`);
      error.code = 'DEVICE_UNKNOWN';
      throw error;
    }

    device.status = cleanStatus(status);
    device.updatedAt = nowIso();
    persist();
    return clone(device);
  }

  function publicContext() {
    ensure();
    const current = getDevice(currentDeviceId);
    const account = accountSession();
    const publicDevices = state.devices.map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      role: device.role,
      status: device.status,
      current: Boolean(device.current),
      labPeer: Boolean(device.labPeer),
      ownerKind: device.ownerKind,
      ownerAccountId: device.ownerAccountId,
      memberIdentity: device.memberIdentity,
    }));

    return {
      schema: 'irgeztne.account-device.context.v2',
      stage: 'second-device-enrollment-and-revocation',
      conversationId,
      account,
      currentDevice: current ? clone(current) : null,
      devices: publicDevices,
      productDevices: publicDevices.filter((device) => !device.labPeer),
      capabilities: {
        storageCoreAccountState: true,
        encryptedAccountCredential: true,
        deviceRegistry: true,
        messengerAuthorizationGate: true,
        nativeMlsRemoveMember: true,
        secondDeviceEnrollment: true,
        liveRevocationUi: true,
      },
    };
  }

  if (persistOnCreate) ensure();

  return Object.freeze({
    ensure,
    assertDeviceActive,
    accountSession,
    registerEnrolledDevice,
    setDeviceStatus,
    getDevice: (deviceId) => {
      ensure();
      const value = getDevice(deviceId);
      return value ? clone(value) : null;
    },
    publicContext,
  });
}

module.exports = {
  REGISTRY_MODULE_ID,
  ACCOUNT_STATE_MODULE_ID,
  ACCOUNT_SECRET_SCOPE,
  ACCOUNT_SECRET_KEY,
  createMessengerDeviceRegistry,
};
