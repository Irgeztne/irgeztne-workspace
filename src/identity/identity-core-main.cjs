'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { encodeDeterministic } = require('./identity-cbor.cjs');
const { createIdentitySecureStore } = require('./identity-secure-store.cjs');
const {
  createRecoveryPackage,
  decryptRecoveryPackage,
  recoveryFingerprint,
  writeRecoveryPackageFile,
  readRecoveryPackageFile
} = require('./identity-recovery.cjs');

const LOCAL_PROFILE = 'irgeztne.identity.local.v0.2';
const AUTH_DOMAIN = 'irgeztne.identity.auth-delegation.v1';
const PROOF_DOMAIN = 'irgeztne.identity.request-proof.v1';
const GENESIS_DOMAIN = 'irgeztne.identity.genesis.v1';
const EVENT_DOMAIN = 'irgeztne.identity.event.v1';
const SERVICE_SUBJECT_PROFILE = 'irgeztne.service-subject.v1';
const JOURNAL_SERIALIZATION = 'rfc8949-core-deterministic-cbor-v1';
const KEY_ALGORITHM = 'Ed25519';

function typedError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest();
}

function hmacSha256(key, bytes) {
  return crypto.createHmac('sha256', key).update(bytes).digest();
}

function base32(bytes) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of Buffer.from(bytes)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function multihashSha256(digest) {
  const bytes = Buffer.from(digest);
  if (bytes.length !== 32) throw new Error('sha2-256 multihash requires a 32-byte digest.');
  return Buffer.concat([Buffer.from([0x12, 0x20]), bytes]);
}

function normalizePublicJwk(jwk) {
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string' || !jwk.x) {
    throw typedError('IDENTITY_KEY_INVALID', 'Expected an Ed25519 public JWK.');
  }
  return Object.freeze({ kty: 'OKP', crv: 'Ed25519', x: String(jwk.x) });
}

function normalizePrivateJwk(jwk) {
  if (
    !jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' ||
    typeof jwk.x !== 'string' || !jwk.x || typeof jwk.d !== 'string' || !jwk.d
  ) {
    throw typedError('IDENTITY_KEY_INVALID', 'Expected an Ed25519 private JWK.');
  }
  return Object.freeze({ kty: 'OKP', crv: 'Ed25519', x: String(jwk.x), d: String(jwk.d) });
}

function generateEd25519Keypair() {
  const pair = crypto.generateKeyPairSync('ed25519');
  return Object.freeze({
    publicJwk: normalizePublicJwk(pair.publicKey.export({ format: 'jwk' })),
    privateJwk: normalizePrivateJwk(pair.privateKey.export({ format: 'jwk' }))
  });
}

function keyId(role, publicJwk) {
  const domain = Buffer.from(`irgeztne.identity.key-id.v1:${String(role).toLowerCase()}:`, 'utf8');
  const digest = sha256(Buffer.concat([domain, encodeDeterministic(normalizePublicJwk(publicJwk))]));
  return `${String(role).toLowerCase()}_${base32(digest).slice(0, 52)}`;
}

function publicKeyMatchesPrivate(publicJwk, privateJwk) {
  try {
    const privateKey = crypto.createPrivateKey({ key: normalizePrivateJwk(privateJwk), format: 'jwk' });
    const derived = normalizePublicJwk(crypto.createPublicKey(privateKey).export({ format: 'jwk' }));
    const expected = normalizePublicJwk(publicJwk);
    return derived.kty === expected.kty && derived.crv === expected.crv && derived.x === expected.x;
  } catch (_) {
    return false;
  }
}

function signEd25519(privateJwk, bytes) {
  const key = crypto.createPrivateKey({ key: normalizePrivateJwk(privateJwk), format: 'jwk' });
  return b64url(crypto.sign(null, Buffer.from(bytes), key));
}

function verifyEd25519(publicJwk, bytes, signature) {
  try {
    const key = crypto.createPublicKey({ key: normalizePublicJwk(publicJwk), format: 'jwk' });
    return crypto.verify(null, Buffer.from(bytes), key, Buffer.from(String(signature || ''), 'base64url'));
  } catch (_) {
    return false;
  }
}

function serviceSeedCommitment(seed) {
  return b64url(sha256(Buffer.concat([
    Buffer.from('irgeztne.service-subject.seed-commitment.v1\0', 'utf8'),
    Buffer.from(seed)
  ])));
}

function identityIdFromAnchor(anchor) {
  const digest = sha256(encodeDeterministic(anchor));
  return {
    identityId: base32(multihashSha256(digest)),
    genesisDigest: b64url(digest)
  };
}

function deviceIdFromPublicKey(publicJwk) {
  const digest = sha256(Buffer.concat([
    Buffer.from('irgeztne.identity.device-id.v1\0', 'utf8'),
    encodeDeterministic(normalizePublicJwk(publicJwk))
  ]));
  return `dev_${base32(digest).slice(0, 52)}`;
}

function eventSigningBytes(body) {
  return Buffer.concat([
    Buffer.from('IRGEZTNE_IDENTITY_EVENT_V1\0', 'utf8'),
    encodeDeterministic(body)
  ]);
}

function eventHash(body, signatures) {
  return b64url(sha256(encodeDeterministic({ body, signatures })));
}

