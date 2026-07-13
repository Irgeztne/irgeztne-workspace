const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('nsAPI', {
  loadNotes: () => ipcRenderer.invoke('ns:notes:load'),
  saveNotes: (text) => ipcRenderer.invoke('ns:notes:save', { text }),
  loadDrafts: () => ipcRenderer.invoke('ns:drafts:load'),
  saveDrafts: (drafts) => ipcRenderer.invoke('ns:drafts:saveAll', drafts),
  loadPages: () => ipcRenderer.invoke('ns:pages:load'),
  loadTemplateFiles: () => ipcRenderer.invoke('ns:templates:load'),
  loadTemplateFilesSync: () => {
    try {
      return ipcRenderer.sendSync('ns:templates:loadSync');
    } catch (error) {
      console.warn('Template sync load failed in preload:', error);
      return [];
    }
  },
  saveTemplateFile: (payload) => ipcRenderer.invoke('ns:templates:save', payload),
  importSiteVideo: (payload) => ipcRenderer.invoke('ns:webstudio:media:importVideo', payload),
  materializeSitePreview: (payload) => ipcRenderer.invoke('ns:preview:materialize', payload),
  exportSiteZip: (payload) => ipcRenderer.invoke('ns:export:zip', payload),
  publishNetlifyZip: (payload) => ipcRenderer.invoke('ns:publish:netlifyZip', payload),
  testCloudflarePages: (payload) => ipcRenderer.invoke('ns:publish:cloudflareTest', payload),
  publishCloudflarePages: (payload) => ipcRenderer.invoke('ns:publish:cloudflarePages', payload),
  openSitePreviewExternal: (payload) => ipcRenderer.invoke('ns:preview:openExternal', payload),
  publishPage: (payload) => ipcRenderer.invoke('ns:publish:page', payload),
  loadVitrinaRegistry: () => ipcRenderer.invoke('ns:vitrina:load'),
  saveVitrinaRegistry: (registry) => ipcRenderer.invoke('ns:vitrina:save', registry),
  storageStatus: () => ipcRenderer.invoke('ns:storage:status'),
  storageGetPreferenceSync: (key, fallback = null) => {
    try { return ipcRenderer.sendSync('ns:storage:getPreferenceSync', { key, fallback }); }
    catch (error) { console.warn('Storage preference sync get failed:', error); return fallback; }
  },
  storageSetPreference: (key, value) => ipcRenderer.invoke('ns:storage:setPreference', { key, value }),
  storageGetLayoutSync: (key, fallback = null) => {
    try { return ipcRenderer.sendSync('ns:storage:getLayoutSync', { key, fallback }); }
    catch (error) { console.warn('Storage layout sync get failed:', error); return fallback; }
  },
  storageSetLayout: (key, value) => ipcRenderer.invoke('ns:storage:setLayout', { key, value }),
  storageGetModuleStateSync: (moduleId, fallback = null) => {
    try { return ipcRenderer.sendSync('ns:storage:getModuleStateSync', { moduleId, fallback }); }
    catch (error) { console.warn('Storage module state sync get failed:', error); return fallback; }
  },
  storageSetModuleState: (moduleId, value) => ipcRenderer.invoke('ns:storage:setModuleState', { moduleId, value }),
  storageSetModuleStateSync: (moduleId, value) => {
    try { return ipcRenderer.sendSync('ns:storage:setModuleStateSync', { moduleId, value }); }
    catch (error) { console.warn('Storage module state sync set failed:', error); return { ok: false }; }
  },
  storageSaveSecret: (scope, key, value) => ipcRenderer.invoke('ns:storage:secretSave', { scope, key, value }),
  storageSecretHasSync: (scope, key) => {
    try { return ipcRenderer.sendSync('ns:storage:secretHasSync', { scope, key }); }
    catch (error) { console.warn('Storage secret sync has failed:', error); return false; }
  },
  storageSecretPreviewSync: (scope, key) => {
    try { return ipcRenderer.sendSync('ns:storage:secretPreviewSync', { scope, key }); }
    catch (error) { console.warn('Storage secret sync preview failed:', error); return ''; }
  },
  storageReadSecretSync: (scope, key) => {
    try { return ipcRenderer.sendSync('ns:storage:secretReadSync', { scope, key }); }
    catch (error) { console.warn('Storage secret sync read failed:', error); return ''; }
  },
  storageClearSecret: (scope, key) => ipcRenderer.invoke('ns:storage:secretClear', { scope, key }),
  readClipboardText: () => {
    try {
      return clipboard.readText() || '';
    } catch (error) {
      console.warn('Clipboard read failed in preload:', error);
      return '';
    }
  },
  writeClipboardText: (text) => {
    try {
      clipboard.writeText(typeof text === 'string' ? text : String(text || ''));
      return true;
    } catch (error) {
      console.warn('Clipboard write failed in preload:', error);
      return false;
    }
  }
});
