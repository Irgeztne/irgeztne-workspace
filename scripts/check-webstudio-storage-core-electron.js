const { app, safeStorage } = require('electron');
const path = require('path');
const { createStorageCore } = require('../src/storage/storage-core-main');

app.whenReady().then(() => {
  const storage = createStorageCore({
    app,
    dataDir: path.join(process.cwd(), 'data'),
    safeStorage
  });

  const manager = storage.getModuleState('webstudio.siteManager.v1', null);

  console.log('HAS_WEBSTUDIO_MANAGER', !!manager);
  if (manager) {
    console.log('ACTIVE_SITE_ID', manager.activeSiteId || '');
    console.log('SITES_COUNT', Array.isArray(manager.sites) ? manager.sites.length : 0);
    console.log('FIRST_SITE_NAME', manager.sites && manager.sites[0] ? manager.sites[0].name : '');
    console.log('HAS_STATE', !!(manager.sites && manager.sites[0] && manager.sites[0].state));
  }

  const raw = JSON.stringify(manager || {});
  console.log('RAW_CONTAINS_TOKEN_FIELD', /"token"\s*:\s*"[^"]+"/.test(raw));
  console.log('RAW_CONTAINS_SECRET_FIELD', /"secretKey"\s*:\s*"[^"]+"|"accessKey"\s*:\s*"[^"]+"/.test(raw));

  storage.close();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
