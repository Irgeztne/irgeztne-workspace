'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function selectedLinuxBackend(safeStorage) {
  try {
    if (safeStorage && typeof safeStorage.getSelectedStorageBackend === 'function') {
      return String(safeStorage.getSelectedStorageBackend() || '').trim().toLowerCase();
    }
  } catch (_) {}
  return '';
}

function protectedStorageStatus(safeStorage, platform = process.platform) {
  let available = false;
  try {
    available = Boolean(
      safeStorage &&
      typeof safeStorage.isEncryptionAvailable === 'function' &&
      safeStorage.isEncryptionAvailable()
    );
  } catch (_) {
    available = false;
  }

  if (!['linux', 'darwin', 'win32'].includes(platform)) {
    return {
      available: false,
      platform,
      backend: 'unsupported',
      reason: 'UNSUPPORTED_IDENTITY_PLATFORM',
      release_requirement: null
    };
  }

  if (!available) {
    return {
      available: false,
      platform,
      backend: 'unavailable',
      reason: 'SECURE_STORAGE_REQUIRED',
      release_requirement: platform === 'darwin' ? 'CONSISTENT_CODE_SIGNING_REQUIRED' : null
    };
  }

  if (
    typeof safeStorage.encryptString !== 'function' ||
    typeof safeStorage.decryptString !== 'function'
  ) {
    return {
      available: false,
      platform,
      backend: 'api-incomplete',
      reason: 'SAFE_STORAGE_API_INCOMPLETE',
      release_requirement: platform === 'darwin' ? 'CONSISTENT_CODE_SIGNING_REQUIRED' : null
    };
  }

  if (platform === 'linux') {
    const backend = selectedLinuxBackend(safeStorage);
    if (!backend || backend === 'unknown') {
      return {
        available: false,
        platform,
        backend: backend || 'unknown',
        reason: 'LINUX_SECRET_STORE_UNKNOWN',
        release_requirement: null
      };
    }
    if (backend === 'basic_text') {
      return {
        available: false,
        platform,
        backend,
        reason: 'UNPROTECTED_LINUX_BASIC_TEXT',
        release_requirement: null
      };
    }
    if (!['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(backend)) {
      return {
        available: false,
        platform,
        backend,
        reason: 'LINUX_SECRET_STORE_UNAPPROVED',
        release_requirement: null
      };
    }
    return {
      available: true,
      platform,
      backend,
      reason: null,
      release_requirement: null
    };
  }

  if (platform === 'darwin') {
    return {
      available: true,
      platform,
      backend: 'macos-keychain',
      reason: null,
      release_requirement: 'CONSISTENT_CODE_SIGNING_REQUIRED'
    };
  }

  return {
    available: true,
    platform,
    backend: 'windows-dpapi',
    reason: null,
    release_requirement: 'SIGNED_RELEASE_RECOMMENDED'
  };
}

function createIdentitySecureStore({ safeStorage, dataDir, filePath, platform = process.platform } = {}) {
  if (!dataDir && !filePath) throw new Error('Identity secure store requires dataDir or filePath.');
  const target = filePath || path.join(dataDir, 'identity-secure-v1.json');

  function status() {
    return { ...protectedStorageStatus(safeStorage, platform), filePath: target };
  }

  function exists() {
    return fs.existsSync(target);
  }

  function assertAvailable() {
    const current = status();
    if (!current.available) {
      const error = new Error('OS-backed protected storage is required for IRGEZTNE Identity.');
      error.code = current.reason || 'SECURE_STORAGE_REQUIRED';
      error.backend = current.backend;
      error.platform = current.platform;
      throw error;
    }
    return current;
  }

  function read() {
    assertAvailable();
    if (!exists()) return null;

    let envelope;
    try {
      envelope = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (_) {
      const error = new Error('Identity protected state envelope is unreadable.');
      error.code = 'IDENTITY_SECURE_STATE_UNREADABLE';
      throw error;
    }
    if (!envelope || envelope.version !== 1 || typeof envelope.ciphertext !== 'string' || !envelope.ciphertext) {
      const error = new Error('Identity protected state envelope is invalid.');
      error.code = 'IDENTITY_SECURE_STATE_INVALID';
      throw error;
    }

    try {
      const encrypted = Buffer.from(envelope.ciphertext, 'base64');
      const clear = safeStorage.decryptString(encrypted);
      const state = JSON.parse(clear);
      if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('invalid state');
      return state;
    } catch (cause) {
      const error = new Error('Identity protected state could not be decrypted or decoded.');
      error.code = 'IDENTITY_SECURE_STATE_UNREADABLE';
      error.cause = cause;
      throw error;
    }
  }

  function serializeState(state) {
    assertAvailable();
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Identity secure state must be an object.');
    }
    return safeStorage.encryptString(JSON.stringify(state)).toString('base64');
  }

  function atomicEnvelopeWrite(ciphertext) {
    ensureDir(path.dirname(target));
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, ciphertext }), { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(tmp, 0o600); } catch (_) {}
    fs.renameSync(tmp, target);
    try { fs.chmodSync(target, 0o600); } catch (_) {}
  }

  function write(state) {
    assertAvailable();
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('Identity secure state must be an object.');
    }
    if (fs.existsSync(target)) {
      const error = new Error('Identity secure state already exists.');
      error.code = 'IDENTITY_SECURE_STATE_EXISTS';
      throw error;
    }
    atomicEnvelopeWrite(serializeState(state));
    return { ok: true };
  }

  function replace(state, { expectedIdentityId } = {}) {
    if (!fs.existsSync(target)) {
      const error = new Error('Identity secure state does not exist.');
      error.code = 'IDENTITY_SECURE_STATE_MISSING';
      throw error;
    }
    if (expectedIdentityId) {
      const current = read();
      if (String(current?.identity?.identity_id || '') !== String(expectedIdentityId)) {
        const error = new Error('Identity secure state changed before replacement.');
        error.code = 'IDENTITY_SECURE_STATE_CONFLICT';
        throw error;
      }
    }
    atomicEnvelopeWrite(serializeState(state));
    return { ok: true };
  }

  return Object.freeze({ status, exists, read, write, replace });
}

module.exports = {
  createIdentitySecureStore,
  protectedStorageStatus,
  selectedLinuxBackend
};
