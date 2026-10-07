'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function backendName(safeStorage) {
  try {
    if (safeStorage && typeof safeStorage.getSelectedStorageBackend === 'function') {
      return String(safeStorage.getSelectedStorageBackend() || '').trim();
    }
  } catch (_) {}
  return '';
}

function protectedStorageStatus(safeStorage) {
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

  const backend = backendName(safeStorage);
  if (!available) {
    return { available: false, backend: backend || 'unavailable', reason: 'OS_PROTECTED_STORAGE_UNAVAILABLE' };
  }
  if (backend.toLowerCase() === 'basic_text') {
    return { available: false, backend, reason: 'UNPROTECTED_LINUX_BASIC_TEXT' };
  }
  if (
    typeof safeStorage.encryptString !== 'function' ||
    typeof safeStorage.decryptString !== 'function'
  ) {
    return { available: false, backend: backend || 'unknown', reason: 'SAFE_STORAGE_API_INCOMPLETE' };
  }
  return { available: true, backend: backend || 'os-protected', reason: null };
}

function createAccountSecureStore({ safeStorage, dataDir, filePath } = {}) {
  if (!dataDir && !filePath) throw new Error('Account secure store requires dataDir or filePath');
  const target = filePath || path.join(dataDir, 'account-secure-v1.json');

  function status() {
    const secure = protectedStorageStatus(safeStorage);
    return { ...secure, filePath: target };
  }

  function assertAvailable() {
    const current = status();
    if (!current.available) {
      const error = new Error('OS-backed protected storage is unavailable; persistent Account secrets are disabled.');
      error.code = current.reason || 'PROTECTED_STORAGE_UNAVAILABLE';
      error.backend = current.backend;
      throw error;
    }
    return current;
  }

  function read() {
    assertAvailable();
    if (!fs.existsSync(target)) return {};
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch (_) {
      return {};
    }
    if (!parsed || parsed.version !== 1 || !parsed.ciphertext) return {};
    try {
      const encrypted = Buffer.from(String(parsed.ciphertext), 'base64');
      const clear = safeStorage.decryptString(encrypted);
      const value = JSON.parse(clear || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) {
      const error = new Error('Account protected state could not be decrypted.');
      error.code = 'ACCOUNT_SECURE_STATE_UNREADABLE';
      throw error;
    }
  }

  function write(value) {
    assertAvailable();
    const normalized = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    ensureDir(path.dirname(target));
    const ciphertext = safeStorage.encryptString(JSON.stringify(normalized)).toString('base64');
    const tmp = `${target}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, ciphertext }), { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(tmp, 0o600); } catch (_) {}
    fs.renameSync(tmp, target);
    try { fs.chmodSync(target, 0o600); } catch (_) {}
    return { ok: true };
  }

  function update(mutator) {
    const current = read();
    const next = typeof mutator === 'function' ? mutator(current) : current;
    write(next);
    return next;
  }

  function clear() {
    try { fs.rmSync(target, { force: true }); } catch (_) {}
    return { ok: true };
  }

  return { status, read, write, update, clear };
}

module.exports = {
  createAccountSecureStore,
  protectedStorageStatus
};