function createGenesisState({ nowSeconds = Math.floor(Date.now() / 1000), randomBytes = crypto.randomBytes } = {}) {
  const root = generateEd25519Keypair();
  const recovery = generateEd25519Keypair();
  const device = generateEd25519Keypair();
  const nonce = Buffer.from(randomBytes(32));
  const subjectSeed = Buffer.from(randomBytes(32));
  if (nonce.length !== 32 || subjectSeed.length !== 32) {
    throw typedError('IDENTITY_RANDOMNESS_INVALID', 'Identity creation requires 256-bit random values.');
  }

  const rootKeyId = keyId('root', root.publicJwk);
  const recoveryKeyId = keyId('recovery', recovery.publicJwk);
  const deviceId = deviceIdFromPublicKey(device.publicJwk);

  const genesisAnchor = {
    domain: GENESIS_DOMAIN,
    version: 1,
    identity_nonce: b64url(nonce),
    root: {
      algorithm: KEY_ALGORITHM,
      key_id: rootKeyId,
      public_key: root.publicJwk
    },
    recovery: {
      algorithm: KEY_ALGORITHM,
      key_id: recoveryKeyId,
      public_key: recovery.publicJwk
    },
    service_subject: {
      profile: SERVICE_SUBJECT_PROFILE,
      commitment_algorithm: 'SHA-256',
      commitment: serviceSeedCommitment(subjectSeed)
    },
    journal: {
      serialization: JOURNAL_SERIALIZATION,
      hash: 'SHA-256',
      signature: KEY_ALGORITHM,
      event_domain: EVENT_DOMAIN
    }
  };

  const { identityId, genesisDigest } = identityIdFromAnchor(genesisAnchor);
  const body = {
    protocol: EVENT_DOMAIN,
    schema: 1,
    identity_id: identityId,
    genesis_digest: genesisDigest,
    recovery_epoch: 0,
    sequence: 0,
    prev_hash: null,
    event_type: 'GENESIS',
    payload: {
      genesis_anchor: genesisAnchor,
      initial_device: {
        device_id: deviceId,
        algorithm: KEY_ALGORITHM,
        public_key: device.publicJwk,
        label: 'IRGEZTNE Workspace'
      }
    },
    issuer: {
      role: 'GENESIS',
      key_id: 'genesis'
    },
    created_at: Number(nowSeconds)
  };

  const signingBytes = eventSigningBytes(body);
  const signatures = [
    {
      role: 'ROOT',
      key_id: rootKeyId,
      algorithm: KEY_ALGORITHM,
      signature: signEd25519(root.privateJwk, signingBytes)
    },
    {
      role: 'RECOVERY',
      key_id: recoveryKeyId,
      algorithm: KEY_ALGORITHM,
      signature: signEd25519(recovery.privateJwk, signingBytes)
    }
  ];
  const headHash = eventHash(body, signatures);

  return {
    version: 1,
    profile: LOCAL_PROFILE,
    status: 'RECOVERY_NOT_PROVISIONED',
    identity: {
      identity_id: identityId,
      genesis_digest: genesisDigest,
      created_at: Number(nowSeconds)
    },
    keys: {
      root: {
        key_id: rootKeyId,
        algorithm: KEY_ALGORITHM,
        public_jwk: root.publicJwk,
        private_jwk: root.privateJwk
      },
      recovery: {
        key_id: recoveryKeyId,
        algorithm: KEY_ALGORITHM,
        public_jwk: recovery.publicJwk,
        private_jwk: recovery.privateJwk,
        staged_until_provisioned: true
      },
      device: {
        device_id: deviceId,
        algorithm: KEY_ALGORITHM,
        public_jwk: device.publicJwk,
        private_jwk: device.privateJwk
      }
    },
    service_subject_seed: b64url(subjectSeed),
    journal: [
      {
        body,
        signatures,
        event_hash: headHash
      }
    ],
    high_water: {
      recovery_epoch: 0,
      sequence: 0,
      head_hash: headHash
    },
    recovery: {
      provisioned: false,
      restore_tested: false
    }
  };
}

function publicJournalShape(state) {
  return {
    identity_id: state?.identity?.identity_id,
    genesis_digest: state?.identity?.genesis_digest,
    journal: state?.journal,
    high_water: state?.high_water
  };
}

