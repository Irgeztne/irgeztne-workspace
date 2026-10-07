'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { ensureSchema } = require('../src/storage/storage-schema');
const { createWorkspaceFileStore } = require('../src/storage/workspace-file-store-main');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-file-store-v1-'));
  const dataDir = path.join(root, 'data');
  const sourceDir = path.join(root, 'sources');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });

  const db = new Database(path.join(dataDir, 'contract.db'));

  try {
    const schema = ensureSchema(db);
    assert.equal(schema.schemaVersion, 2);
    assert.equal(db.pragma('user_version', { simple: true }), 2);
    console.log('PASS schema v2');

    const store = createWorkspaceFileStore({ db, dataDir });

    const bytes = Buffer.from(
      'IRGEZTNE WORKSPACE FILE STORE CONTRACT\n'.repeat(4096),
      'utf8'
    );

    const sourceA = path.join(sourceDir, 'camel-a.bin');
    const sourceB = path.join(sourceDir, 'camel-b.bin');

    fs.writeFileSync(sourceA, bytes);
    fs.writeFileSync(sourceB, bytes);

    const first = await store.importFromPath({
      sourcePath: sourceA,
      ownerType: 'document',
      ownerId: 'doc-A',
      role: 'attachment'
    });

    assert.equal(first.ok, true);
    assert.equal(first.blob.reusedPhysicalBlob, false);

    let status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 1);
    assert.equal(status.refs, 1);

    const physicalPath = path.resolve(
      dataDir,
      ...first.file.storageRelpath.split('/')
    );

    assert.equal(fs.existsSync(physicalPath), true);
    assert.deepEqual(fs.readFileSync(physicalPath), bytes);
    console.log('PASS first import creates one verified physical blob');

    const second = await store.importFromPath({
      sourcePath: sourceB,
      ownerType: 'presentation',
      ownerId: 'pres-A',
      role: 'media'
    });

    assert.equal(second.blob.blobId, first.blob.blobId);
    assert.equal(second.blob.reusedPhysicalBlob, true);
    assert.notEqual(second.file.fileId, first.file.fileId);

    status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 2);
    assert.equal(status.refs, 2);
    assert.equal(status.blobBytes, bytes.length);
    console.log('PASS duplicate content reuses one physical blob');

    const extraRef = store.attachExistingFile({
      fileId: second.file.fileId,
      ownerType: 'document',
      ownerId: 'doc-B',
      role: 'attachment'
    });

    assert.equal(extraRef.created, true);

    const duplicateRef = store.attachExistingFile({
      fileId: second.file.fileId,
      ownerType: 'document',
      ownerId: 'doc-B',
      role: 'attachment'
    });

    assert.equal(duplicateRef.created, false);

    status = store.status();
    assert.equal(status.refs, 3);
    console.log('PASS duplicate logical reference is idempotent');

    const removedFirst = store.removeReference(first.ref.ref_id);

    assert.equal(removedFirst.removed, true);
    assert.equal(removedFirst.deletedFileId, first.file.fileId);
    assert.equal(removedFirst.orphanedBlobId, null);

    status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.files, 1);
    assert.equal(status.refs, 2);
    assert.equal(fs.existsSync(physicalPath), true);
    console.log('PASS removing one consumer does not delete shared blob');

    const removedSecondPrimary = store.removeReference(second.ref.ref_id);

    assert.equal(removedSecondPrimary.removed, true);
    assert.equal(removedSecondPrimary.deletedFileId, null);

    status = store.status();
    assert.equal(status.files, 1);
    assert.equal(status.refs, 1);
    console.log('PASS logical file survives while another reference exists');

    const removedLast = store.removeReference(extraRef.ref.ref_id);

    assert.equal(removedLast.removed, true);
    assert.equal(removedLast.deletedFileId, second.file.fileId);
    assert.equal(removedLast.orphanedBlobId, first.blob.blobId);

    status = store.status();
    assert.equal(status.blobs, 1);
    assert.equal(status.readyBlobs, 0);
    assert.equal(status.files, 0);
    assert.equal(status.refs, 0);
    assert.equal(fs.existsSync(physicalPath), true);
    console.log('PASS last reference marks blob orphaned without immediate deletion');

    const protectedGc = await store.collectOrphans();

    assert.equal(protectedGc.deletedCount, 0);
    assert.equal(fs.existsSync(physicalPath), true);
    console.log('PASS fresh orphan survives default safety window');

    const forcedGc = await store.collectOrphans({ olderThanMs: 0 });

    assert.equal(forcedGc.deletedCount, 1);
    assert.equal(forcedGc.deletedBytes, bytes.length);
    assert.equal(fs.existsSync(physicalPath), false);

    status = store.status();
    assert.equal(status.blobs, 0);
    assert.equal(status.files, 0);
    assert.equal(status.refs, 0);
    console.log('PASS eligible orphan is garbage-collected');

    const integritySeed = await store.importFromPath({
      sourcePath: sourceA,
      ownerType: 'document',
      ownerId: 'doc-integrity-A',
      role: 'attachment'
    });

    const integrityPath = path.resolve(
      dataDir,
      ...integritySeed.file.storageRelpath.split('/')
    );

    fs.writeFileSync(
      integrityPath,
      Buffer.alloc(bytes.length, 0x58)
    );

    await assert.rejects(
      () => store.importFromPath({
        sourcePath: sourceA,
        ownerType: 'document',
        ownerId: 'doc-integrity-B',
        role: 'attachment'
      }),
      (error) => {
        assert.equal(error.code, 'WORKSPACE_BLOB_HASH_MISMATCH');
        return true;
      }
    );

    assert.equal(
      store.getFile(integritySeed.file.fileId).blobState,
      'quarantined'
    );
    console.log('PASS same-size corrupted blob is detected and quarantined');

    const notAFile = path.join(sourceDir, 'directory');
    fs.mkdirSync(notAFile);

    await assert.rejects(
      () => store.importFromPath({
        sourcePath: notAFile,
        ownerType: 'document',
        ownerId: 'doc-invalid',
        role: 'attachment'
      }),
      (error) => {
        assert.equal(error.code, 'WORKSPACE_SOURCE_NOT_FILE');
        return true;
      }
    );
    console.log('PASS non-file import source is rejected');

    const tempDir = path.join(dataDir, 'files', 'tmp');
    assert.deepEqual(
      fs.existsSync(tempDir) ? fs.readdirSync(tempDir) : [],
      []
    );
    console.log('PASS temporary import files are cleaned');

    console.log('WORKSPACE FILE STORE CONTRACT V1: PASS');
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('WORKSPACE FILE STORE CONTRACT V1: FAIL');
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
