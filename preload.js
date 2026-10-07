const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('nsAPI', {
  

  // IRGEZTNE_WINDOW_CONTROLS_V04P16
  windowGetState: () => ipcRenderer.invoke('ns:window:getState'),
  windowToggleMaximize: () => ipcRenderer.invoke('ns:window:toggleMaximize'),
  // Dedicated Weather window capability. Main validates the payload and owns
  // BrowserWindow creation; no generic window or filesystem access is exposed.
  weatherOpenFull: (payload) => ipcRenderer.invoke('irgeztne:weather:openFull', payload),
  onWeatherLocationChanged: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('Weather location listener must be a function');
    const listener = () => callback();
    ipcRenderer.on('irgeztne:weather:locationChanged', listener);
    return () => ipcRenderer.removeListener('irgeztne:weather:locationChanged', listener);
  },
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
  importSiteImage: (payload) => ipcRenderer.invoke('ns:webstudio:media:importImage', payload),
  materializeSitePreview: (payload) => ipcRenderer.invoke('ns:preview:materialize', payload),
  exportSiteZip: (payload) => ipcRenderer.invoke('ns:export:zip', payload),
  publishNetlifyZip: (payload) => ipcRenderer.invoke('ns:publish:netlifyZip', payload),
  testCloudflarePages: (payload) => ipcRenderer.invoke('ns:publish:cloudflareTest', payload),
  publishCloudflarePages: (payload) => ipcRenderer.invoke('ns:publish:cloudflarePages', payload),
  testRemotePublish: (payload) => ipcRenderer.invoke('ns:publish:remoteTest', payload),
  publishRemote: (payload) => ipcRenderer.invoke('ns:publish:remote', payload),
  openSitePreviewExternal: (payload) => ipcRenderer.invoke('ns:preview:openExternal', payload),
  // IRGEZTNE_DOCUMENTS_EXTERNAL_LINK_V6
  openExternalUrl: (url) => ipcRenderer.invoke('ns:system:openExternalUrl', { url }),
  publishPage: (payload) => ipcRenderer.invoke('ns:publish:page', payload),
  loadVitrinaRegistry: () => ipcRenderer.invoke('ns:vitrina:load'),
  saveVitrinaRegistry: (registry) => ipcRenderer.invoke('ns:vitrina:save', registry),
  workspaceTestCleanup: (payload) => ipcRenderer.invoke('ns:workspace:testCleanup', payload),
  workspaceBackupExport: (payload) => ipcRenderer.invoke('ns:workspace:backupExport', payload),
  workspaceBackupImport: (payload) => ipcRenderer.invoke('ns:workspace:backupImport', payload),
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

  // IRGEZTNE_WORKSHOP_FOLDER_PICKER_R1W7B
  workshopPickFolder: () => ipcRenderer.invoke('ns:workshop:pickFolder'),
  // IRGEZTNE_WORKSHOP_IMPORT_CONFLICTS_R1W7C
  workshopResolveImportConflicts: (payload) => ipcRenderer.invoke('ns:workshop:resolveImportConflicts', {
    locale: payload && payload.locale === 'en' ? 'en' : 'ru',
    count: Number(payload && payload.count || 0),
    paths: Array.isArray(payload && payload.paths) ? payload.paths.slice(0, 5) : []
  }),

  // IRGEZTNE_WORKSPACE_FILE_PICKER_V1
  workspaceFilePickImport: (payload) =>
    ipcRenderer.invoke('ns:storage:workspaceFilePickImport', payload),
  workspaceFileImportBuffer: (payload) =>
    ipcRenderer.invoke('ns:storage:workspaceFileImportBuffer', payload),
  workspaceFileListSync: (limit = 5000) => {
    try { return ipcRenderer.sendSync('ns:storage:workspaceFileListSync', { limit }); }
    catch (error) { console.warn('Workspace file list sync failed:', error); return { ok: false, files: [] }; }
  },
  workspaceFileGet: (fileId) =>
    ipcRenderer.invoke('ns:storage:workspaceFileGet', { fileId }),
  workspaceFileSaveAs: (fileId, suggestedName) =>
    ipcRenderer.invoke('ns:storage:workspaceFileSaveAs', { fileId, suggestedName }),
  // IRGEZTNE_WORKSPACE_FILE_OPEN_R1N
  workspaceFileOpen: (fileId) =>
    ipcRenderer.invoke('ns:storage:workspaceFileOpen', { fileId }),
  workspaceFileAttach: (payload) =>
    ipcRenderer.invoke('ns:storage:workspaceFileAttach', payload),
  workspaceFileRemoveReference: (refId) =>
    ipcRenderer.invoke('ns:storage:workspaceFileRemoveReference', { refId }),

  // IRGEZTNE_DOCUMENT_BUNDLE_EXPORT_R1L
  exportDocumentBundle: (payload) =>
    ipcRenderer.invoke('ns:office:exportDocumentBundle', payload),

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

// IRGEZTNE Account desktop v1 — renderer gets operations and public state only.
// Workspace session tokens, PKCE verifier/state and device private keys never cross this bridge.
contextBridge.exposeInMainWorld('irgeztneAccount', Object.freeze({
  getStatus: () => ipcRenderer.invoke('account:desktop:status'),
  startConnection: (label = 'IRGEZTNE Workspace') => ipcRenderer.invoke('account:desktop:start', {
    label: String(label || 'IRGEZTNE Workspace').slice(0, 80)
  }),
  openAuthorization: () => ipcRenderer.invoke('account:desktop:open-authorization'),
  completeConnection: () => ipcRenderer.invoke('account:desktop:complete'),
  cancelConnection: () => ipcRenderer.invoke('account:desktop:cancel'),
  logout: () => ipcRenderer.invoke('account:desktop:logout')
}));

// IRGEZTNE Identity local core v0.1 — public state and explicit creation only.
// No raw keys, ServiceSubjectSeed, generic signing, journal mutation or secret-store
// access is exposed to Renderer.
contextBridge.exposeInMainWorld('irgeztneIdentity', Object.freeze({
  getStatus: () => ipcRenderer.invoke('identity:status'),
  create: () => ipcRenderer.invoke('identity:create'),
  provisionRecovery: (passphrase) => ipcRenderer.invoke('identity:recovery:provision', { passphrase }),
  testRecovery: (passphrase) => ipcRenderer.invoke('identity:recovery:test', { passphrase }),
  restoreRecovery: (passphrase) => ipcRenderer.invoke('identity:recovery:restore', { passphrase })
}));

// IRGEZTNE Identity-linked Account v0.5 — high-level network Account operations only.
// Renderer never receives Identity private keys, ServiceSubjectSeed, capability tokens,
// ephemeral signing keys or generic signing access.
contextBridge.exposeInMainWorld('irgeztneIdentityAccount', Object.freeze({
  getStatus: () => ipcRenderer.invoke('identity-account:status'),
  createAccount: () => ipcRenderer.invoke('identity-account:create'),
  refreshAccount: () => ipcRenderer.invoke('identity-account:refresh'),
  updateProfile: (payload) => ipcRenderer.invoke('identity-account:update-profile', payload),
  disconnectLocal: () => ipcRenderer.invoke('identity-account:disconnect-local')
}));

// IRGEZTNE Green Lightning v0.4P — narrow renderer capability bridge.
// No ipcRenderer object, crypto keys, database paths, keyring values, or generic secret APIs are exposed here.
function assertMessengerTextV04P(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 65_536) {
    throw new TypeError('invalid Messenger text');
  }
  return value;
}

