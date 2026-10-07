'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { createIdentityController, identityInternals } = require('../src/identity/identity-core-main.cjs');
const { parseRecoveryPackage } = require('../src/identity/identity-recovery.cjs');

function fakeSafeStorage(backend = 'gnome_libsecret') {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => backend,
    encryptString: (value) => Buffer.from(`TEST:${value}`, 'utf8'),
    decryptString: (value) => {
      const text = Buffer.from(value).toString('utf8');
      if (!text.startsWith('TEST:')) throw new Error('bad fake ciphertext');
      return text.slice(5);
    }
  };
}
function fakeApp(root) { return { getPath:(name)=>{ assert.equal(name,'userData'); return root; } }; }
function deterministicRandom() {
  let counter=1;
  return (n)=>{ const out=Buffer.alloc(n); for(let i=0;i<n;i+=1) out[i]=(counter+i)&0xff; counter+=n; return out; };
}
const TEST_SCRYPT = { N:1024, r:8, p:1, key_length:32 };
const PASSPHRASE = 'correct horse battery staple 2026';

function newController(root, overrides={}) {
  return createIdentityController({
    app:fakeApp(root), safeStorage:fakeSafeStorage(), platform:'linux',
    now:()=>1_800_000_000_000, randomBytes:deterministicRandom(), ...overrides
  });
}

test('Recovery package is encrypted, provisioned only after file write, and contains no plaintext private material', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-src-'));
  const file=path.join(root,'offline','recovery.json');
  const controller=newController(root);
  const before=controller.create();
  const result=controller.provisionRecoveryForMain({filePath:file,passphrase:PASSPHRASE,scrypt:TEST_SCRYPT});
  assert.equal(result.recovery_provisioned,true);
  assert.equal(result.recovery_restore_tested,false);
  assert.ok(result.recovery_package.fingerprint);
  assert.equal(fs.existsSync(file),true);
  const text=fs.readFileSync(file,'utf8');
  const parsed=parseRecoveryPackage(text);
  assert.equal(parsed.value.profile,'irgeztne.identity.recovery-package.v1');
  assert.equal(parsed.value.identity_id,before.identity_id);
  assert.equal(text.includes('private_jwk'),false);
  assert.equal(text.includes('service_subject_seed'),false);
  assert.equal(text.includes('"d"'),false);
});

test('Recovery restore test verifies continuity for Account/Chat/Workshop/Hosting/Atlas and marks READY', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-test-'));
  const file=path.join(root,'recovery.json');
  const controller=newController(root);
  controller.create();
  const subjects={};
  for(const name of ['account','chat','workshop','hosting','atlas']) subjects[name]=controller.deriveServiceSubjectForMain(name,'prod','v1');
  controller.provisionRecoveryForMain({filePath:file,passphrase:PASSPHRASE,scrypt:TEST_SCRYPT});
  const tested=controller.testRecoveryPackageForMain({filePath:file,passphrase:PASSPHRASE});
  assert.equal(tested.recovery_provisioned,true);
  assert.equal(tested.recovery_restore_tested,true);
  assert.equal(tested.status,'READY');
  for(const name of Object.keys(subjects)) assert.equal(controller.deriveServiceSubjectForMain(name,'prod','v1'),subjects[name]);
});

test('Wrong Recovery passphrase and package tampering fail closed', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-wrong-'));
  const file=path.join(root,'recovery.json');
  const controller=newController(root);
  controller.create();
  controller.provisionRecoveryForMain({filePath:file,passphrase:PASSPHRASE,scrypt:TEST_SCRYPT});
  assert.throws(()=>controller.testRecoveryPackageForMain({filePath:file,passphrase:'this passphrase is definitely wrong'}), e=>e && e.code==='IDENTITY_RECOVERY_DECRYPT_FAILED');
  const doc=JSON.parse(fs.readFileSync(file,'utf8'));
  doc.identity_id = doc.identity_id.slice(0,-1) + (doc.identity_id.endsWith('a')?'b':'a');
  fs.writeFileSync(file,JSON.stringify(doc));
  assert.throws(()=>controller.testRecoveryPackageForMain({filePath:file,passphrase:PASSPHRASE}), e=>e && e.code==='IDENTITY_RECOVERY_DECRYPT_FAILED');
});

test('Fresh installation restores same IdentityID and pairwise subjects but creates a new Root/Device epoch', () => {
  const sourceRoot=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-source-'));
  const file=path.join(sourceRoot,'recovery.json');
  const source=newController(sourceRoot);
  const created=source.create();
  const sourceJournal=source.getPublicJournalForMain();
  const sourceSubjects={};
  for(const name of ['account','chat','workshop','hosting','atlas']) sourceSubjects[name]=source.deriveServiceSubjectForMain(name,'prod','v1');
  source.provisionRecoveryForMain({filePath:file,passphrase:PASSPHRASE,scrypt:TEST_SCRYPT});
  source.testRecoveryPackageForMain({filePath:file,passphrase:PASSPHRASE});

  const targetRoot=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-target-'));
  const target=newController(targetRoot,{randomBytes:undefined});
  const restored=target.restoreRecoveryPackageForMain({filePath:file,passphrase:PASSPHRASE});
  assert.equal(restored.restored,true);
  assert.equal(restored.identity_id,created.identity_id);
  assert.notEqual(restored.device_id,created.device_id);
  assert.equal(restored.recovery_epoch,1);
  assert.equal(restored.sequence,0);
  assert.equal(restored.status,'RECOVERED_PENDING_REGISTRY_SYNC');
  const restoredJournal=target.getPublicJournalForMain();
  assert.equal(restoredJournal.journal.length,sourceJournal.journal.length+1);
  assert.equal(restoredJournal.journal.at(-1).body.event_type,'RECOVERY_ROTATE_ROOT');
  assert.ok(identityInternals.projectPublicJournal(restoredJournal));
  for(const name of Object.keys(sourceSubjects)) assert.equal(target.deriveServiceSubjectForMain(name,'prod','v1'),sourceSubjects[name]);
});

test('Recovery restore refuses to overwrite an existing local Identity', () => {
  const sourceRoot=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-source2-'));
  const file=path.join(sourceRoot,'recovery.json');
  const source=newController(sourceRoot); source.create(); source.provisionRecoveryForMain({filePath:file,passphrase:PASSPHRASE,scrypt:TEST_SCRYPT});
  const targetRoot=fs.mkdtempSync(path.join(os.tmpdir(),'irgeztne-recovery-existing-'));
  const target=newController(targetRoot); target.create();
  assert.throws(()=>target.restoreRecoveryPackageForMain({filePath:file,passphrase:PASSPHRASE}), e=>e && e.code==='IDENTITY_ALREADY_EXISTS');
});
