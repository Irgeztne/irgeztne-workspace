'use strict';

const crypto = require('crypto');

const REVOCATION_MODULE_ID = 'green-lightning.account-device.revocation.v1';
const REVOCATION_SECRET_SCOPE = 'green-lightning.account-device.revocation';
const SCHEMA = 'irgeztne.account-device.revocation.v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(now = Date.now) {
  return new Date(now()).toISOString();
}

function cleanText(value, max = 500) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function secretKeyForDevice(deviceId) {
  const digest = crypto.createHash('sha256').update(String(deviceId || '')).digest('hex');
  return `pending-commit-${digest}`;
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const deviceId = cleanText(raw.deviceId, 180);
  const memberIdentity = cleanText(raw.memberIdentity, 500);
  if (!deviceId || !memberIdentity) return null;

  const phase = ['revoking', 'commit-pending', 'revoked'].includes(raw.phase)
    ? raw.phase
    : 'revoking';

  const receipt = raw.receipt && typeof raw.receipt === 'object'
    ? {
        schema: 'irgeztne.account-device.revocation.receipt.v1',
        result: cleanText(raw.receipt.result, 80) || 'REVOKED',
        nativeResult: cleanText(raw.receipt.nativeResult, 80),
        deviceId,
        memberIdentity,
        epoch: Number(raw.receipt.epoch) || 0,
        members: Number(raw.receipt.members) || 0,
        revokedAt: cleanText(raw.receipt.revokedAt, 80),
      }
    : null;

  return {
    deviceId,
    memberIdentity,
    phase,
    startedAt: cleanText(raw.startedAt, 80),
    updatedAt: cleanText(raw.updatedAt, 80),
    nativeResult: cleanText(raw.nativeResult, 80),
    epoch: Number(raw.epoch) || 0,
    members: Number(raw.members) || 0,
    receipt,
  };
}

function normalizeState(raw) {
  const state = {
    schema: SCHEMA,
    version: 1,
    updatedAt: '',
    records: {},
  };

  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA) return state;

  const records = raw.records && typeof raw.records === 'object'
    ? raw.records
    : {};

  for (const [key, value] of Object.entries(records)) {
    const record = normalizeRecord(value);
    if (!record) continue;
    state.records[record.deviceId] = record;
  }

  state.updatedAt = cleanText(raw.updatedAt, 80);
  return state;
}

