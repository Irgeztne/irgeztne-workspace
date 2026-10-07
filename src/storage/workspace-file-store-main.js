'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pipeline } = require('stream/promises');

const SOURCE_KINDS = new Set(['computer', 'generated', 'imported', 'legacy']);

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function cleanText(value, field, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > maxLength) {
    throw new TypeError(`Invalid ${field}`);
  }
  return text;
}

function cleanSourceKind(value) {
  const kind = String(value || 'computer').trim().toLowerCase();
  if (!SOURCE_KINDS.has(kind)) {
    throw new TypeError('Invalid source kind');
  }
  return kind;
}

function blobIdForSha256(sha256) {
  return `blob_${sha256}`;
}

function storageRelpathForSha256(sha256) {
  return path.posix.join(
    'files',
    'blobs',
    sha256.slice(0, 2),
    `${sha256}.blob`
  );
}

function resolveInternalPath(dataDir, relpath) {
  const root = path.resolve(dataDir);
  const target = path.resolve(root, ...String(relpath || '').split('/'));

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Workspace file path escaped the data directory');
  }

  return target;
}

async function unlinkIfExists(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
}

async function copyToTempAndHash(sourcePath, tempPath) {
  const hash = crypto.createHash('sha256');
  const source = fs.createReadStream(sourcePath);

  source.on('data', (chunk) => {
    hash.update(chunk);
  });

  await pipeline(
    source,
    fs.createWriteStream(tempPath, {
      flags: 'wx',
      mode: 0o600
    })
  );

  const handle = await fsp.open(tempPath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }

  return hash.digest('hex');
}

async function hashFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const source = fs.createReadStream(filePath);

  for await (const chunk of source) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

