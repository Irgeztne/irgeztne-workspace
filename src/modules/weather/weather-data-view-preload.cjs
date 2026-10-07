'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('IRGEZTNEWeatherHost', Object.freeze({
  getStateSync(slot, fallback = null) {
    try { return ipcRenderer.sendSync('irgeztne:weather:getStateSync', { slot, fallback }); }
    catch (_) { return fallback; }
  },
  setStateSync(slot, value) {
    try { return ipcRenderer.sendSync('irgeztne:weather:setStateSync', { slot, value }); }
    catch (_) { return { ok: false }; }
  },
  notifyLocationChanged() {
    ipcRenderer.send('irgeztne:weather:locationChanged');
  },
  openOfficialLink(url) {
    return ipcRenderer.invoke('irgeztne:weather:openOfficialLink', { url });
  }
}));