function projectPublicJournal(publicJournal) {
  try {
    if (!publicJournal || !Array.isArray(publicJournal.journal) || !publicJournal.journal.length || !publicJournal.high_water) return null;
    const genesisEvent = publicJournal.journal[0];
    const body = genesisEvent?.body;
    const signatures = genesisEvent?.signatures;
    if (!body || body.protocol !== EVENT_DOMAIN || body.event_type !== 'GENESIS' || body.sequence !== 0 || body.recovery_epoch !== 0 || body.prev_hash !== null || !Array.isArray(signatures)) return null;
    const anchor = body.payload?.genesis_anchor;
    const initialDevice = body.payload?.initial_device;
    if (!anchor || !initialDevice) return null;
    const { identityId, genesisDigest } = identityIdFromAnchor(anchor);
    if (String(publicJournal.identity_id || '') !== identityId || String(body.identity_id || '') !== identityId) return null;
    if (String(publicJournal.genesis_digest || '') !== genesisDigest || String(body.genesis_digest || '') !== genesisDigest) return null;
    const root = { key_id:String(anchor.root?.key_id || ''), public_jwk:normalizePublicJwk(anchor.root?.public_key) };
    const recovery = { key_id:String(anchor.recovery?.key_id || ''), public_jwk:normalizePublicJwk(anchor.recovery?.public_key) };
    const device = { device_id:String(initialDevice.device_id || ''), public_jwk:normalizePublicJwk(initialDevice.public_key) };
    if (!root.key_id || !recovery.key_id || !device.device_id) return null;
    const signingBytes = eventSigningBytes(body);
    const rootSig = signatures.find((item) => item?.role === 'ROOT' && item?.key_id === root.key_id);
    const recoverySig = signatures.find((item) => item?.role === 'RECOVERY' && item?.key_id === recovery.key_id);
    if (!rootSig || !recoverySig) return null;
    if (!verifyEd25519(root.public_jwk, signingBytes, rootSig.signature)) return null;
    if (!verifyEd25519(recovery.public_jwk, signingBytes, recoverySig.signature)) return null;
    const genesisHash = eventHash(body, signatures);
    if (String(genesisEvent.event_hash || '') !== genesisHash) return null;

    let projected = {
      identity_id: identityId,
      genesis_digest: genesisDigest,
      genesis_anchor: anchor,
      root,
      recovery,
      device,
      recovery_epoch: 0,
      sequence: 0,
      head_hash: genesisHash
    };

    for (let i = 1; i < publicJournal.journal.length; i += 1) {
      const event = publicJournal.journal[i];
      const next = event?.body;
      const eventSignatures = event?.signatures;
      if (!next || !Array.isArray(eventSignatures) || next.protocol !== EVENT_DOMAIN || next.schema !== 1) return null;
      if (String(next.identity_id || '') !== identityId || String(next.genesis_digest || '') !== genesisDigest) return null;
      if (String(next.prev_hash || '') !== projected.head_hash) return null;

      if (next.event_type === 'RECOVERY_ROTATE_ROOT') {
        if (Number(next.recovery_epoch) !== projected.recovery_epoch + 1 || Number(next.sequence) !== 0) return null;
        if (next.issuer?.role !== 'RECOVERY' || String(next.issuer?.key_id || '') !== projected.recovery.key_id) return null;
        const newRootPayload = next.payload?.new_root;
        const newDevicePayload = next.payload?.new_device;
        if (!newRootPayload?.key_id || !newRootPayload?.public_key || !newDevicePayload?.device_id || !newDevicePayload?.public_key) return null;
        const newRoot = { key_id:String(newRootPayload.key_id), public_jwk:normalizePublicJwk(newRootPayload.public_key) };
        const newDevice = { device_id:String(newDevicePayload.device_id), public_jwk:normalizePublicJwk(newDevicePayload.public_key) };
        const eventBytes = eventSigningBytes(next);
        const recoveryProof = eventSignatures.find((item) => item?.role === 'RECOVERY' && item?.key_id === projected.recovery.key_id);
        const rootProof = eventSignatures.find((item) => item?.role === 'NEW_ROOT' && item?.key_id === newRoot.key_id);
        if (!recoveryProof || !rootProof) return null;
        if (!verifyEd25519(projected.recovery.public_jwk, eventBytes, recoveryProof.signature)) return null;
        if (!verifyEd25519(newRoot.public_jwk, eventBytes, rootProof.signature)) return null;
        const hash = eventHash(next, eventSignatures);
        if (String(event.event_hash || '') !== hash) return null;
        projected = {
          ...projected,
          root:newRoot,
          device:newDevice,
          recovery_epoch:Number(next.recovery_epoch),
          sequence:Number(next.sequence),
          head_hash:hash
        };
        continue;
      }

      return null;
    }

    if (
      Number(publicJournal.high_water.recovery_epoch) !== projected.recovery_epoch ||
      Number(publicJournal.high_water.sequence) !== projected.sequence ||
      String(publicJournal.high_water.head_hash || '') !== projected.head_hash
    ) return null;
    return projected;
  } catch (_) {
    return null;
  }
}

function verifyGenesisState(state) {
  try {
    if (!state || state.version !== 1 || state.profile !== LOCAL_PROFILE || !Array.isArray(state.journal) || state.journal.length !== 1) return false;
    return verifyIdentityState(state);
  } catch (_) { return false; }
}

function verifyIdentityState(state) {
  try {
    if (!state || state.version !== 1 || state.profile !== LOCAL_PROFILE || !state.identity || !state.keys || !state.recovery || !Array.isArray(state.journal) || !state.journal.length) return false;
    const projected = projectPublicJournal(publicJournalShape(state));
    if (!projected) return false;
    const root = state.keys.root;
    const recovery = state.keys.recovery;
    const device = state.keys.device;
    if (String(root?.key_id || '') !== projected.root.key_id || !publicKeyMatchesPrivate(projected.root.public_jwk, root?.private_jwk)) return false;
    if (String(recovery?.key_id || '') !== projected.recovery.key_id || !publicKeyMatchesPrivate(projected.recovery.public_jwk, recovery?.private_jwk)) return false;
    if (String(device?.device_id || '') !== projected.device.device_id || !publicKeyMatchesPrivate(projected.device.public_jwk, device?.private_jwk)) return false;
    if (state.identity.identity_id !== projected.identity_id || state.identity.genesis_digest !== projected.genesis_digest) return false;
    const seed = Buffer.from(String(state.service_subject_seed || ''), 'base64url');
    if (seed.length !== 32) return false;
    if (projected.genesis_anchor.service_subject?.commitment !== serviceSeedCommitment(seed)) return false;
    if (typeof state.recovery.provisioned !== 'boolean' || typeof state.recovery.restore_tested !== 'boolean') return false;
    return true;
  } catch (_) { return false; }
}