function createWorkspaceFileStore(options) {
  options = options || {};

  const db = options.db;
  const dataDir = path.resolve(String(options.dataDir || ''));

  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('Workspace file store requires an opened SQLite database');
  }

  if (!dataDir) {
    throw new TypeError('Workspace file store requires dataDir');
  }

  const rootDir = path.join(dataDir, 'files');
  const blobsDir = path.join(rootDir, 'blobs');
  const tempDir = path.join(rootDir, 'tmp');

  ensureDir(blobsDir);
  ensureDir(tempDir);

  const q = {
    blobBySha: db.prepare(`
      SELECT blob_id, sha256, size_bytes, storage_relpath, state,
             created_at, verified_at, orphaned_at
      FROM workspace_file_blobs
      WHERE sha256 = ?
    `),

    blobById: db.prepare(`
      SELECT blob_id, sha256, size_bytes, storage_relpath, state,
             created_at, verified_at, orphaned_at
      FROM workspace_file_blobs
      WHERE blob_id = ?
    `),

    insertBlob: db.prepare(`
      INSERT OR IGNORE INTO workspace_file_blobs(
        blob_id, sha256, size_bytes, storage_relpath,
        state, created_at, verified_at, orphaned_at
      )
      VALUES (?, ?, ?, ?, 'ready', ?, ?, '')
    `),

    markBlobReady: db.prepare(`
      UPDATE workspace_file_blobs
      SET state = 'ready',
          size_bytes = ?,
          storage_relpath = ?,
          verified_at = ?,
          orphaned_at = ''
      WHERE blob_id = ?
    `),

    markBlobOrphaned: db.prepare(`
      UPDATE workspace_file_blobs
      SET state = 'orphaned',
          orphaned_at = ?
      WHERE blob_id = ?
    `),

    markBlobQuarantined: db.prepare(`
      UPDATE workspace_file_blobs
      SET state = 'quarantined'
      WHERE blob_id = ?
    `),

    insertFile: db.prepare(`
      INSERT INTO workspace_files(
        file_id, blob_id, original_name, display_name,
        mime_type, extension, source_kind, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),

    fileById: db.prepare(`
      SELECT
        f.file_id,
        f.blob_id,
        f.original_name,
        f.display_name,
        f.mime_type,
        f.extension,
        f.source_kind,
        f.created_at,
        f.updated_at,
        b.sha256,
        b.size_bytes,
        b.storage_relpath,
        b.state AS blob_state
      FROM workspace_files f
      JOIN workspace_file_blobs b ON b.blob_id = f.blob_id
      WHERE f.file_id = ?
    `),

    listFiles: db.prepare(`
      SELECT
        f.file_id,
        f.blob_id,
        f.original_name,
        f.display_name,
        f.mime_type,
        f.extension,
        f.source_kind,
        f.created_at,
        f.updated_at,
        b.sha256,
        b.size_bytes,
        b.storage_relpath,
        b.state AS blob_state
      FROM workspace_files f
      JOIN workspace_file_blobs b ON b.blob_id = f.blob_id
      ORDER BY f.updated_at DESC, f.created_at DESC
      LIMIT ?
    `),

    insertRef: db.prepare(`
      INSERT OR IGNORE INTO workspace_file_refs(
        ref_id, file_id, owner_type, owner_id, role, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `),

    refByUnique: db.prepare(`
      SELECT ref_id, file_id, owner_type, owner_id, role, created_at
      FROM workspace_file_refs
      WHERE file_id = ?
        AND owner_type = ?
        AND owner_id = ?
        AND role = ?
    `),

    refById: db.prepare(`
      SELECT ref_id, file_id, owner_type, owner_id, role, created_at
      FROM workspace_file_refs
      WHERE ref_id = ?
    `),

    deleteRefById: db.prepare(`
      DELETE FROM workspace_file_refs
      WHERE ref_id = ?
    `),

    refCountForFile: db.prepare(`
      SELECT COUNT(*) AS count
      FROM workspace_file_refs
      WHERE file_id = ?
    `),

    deleteFile: db.prepare(`
      DELETE FROM workspace_files
      WHERE file_id = ?
    `),

    fileCountForBlob: db.prepare(`
      SELECT COUNT(*) AS count
      FROM workspace_files
      WHERE blob_id = ?
    `),

    orphanBlobs: db.prepare(`
      SELECT blob_id, sha256, size_bytes, storage_relpath,
             state, created_at, verified_at, orphaned_at
      FROM workspace_file_blobs
      WHERE state = 'orphaned'
      ORDER BY orphaned_at ASC
    `),

    deleteBlob: db.prepare(`
      DELETE FROM workspace_file_blobs
      WHERE blob_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM workspace_files
          WHERE workspace_files.blob_id = workspace_file_blobs.blob_id
        )
    `),

    countBlobs: db.prepare(`
      SELECT COUNT(*) AS count,
             COALESCE(SUM(size_bytes), 0) AS bytes
      FROM workspace_file_blobs
    `),

    countReadyBlobs: db.prepare(`
      SELECT COUNT(*) AS count,
             COALESCE(SUM(size_bytes), 0) AS bytes
      FROM workspace_file_blobs
      WHERE state = 'ready'
    `),

    countFiles: db.prepare(`
      SELECT COUNT(*) AS count
      FROM workspace_files
    `),

    countRefs: db.prepare(`
      SELECT COUNT(*) AS count
      FROM workspace_file_refs
    `)
  };

  const createLogicalFile = db.transaction((input) => {
    const stamp = nowIso();
    const blobId = blobIdForSha256(input.sha256);

    q.insertBlob.run(
      blobId,
      input.sha256,
      input.sizeBytes,
      input.storageRelpath,
      stamp,
      stamp
    );

    const blob = q.blobBySha.get(input.sha256);
    if (!blob) {
      throw new Error('Workspace blob metadata was not created');
    }

    if (Number(blob.size_bytes) !== Number(input.sizeBytes)) {
      q.markBlobQuarantined.run(blob.blob_id);
      const error = new Error('Workspace blob size mismatch');
      error.code = 'WORKSPACE_BLOB_SIZE_MISMATCH';
      throw error;
    }

    q.markBlobReady.run(
      input.sizeBytes,
      input.storageRelpath,
      stamp,
      blob.blob_id
    );

    const fileId = `file_${crypto.randomUUID().replace(/-/g, '')}`;
    const refId = `ref_${crypto.randomUUID().replace(/-/g, '')}`;

    q.insertFile.run(
      fileId,
      blob.blob_id,
      input.originalName,
      input.displayName,
      input.mimeType,
      input.extension,
      input.sourceKind,
      stamp,
      stamp
    );

    q.insertRef.run(
      refId,
      fileId,
      input.ownerType,
      input.ownerId,
      input.role,
      stamp
    );

    return {
      fileId,
      blobId: blob.blob_id,
      refId
    };
  });

  const attachExistingFileTx = db.transaction((input) => {
    const file = q.fileById.get(input.fileId);
    if (!file) {
      const error = new Error('Workspace file was not found');
      error.code = 'WORKSPACE_FILE_NOT_FOUND';
      throw error;
    }

    if (file.blob_state !== 'ready') {
      const error = new Error('Workspace file blob is not ready');
      error.code = 'WORKSPACE_BLOB_NOT_READY';
      throw error;
    }

    const existing = q.refByUnique.get(
      input.fileId,
      input.ownerType,
      input.ownerId,
      input.role
    );

    if (existing) {
      return {
        created: false,
        ref: existing
      };
    }

    const refId = `ref_${crypto.randomUUID().replace(/-/g, '')}`;
    const stamp = nowIso();

    q.insertRef.run(
      refId,
      input.fileId,
      input.ownerType,
      input.ownerId,
      input.role,
      stamp
    );

    return {
      created: true,
      ref: q.refById.get(refId)
    };
  });

  const removeReferenceTx = db.transaction((refId) => {
    const ref = q.refById.get(refId);
    if (!ref) {
      return {
        removed: false,
        orphanedBlobId: null
      };
    }

    const file = q.fileById.get(ref.file_id);
    q.deleteRefById.run(refId);

    let deletedFileId = null;
    let orphanedBlobId = null;

    if (file) {
      const remainingRefs = Number(q.refCountForFile.get(file.file_id).count || 0);

      if (remainingRefs === 0) {
        q.deleteFile.run(file.file_id);
        deletedFileId = file.file_id;

        const remainingFiles = Number(q.fileCountForBlob.get(file.blob_id).count || 0);

        if (remainingFiles === 0) {
          q.markBlobOrphaned.run(nowIso(), file.blob_id);
          orphanedBlobId = file.blob_id;
        }
      }
    }

    return {
      removed: true,
      deletedFileId,
      orphanedBlobId
    };
  });

  async function importFromPath(payload) {
    payload = payload || {};

    const sourcePath = path.resolve(
      cleanText(payload.sourcePath, 'source path', 8192)
    );

    const stat = await fsp.stat(sourcePath);

    if (!stat.isFile()) {
      const error = new TypeError('Workspace import source must be a regular file');
      error.code = 'WORKSPACE_SOURCE_NOT_FILE';
      throw error;
    }

    const originalName = path.basename(
      String(payload.originalName || path.basename(sourcePath))
    );

    const displayName = String(payload.displayName || originalName).trim() || originalName;
    const ownerType = cleanText(payload.ownerType, 'owner type', 120);
    const ownerId = cleanText(payload.ownerId, 'owner id', 300);
    const role = cleanText(payload.role || 'attachment', 'role', 120);
    const sourceKind = cleanSourceKind(payload.sourceKind);
    const mimeType = String(payload.mimeType || 'application/octet-stream')
      .trim()
      .slice(0, 255) || 'application/octet-stream';

    const extension = path.extname(originalName)
      .toLowerCase()
      .replace(/^\./, '')
      .slice(0, 40);

    const tempName =
      `import-${process.pid}-${Date.now()}-${crypto.randomUUID()}.tmp`;

    const tempPath = path.join(tempDir, tempName);

    let sha256 = '';

    try {
      sha256 = await copyToTempAndHash(sourcePath, tempPath);

      const storageRelpath = storageRelpathForSha256(sha256);
      const targetPath = resolveInternalPath(dataDir, storageRelpath);

      ensureDir(path.dirname(targetPath));

      let reusedPhysicalBlob = false;

      try {
        await fsp.link(tempPath, targetPath);
      } catch (error) {
        if (error && error.code === 'EEXIST') {
          reusedPhysicalBlob = true;
        } else {
          throw error;
        }
      }

      await unlinkIfExists(tempPath);

      const targetStat = await fsp.stat(targetPath);

      if (!targetStat.isFile() || Number(targetStat.size) !== Number(stat.size)) {
        const known = q.blobBySha.get(sha256);
        if (known) q.markBlobQuarantined.run(known.blob_id);

        const error = new Error('Workspace blob integrity check failed');
        error.code = 'WORKSPACE_BLOB_INTEGRITY_FAILED';
        throw error;
      }

      if (reusedPhysicalBlob) {
        const existingSha256 = await hashFileSha256(targetPath);

        if (existingSha256 !== sha256) {
          const known = q.blobBySha.get(sha256);
          if (known) q.markBlobQuarantined.run(known.blob_id);

          const error = new Error('Existing Workspace blob failed SHA-256 verification');
          error.code = 'WORKSPACE_BLOB_HASH_MISMATCH';
          throw error;
        }
      }

      const ids = createLogicalFile({
        sha256,
        sizeBytes: stat.size,
        storageRelpath,
        originalName,
        displayName,
        mimeType,
        extension,
        sourceKind,
        ownerType,
        ownerId,
        role
      });

      return {
        ok: true,
        file: getFile(ids.fileId),
        ref: q.refById.get(ids.refId),
        blob: {
          blobId: ids.blobId,
          sha256,
          sizeBytes: stat.size,
          reusedPhysicalBlob
        }
      };
    } catch (error) {
      await unlinkIfExists(tempPath);
      throw error;
    }
  }

  function getFile(fileId) {
    const id = cleanText(fileId, 'file id', 200);
    const row = q.fileById.get(id);

    if (!row) return null;

    return {
      fileId: row.file_id,
      blobId: row.blob_id,
      originalName: row.original_name,
      displayName: row.display_name,
      mimeType: row.mime_type,
      extension: row.extension,
      sourceKind: row.source_kind,
      sizeBytes: Number(row.size_bytes || 0),
      sha256: row.sha256,
      blobState: row.blob_state,
      storageRelpath: row.storage_relpath,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function rowToPublicFile(row) {
    if (!row) return null;
    return {
      fileId: row.file_id,
      blobId: row.blob_id,
      originalName: row.original_name,
      displayName: row.display_name,
      mimeType: row.mime_type,
      extension: row.extension,
      sourceKind: row.source_kind,
      sizeBytes: Number(row.size_bytes || 0),
      sha256: row.sha256,
      blobState: row.blob_state,
      storageRelpath: row.storage_relpath,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function listFiles(options) {
    options = options || {};
    const requested = Number(options.limit || 5000);
    const limit = Math.max(1, Math.min(10000, Number.isFinite(requested) ? requested : 5000));
    return q.listFiles.all(limit).map(rowToPublicFile);
  }

  function attachExistingFile(payload) {
    payload = payload || {};

    return attachExistingFileTx({
      fileId: cleanText(payload.fileId, 'file id', 200),
      ownerType: cleanText(payload.ownerType, 'owner type', 120),
      ownerId: cleanText(payload.ownerId, 'owner id', 300),
      role: cleanText(payload.role || 'attachment', 'role', 120)
    });
  }

  function removeReference(refId) {
    return removeReferenceTx(
      cleanText(refId, 'reference id', 200)
    );
  }

  async function collectOrphans(options) {
    options = options || {};

    const olderThanMs = Math.max(
      0,
      Number(options.olderThanMs == null ? 24 * 60 * 60 * 1000 : options.olderThanMs)
    );

    const now = Date.now();
    const deleted = [];

    for (const blob of q.orphanBlobs.all()) {
      const orphanedAt = Date.parse(blob.orphaned_at || '');

      if (
        olderThanMs > 0 &&
        (!Number.isFinite(orphanedAt) || now - orphanedAt < olderThanMs)
      ) {
        continue;
      }

      const remainingFiles = Number(
        q.fileCountForBlob.get(blob.blob_id).count || 0
      );

      if (remainingFiles !== 0) continue;

      const targetPath = resolveInternalPath(
        dataDir,
        blob.storage_relpath
      );

      await unlinkIfExists(targetPath);

      const result = q.deleteBlob.run(blob.blob_id);

      if (result.changes > 0) {
        deleted.push({
          blobId: blob.blob_id,
          sha256: blob.sha256,
          sizeBytes: Number(blob.size_bytes || 0)
        });
      }
    }

    return {
      ok: true,
      deleted,
      deletedCount: deleted.length,
      deletedBytes: deleted.reduce(
        (sum, item) => sum + item.sizeBytes,
        0
      )
    };
  }

  function status() {
    const all = q.countBlobs.get();
    const ready = q.countReadyBlobs.get();

    return {
      ok: true,
      rootDir,
      blobs: Number(all.count || 0),
      blobBytes: Number(all.bytes || 0),
      readyBlobs: Number(ready.count || 0),
      readyBytes: Number(ready.bytes || 0),
      files: Number(q.countFiles.get().count || 0),
      refs: Number(q.countRefs.get().count || 0)
    };
  }

  return {
    status,
    importFromPath,
    getFile,
    listFiles,
    attachExistingFile,
    removeReference,
    collectOrphans
  };
}

module.exports = {
  createWorkspaceFileStore
};