// IRGEZTNE Green Lightning v0.4P15 — narrow reply capability.
// Renderer may name only the message being replied to. Main process resolves the
// canonical sender/text from encrypted history; renderer cannot forge the quote.
function assertMessengerSendOptionsV04P15(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('invalid Messenger send options');
  }

  const replyToId = value.replyToId == null ? '' : String(value.replyToId);
  if (!replyToId) return null;
  if (replyToId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(replyToId)) {
    throw new TypeError('invalid Messenger reply target');
  }
  return Object.freeze({ replyToId });
}

// IRGEZTNE Green Lightning v0.4P17 — narrow reaction capability.
const MESSENGER_REACTIONS_V04P17 = new Set(['👍', '❤️', '😂', '😮', '😢', '🐪']);

function assertMessengerReactionTargetV04P17(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid Messenger reaction target');
  }
  return messageId;
}

function assertMessengerReactionEmojiV04P17(value) {
  const emoji = String(value == null ? '' : value);
  if (!MESSENGER_REACTIONS_V04P17.has(emoji)) {
    throw new TypeError('invalid Messenger reaction');
  }
  return emoji;
}

// IRGEZTNE Green Lightning v0.4P18 — narrow edit capability.
function assertMessengerEditTargetV04P18(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid Messenger edit target');
  }
  return messageId;
}

// IRGEZTNE Account ↔ Device v0.4P24 — narrow revocation capability.
// Renderer may name a Device Registry id only. Main process resolves the
// canonical MLS member identity and rejects current/lab/foreign devices.
function assertMessengerDeviceIdV04P24(value) {
  const deviceId = String(value == null ? '' : value);
  if (!deviceId || deviceId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
    throw new TypeError('invalid Messenger device id');
  }
  return deviceId;
}

// IRGEZTNE Message Lifecycle v0.4P19 — delete-for-all capability.
function assertMessengerDeleteTargetV04P19(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid Messenger delete target');
  }
  return messageId;
}

function assertMessengerSenderV1(value) {
  const sender = String(value == null ? '' : value);
  if (!['local', 'peer', 'camel'].includes(sender)) {
    throw new TypeError('invalid Messenger attachment sender');
  }
  return sender;
}

