'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');

function cleanString(value, max = 4096) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function normalizePort(value, fallback) {
  const raw = cleanString(value, 16);
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535');
  }
  return port;
}

function normalizeRemoteRoot(value) {
  let raw = cleanString(value || '/', 2048).replace(/\\/g, '/');
  if (!raw) raw = '/';
  if (raw.includes('\0')) throw new Error('Remote path is invalid');
  const absolute = raw.startsWith('/');
  const pieces = raw.split('/').filter(Boolean);
  if (pieces.some((part) => part === '..')) throw new Error('Remote path must not contain ..');
  const normalized = pieces.filter((part) => part !== '.').join('/');
  if (!normalized) return absolute ? '/' : '.';
  return (absolute ? '/' : '') + normalized;
}

function normalizeEntryName(value) {
  const raw = cleanString(value, 4096).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.endsWith('/')) return '';
  const pieces = raw.split('/').filter(Boolean);
  if (!pieces.length || pieces.some((part) => part === '.' || part === '..')) return '';
  return pieces.join('/');
}

function remoteJoin(root, relativeName) {
  const safeRoot = normalizeRemoteRoot(root);
  const safeName = normalizeEntryName(relativeName);
  if (!safeName) throw new Error('Remote file name is invalid');
  if (safeRoot === '/') return '/' + safeName;
  if (safeRoot === '.') return safeName;
  return safeRoot.replace(/\/$/, '') + '/' + safeName;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function manifestFromEntries(entries) {
  const manifest = { version: 1, files: {} };
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = normalizeEntryName(entry && entry.name);
    if (!name) continue;
    const buffer = Buffer.isBuffer(entry.buffer) ? entry.buffer : Buffer.from(entry.buffer || '');
    manifest.files[name] = { sha256: sha256(buffer), size: buffer.length };
  }
  return manifest;
}

function diffManifests(previous, current) {
  const prev = previous && previous.files && typeof previous.files === 'object' ? previous.files : {};
  const next = current && current.files && typeof current.files === 'object' ? current.files : {};
  const upload = [];
  const remove = [];
  const unchanged = [];

  Object.keys(next).sort().forEach((name) => {
    const before = prev[name];
    const after = next[name];
    if (!before || before.sha256 !== after.sha256 || Number(before.size) !== Number(after.size)) upload.push(name);
    else unchanged.push(name);
  });

  Object.keys(prev).sort().forEach((name) => {
    if (!Object.prototype.hasOwnProperty.call(next, name)) remove.push(name);
  });

  remove.sort((a, b) => b.split('/').length - a.split('/').length || b.localeCompare(a));
  return { upload, remove, unchanged };
}

function targetIdentity(providerId, config, siteKey) {
  const provider = cleanString(providerId, 32).toLowerCase();
  const identity = {
    provider,
    host: cleanString(config && config.host, 512).toLowerCase(),
    port: cleanString(config && config.port, 16),
    username: cleanString(config && config.username, 512),
    remotePath: normalizeRemoteRoot(config && config.remotePath || '/'),
    protocol: cleanString(config && config.protocol, 32).toLowerCase(),
    siteKey: cleanString(siteKey || 'default', 512)
  };
  return crypto.createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}

function missingDependencyMessage(name) {
  return `Missing publishing dependency: ${name}. Run npm install in the Workspace project.`;
}

function loadBasicFtp() {
  try { return require('basic-ftp'); }
  catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') throw new Error(missingDependencyMessage('basic-ftp'));
    throw error;
  }
}

function loadSftpClient() {
  try { return require('ssh2-sftp-client'); }
  catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') throw new Error(missingDependencyMessage('ssh2-sftp-client'));
    throw error;
  }
}

function ftpConnectionOptions(config) {
  const protocol = cleanString(config && config.protocol || 'ftps', 32).toLowerCase();
  const implicit = protocol === 'ftps-implicit';
  const secure = implicit ? 'implicit' : protocol === 'ftps';
  return {
    host: cleanString(config && config.host, 512),
    port: normalizePort(config && config.port, implicit ? 990 : 21),
    user: cleanString(config && config.username, 512),
    password: String(config && config.password || ''),
    secure
  };
}

function sftpConnectionOptions(config) {
  return {
    host: cleanString(config && config.host, 512),
    port: normalizePort(config && config.port, 22),
    username: cleanString(config && config.username, 512),
    password: String(config && config.password || ''),
    readyTimeout: 15000
  };
}

function assertConnectionFields(config, providerId) {
  if (!cleanString(config && config.host, 512)) throw new Error('Host is required');
  if (!cleanString(config && config.username, 512)) throw new Error('Username is required');
  if (!String(config && config.password || '')) throw new Error('Password is required');
  normalizeRemoteRoot(config && config.remotePath || '/');
  if (providerId === 'ftp') ftpConnectionOptions(config);
  if (providerId === 'sftp') sftpConnectionOptions(config);
}