function createAccountDeviceRevocation({
  storage,
  deviceRegistry,
  currentDeviceId,
  removeMember,
  applyCommit,
  now = Date.now,
}) {
  if (!storage || typeof storage.getModuleState !== 'function' || typeof storage.setModuleState !== 'function') {
    throw new Error('Account Device Revocation requires Storage Core');
  }
  if (typeof storage.saveSecret !== 'function' || typeof storage.readSecret !== 'function' || typeof storage.clearSecret !== 'function') {
    throw new Error('Account Device Revocation requires encrypted secret storage');
  }
  if (!deviceRegistry || typeof deviceRegistry.getDevice !== 'function') {
    throw new Error('Account Device Revocation requires Device Registry');
  }
  if (!currentDeviceId) throw new Error('currentDeviceId is required');
  if (typeof removeMember !== 'function') throw new Error('removeMember callback is required');
  if (typeof applyCommit !== 'function') throw new Error('applyCommit callback is required');

  let state = normalizeState(storage.getModuleState(REVOCATION_MODULE_ID, null));

  function persist() {
    state.updatedAt = nowIso(now);
    storage.setModuleState(REVOCATION_MODULE_ID, state);
  }

  function getRecord(deviceId) {
    return state.records[String(deviceId || '')] || null;
  }

  function pendingCommit(deviceId) {
    return storage.readSecret(REVOCATION_SECRET_SCOPE, secretKeyForDevice(deviceId)) || '';
  }

  function savePendingCommit(deviceId, commitHex) {
    storage.saveSecret(
      REVOCATION_SECRET_SCOPE,
      secretKeyForDevice(deviceId),
      String(commitHex || '')
    );
  }

  function clearPendingCommit(deviceId) {
    storage.clearSecret(REVOCATION_SECRET_SCOPE, secretKeyForDevice(deviceId));
  }

  function validateTarget(deviceId) {
    const id = cleanText(deviceId, 180);
    if (!id) throw typedError('DEVICE_ID_INVALID', 'Device id is required');

    const target = deviceRegistry.getDevice(id);
    if (!target) throw typedError('DEVICE_UNKNOWN', `Unknown Messenger device ${id}`);

    if (target.deviceId === currentDeviceId || target.current) {
      throw typedError('DEVICE_SELF_REVOKE_DENIED', 'The current Workspace device cannot revoke itself');
    }
    if (target.labPeer) {
      throw typedError('DEVICE_LAB_PEER_REVOKE_DENIED', 'Lab peers are not Account devices');
    }
    if (target.ownerKind !== 'account-device') {
      throw typedError('DEVICE_REVOKE_TARGET_DENIED', 'Only linked Account devices may be revoked');
    }

    const account = deviceRegistry.accountSession();
    if (
      cleanText(target.ownerAccountId, 360) &&
      cleanText(target.ownerAccountId, 360) !== cleanText(account.accountId, 360)
    ) {
      throw typedError('DEVICE_ACCOUNT_MISMATCH', 'The device belongs to another Account identity');
    }

    return target;
  }

  function completedResult(target, record) {
    const receipt = record && record.receipt
      ? clone(record.receipt)
      : {
          schema: 'irgeztne.account-device.revocation.receipt.v1',
          result: 'REVOKED',
          nativeResult: 'NOT_PRESENT',
          deviceId: target.deviceId,
          memberIdentity: target.memberIdentity,
          epoch: 0,
          members: 0,
          revokedAt: cleanText(target.updatedAt, 80) || nowIso(now),
        };

    return {
      ok: true,
      result: 'ALREADY_REVOKED',
      device: clone(target),
      receipt,
    };
  }

  function markRecord(target, patch) {
    const old = getRecord(target.deviceId);
    const startedAt = old && old.startedAt
      ? old.startedAt
      : nowIso(now);

    state.records[target.deviceId] = {
      deviceId: target.deviceId,
      memberIdentity: target.memberIdentity,
      phase: patch.phase || (old && old.phase) || 'revoking',
      startedAt,
      updatedAt: nowIso(now),
      nativeResult: cleanText(
        patch.nativeResult != null
          ? patch.nativeResult
          : old && old.nativeResult,
        80
      ),
      epoch: Number(
        patch.epoch != null
          ? patch.epoch
          : old && old.epoch
      ) || 0,
      members: Number(
        patch.members != null
          ? patch.members
          : old && old.members
      ) || 0,
      receipt: patch.receipt != null
        ? clone(patch.receipt)
        : old && old.receipt
          ? clone(old.receipt)
          : null,
    };

    persist();
    return clone(state.records[target.deviceId]);
  }

  function finalizeRevoked(target, nativeResult, epoch, members) {
    clearPendingCommit(target.deviceId);

    const revokedAt = nowIso(now);
    const receipt = {
      schema: 'irgeztne.account-device.revocation.receipt.v1',
      result: 'REVOKED',
      nativeResult: cleanText(nativeResult, 80) || 'NOT_PRESENT',
      deviceId: target.deviceId,
      memberIdentity: target.memberIdentity,
      epoch: Number(epoch) || 0,
      members: Number(members) || 0,
      revokedAt,
    };

    markRecord(target, {
      phase: 'revoked',
      nativeResult: receipt.nativeResult,
      epoch: receipt.epoch,
      members: receipt.members,
      receipt,
    });

    const device = deviceRegistry.setDeviceStatus(target.deviceId, 'revoked');

    return {
      ok: true,
      result: 'REVOKED',
      device,
      receipt,
    };
  }

  async function finishPendingCommit(target, record) {
    const commitHex = pendingCommit(target.deviceId);
    if (!commitHex) return null;

    await applyCommit({
      deviceId: target.deviceId,
      memberIdentity: target.memberIdentity,
      commitHex,
    });

    return finalizeRevoked(
      target,
      record && record.nativeResult || 'REMOVED',
      record && record.epoch || 0,
      record && record.members || 0
    );
  }

  async function revokeDevice(deviceId) {
    // Always reload Registry state before authorization decisions.
    deviceRegistry.ensure();
    const target = validateTarget(deviceId);
    const record = getRecord(target.deviceId);

    if (target.status === 'revoked' || (record && record.phase === 'revoked')) {
      return completedResult(target, record);
    }

    if (!['active', 'revoking'].includes(target.status)) {
      throw typedError(
        'DEVICE_REVOKE_STATE_DENIED',
        `Device ${target.deviceId} cannot be revoked from status ${target.status}`
      );
    }

    if (target.status !== 'revoking') {
      deviceRegistry.setDeviceStatus(target.deviceId, 'revoking');
    }

    markRecord(target, {
      phase: record && record.phase === 'commit-pending'
        ? 'commit-pending'
        : 'revoking',
    });

    // Crash/interruption recovery: the MLS remove already happened and the
    // public Commit was durably saved in encrypted Storage Core. Do not remove
    // twice; finish advancing the remaining local members first.
    const recovered = await finishPendingCommit(target, getRecord(target.deviceId));
    if (recovered) return recovered;

    let removal;
    try {
      removal = await removeMember({
        deviceId: target.deviceId,
        memberIdentity: target.memberIdentity,
      });
    } catch (error) {
      // Fail closed. Registry stays revoking so a later explicit retry can
      // recover instead of silently declaring the device active.
      throw error;
    }

    if (!removal || !['REMOVED', 'NOT_PRESENT'].includes(removal.result)) {
      throw typedError('MLS_REMOVE_CONTRACT_ERROR', 'removeMember returned an invalid result');
    }

    if (removal.result === 'REMOVED') {
      if (!removal.commitHex) {
        throw typedError('MLS_REMOVE_CONTRACT_ERROR', 'REMOVED is missing commitHex');
      }

      // Persist the Commit before touching the other local MLS members. If the
      // app stops during applyCommit, the exact Commit is replayed on retry.
      savePendingCommit(target.deviceId, removal.commitHex);
      markRecord(target, {
        phase: 'commit-pending',
        nativeResult: 'REMOVED',
        epoch: removal.epoch,
        members: removal.members,
      });

      await applyCommit({
        deviceId: target.deviceId,
        memberIdentity: target.memberIdentity,
        commitHex: removal.commitHex,
      });

      return finalizeRevoked(
        target,
        'REMOVED',
        removal.epoch,
        removal.members
      );
    }

    // Idempotent native no-op. This is also the recovery result if the local
    // committer had already removed the member before the coordinator stopped.
    return finalizeRevoked(
      target,
      'NOT_PRESENT',
      removal.epoch,
      removal.members
    );
  }

  function publicStatus() {
    state = normalizeState(storage.getModuleState(REVOCATION_MODULE_ID, state));

    const records = Object.values(state.records).map((record) => ({
      deviceId: record.deviceId,
      phase: record.phase,
      nativeResult: record.nativeResult,
      epoch: record.epoch,
      members: record.members,
      receipt: record.receipt ? clone(record.receipt) : null,
      pendingCommit: Boolean(pendingCommit(record.deviceId)),
    }));

    return {
      schema: 'irgeztne.account-device.revocation.context.v1',
      records,
      capabilities: {
        selfRevokeDenied: true,
        labPeerRevokeDenied: true,
        idempotent: true,
        crashAwarePendingCommit: true,
        encryptedPendingCommitStorage: true,
      },
    };
  }

  return Object.freeze({
    revokeDevice,
    publicStatus,
  });
}

module.exports = {
  REVOCATION_MODULE_ID,
  REVOCATION_SECRET_SCOPE,
  createAccountDeviceRevocation,
};