function assertMessengerAttachmentTargetV1(value) {
  const messageId = String(value == null ? '' : value);
  if (!messageId || messageId.length > 180 || !/^[A-Za-z0-9._:-]+$/.test(messageId)) {
    throw new TypeError('invalid Messenger attachment target');
  }
  return messageId;
}

contextBridge.exposeInMainWorld('irgeztneMessenger', Object.freeze({
  getStatus: () => ipcRenderer.invoke('messenger:status'),
  getConversation: () => ipcRenderer.invoke('messenger:get-conversation'),
  createDirectInvite: () => ipcRenderer.invoke('messenger:create-direct-invite'),
  joinDirectInvite: (inviteToken) => {
    const token = String(inviteToken == null ? '' : inviteToken).trim();
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new TypeError('invalid Chat invite');
    return ipcRenderer.invoke('messenger:join-direct-invite', token);
  },
  refreshRemoteTransport: () => ipcRenderer.invoke('messenger:refresh-remote-transport'),
  sendAttachment: (sender = 'local', options = null) => ipcRenderer.invoke(
    'messenger:send-attachment',
    assertMessengerSenderV1(sender),
    assertMessengerSendOptionsV04P15(options)
  ),
  openAttachment: (messageId) => ipcRenderer.invoke(
    'messenger:open-attachment',
    assertMessengerAttachmentTargetV1(messageId)
  ),
  saveAttachment: (messageId) => ipcRenderer.invoke(
    'messenger:save-attachment',
    assertMessengerAttachmentTargetV1(messageId)
  ),
  getDeviceContext: () => ipcRenderer.invoke('messenger:get-device-context'),
  getDeviceEnrollmentStatus: () => ipcRenderer.invoke('messenger:device-enrollment-status'),
  revokeAccountDevice: (deviceId) => ipcRenderer.invoke(
    'messenger:device-revoke',
    assertMessengerDeviceIdV04P24(deviceId)
  ),
  getDeviceRevocationStatus: () => ipcRenderer.invoke('messenger:device-revocation-status'),
  beginDeviceEnrollment: () => ipcRenderer.invoke('messenger:device-enrollment-begin'),
  cancelDeviceEnrollment: () => ipcRenderer.invoke('messenger:device-enrollment-cancel'),
  getDeviceEnrollmentTransportStatus: () => ipcRenderer.invoke('messenger:device-enrollment-transport-status'),
  sendLocalText: (text, options = null) => ipcRenderer.invoke(
    'messenger:send-local-text',
    assertMessengerTextV04P(text),
    assertMessengerSendOptionsV04P15(options)
  ),
  sendPeerText: (text, options = null) => ipcRenderer.invoke(
    'messenger:send-peer-text',
    assertMessengerTextV04P(text),
    assertMessengerSendOptionsV04P15(options)
  ),
  sendCamelText: (text, options = null) => ipcRenderer.invoke(
    'messenger:send-camel-text',
    assertMessengerTextV04P(text),
    assertMessengerSendOptionsV04P15(options)
  ),
  reactLocal: (messageId, emoji) => ipcRenderer.invoke(
    'messenger:react-local',
    assertMessengerReactionTargetV04P17(messageId),
    assertMessengerReactionEmojiV04P17(emoji)
  ),
  reactPeer: (messageId, emoji) => ipcRenderer.invoke(
    'messenger:react-peer',
    assertMessengerReactionTargetV04P17(messageId),
    assertMessengerReactionEmojiV04P17(emoji)
  ),
  reactCamel: (messageId, emoji) => ipcRenderer.invoke(
    'messenger:react-camel',
    assertMessengerReactionTargetV04P17(messageId),
    assertMessengerReactionEmojiV04P17(emoji)
  ),
  editLocal: (messageId, text) => ipcRenderer.invoke(
    'messenger:edit-local',
    assertMessengerEditTargetV04P18(messageId),
    assertMessengerTextV04P(text)
  ),
  editPeer: (messageId, text) => ipcRenderer.invoke(
    'messenger:edit-peer',
    assertMessengerEditTargetV04P18(messageId),
    assertMessengerTextV04P(text)
  ),
  editCamel: (messageId, text) => ipcRenderer.invoke(
    'messenger:edit-camel',
    assertMessengerEditTargetV04P18(messageId),
    assertMessengerTextV04P(text)
  ),
  deleteLocalForAll: (messageId) => ipcRenderer.invoke(
    'messenger:delete-local-for-all',
    assertMessengerDeleteTargetV04P19(messageId)
  ),
  deletePeerForAll: (messageId) => ipcRenderer.invoke(
    'messenger:delete-peer-for-all',
    assertMessengerDeleteTargetV04P19(messageId)
  ),
  deleteCamelForAll: (messageId) => ipcRenderer.invoke(
    'messenger:delete-camel-for-all',
    assertMessengerDeleteTargetV04P19(messageId)
  )
}));