function recoveryPayloadProjection(payload) {
  const publicJournal = payload?.public_journal;
  const projected = projectPublicJournal(publicJournal);
  if (!projected) throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery package journal checkpoint is invalid.');
  if (String(payload.identity_id || '') !== projected.identity_id || String(payload.genesis_digest || '') !== projected.genesis_digest) {
    throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery package IdentityID/genesis mismatch.');
  }
  const material = payload.recovery_material;
  if (!material?.key_id || !material?.public_jwk || !material?.private_jwk) {
    throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery private material is missing.');
  }
  if (String(material.key_id) !== projected.recovery.key_id || !publicKeyMatchesPrivate(projected.recovery.public_jwk, material.private_jwk)) {
    throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery private material does not match the active Recovery authority.');
  }
  const seed = Buffer.from(String(payload.service_subject_seed || ''), 'base64url');
  if (seed.length !== 32 || projected.genesis_anchor.service_subject?.commitment !== serviceSeedCommitment(seed)) {
    throw typedError('IDENTITY_RECOVERY_PAYLOAD_INVALID', 'Recovery ServiceSubjectSeed does not match Genesis commitment.');
  }
  return { projected, seed };
}

function recoveryPackageFingerprintForPayload(header, payload) {
  const projected = recoveryPayloadProjection(payload).projected;
  return recoveryFingerprint({
    identityId: projected.identity_id,
    genesisDigest: projected.genesis_digest,
    recoveryKeyId: projected.recovery.key_id,
    recoveryPublicJwk: projected.recovery.public_jwk,
    serviceSubjectCommitment: projected.genesis_anchor.service_subject?.commitment
  });
}

function createRecoveryRotateState(payload, { nowSeconds = Math.floor(Date.now()/1000) } = {}) {
  const { projected, seed } = recoveryPayloadProjection(payload);
  const recoveryMaterial = payload.recovery_material;
  const newRoot = generateEd25519Keypair();
  const newDevice = generateEd25519Keypair();
  const newRootKeyId = keyId('root', newRoot.publicJwk);
  const newDeviceId = deviceIdFromPublicKey(newDevice.publicJwk);
  const body = {
    protocol: EVENT_DOMAIN,
    schema: 1,
    identity_id: projected.identity_id,
    genesis_digest: projected.genesis_digest,
    recovery_epoch: projected.recovery_epoch + 1,
    sequence: 0,
    prev_hash: projected.head_hash,
    event_type: 'RECOVERY_ROTATE_ROOT',
    payload: {
      new_root: { algorithm:KEY_ALGORITHM, key_id:newRootKeyId, public_key:newRoot.publicJwk },
      new_device: { device_id:newDeviceId, algorithm:KEY_ALGORITHM, public_key:newDevice.publicJwk, label:'IRGEZTNE Workspace (recovered)' },
      revoke_prior_devices: true,
      recovery_reason: 'OFFLINE_RECOVERY_PACKAGE'
    },
    issuer: { role:'RECOVERY', key_id:projected.recovery.key_id },
    created_at: Number(nowSeconds)
  };
  const bytes = eventSigningBytes(body);
  const signatures = [
    { role:'RECOVERY', key_id:projected.recovery.key_id, algorithm:KEY_ALGORITHM, signature:signEd25519(recoveryMaterial.private_jwk, bytes) },
    { role:'NEW_ROOT', key_id:newRootKeyId, algorithm:KEY_ALGORITHM, signature:signEd25519(newRoot.privateJwk, bytes) }
  ];
  const event = { body, signatures, event_hash:eventHash(body,signatures) };
  const state = {
    version:1,
    profile:LOCAL_PROFILE,
    status:'RECOVERED_PENDING_REGISTRY_SYNC',
    identity:{ identity_id:projected.identity_id, genesis_digest:projected.genesis_digest, created_at:Number(payload.public_journal?.journal?.[0]?.body?.created_at || nowSeconds) },
    keys:{
      root:{ key_id:newRootKeyId, algorithm:KEY_ALGORITHM, public_jwk:newRoot.publicJwk, private_jwk:newRoot.privateJwk },
      recovery:{ key_id:projected.recovery.key_id, algorithm:KEY_ALGORITHM, public_jwk:projected.recovery.public_jwk, private_jwk:recoveryMaterial.private_jwk, staged_until_provisioned:false },
      device:{ device_id:newDeviceId, algorithm:KEY_ALGORITHM, public_jwk:newDevice.publicJwk, private_jwk:newDevice.privateJwk }
    },
    service_subject_seed:b64url(seed),
    journal:[...JSON.parse(JSON.stringify(payload.public_journal.journal)), event],
    high_water:{ recovery_epoch:body.recovery_epoch, sequence:body.sequence, head_hash:event.event_hash },
    recovery:{
      provisioned:true,
      restore_tested:true,
      package_fingerprint:null,
      provisioned_at:Number(nowSeconds),
      restore_tested_at:Number(nowSeconds),
      restored_at:Number(nowSeconds)
    }
  };
  if (!verifyIdentityState(state)) throw typedError('IDENTITY_RECOVERY_RESTORE_SELF_CHECK_FAILED', 'Recovered Identity failed cryptographic self-check.');
  return state;
}

function publicSummary(state, secureStatus) {
  return Object.freeze({
    ok: true,
    exists: true,
    identity_id: String(state.identity.identity_id),
    device_id: String(state.keys.device.device_id),
    recovery_epoch: Number(state.high_water.recovery_epoch),
    sequence: Number(state.high_water.sequence),
    head_hash: String(state.high_water.head_hash),
    recovery_provisioned: Boolean(state.recovery.provisioned),
    recovery_restore_tested: Boolean(state.recovery.restore_tested),
    recovery_package_fingerprint: state.recovery.package_fingerprint ? String(state.recovery.package_fingerprint) : null,
    recovery_provisioned_at: Number(state.recovery.provisioned_at || 0) || null,
    recovery_restore_tested_at: Number(state.recovery.restore_tested_at || 0) || null,
    status: String(state.status || ''),
    protected_storage: Object.freeze({
      available: Boolean(secureStatus.available),
      backend: String(secureStatus.backend || 'unknown'),
      reason: secureStatus.reason || null
    })
  });
}

