'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { ensureSchema } = require('./storage-schema');
const { createSecretTools } = require('./storage-secrets');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function toJson(value) {
  return JSON.stringify(value == null ? null : value);
}

function fromJson(value, fallback) {
  try { return JSON.parse(String(value || 'null')); } catch (_) { return fallback; }
}

function defaultDataDir(app) {
  if (app && app.isPackaged && typeof app.getPath === 'function') {
    return path.join(app.getPath('userData'), 'data');
  }
  return path.join(process.cwd(), 'data');
}

function createStorageCore(options) {
  options = options || {};
  const app = options.app || null;
  const dataDir = options.dataDir || defaultDataDir(app);
  const dbPath = options.dbPath || path.join(dataDir, 'irgeztne-workspace.db');

  ensureDir(path.dirname(dbPath));

  const db = new Database(dbPath);
  const schema = ensureSchema(db);
  const secretTools = createSecretTools({
    safeStorage: options.safeStorage,
    dataDir,
    secretKeyPath: path.join(dataDir, 'storage-secret.key')
  });

  const statements = {
    kvGet: db.prepare('SELECT value FROM app_kv WHERE key=?'),
    kvSet: db.prepare(`INSERT INTO app_kv(key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`),
    moduleGet: db.prepare('SELECT value FROM module_state WHERE module_id=?'),
    moduleSet: db.prepare(`INSERT INTO module_state(module_id, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(module_id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`),
    prefGet: db.prepare('SELECT value FROM app_preferences WHERE key=?'),
    prefSet: db.prepare(`INSERT INTO app_preferences(key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`),
    layoutGet: db.prepare('SELECT value FROM workspace_layout WHERE key=?'),
    layoutSet: db.prepare(`INSERT INTO workspace_layout(key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`),
    secretGet: db.prepare('SELECT encrypted_value, preview FROM encrypted_secrets WHERE scope=? AND key=?'),
    secretSet: db.prepare(`INSERT INTO encrypted_secrets(scope, key, encrypted_value, preview, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(scope, key) DO UPDATE SET encrypted_value=excluded.encrypted_value, preview=excluded.preview, updated_at=excluded.updated_at`),
    secretDelete: db.prepare('DELETE FROM encrypted_secrets WHERE scope=? AND key=?')
  };

  function getJson(statement, key, fallback) {
    const row = statement.get(String(key || ''));
    return row ? fromJson(row.value, fallback) : fallback;
  }

  function setJson(statement, key, value) {
    statement.run(String(key || ''), toJson(value), nowIso());
    return { ok: true };
  }

  return {
    status() {
      return { ok: true, dbPath, dataDir, schemaVersion: schema.schemaVersion, secretMode: secretTools.mode };
    },
    get(key, fallback) { return getJson(statements.kvGet, key, fallback); },
    set(key, value) { return setJson(statements.kvSet, key, value); },
    getModuleState(moduleId, fallback) { return getJson(statements.moduleGet, moduleId, fallback); },
    setModuleState(moduleId, value) { return setJson(statements.moduleSet, moduleId, value); },
    getPreference(key, fallback) { return getJson(statements.prefGet, key, fallback); },
    setPreference(key, value) { return setJson(statements.prefSet, key, value); },
    getLayout(key, fallback) { return getJson(statements.layoutGet, key, fallback); },
    setLayout(key, value) { return setJson(statements.layoutSet, key, value); },
    saveSecret(scope, key, value) {
      const text = String(value || '');
      if (!text) return { ok: false, message: 'Empty secret was not saved.' };
      statements.secretSet.run(String(scope || 'default'), String(key || 'token'), secretTools.encryptString(text), secretTools.secretPreview(text), nowIso());
      return { ok: true, preview: secretTools.secretPreview(text) };
    },
    hasSecret(scope, key) {
      const row = statements.secretGet.get(String(scope || 'default'), String(key || 'token'));
      return !!(row && row.encrypted_value);
    },
    previewSecret(scope, key) {
      const row = statements.secretGet.get(String(scope || 'default'), String(key || 'token'));
      return row && row.preview ? row.preview : '';
    },
    readSecret(scope, key) {
      const row = statements.secretGet.get(String(scope || 'default'), String(key || 'token'));
      return row && row.encrypted_value ? secretTools.decryptString(row.encrypted_value) : '';
    },
    clearSecret(scope, key) {
      statements.secretDelete.run(String(scope || 'default'), String(key || 'token'));
      return { ok: true };
    },
    close() { db.close(); }
  };
}

module.exports = { createStorageCore };
