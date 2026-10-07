'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { encodeDeterministic } = require('./identity-cbor.cjs');

const PACKAGE_PROFILE = 'irgeztne.identity.recovery-package.v1';
const PAYLOAD_PROFILE = 'irgeztne.identity.recovery-payload.v1';
const KDF_NAME = 'scrypt';
const AEAD_NAME = 'AES-256-GCM';
const DEFAULT_SCRYPT = Object.freeze({ N: 32768, r: 8, p: 1, key_length: 32 });

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function b64url(bytes) { return Buffer.from(bytes).toString('base64url'); }
function unb64url(text) {
  try { return Buffer.from(String(text || ''), 'base64url'); }
  catch (_) { return Buffer.alloc(0); }
}
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest(); }

function normalizePassphrase(value) {
  const text = String(value ?? '').normalize('NFKC');
  if (text.trim().length < 12 || Buffer.byteLength(text, 'utf8') > 1024) {
    throw typedError('IDENTITY_RECOVERY_PASSPHRASE_WEAK', 'Recovery passphrase must contain at least 12 non-whitespace characters and at most 1024 UTF-8 bytes.');
  }
  return text;
}

function safeKdfParams(value = DEFAULT_SCRYPT) {
  const N = Number(value.N);
  const r = Number(value.r);
  const p = Number(value.p);
  const keyLength = Number(value.key_length || value.keyLength || 32);
  if (!Number.isSafeInteger(N) || N < 1024 || N > 262144 || (N & (N - 1)) !== 0) {
    throw typedError('IDENTITY_RECOVERY_KDF_INVALID', 'Recovery scrypt N is invalid.');
  }
  if (!Number.isSafeInteger(r) || r < 1 || r > 32 || !Number.isSafeInteger(p) || p < 1 || p > 16 || keyLength !== 32) {
    throw typedError('IDENTITY_RECOVERY_KDF_INVALID', 'Recovery scrypt parameters are invalid.');
  }
  return Object.freeze({ N, r, p, key_length: keyLength });
}

function deriveKey(passphrase, salt, params = DEFAULT_SCRYPT) {
  const p = safeKdfParams(params);
  const pass = Buffer.from(normalizePassphrase(passphrase), 'utf8');
  const saltBytes = Buffer.from(salt);
  if (saltBytes.length !== 16) throw typedError('IDENTITY_RECOVERY_KDF_INVALID', 'Recovery scrypt salt must be 128 bits.');
  const maxmem = Math.max(64 * 1024 * 1024, 128 * p.N * p.r + 8 * 1024 * 1024);
  try {
    return crypto.scryptSync(pass, saltBytes, p.key_length, { N: p.N, r: p.r, p: p.p, maxmem });
  } finally {
    pass.fill(0);
  }
}

function recoveryFingerprint({ identityId, genesisDigest, recoveryKeyId, recoveryPublicJwk, serviceSubjectCommitment }) {
  const digest = sha256(encodeDeterministic({
    domain: 'irgeztne.identity.recovery-fingerprint.v1',
    identity_id: String(identityId || ''),
    genesis_digest: String(genesisDigest || ''),
    recovery_key_id: String(recoveryKeyId || ''),
    recovery_public_jwk: recoveryPublicJwk,
    service_subject_commitment: String(serviceSubjectCommitment || '')
  }));
  const hex = digest.toString('hex').slice(0, 32).toUpperCase();
  return hex.match(/.{1,4}/g).join('-');
}

function packageHeaderFromState(state, nowSeconds) {
  const genesis = state?.journal?.[0]?.body?.payload?.genesis_anchor;
  if (!genesis) throw typedError('IDENTITY_RECOVERY_STATE_INVALID', 'Identity Genesis is missing.');
  return {
    profile: PACKAGE_PROFILE,
    version: 1,
    identity_id: String(state.identity.identity_id),
    genesis_digest: String(state.identity.genesis_digest),
    created_at: Number(nowSeconds),
    passphrase_normalization: 'NFKC',
    recovery_fingerprint: recoveryFingerprint({
      identityId: state.identity.identity_id,
      genesisDigest: state.identity.genesis_digest,
      recoveryKeyId: state.keys.recovery.key_id,
      recoveryPublicJwk: state.keys.recovery.public_jwk,
      serviceSubjectCommitment: genesis.service_subject?.commitment
    }),
    restore_test_required: true
  };
}

function recoveryPayloadFromState(state, nowSeconds) {
  return {
    profile: PAYLOAD_PROFILE,
    version: 1,
    identity_id: String(state.identity.identity_id),
    genesis_digest: String(state.identity.genesis_digest),
    exported_at: Number(nowSeconds),
    recovery_material: {
      key_id: String(state.keys.recovery.key_id),
      algorithm: String(state.keys.recovery.algorithm || 'Ed25519'),
      public_jwk: state.keys.recovery.public_jwk,
      private_jwk: state.keys.recovery.private_jwk
    },
    service_subject_seed: String(state.service_subject_seed),
    public_journal: {
      identity_id: String(state.identity.identity_id),
      genesis_digest: String(state.identity.genesis_digest),
      journal: JSON.parse(JSON.stringify(state.journal)),
      high_water: JSON.parse(JSON.stringify(state.high_water))
    }
  };
}