function canonicalServiceSector(serviceNamespace, serviceEnvironment, subjectProfileVersion) {
  const namespace = String(serviceNamespace || '').trim().toLowerCase();
  const environment = String(serviceEnvironment || '').trim().toLowerCase();
  const version = String(subjectProfileVersion || '').trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(namespace)) {
    throw typedError('IDENTITY_SERVICE_SECTOR_INVALID', 'Invalid service namespace.');
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(environment)) {
    throw typedError('IDENTITY_SERVICE_SECTOR_INVALID', 'Invalid service environment.');
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(version)) {
    throw typedError('IDENTITY_SERVICE_SECTOR_INVALID', 'Invalid subject profile version.');
  }

  return {
    service_namespace: namespace,
    service_environment: environment,
    subject_profile_version: version
  };
}

function deriveServiceSubjectFromState(state, serviceNamespace, serviceEnvironment = 'prod', subjectProfileVersion = 'v1') {
  if (!verifyIdentityState(state)) {
    throw typedError('IDENTITY_STATE_INVALID', 'Identity state failed cryptographic verification.');
  }
  return deriveSubjectFromSeed(state.service_subject_seed, serviceNamespace, serviceEnvironment, subjectProfileVersion);
}

function deriveSubjectFromSeed(seedValue, serviceNamespace, serviceEnvironment = 'prod', subjectProfileVersion = 'v1') {
  const seed = Buffer.from(String(seedValue || ''), 'base64url');
  if (seed.length !== 32) throw typedError('IDENTITY_SUBJECT_SEED_INVALID', 'ServiceSubjectSeed is invalid.');
  const sector = encodeDeterministic(canonicalServiceSector(serviceNamespace, serviceEnvironment, subjectProfileVersion));
  const prefix = Buffer.from('irgeztne.service-subject.v1', 'utf8');
  const length = Buffer.alloc(4); length.writeUInt32BE(sector.length,0);
  return base32(hmacSha256(seed, Buffer.concat([prefix,length,sector])));
}

function publicJournalFromState(state) {
  if (!verifyIdentityState(state)) throw typedError('IDENTITY_STATE_INVALID', 'Identity state failed cryptographic verification.');
  return JSON.parse(JSON.stringify({
    identity_id: state.identity.identity_id,
    genesis_digest: state.identity.genesis_digest,
    journal: state.journal,
    high_water: state.high_water
  }));
}

