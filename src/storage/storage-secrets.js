'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function secretPreview(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return '•••• ' + text.slice(-4);
}

function readOrCreateFallbackKey(secretKeyPath) {
  ensureDir(path.dirname(secretKeyPath));

  if (fs.existsSync(secretKeyPath)) {
    const raw = fs.readFileSync(secretKeyPath, 'utf8').trim();
    const key = Buffer.from(raw, 'base64');
    if (key.length === 32) return key;
  }

  const key = crypto.randomBytes(32);
  fs.writeFileSync(secretKeyPath, key.toString('base64'), { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(secretKeyPath, 0o600); } catch (_) {}
  return key;
}

function createSecretTools(options) {
  const safeStorage = options && options.safeStorage;
  const dataDir = options && options.dataDir ? options.dataDir : process.cwd();
  const secretKeyPath = options && options.secretKeyPath ? options.secretKeyPath : path.join(dataDir, 'storage-secret.key');

  function canUseSafeStorage() {
    try {
      return !!(safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable());
    } catch (_) {
      return false;
    }
  }

  function encryptString(value) {
    const text = String(value || '');
    if (!text) return '';

    if (canUseSafeStorage()) {
      const encrypted = safeStorage.encryptString(text);
      return 'safe:' + encrypted.toString('base64');
    }

    const key = readOrCreateFallbackKey(secretKeyPath);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return 'aes256gcm:v1:' + [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64')
    ].join(':');
  }

  function decryptString(value) {
    const raw = String(value || '');
    if (!raw) return '';

    if (raw.startsWith('safe:')) {
      if (!canUseSafeStorage()) return '';
      return safeStorage.decryptString(Buffer.from(raw.slice(5), 'base64'));
    }

    if (raw.startsWith('aes256gcm:v1:')) {
      const parts = raw.split(':');
      if (parts.length !== 5) return '';
      const key = readOrCreateFallbackKey(secretKeyPath);
      const iv = Buffer.from(parts[2], 'base64');
      const tag = Buffer.from(parts[3], 'base64');
      const encrypted = Buffer.from(parts[4], 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    }

    return '';
  }

  return {
    mode: canUseSafeStorage() ? 'safeStorage' : 'aes256gcm-local-key',
    encryptString,
    decryptString,
    secretPreview
  };
}

module.exports = {
  createSecretTools,
  secretPreview
};
