'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BLOB_MAGIC = Buffer.from('IRGEBL01', 'ascii');
const KEY_FILE_NAME = '.blob-key-v1.json';
const BLOB_SUFFIX = '.blob';
const MAX_BLOB_BYTES = 25 * 1024 * 1024;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(dirPath, 0o700); } catch (_) {}
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function cleanBlobId(value) {
  const id = String(value || '');
  if (!id || id.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new TypeError('invalid app-owned blob id');
  }
  return id;
}

function createMessengerBlobStore({ rootDir, safeStorage }) {
  if (!rootDir || typeof rootDir !== 'string') {
    throw new Error('Messenger blob rootDir is required');
  }

  const keyFile = path.join(rootDir, KEY_FILE_NAME);

  function secureBackendStatus() {
    if (
      !safeStorage ||
      typeof safeStorage.isEncryptionAvailable !== 'function' ||
      !safeStorage.isEncryptionAvailable()
    ) {
      return { ok: false, reason: 'safe-storage-unavailable' };
    }

    let backend = '';
    if (typeof safeStorage.getSelectedStorageBackend === 'function') {
      try {
        backend = String(safeStorage.getSelectedStorageBackend() || '');
      } catch (_) {}
    }

    if (process.platform === 'linux' && backend === 'basic_text') {
      return { ok: false, reason: 'unsafe-linux-basic-text', backend };
    }

    return { ok: true, backend: backend || 'safeStorage' };
  }

  function requireSecureBackend() {
    const status = secureBackendStatus();
    if (!status.ok) {
      const error = new Error(`Secure attachment storage unavailable: ${status.reason}`);
      error.code = 'ATTACHMENT_SECURE_STORAGE_UNAVAILABLE';
      throw error;
    }
    return status;
  }

  function loadOrCreateKey() {
    const status = requireSecureBackend();
    ensureDir(rootDir);

    if (fs.existsSync(keyFile)) {
      const record = JSON.parse(fs.readFileSync(keyFile, 'utf8'));

      if (
        !record ||
        record.v !== 1 ||
        typeof record.encryptedKeyBase64 !== 'string' ||
        !record.encryptedKeyBase64
      ) {
        throw new Error('Invalid messenger blob key record');
      }

      const encrypted = Buffer.from(record.encryptedKeyBase64, 'base64');
      const plain = safeStorage.decryptString(encrypted);
      const key = Buffer.from(String(plain || ''), 'base64');

      if (key.length !== 32) {
        throw new Error('Invalid messenger blob encryption key');
      }

      return key;
    }

    const key = crypto.randomBytes(32);
    const encrypted = safeStorage.encryptString(key.toString('base64'));

    const record = {
      v: 1,
      protection: 'electron-safeStorage',
      backend: status.backend,
      encryptedKeyBase64: encrypted.toString('base64'),
      createdAt: new Date().toISOString()
    };

    const temp = `${keyFile}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temp, JSON.stringify(record, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });
    fs.renameSync(temp, keyFile);
    try { fs.chmodSync(keyFile, 0o600); } catch (_) {}

    return key;
  }

  function blobPath(blobId) {
    const id = cleanBlobId(blobId);
    return path.join(rootDir, `${id}${BLOB_SUFFIX}`);
  }

  function putBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('attachment payload must be a Buffer');
    }

    if (buffer.length < 1 || buffer.length > MAX_BLOB_BYTES) {
      throw new RangeError('attachment payload is outside the allowed limit');
    }

    const key = loadOrCreateKey();
    const blobId = `blob_${crypto.randomUUID().replace(/-/g, '')}`;
    const digest = sha256Hex(buffer);

    const iv = crypto.randomBytes(12);
    const aad = Buffer.from(
      `IRGEZTNE_CHAT_BLOB_V1\0${blobId}\0${buffer.length}\0${digest}`,
      'utf8'
    );

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    ensureDir(rootDir);

    const target = blobPath(blobId);
    const temp = `${target}.tmp-${process.pid}-${Date.now()}`;

    fs.writeFileSync(
      temp,
      Buffer.concat([BLOB_MAGIC, iv, tag, ciphertext]),
      { mode: 0o600 }
    );

    fs.renameSync(temp, target);
    try { fs.chmodSync(target, 0o600); } catch (_) {}

    return Object.freeze({
      blobId,
      sizeBytes: buffer.length,
      sha256: digest
    });
  }

  function readBuffer(blobId, expected = {}) {
    const key = loadOrCreateKey();
    const target = blobPath(blobId);
    const raw = fs.readFileSync(target);

    const minimum = BLOB_MAGIC.length + 12 + 16 + 1;
    if (raw.length < minimum || !raw.subarray(0, BLOB_MAGIC.length).equals(BLOB_MAGIC)) {
      throw new Error('Invalid encrypted messenger blob');
    }

    const ivStart = BLOB_MAGIC.length;
    const tagStart = ivStart + 12;
    const bodyStart = tagStart + 16;

    const iv = raw.subarray(ivStart, tagStart);
    const tag = raw.subarray(tagStart, bodyStart);
    const ciphertext = raw.subarray(bodyStart);

    const sizeBytes = Number(expected.sizeBytes);
    const digest = String(expected.sha256 || '').toLowerCase();

    if (
      !Number.isSafeInteger(sizeBytes) ||
      sizeBytes < 1 ||
      sizeBytes > MAX_BLOB_BYTES ||
      !/^[a-f0-9]{64}$/.test(digest)
    ) {
      throw new TypeError('expected attachment integrity metadata is invalid');
    }

    const aad = Buffer.from(
      `IRGEZTNE_CHAT_BLOB_V1\0${cleanBlobId(blobId)}\0${sizeBytes}\0${digest}`,
      'utf8'
    );

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);

    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    if (plain.length !== sizeBytes || sha256Hex(plain) !== digest) {
      const error = new Error('Attachment integrity verification failed');
      error.code = 'ATTACHMENT_INTEGRITY_ERROR';
      throw error;
    }

    return plain;
  }

  function has(blobId) {
    return fs.existsSync(blobPath(blobId));
  }

  function remove(blobId) {
    const target = blobPath(blobId);
    try {
      fs.unlinkSync(target);
      return true;
    } catch (error) {
      if (error && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  function status() {
    const secure = secureBackendStatus();
    return Object.freeze({
      ok: secure.ok,
      reason: secure.reason || null,
      backend: secure.backend || null,
      rootReady: fs.existsSync(rootDir)
    });
  }

  return Object.freeze({
    status,
    putBuffer,
    readBuffer,
    has,
    remove
  });
}

module.exports = {
  createMessengerBlobStore,
  MAX_BLOB_BYTES
};