async function testFtpConnection(config) {
  assertConnectionFields(config, 'ftp');
  const { Client } = loadBasicFtp();
  const client = new Client(15000);
  client.ftp.verbose = false;
  try {
    await client.access(ftpConnectionOptions(config));
    const root = normalizeRemoteRoot(config.remotePath || '/');
    if (root !== '.') await client.cd(root);
    const pwd = await client.pwd();
    return { ok: true, remotePath: pwd || root };
  } finally {
    client.close();
  }
}

async function testSftpConnection(config) {
  assertConnectionFields(config, 'sftp');
  const SftpClient = loadSftpClient();
  const client = new SftpClient('IRGEZTNE Workspace');
  try {
    await client.connect(sftpConnectionOptions(config));
    const root = normalizeRemoteRoot(config.remotePath || '/');
    const exists = await client.exists(root);
    if (!exists) throw new Error(`Remote path does not exist: ${root}`);
    if (exists !== 'd') throw new Error(`Remote path is not a directory: ${root}`);
    return { ok: true, remotePath: root };
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

async function withTempFile(buffer, name, fn) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'irgeztne-publish-'));
  try {
    const local = path.join(dir, path.basename(name || 'upload.bin'));
    await fsp.writeFile(local, buffer);
    return await fn(local);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function publishFtp(config, entriesByName, plan) {
  assertConnectionFields(config, 'ftp');
  const { Client } = loadBasicFtp();
  const client = new Client(20000);
  client.ftp.verbose = false;
  const root = normalizeRemoteRoot(config.remotePath || '/');
  try {
    await client.access(ftpConnectionOptions(config));
    for (const name of plan.upload) {
      const entry = entriesByName[name];
      if (!entry) throw new Error(`Build entry is missing: ${name}`);
      const remoteFile = remoteJoin(root, name);
      const remoteDir = path.posix.dirname(remoteFile);
      const remoteBase = path.posix.basename(remoteFile);
      await client.ensureDir(remoteDir);
      await withTempFile(entry.buffer, remoteBase, async (localPath) => {
        await client.uploadFrom(localPath, remoteBase);
      });
    }
    for (const name of plan.remove) {
      const remoteFile = remoteJoin(root, name);
      try { await client.remove(remoteFile, true); } catch (_) {}
    }
  } finally {
    client.close();
  }
}

async function publishSftp(config, entriesByName, plan) {
  assertConnectionFields(config, 'sftp');
  const SftpClient = loadSftpClient();
  const client = new SftpClient('IRGEZTNE Workspace');
  const root = normalizeRemoteRoot(config.remotePath || '/');
  try {
    await client.connect(sftpConnectionOptions(config));
    for (const name of plan.upload) {
      const entry = entriesByName[name];
      if (!entry) throw new Error(`Build entry is missing: ${name}`);
      const remoteFile = remoteJoin(root, name);
      const remoteDir = path.posix.dirname(remoteFile);
      const exists = await client.exists(remoteDir);
      if (!exists) await client.mkdir(remoteDir, true);
      await client.put(entry.buffer, remoteFile);
    }
    for (const name of plan.remove) {
      const remoteFile = remoteJoin(root, name);
      try {
        const exists = await client.exists(remoteFile);
        if (exists && exists !== 'd') await client.delete(remoteFile, true);
      } catch (_) {}
    }
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

async function testConnection(providerId, config) {
  if (providerId === 'ftp') return testFtpConnection(config);
  if (providerId === 'sftp') return testSftpConnection(config);
  throw new Error('Unsupported remote publishing provider');
}

async function publish(providerId, config, entries, previousManifest) {
  assertConnectionFields(config, providerId);
  const normalizedEntries = [];
  const entriesByName = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = normalizeEntryName(entry && entry.name);
    if (!name) continue;
    const buffer = Buffer.isBuffer(entry.buffer) ? entry.buffer : Buffer.from(entry.buffer || '');
    const normalized = { name, buffer };
    normalizedEntries.push(normalized);
    entriesByName[name] = normalized;
  }
  const currentManifest = manifestFromEntries(normalizedEntries);
  const plan = diffManifests(previousManifest, currentManifest);
  if (providerId === 'ftp') await publishFtp(config, entriesByName, plan);
  else if (providerId === 'sftp') await publishSftp(config, entriesByName, plan);
  else throw new Error('Unsupported remote publishing provider');
  return { currentManifest, plan };
}

module.exports = {
  normalizePort,
  normalizeRemoteRoot,
  normalizeEntryName,
  remoteJoin,
  manifestFromEntries,
  diffManifests,
  targetIdentity,
  testConnection,
  publish
};
