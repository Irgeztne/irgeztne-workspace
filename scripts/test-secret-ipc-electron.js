const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { createStorageCore } = require('../src/storage/storage-core-main');

let storage = null;

function registerSecretIpc() {
  storage = createStorageCore({
    app,
    dataDir: path.join(process.cwd(), 'data'),
    safeStorage
  });

  ipcMain.handle('ns:storage:secretSave', async (event, payload = {}) => {
    return storage.saveSecret(payload.scope, payload.key, payload.value);
  });

  ipcMain.on('ns:storage:secretHasSync', (event, payload = {}) => {
    event.returnValue = storage.hasSecret(payload.scope, payload.key);
  });

  ipcMain.on('ns:storage:secretPreviewSync', (event, payload = {}) => {
    event.returnValue = storage.previewSecret(payload.scope, payload.key);
  });

  ipcMain.on('ns:storage:secretReadSync', (event, payload = {}) => {
    event.returnValue = storage.readSecret(payload.scope, payload.key);
  });

  ipcMain.handle('ns:storage:secretClear', async (event, payload = {}) => {
    return storage.clearSecret(payload.scope, payload.key);
  });
}

app.whenReady().then(async () => {
  registerSecretIpc();

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(process.cwd(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadURL('data:text/html;charset=utf-8,<html><body>secret-ipc-test</body></html>');

  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const api = window.nsAPI;
      const scope = 'test:step4a';

      const readSecret =
        api.storageReadSecretSync ||
        api.storageSecretReadSync ||
        null;

      await api.storageSaveSecret(scope, 'token', 'abc_test_1234');

      const has = api.storageSecretHasSync(scope, 'token');
      const preview = api.storageSecretPreviewSync(scope, 'token');
      const readOk = readSecret ? readSecret(scope, 'token') === 'abc_test_1234' : false;

      const clear = await api.storageClearSecret(scope, 'token');
      const hasAfterClear = api.storageSecretHasSync(scope, 'token');

      return {
        apiKeys: Object.keys(api).filter((key) => key.toLowerCase().includes('secret')),
        has,
        preview,
        readOk,
        clear,
        hasAfterClear
      };
    })();
  `);

  console.log(result);

  if (storage) storage.close();
  await win.close();
  app.quit();
}).catch((error) => {
  console.error(error);
  try { if (storage) storage.close(); } catch (_) {}
  app.exit(1);
});
