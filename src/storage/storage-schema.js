'use strict';

const SCHEMA_VERSION = 2;

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


    /* IRGEZTNE_WORKSPACE_FILE_STORE_SCHEMA_V1
       Physical bytes -> logical files -> usage references.
       Blobs are content-deduplicated; consumers never own duplicate bytes. */

    CREATE TABLE IF NOT EXISTS workspace_file_blobs (
      blob_id TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64),
      size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
      storage_relpath TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL DEFAULT 'ready'
        CHECK (state IN ('ready', 'orphaned', 'quarantined')),
      created_at TEXT NOT NULL,
      verified_at TEXT DEFAULT '',
      orphaned_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS workspace_files (
      file_id TEXT PRIMARY KEY,
      blob_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      extension TEXT DEFAULT '',
      source_kind TEXT NOT NULL DEFAULT 'computer'
        CHECK (source_kind IN ('computer', 'generated', 'imported', 'legacy')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (blob_id)
        REFERENCES workspace_file_blobs(blob_id)
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS workspace_file_refs (
      ref_id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'attachment',
      created_at TEXT NOT NULL,
      FOREIGN KEY (file_id)
        REFERENCES workspace_files(file_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workspace_files_blob
      ON workspace_files(blob_id);

    CREATE INDEX IF NOT EXISTS idx_workspace_file_refs_file
      ON workspace_file_refs(file_id);

    CREATE INDEX IF NOT EXISTS idx_workspace_file_refs_owner
      ON workspace_file_refs(owner_type, owner_id);

    CREATE UNIQUE INDEX IF NOT EXISTS ux_workspace_file_refs_owner_file_role
      ON workspace_file_refs(owner_type, owner_id, file_id, role);

    INSERT OR IGNORE INTO storage_migrations(id, applied_at, note)
    VALUES (
      'workspace-file-store-schema-v1',
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
      'Content-addressed Workspace file store: blobs, logical files, references'
    );

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);

  return { ok: true, schemaVersion: SCHEMA_VERSION };
}

module.exports = {
  SCHEMA_VERSION,
  ensureSchema
};
