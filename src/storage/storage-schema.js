'use strict';

const SCHEMA_VERSION = 1;

function ensureSchema(db) {
  if (!db || typeof db.exec !== 'function') {
    throw new Error('Storage schema requires an opened SQLite database.');
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS storage_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS module_state (
      module_id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspace_layout (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webstudio_sites (
      site_id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webstudio_pages (
      site_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (site_id, page_id)
    );

    CREATE TABLE IF NOT EXISTS publish_profiles (
      provider_id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS encrypted_secrets (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      preview TEXT DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (scope, key)
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);

  return { ok: true, schemaVersion: SCHEMA_VERSION };
}

module.exports = {
  SCHEMA_VERSION,
  ensureSchema
};