function createIdentityController({
  app,
  safeStorage,
  dataDir,
  now = () => Date.now(),
  randomBytes = crypto.randomBytes,
  platform = process.platform
} = {}) {
  if (!app || typeof app.getPath !== 'function') throw new Error('Identity controller requires Electron app.');
  const targetDataDir = dataDir || path.join(app.getPath('userData'), 'data');
  const secureStore = createIdentitySecureStore({ safeStorage, dataDir: targetDataDir, platform });
  const ephemeralSessions = new Map();

  function getStatus() {
    const secure = secureStore.status();
    if (!secure.available) {
      return {
        ok: true,
        exists: false,
        status: 'SECURE_STORAGE_REQUIRED',
        protected_storage: {
          available: false,
          backend: secure.backend,
          reason: secure.reason
        }
      };
    }
    if (!secureStore.exists()) {
      return {
        ok: true,
        exists: false,
        status: 'NOT_CREATED',
        protected_storage: {
          available: true,
          backend: secure.backend,
          reason: null
        }
      };
    }
    const state = secureStore.read();
    if (!verifyIdentityState(state)) {
      throw typedError('IDENTITY_STATE_INVALID', 'Stored Identity failed cryptographic verification.');
    }
    return publicSummary(state, secure);
  }

  function create() {
    const secure = secureStore.status();
    if (!secure.available) {
      throw typedError(secure.reason || 'SECURE_STORAGE_REQUIRED', 'OS-backed protected storage is required to create IRGEZTNE Identity.');
    }
    if (secureStore.exists()) {
      const state = secureStore.read();
      if (!verifyIdentityState(state)) throw typedError('IDENTITY_STATE_INVALID', 'Stored Identity failed cryptographic verification.');
      return { ...publicSummary(state, secure), created: false };
    }

    const state = createGenesisState({
      nowSeconds: Math.floor(now() / 1000),
      randomBytes
    });
    if (!verifyIdentityState(state)) {
      throw typedError('IDENTITY_CREATE_SELF_CHECK_FAILED', 'New Identity failed its cryptographic self-check.');
    }
    secureStore.write(state);

    const reopened = secureStore.read();
    if (!verifyIdentityState(reopened) || reopened.identity.identity_id !== state.identity.identity_id) {
      throw typedError('IDENTITY_PERSISTENCE_VERIFY_FAILED', 'New Identity could not be verified after persistence.');
    }
    return { ...publicSummary(reopened, secure), created: true };
  }

  function readVerifiedState() {
    const secure = secureStore.status();
    if (!secure.available) throw typedError(secure.reason || 'SECURE_STORAGE_REQUIRED', 'Protected storage is unavailable.');
    if (!secureStore.exists()) throw typedError('IDENTITY_NOT_CREATED', 'IRGEZTNE Identity has not been created.');
    const state = secureStore.read();
    if (!verifyIdentityState(state)) throw typedError('IDENTITY_STATE_INVALID', 'Stored Identity failed cryptographic verification.');
    return state;
  }

  function persistMutatedState(previous, next) {
    if (!verifyIdentityState(next)) throw typedError('IDENTITY_STATE_INVALID', 'Mutated Identity state failed cryptographic verification.');
    secureStore.replace(next, { expectedIdentityId:previous.identity.identity_id });
    const reopened = secureStore.read();
    if (!verifyIdentityState(reopened) || reopened.high_water.head_hash !== next.high_water.head_hash) {
      throw typedError('IDENTITY_PERSISTENCE_VERIFY_FAILED', 'Identity mutation could not be verified after persistence.');
    }
    return reopened;
  }

  function validateRecoveryAgainstCurrent(state, header, payload) {
    const { projected, seed } = recoveryPayloadProjection(payload);
    if (projected.identity_id !== state.identity.identity_id || projected.genesis_digest !== state.identity.genesis_digest) {
      throw typedError('IDENTITY_RECOVERY_WRONG_IDENTITY', 'Recovery package belongs to a different Identity.');
    }
    if (String(payload.recovery_material.key_id) !== String(state.keys.recovery.key_id) || payload.recovery_material.public_jwk?.x !== state.keys.recovery.public_jwk?.x) {
      throw typedError('IDENTITY_RECOVERY_STALE_AUTHORITY', 'Recovery package does not contain the currently active Recovery authority.');
    }
    if (b64url(seed) !== String(state.service_subject_seed)) {
      throw typedError('IDENTITY_RECOVERY_SUBJECT_SEED_MISMATCH', 'Recovery package contains a different ServiceSubjectSeed.');
    }
    const expectedFingerprint = recoveryPackageFingerprintForPayload(header,payload);
    if (String(header.recovery_fingerprint || '') !== expectedFingerprint) {
      throw typedError('IDENTITY_RECOVERY_FINGERPRINT_MISMATCH', 'Recovery package fingerprint is invalid.');
    }
    return { projected, expectedFingerprint };
  }

  function provisionRecoveryForMain({ filePath, passphrase, scrypt } = {}) {
    const state = readVerifiedState();
    const nowSeconds = Math.floor(now()/1000);
    const pkg = createRecoveryPackage(state, passphrase, { nowSeconds, randomBytes, scrypt });
    const roundTrip = decryptRecoveryPackage(pkg, passphrase);
    validateRecoveryAgainstCurrent(state, roundTrip.header, roundTrip.payload);
    const written = writeRecoveryPackageFile(filePath, pkg, { overwrite:false });
    const next = JSON.parse(JSON.stringify(state));
    next.keys.recovery.staged_until_provisioned = false;
    next.recovery = {
      ...next.recovery,
      provisioned:true,
      restore_tested:false,
      package_fingerprint:String(pkg.recovery_fingerprint),
      provisioned_at:nowSeconds,
      restore_tested_at:null
    };
    next.status = 'RECOVERY_PROVISIONED_UNTESTED';
    const reopened = persistMutatedState(state,next);
    return {
      ...publicSummary(reopened, secureStore.status()),
      recovery_package:{
        fingerprint:String(pkg.recovery_fingerprint),
        file_name:path.basename(written.filePath),
        bytes:written.bytes,
        restore_tested:false
      }
    };
  }

  function testRecoveryPackageForMain({ filePath, passphrase } = {}) {
    const state = readVerifiedState();
    const input = readRecoveryPackageFile(filePath);
    const decoded = decryptRecoveryPackage(input.packageObject, passphrase);
    const checked = validateRecoveryAgainstCurrent(state, decoded.header, decoded.payload);
    const sectors = ['account','chat','workshop','hosting','atlas'];
    for (const sector of sectors) {
      const currentSubject = deriveServiceSubjectFromState(state, sector, 'prod', 'v1');
      const recoveredSubject = deriveSubjectFromSeed(decoded.payload.service_subject_seed, sector, 'prod', 'v1');
      if (currentSubject !== recoveredSubject) throw typedError('IDENTITY_RECOVERY_SUBJECT_CONTINUITY_FAILED', `Recovery package failed ${sector} subject continuity check.`);
    }
    const nowSeconds = Math.floor(now()/1000);
    const next = JSON.parse(JSON.stringify(state));
    next.keys.recovery.staged_until_provisioned = false;
    next.recovery = {
      ...next.recovery,
      provisioned:true,
      restore_tested:true,
      package_fingerprint:checked.expectedFingerprint,
      provisioned_at:Number(next.recovery.provisioned_at || nowSeconds),
      restore_tested_at:nowSeconds
    };
    next.status = 'READY';
    const reopened = persistMutatedState(state,next);
    return {
      ...publicSummary(reopened, secureStore.status()),
      recovery_package:{ fingerprint:checked.expectedFingerprint, file_name:path.basename(input.filePath), restore_tested:true }
    };
  }

  function restoreRecoveryPackageForMain({ filePath, passphrase } = {}) {
    const secure = secureStore.status();
    if (!secure.available) throw typedError(secure.reason || 'SECURE_STORAGE_REQUIRED', 'OS-backed protected storage is required to restore IRGEZTNE Identity.');
    if (secureStore.exists()) throw typedError('IDENTITY_ALREADY_EXISTS', 'This Workspace installation already contains an Identity. Recovery restore refuses to overwrite it.');
    const input = readRecoveryPackageFile(filePath);
    const decoded = decryptRecoveryPackage(input.packageObject, passphrase);
    const expectedFingerprint = recoveryPackageFingerprintForPayload(decoded.header, decoded.payload);
    if (String(decoded.header.recovery_fingerprint || '') !== expectedFingerprint) throw typedError('IDENTITY_RECOVERY_FINGERPRINT_MISMATCH', 'Recovery package fingerprint is invalid.');
    const restored = createRecoveryRotateState(decoded.payload, { nowSeconds:Math.floor(now()/1000) });
    restored.recovery.package_fingerprint = expectedFingerprint;
    secureStore.write(restored);
    const reopened = secureStore.read();
    if (!verifyIdentityState(reopened) || reopened.identity.identity_id !== decoded.header.identity_id) {
      throw typedError('IDENTITY_RECOVERY_RESTORE_PERSISTENCE_FAILED', 'Recovered Identity could not be verified after persistence.');
    }
    return {
      ...publicSummary(reopened, secure),
      restored:true,
      recovery_package:{ fingerprint:expectedFingerprint, file_name:path.basename(input.filePath), restore_tested:true }
    };
  }

  function deriveServiceSubjectForMain(serviceNamespace, serviceEnvironment = 'prod', subjectProfileVersion = 'v1') {
    return deriveServiceSubjectFromState(
      readVerifiedState(),
      serviceNamespace,
      serviceEnvironment,
      subjectProfileVersion
    );
  }

  function getPublicJournalForMain() {
    return publicJournalFromState(readVerifiedState());
  }


  function createAuthDelegationForMain({
    challengeId,
    challenge,
    audience,
    scopes,
    serviceEnvironment = 'prod',
    subjectProfileVersion = 'v1',
    expiresAt,
    nowSeconds = Math.floor(now() / 1000)
  } = {}) {
    const state = readVerifiedState();
    const challengeIdText = String(challengeId || '').trim();
    const challengeText = String(challenge || '').trim();
    const audienceText = String(audience || '').trim().toLowerCase();
    const requestedScopes = Array.isArray(scopes)
      ? [...new Set(scopes.map((item) => String(item || '').trim()).filter(Boolean))].sort()
      : [];
    const exp = Number(expiresAt || 0);
    if (!/^[A-Za-z0-9_-]{12,160}$/.test(challengeIdText)) {
      throw typedError('IDENTITY_CHALLENGE_INVALID', 'Identity challenge id is invalid.');
    }
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(challengeText)) {
      throw typedError('IDENTITY_CHALLENGE_INVALID', 'Identity challenge is invalid.');
    }
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(audienceText)) {
      throw typedError('IDENTITY_AUDIENCE_INVALID', 'Identity audience is invalid.');
    }
    if (!requestedScopes.length || requestedScopes.some((scope) => !/^[a-z0-9][a-z0-9._:-]{0,95}$/.test(scope))) {
      throw typedError('IDENTITY_SCOPE_INVALID', 'Identity scopes are invalid.');
    }
    if (!Number.isSafeInteger(exp) || exp <= nowSeconds || exp > nowSeconds + 600) {
      throw typedError('IDENTITY_AUTH_EXPIRY_INVALID', 'Identity authentication delegation expiry is invalid.');
    }

    const ephemeral = generateEd25519Keypair();
    const sessionHandle = b64url(crypto.randomBytes(24));
    const sector = canonicalServiceSector(audienceText, serviceEnvironment, subjectProfileVersion);
    const subject = deriveServiceSubjectFromState(
      state,
      sector.service_namespace,
      sector.service_environment,
      sector.subject_profile_version
    );
    const body = {
      domain: AUTH_DOMAIN,
      version: 1,
      identity_id: state.identity.identity_id,
      device_id: state.keys.device.device_id,
      journal: {
        recovery_epoch: state.high_water.recovery_epoch,
        sequence: state.high_water.sequence,
        head_hash: state.high_water.head_hash
      },
      service_sector: sector,
      subject,
      audience: audienceText,
      scopes: requestedScopes,
      ephemeral_public_key: ephemeral.publicJwk,
      challenge_id: challengeIdText,
      challenge: challengeText,
      environment: sector.service_environment,
      issued_at: Number(nowSeconds),
      expires_at: exp
    };
    const signature = signEd25519(
      state.keys.device.private_jwk,
      Buffer.concat([Buffer.from('IRGEZTNE_IDENTITY_AUTH_DELEGATION_V1\0', 'utf8'), encodeDeterministic(body)])
    );
    ephemeralSessions.set(sessionHandle, {
      audience: audienceText,
      subject,
      scopes: requestedScopes,
      expires_at: exp,
      private_jwk: ephemeral.privateJwk,
      public_jwk: ephemeral.publicJwk,
      next_sequence: 1
    });
    return {
      session_handle: sessionHandle,
      delegation: {
        body,
        signature: {
          role: 'DEVICE',
          algorithm: KEY_ALGORITHM,
          key_id: state.keys.device.device_id,
          signature
        }
      }
    };
  }

  function createCapabilityProofForMain(sessionHandle, {
    capability,
    method,
    path: requestPath,
    bodyDigest = '',
    requestId = b64url(crypto.randomBytes(18)),
    nowSeconds = Math.floor(now() / 1000)
  } = {}) {
    const handle = String(sessionHandle || '');
    const session = ephemeralSessions.get(handle);
    if (!session) throw typedError('IDENTITY_EPHEMERAL_SESSION_NOT_FOUND', 'Identity ephemeral service session is unavailable.');
    if (session.expires_at <= nowSeconds) {
      ephemeralSessions.delete(handle);
      throw typedError('IDENTITY_EPHEMERAL_SESSION_EXPIRED', 'Identity ephemeral service session expired.');
    }
    const capabilityText = String(capability || '').trim();
    const methodText = String(method || '').trim().toUpperCase();
    const pathText = String(requestPath || '').trim();
    if (!capabilityText || !methodText || !pathText.startsWith('/')) {
      throw typedError('IDENTITY_REQUEST_PROOF_INVALID', 'Identity request proof input is invalid.');
    }
    const sequence = session.next_sequence++;
    const capabilityDigest = b64url(sha256(Buffer.from(capabilityText, 'utf8')));
    const body = {
      domain: PROOF_DOMAIN,
      version: 1,
      audience: session.audience,
      subject: session.subject,
      method: methodText,
      path: pathText,
      body_digest: String(bodyDigest || ''),
      capability_digest: capabilityDigest,
      request_id: String(requestId),
      sequence,
      issued_at: Number(nowSeconds)
    };
    const signature = signEd25519(
      session.private_jwk,
      Buffer.concat([Buffer.from('IRGEZTNE_IDENTITY_REQUEST_PROOF_V1\0', 'utf8'), encodeDeterministic(body)])
    );
    return b64url(Buffer.from(JSON.stringify({ body, signature }), 'utf8'));
  }

  function dropServiceSessionForMain(sessionHandle) {
    return ephemeralSessions.delete(String(sessionHandle || ''));
  }

  return Object.freeze({
    getStatus,
    create,
    provisionRecoveryForMain,
    testRecoveryPackageForMain,
    restoreRecoveryPackageForMain,
    deriveServiceSubjectForMain,
    getPublicJournalForMain,
    createAuthDelegationForMain,
    createCapabilityProofForMain,
    dropServiceSessionForMain,
    protectedStorageStatus: () => secureStore.status()
  });
}

