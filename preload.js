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
  materializeSitePreview: (payload) => ipcRenderer.invoke('ns:preview:materialize', payload),
  exportSiteZip: (payload) => ipcRenderer.invoke('ns:export:zip', payload),
  openSitePreviewExternal: (payload) => ipcRenderer.invoke('ns:preview:openExternal', payload),
  publishPage: (payload) => ipcRenderer.invoke('ns:publish:page', payload),
  loadVitrinaRegistry: () => ipcRenderer.invoke('ns:vitrina:load'),
  saveVitrinaRegistry: (registry) => ipcRenderer.invoke('ns:vitrina:save', registry),
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
