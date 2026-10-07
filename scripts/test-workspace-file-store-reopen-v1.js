'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { ensureSchema } = require('../src/storage/storage-schema');
const { createWorkspaceFileStore } = require('../src/storage/workspace-file-store-main');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-file-store-reopen-'));
  const dataDir = path.join(root, 'data');
  const sourceDir = path.join(root, 'sources');
  const dbPath = path.join(dataDir, 'workspace.db');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  const sourcePath = path.join(sourceDir, 'persistent-video.bin');
  const bytes = Buffer.from(
    'IRGEZTNE FILE STORE REOPEN CONTRACT\n'.repeat(8192),
    'utf8'
  );

  fs.writeFileSync(sourcePath, bytes);

  let db = null;

  try {
    db = new Database(dbPath);
    ensureSchema(db);

    let store = createWorkspaceFileStore({ db, dataDir });

    const first = await store.importFromPath({
      sourcePath,
      originalName: 'persistent-video.bin',
      mimeType: 'application/octet-stream',
      ownerType: 'webstudio',
      ownerId: 'site-A',
      role: 'media'
    });

    assert.equal(first.ok, true);
    assert.equal(first.blob.reusedPhysicalBlob, false);

    const firstFileId = first.file.fileId;
    const firstBlobId = first.blob.blobId;
    const firstRelpath = first.file.storageRelpath;

    let status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 1);
    assert.equal(status.refs, 1);

    db.close();
    db = null;
    store = null;

    console.log('PASS initial store closed cleanly');

    db = new Database(dbPath);
    ensureSchema(db);

    store = createWorkspaceFileStore({ db, dataDir });

    const restored = store.getFile(firstFileId);

    assert.ok(restored);
    assert.equal(restored.fileId, firstFileId);
    assert.equal(restored.blobId, firstBlobId);
    assert.equal(restored.sizeBytes, bytes.length);
    assert.equal(restored.blobState, 'ready');

    const physicalPath = path.resolve(
      dataDir,
      ...firstRelpath.split('/')
    );

    assert.equal(fs.existsSync(physicalPath), true);
    assert.deepEqual(fs.readFileSync(physicalPath), bytes);

    status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 1);
    assert.equal(status.refs, 1);

    console.log('PASS blob/file/ref survive database reopen');

    const second = await store.importFromPath({
      sourcePath,
      originalName: 'persistent-video-copy.bin',
      mimeType: 'application/octet-stream',
      ownerType: 'presentation',
      ownerId: 'presentation-B',
      role: 'media'
    });

    assert.equal(second.blob.blobId, firstBlobId);
    assert.equal(second.blob.reusedPhysicalBlob, true);

    status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 2);
    assert.equal(status.refs, 2);
    assert.equal(status.blobBytes, bytes.length);

    console.log('PASS deduplication still works after reopen');

    db.close();
    db = null;

    db = new Database(dbPath);
    ensureSchema(db);

    store = createWorkspaceFileStore({ db, dataDir });

    status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 2);
    assert.equal(status.refs, 2);

    assert.ok(store.getFile(firstFileId));
    assert.equal(fs.existsSync(physicalPath), true);

    console.log('PASS second reopen preserves post-restart changes');
    console.log('WORKSPACE FILE STORE REOPEN CONTRACT V1: PASS');
  } finally {
    if (db) {
      try { db.close(); } catch (_) {}
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('WORKSPACE FILE STORE REOPEN CONTRACT V1: FAIL');
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