function createRecoveryPackage(state, passphrase, {
  nowSeconds = Math.floor(Date.now() / 1000),
  randomBytes = crypto.randomBytes,
  scrypt = DEFAULT_SCRYPT
} = {}) {
  const header = packageHeaderFromState(state, nowSeconds);
  const payload = recoveryPayloadFromState(state, nowSeconds);
  const salt = Buffer.from(randomBytes(16));
  const nonce = Buffer.from(randomBytes(12));
  if (salt.length !== 16 || nonce.length !== 12) throw typedError('IDENTITY_RECOVERY_RANDOMNESS_INVALID', 'Recovery package requires 128-bit salt and 96-bit nonce.');
  const params = safeKdfParams(scrypt);
  const aad = encodeDeterministic(header);
  const key = deriveKey(passphrase, salt, params);
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const clear = Buffer.from(JSON.stringify(payload), 'utf8');
    try {
      const ciphertext = Buffer.concat([cipher.update(clear), cipher.final()]);
      const tag = cipher.getAuthTag();
      return {
        ...header,
        kdf: { name: KDF_NAME, salt: b64url(salt), ...params },
        aead: { name: AEAD_NAME, nonce: b64url(nonce), tag: b64url(tag) },
        ciphertext: b64url(ciphertext)
      };
    } finally {
      clear.fill(0);
    }
  } finally {
    key.fill(0);
  }
}

function parseRecoveryPackage(input) {
  let value = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input); }
    catch (_) { throw typedError('IDENTITY_RECOVERY_PACKAGE_INVALID', 'Recovery package is not valid JSON.'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.profile !== PACKAGE_PROFILE || value.version !== 1) {
    throw typedError('IDENTITY_RECOVERY_PACKAGE_INVALID', 'Recovery package profile/version is invalid.');
  }
  const header = {
    profile: value.profile,
    version: value.version,
    identity_id: String(value.identity_id || ''),
    genesis_digest: String(value.genesis_digest || ''),
    created_at: Number(value.created_at || 0),
    passphrase_normalization: String(value.passphrase_normalization || ''),
    recovery_fingerprint: String(value.recovery_fingerprint || ''),
    restore_test_required: Boolean(value.restore_test_required)
  };
  if (!header.identity_id || !header.genesis_digest || !Number.isSafeInteger(header.created_at) || header.created_at <= 0 || header.passphrase_normalization !== 'NFKC' || !header.recovery_fingerprint) {
    throw typedError('IDENTITY_RECOVERY_PACKAGE_INVALID', 'Recovery package public header is incomplete.');
  }
  if (value.kdf?.name !== KDF_NAME || value.aead?.name !== AEAD_NAME) throw typedError('IDENTITY_RECOVERY_PACKAGE_INVALID', 'Recovery package crypto profile is unsupported.');
  const params = safeKdfParams(value.kdf);
  const salt = unb64url(value.kdf.salt);
  const nonce = unb64url(value.aead.nonce);
  const tag = unb64url(value.aead.tag);
  const ciphertext = unb64url(value.ciphertext);
  if (salt.length !== 16 || nonce.length !== 12 || tag.length !== 16 || ciphertext.length < 32) {
    throw typedError('IDENTITY_RECOVERY_PACKAGE_INVALID', 'Recovery package cryptographic envelope is invalid.');
  }
  return { value, header, params, salt, nonce, tag, ciphertext };
}

function decryptRecoveryPackage(input, passphrase) {
  const parsed = parseRecoveryPackage(input);
  const aad = encodeDeterministic(parsed.header);
  const key = deriveKey(passphrase, parsed.salt, parsed.params);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, parsed.nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(parsed.tag);
    let clear;
    try {
      clear = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]);
    } catch (_) {
      throw typedError('IDENTITY_RECOVERY_DECRYPT_FAILED', 'Recovery package passphrase is incorrect or the package was modified.');
    }
    try {
      const payload = JSON.parse(clear.toString('utf8'));
      if (!payload || payload.profile !== PAYLOAD_PROFILE || payload.version !== 1) {
        throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery payload profile/version is invalid.');
      }
      if (String(payload.identity_id || '') !== parsed.header.identity_id || String(payload.genesis_digest || '') !== parsed.header.genesis_digest) {
        throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery payload identity does not match its public header.');
      }
      return { header: parsed.header, payload };
    } finally {
      clear.fill(0);
    }
  } finally {
    key.fill(0);
  }
}

function writeRecoveryPackageFile(filePath, packageObject, { overwrite = false } = {}) {
  const target = path.resolve(String(filePath || ''));
  if (!target || target === path.parse(target).root) throw typedError('IDENTITY_RECOVERY_PATH_INVALID', 'Recovery package path is invalid.');
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const data = JSON.stringify(packageObject, null, 2) + '\n';
  if (!overwrite && fs.existsSync(target)) throw typedError('IDENTITY_RECOVERY_FILE_EXISTS', 'Recovery package target already exists.');
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, data, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch (_) {}
  fs.renameSync(tmp, target);
  try { fs.chmodSync(target, 0o600); } catch (_) {}
  return { filePath: target, bytes: Buffer.byteLength(data, 'utf8') };
}

function readRecoveryPackageFile(filePath) {
  const target = path.resolve(String(filePath || ''));
  let text;
  try { text = fs.readFileSync(target, 'utf8'); }
  catch (_) { throw typedError('IDENTITY_RECOVERY_FILE_UNREADABLE', 'Recovery package file could not be read.'); }
  return { filePath: target, packageObject: parseRecoveryPackage(text).value };
}

module.exports = {
  PACKAGE_PROFILE,
  PAYLOAD_PROFILE,
  DEFAULT_SCRYPT,
  createRecoveryPackage,
  decryptRecoveryPackage,
  parseRecoveryPackage,
  recoveryFingerprint,
  writeRecoveryPackageFile,
  readRecoveryPackageFile,
  normalizePassphrase,
  safeKdfParams
};