function registerIdentityIpc({ ipcMain, assertTrustedSender, getController, dialog }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('Identity IPC requires ipcMain.');
  if (typeof assertTrustedSender !== 'function') throw new Error('Identity IPC requires sender guard.');
  if (typeof getController !== 'function') throw new Error('Identity IPC requires controller factory.');

  const guarded = (fn) => async (event) => {
    assertTrustedSender(event);
    try {
      return await fn(getController());
    } catch (error) {
      return {
        ok: false,
        code: error?.code || 'IDENTITY_ERROR',
        message: String(error?.message || 'Identity operation failed.'),
        details: error?.details || null
      };
    }
  };

  // Deliberately narrow: Renderer can only ask for public status or explicitly
  // request first-time creation. No generic signing, secret access, subject seed,
  // service-subject derivation or journal mutation is exposed.
  ipcMain.handle('identity:status', guarded((controller) => controller.getStatus()));
  ipcMain.handle('identity:create', guarded((controller) => controller.create()));

  const recoveryGuarded = (fn) => async (event, payload = {}) => {
    assertTrustedSender(event);
    try { return await fn(getController(), payload || {}); }
    catch (error) { return { ok:false, code:error?.code || 'IDENTITY_RECOVERY_ERROR', message:String(error?.message || 'Identity Recovery operation failed.'), details:error?.details || null }; }
  };

  if (dialog && typeof dialog.showSaveDialog === 'function' && typeof dialog.showOpenDialog === 'function') {
    ipcMain.handle('identity:recovery:provision', recoveryGuarded(async (controller,payload) => {
      const status = controller.getStatus();
      if (!status?.exists) throw typedError('IDENTITY_NOT_CREATED', 'Create Identity before provisioning Recovery.');
      const suffix = String(status.identity_id || '').slice(0,12) || 'identity';
      const result = await dialog.showSaveDialog({
        title:'Save IRGEZTNE Recovery Package',
        defaultPath:`IRGEZTNE-Recovery-${suffix}.irgeztne-recovery.json`,
        filters:[{name:'IRGEZTNE Recovery Package',extensions:['json']}]
      });
      if (result.canceled || !result.filePath) return { ok:true, canceled:true };
      return controller.provisionRecoveryForMain({ filePath:result.filePath, passphrase:payload.passphrase });
    }));
    ipcMain.handle('identity:recovery:test', recoveryGuarded(async (controller,payload) => {
      const result = await dialog.showOpenDialog({ title:'Test IRGEZTNE Recovery Package', properties:['openFile'], filters:[{name:'IRGEZTNE Recovery Package',extensions:['json']}] });
      if (result.canceled || !result.filePaths?.[0]) return { ok:true, canceled:true };
      return controller.testRecoveryPackageForMain({ filePath:result.filePaths[0], passphrase:payload.passphrase });
    }));
    ipcMain.handle('identity:recovery:restore', recoveryGuarded(async (controller,payload) => {
      const result = await dialog.showOpenDialog({ title:'Restore IRGEZTNE Identity', properties:['openFile'], filters:[{name:'IRGEZTNE Recovery Package',extensions:['json']}] });
      if (result.canceled || !result.filePaths?.[0]) return { ok:true, canceled:true };
      return controller.restoreRecoveryPackageForMain({ filePath:result.filePaths[0], passphrase:payload.passphrase });
    }));
  }
}

module.exports = {
  createIdentityController,
  registerIdentityIpc,
  identityInternals: Object.freeze({
    LOCAL_PROFILE,
    GENESIS_DOMAIN,
    AUTH_DOMAIN,
    PROOF_DOMAIN,
    EVENT_DOMAIN,
    SERVICE_SUBJECT_PROFILE,
    JOURNAL_SERIALIZATION,
    KEY_ALGORITHM,
    base32,
    multihashSha256,
    identityIdFromAnchor,
    deviceIdFromPublicKey,
    canonicalServiceSector,
    deriveServiceSubjectFromState,
    createGenesisState,
    verifyGenesisState,
    verifyIdentityState,
    projectPublicJournal,
    recoveryPayloadProjection,
    createRecoveryRotateState,
    deriveSubjectFromSeed,
    publicJournalFromState,
    eventSigningBytes,
    eventHash
  })
};
