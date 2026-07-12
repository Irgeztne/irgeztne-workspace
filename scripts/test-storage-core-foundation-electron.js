'use strict';

const path = require('path');
const { app, safeStorage } = require('electron');
const { createStorageCore } = require('../src/storage/storage-core-main');

app.whenReady().then(() => {
  const testDataDir = path.join(process.cwd(), 'data', 'storage-core-foundation-test');
  const storage = createStorageCore({ app, safeStorage, dataDir: testDataDir });

  console.log('STATUS', storage.status());

  storage.setPreference('language', 'ru');
  console.log('PREFERENCE', storage.getPreference('language', 'missing'));

  storage.setModuleState('test.module', { ok: true, name: 'IRGEZTNE' });
  console.log('MODULE', storage.getModuleState('test.module', {}));

  storage.saveSecret('test:netlify', 'token', 'test-secret-token-1234');
  console.log('SECRET_HAS', storage.hasSecret('test:netlify', 'token'));
  console.log('SECRET_PREVIEW', storage.previewSecret('test:netlify', 'token'));
  console.log('SECRET_READ_OK', storage.readSecret('test:netlify', 'token') === 'test-secret-token-1234');

  storage.clearSecret('test:netlify', 'token');
  console.log('SECRET_HAS_AFTER_CLEAR', storage.hasSecret('test:netlify', 'token'));

  storage.close();
  app.quit();
}).catch((error) => {
  console.error('STORAGE_TEST_FAILED', error);
  app.exit(1);
});
