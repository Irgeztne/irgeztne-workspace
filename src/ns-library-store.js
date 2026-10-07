(function () {
  'use strict';

  const STORAGE_KEY = 'nsbrowser:v8:source-library'; // legacy migration/cache
  const DURABLE_STATE_KEY = 'files.library.v1';
  const DURABLE_PERSISTENCE_VERSION = 1;
  let migrateLegacyOnBoot = false;
  // IRGEZTNE_FILES_NO_GHOST_RECOVERY_R1D
  // Raw Workspace File Store recovery is emergency-only. A persisted Files
  // snapshot (even an empty one) is authoritative and must not be repopulated
  // from files that are still retained by Office/Chat/other owners.
  let recoverWorkspaceFilesOnBoot = false;

  const DEFAULT_STATE = {
    items: [],
    activeId: null,
    filters: {
      query: '',
      category: 'all',
      sort: 'recent'
    }
  };

  const TEXT_EXTS = new Set([
    'txt', 'md', 'markdown', 'json', 'jsonld', 'js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx',
    'css', 'html', 'htm', 'xml', 'svg', 'rdf', 'ttl', 'n3', 'nt', 'nq', 'trig', 'owl',
    'csv', 'yml', 'yaml'
  ]);

  const IMAGE_EXTS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'
  ]);

  const RDF_EXTS = new Set([
    'rdf', 'ttl', 'n3', 'nt', 'nq', 'trig', 'owl', 'jsonld'
  ]);

  function safeNow() {
    return new Date().toISOString();
  }

  function safeString(value) {
    return String(value || '').trim();
  }

  function safeLower(value) {
    return safeString(value).toLowerCase();
  }

  function makeId(prefix) {
    return (
      prefix +
      '_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function getExt(name) {
    if (!name || typeof name !== 'string') return '';
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function slugify(value) {
    return safeLower(value)
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
  }

  function normalizeCategory(value) {
    const v = slugify(value);

    if (!v || v === 'all') return 'all';
    if (v === 'asset' || v === 'assets') return 'asset';
    if (v === 'context' || v === 'ai-context') return 'context';
    if (v === 'research') return 'research';
    if (v === 'publishing') return 'publishing';
    if (v === 'archive') return 'archive';
    if (v === 'other') return 'other';
    if (v === 'favorite' || v === 'favorites') return 'favorites';
    if (v === 'pin' || v === 'pinned') return 'pinned';

    return v;
  }

  function isPdfLike(type, name) {
    const ext = getExt(name);
    const safeType = safeLower(type);
    return ext === 'pdf' || safeType === 'application/pdf';
  }

  function isImageLike(type, name) {
    const ext = getExt(name);
    const safeType = safeLower(type);

    if (safeType.indexOf('image/') === 0) return true;
    return IMAGE_EXTS.has(ext);
  }

  function isRdfLike(type, name) {
    const ext = getExt(name);
    const safeType = safeLower(type);

    if (RDF_EXTS.has(ext)) return true;

    return (
      safeType === 'application/rdf+xml' ||
      safeType === 'application/owl+xml' ||
      safeType === 'application/ld+json' ||
      safeType === 'text/turtle' ||
      safeType === 'application/n-triples' ||
      safeType === 'application/n-quads' ||
      safeType === 'application/trig' ||
      safeType === 'application/trix'
    );
  }

  function isTextLike(type, name) {
    const ext = getExt(name);
    const safeType = safeLower(type);

    if (TEXT_EXTS.has(ext)) return true;
    if (isRdfLike(type, name)) return true;
    if (safeType.indexOf('text/') === 0) return true;

    return (
      safeType === 'application/json' ||
      safeType === 'application/javascript' ||
      safeType === 'application/xml' ||
      safeType === 'text/xml' ||
      safeType === 'application/xhtml+xml' ||
      safeType.indexOf('+xml') !== -1
    );
  }

  function detectPreviewKind(type, name) {
    if (isImageLike(type, name)) return 'image';
    if (isPdfLike(type, name)) return 'pdf';
    if (isTextLike(type, name)) return 'text';
    return 'file';
  }

  function inferCategory(file) {
    var safeFile = file || {};
    var type = safeFile.type || '';
    var name = safeFile.name || '';

    if (isImageLike(type, name)) return 'asset';
    if (isTextLike(type, name)) return 'context';
    if (isPdfLike(type, name)) return 'research';

    return 'other';
  }

  function normalizeItem(input) {
    input = input || {};

    const now = safeNow();
    const name = input.name || input.originalName || 'untitled';
    const type = input.type || 'application/octet-stream';
    const previewInput = input.preview || {};
    const storageInput = input.storage || {};
    const usageInput = input.usage || {};
    const publishingInput = input.publishing || {};
    const previewKind = previewInput.kind || detectPreviewKind(type, name);
    const normalizedCategory = normalizeCategory(input.category);
    const category = normalizedCategory !== 'all'
      ? normalizedCategory
      : inferCategory({ type: type, name: name });

    return {
      id: input.id || makeId('src'),
      name: name,
      originalName: input.originalName || name,
      type: type,
      ext: input.ext || getExt(name),
      size: Number(input.size || 0),
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,

      category: category,
      tags: Array.isArray(input.tags) ? input.tags : [],
      description: typeof input.description === 'string' ? input.description : '',
      favorite: Boolean(input.favorite),
      pinned: Boolean(input.pinned),
      fingerprint: typeof input.fingerprint === 'string' ? input.fingerprint : '',

      storage: {
        kind: storageInput.kind || 'local',
        dataUrl: storageInput.dataUrl || null,
        fileId: storageInput.fileId || null,
        refId: storageInput.refId || null,
        sha256: storageInput.sha256 || null
      },

      preview: {
        kind: previewKind,
        excerpt: typeof previewInput.excerpt === 'string' ? previewInput.excerpt : '',
        textContent: typeof previewInput.textContent === 'string' ? previewInput.textContent : '',
        textType:
          typeof previewInput.textType === 'string'
            ? previewInput.textType
            : isRdfLike(type, name)
            ? 'rdf'
            : 'text'
      },

      usage: {
        inChatContext: Boolean(usageInput.inChatContext),
        inEditor: Boolean(usageInput.inEditor),
        inPublishing: Boolean(usageInput.inPublishing),
        inSiteAssets: Boolean(usageInput.inSiteAssets)
      },

      publishing: {
        ipfsReady: Boolean(publishingInput.ipfsReady),
        ipfsCid: publishingInput.ipfsCid || null,
        publishName: publishingInput.publishName || null
      }
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeStoredState(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;

    const items = Array.isArray(parsed.items) ? parsed.items.map(normalizeItem) : [];
    let activeId = parsed.activeId || null;

    if (
      activeId &&
      !items.some(function (item) {
        return item.id === activeId;
      })
    ) {
      activeId = items.length ? items[0].id : null;
    }

    return {
      items: items,
      activeId: activeId,
      filters: {
        query: (parsed.filters && parsed.filters.query) || '',
        category: normalizeCategory((parsed.filters && parsed.filters.category) || 'all'),
        sort: (parsed.filters && parsed.filters.sort) || 'recent'
      },
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      persistenceVersion: Math.max(0, Number(parsed.persistenceVersion || 0))
    };
  }

  function storedStateStamp(candidate) {
    if (!candidate) return 0;
    const explicit = Date.parse(candidate.savedAt || '');
    if (Number.isFinite(explicit)) return explicit;

    return (candidate.items || []).reduce(function (latest, item) {
      const value = Date.parse(item && item.updatedAt || '');
      return Number.isFinite(value) ? Math.max(latest, value) : latest;
    }, 0);
  }

  function readLegacyLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeStoredState(JSON.parse(raw)) : null;
    } catch (err) {
      console.warn('[NSLibraryStore] Failed to read legacy local state:', err);
      return null;
    }
  }

  function readDurableState() {
    try {
      const api = window.nsAPI;
      if (!api || typeof api.storageGetModuleStateSync !== 'function') return null;
      return normalizeStoredState(
        api.storageGetModuleStateSync(DURABLE_STATE_KEY, null)
      );
    } catch (err) {
      console.warn('[NSLibraryStore] Failed to read Storage Core state:', err);
      return null;
    }
  }

  function readState() {
    const durableCandidate = readDurableState();
    const localCandidate = readLegacyLocalState();

    const durableCount = durableCandidate && Array.isArray(durableCandidate.items)
      ? durableCandidate.items.length
      : 0;
    const localCount = localCandidate && Array.isArray(localCandidate.items)
      ? localCandidate.items.length
      : 0;

    // Recovery rule: an empty/new durable record never erases a richer legacy
    // library. When both contain data, prefer the newer snapshot.
    if (localCount > 0 && durableCount === 0) {
      migrateLegacyOnBoot = true;
      return localCandidate;
    }

    if (localCount > 0 && durableCount > 0 && storedStateStamp(localCandidate) > storedStateStamp(durableCandidate)) {
      migrateLegacyOnBoot = true;
      return localCandidate;
    }

    if (durableCandidate) return durableCandidate;
    if (localCandidate) {
      migrateLegacyOnBoot = true;
      return localCandidate;
    }

    // No Files snapshot exists at all: only in this emergency case may the
    // Workspace File Store be used to reconstruct the library.
    recoverWorkspaceFilesOnBoot = true;
    return clone(DEFAULT_STATE);
  }

  const state = readState();
  const listeners = new Set();

  function hasItem(id) {
    if (!id) return false;
    return state.items.some(function (item) {
      return item.id === id;
    });
  }

  function normalizeActiveId(preferredId) {
    if (
      preferredId &&
      state.items.some(function (item) {
        return item.id === preferredId;
      })
    ) {
      return preferredId;
    }

    return state.items.length ? state.items[0].id : null;
  }

  function syncState() {
    if (!Array.isArray(state.items)) {
      state.items = [];
    }

    state.items = state.items.map(normalizeItem);
    state.activeId = normalizeActiveId(state.activeId);
    state.filters.category = normalizeCategory(state.filters.category || 'all');

    if (typeof state.filters.query !== 'string') {
      state.filters.query = '';
    }

    if (!state.filters.sort) {
      state.filters.sort = 'recent';
    }
  }

  syncState();

  if (migrateLegacyOnBoot) {
    if (save()) migrateLegacyOnBoot = false;
  }

  function serializeState() {
    return {
      items: state.items.map(normalizeItem),
      activeId: state.activeId,
      filters: Object.assign({}, state.filters),
      savedAt: safeNow(),
      persistenceVersion: DURABLE_PERSISTENCE_VERSION
    };
  }

  function save() {
    const payload = serializeState();
    let durableSaved = false;

    try {
      const api = window.nsAPI;
      if (api && typeof api.storageSetModuleStateSync === 'function') {
        const result = api.storageSetModuleStateSync(DURABLE_STATE_KEY, payload);
        durableSaved = Boolean(result && result.ok === true);
        if (!durableSaved) {
          console.warn('[NSLibraryStore] Storage Core rejected Files state');
        }
      }
    } catch (err) {
      console.warn('[NSLibraryStore] Failed to save Files state to Storage Core:', err);
    }

    // Keep the historic renderer copy only as a migration/cache fallback.
    // Storage Core remains the canonical owner once available.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      if (!durableSaved) {
        console.error('[NSLibraryStore] Failed to save Files state:', err);
      } else {
        console.warn('[NSLibraryStore] Legacy local mirror was not updated:', err);
      }
    }

    return durableSaved;
  }

  function workspaceFileListSync() {
    try {
      const api = window.nsAPI;
      if (!api || typeof api.workspaceFileListSync !== 'function') return [];
      const result = api.workspaceFileListSync(5000);
      return result && result.ok === true && Array.isArray(result.files) ? result.files : [];
    } catch (err) {
      console.warn('[NSLibraryStore] Workspace File Store list failed:', err);
      return [];
    }
  }

  function libraryItemFromWorkspaceFile(file) {
    const name = file && (file.displayName || file.originalName) || 'workspace-file';
    const type = file && file.mimeType || 'application/octet-stream';
    return normalizeItem({
      id: 'ws_' + String(file.fileId || makeId('file')),
      name: name,
      originalName: file.originalName || name,
      type: type,
      ext: file.extension || getExt(name),
      size: Number(file.sizeBytes || 0),
      createdAt: file.createdAt || safeNow(),
      updatedAt: file.updatedAt || file.createdAt || safeNow(),
      category: inferCategory({ type: type, name: name }),
      fingerprint: '',
      storage: {
        kind: 'workspace-file',
        dataUrl: null,
        fileId: file.fileId || null,
        refId: null,
        sha256: file.sha256 || null
      },
      preview: {
        kind: detectPreviewKind(type, name),
        excerpt: '',
        textContent: '',
        textType: isRdfLike(type, name) ? 'rdf' : 'text'
      }
    });
  }

  function recoverFromWorkspaceFileStore() {
    const durableFiles = workspaceFileListSync();
    if (!durableFiles.length) return 0;

    const byFileId = new Set();
    const bySha = new Set();
    state.items.forEach(function (item) {
      const storage = item && item.storage ? item.storage : {};
      if (storage.fileId) byFileId.add(String(storage.fileId));
      if (storage.sha256) bySha.add(String(storage.sha256));
    });

    let recovered = 0;
    durableFiles.forEach(function (file) {
      if (!file || file.blobState !== 'ready' || !file.fileId) return;
      if (byFileId.has(String(file.fileId))) return;
      if (file.sha256 && bySha.has(String(file.sha256))) return;
      const item = libraryItemFromWorkspaceFile(file);
      state.items.push(item);
      byFileId.add(String(file.fileId));
      if (file.sha256) bySha.add(String(file.sha256));
      recovered += 1;
    });

    if (recovered) {
      state.items.sort(function (a, b) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      state.activeId = normalizeActiveId(state.activeId);
      save();
    }
    return recovered;
  }

  const recoveredWorkspaceFiles = recoverWorkspaceFilesOnBoot
    ? recoverFromWorkspaceFileStore()
    : 0;

  if (recoveredWorkspaceFiles) {
    console.info('[NSLibraryStore] recovered Workspace File Store items:', recoveredWorkspaceFiles);
  }

  function emitChange() {
    const snapshot = api.getState();

    listeners.forEach(function (listener) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[NSLibraryStore] Listener error:', err);
      }
    });

    try {
      window.dispatchEvent(
        new CustomEvent('ns:library-store-changed', {
          detail: snapshot
        })
      );
    } catch (err) {
      console.error('[NSLibraryStore] Failed to dispatch change event:', err);
    }
  }

  function commit() {
    syncState();
    save();
    emitChange();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function getState() {
    syncState();
    return clone(state);
  }

  function getAllItems() {
    return state.items.slice();
  }

  function setActiveItem(id) {
    if (!id) {
      state.activeId = state.items.length ? state.items[0].id : null;
      commit();
      return state.activeId;
    }

    state.activeId = hasItem(id) ? id : normalizeActiveId(null);
    commit();
    return state.activeId;
  }

  function setFilters(patch) {
    state.filters = Object.assign({}, state.filters, patch || {});
    state.filters.category = normalizeCategory(state.filters.category || 'all');
    commit();
  }

  function addItem(item) {
    const normalized = normalizeItem(item);
    state.items.unshift(normalized);
    state.activeId = normalized.id;
    syncState();
    commit();
    return normalized;
  }

  function updateItem(id, patch) {
    const index = state.items.findIndex(function (item) {
      return item.id === id;
    });

    if (index === -1) return null;

    const current = state.items[index];
    const next = normalizeItem(
      Object.assign({}, current, patch || {}, {
        updatedAt: safeNow(),
        storage: Object.assign({}, current.storage || {}, (patch && patch.storage) || {}),
        preview: Object.assign({}, current.preview || {}, (patch && patch.preview) || {}),
        usage: Object.assign({}, current.usage || {}, (patch && patch.usage) || {}),
        publishing: Object.assign({}, current.publishing || {}, (patch && patch.publishing) || {})
      })
    );

    state.items[index] = next;
    commit();
    return next;
  }

  function removeItem(id) {
    const index = state.items.findIndex(function (item) {
      return item.id === id;
    });

    if (index === -1) return false;

    state.items.splice(index, 1);
    syncState();
    commit();
    return true;
  }

  function toggleFavorite(id) {
    const item = state.items.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return null;
    return updateItem(id, { favorite: !item.favorite });
  }

  function togglePinned(id) {
    const item = state.items.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return null;
    return updateItem(id, { pinned: !item.pinned });
  }

  function addTag(id, tag) {
    const item = state.items.find(function (entry) {
      return entry.id === id;
    });
    if (!item || !tag) return null;

    const cleanTag = String(tag).trim();
    if (!cleanTag) return null;

    if (item.tags.includes(cleanTag)) return item;
    return updateItem(id, { tags: item.tags.concat(cleanTag) });
  }

  function removeTag(id, tag) {
    const item = state.items.find(function (entry) {
      return entry.id === id;
    });
    if (!item) return null;

    return updateItem(id, {
      tags: item.tags.filter(function (entry) {
        return entry !== tag;
      })
    });
  }

  function getItemById(id) {
    if (!id) return null;

    return (
      state.items.find(function (item) {
        return item.id === id;
      }) || null
    );
  }

  function getFilteredItems() {
    const query = state.filters.query.trim().toLowerCase();
    const category = normalizeCategory(state.filters.category);
    const sort = state.filters.sort;

    let items = state.items.slice();

    if (category && category !== 'all') {
      if (category === 'favorites') {
        items = items.filter(function (item) {
          return item.favorite;
        });
      } else if (category === 'pinned') {
        items = items.filter(function (item) {
          return item.pinned;
        });
      } else {
        items = items.filter(function (item) {
          return normalizeCategory(item.category) === category;
        });
      }
    }

    if (query) {
      items = items.filter(function (item) {
        const haystack = [
          item.name,
          item.originalName,
          item.type,
          item.description,
          item.category,
          item.ext,
          item.preview && item.preview.excerpt,
          item.preview && item.preview.textContent
        ]
          .concat(item.tags || [])
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.indexOf(query) !== -1;
      });
    }

    items.sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }

      if (sort === 'size') {
        return b.size - a.size;
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return items;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function fileToText(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();

      reader.onload = function () {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      };

      reader.onerror = function () {
        resolve('');
      };

      try {
        reader.readAsText(file);
      } catch (err) {
        resolve('');
      }
    });
  }

  function makeFingerprint(file) {
    return [
      safeLower(file && file.name),
      Number((file && file.size) || 0),
      Number((file && file.lastModified) || 0)
    ].join('::');
  }

  function getWorkspaceFileApi() {
    const api = window.nsAPI;
    if (!api || typeof api.workspaceFileImportBuffer !== 'function') return null;
    return api;
  }

  async function createItemFromWorkspaceFile(file) {
    const api = getWorkspaceFileApi();
    if (!api || !file || typeof file.arrayBuffer !== 'function') return null;

    const previewKind = detectPreviewKind(file.type, file.name);
    let textContent = '';
    let excerpt = '';

    if (previewKind === 'text') {
      textContent = await fileToText(file);
      excerpt = textContent.slice(0, 1000);
    }

    let result = null;

    try {
      result = await api.workspaceFileImportBuffer({
        ownerType: 'files',
        ownerId: 'library',
        role: 'source',
        sourceKind: 'computer',
        originalName: file.name,
        displayName: file.name,
        mimeType: file.type || 'application/octet-stream',
        bytes: await file.arrayBuffer()
      });
    } catch (err) {
      console.warn('[NSLibraryStore] Workspace File Store import failed:', err);
      return null;
    }

    if (!result || result.ok !== true || !result.file || !result.ref) {
      return null;
    }

    return normalizeItem({
      name: result.file.displayName || result.file.originalName || file.name,
      originalName: result.file.originalName || file.name,
      type: result.file.mimeType || file.type || 'application/octet-stream',
      ext: result.file.extension || getExt(file.name),
      size: Number(result.file.sizeBytes || file.size || 0),
      category: inferCategory(file),
      tags: [],
      description: '',
      favorite: false,
      pinned: false,
      fingerprint: makeFingerprint(file),
      storage: {
        kind: 'workspace-file',
        dataUrl: null,
        fileId: result.file.fileId,
        refId: result.ref.refId,
        sha256: result.file.sha256 || null
      },
      preview: {
        kind: previewKind,
        excerpt: excerpt,
        textContent: textContent,
        textType: isRdfLike(file.type, file.name) ? 'rdf' : 'text'
      },
      usage: {
        inChatContext: false,
        inEditor: false,
        inPublishing: false,
        inSiteAssets: false
      },
      publishing: {
        ipfsReady: false,
        ipfsCid: null,
        publishName: null
      }
    });
  }

  async function createItemFromFile(file) {
    const previewKind = detectPreviewKind(file.type, file.name);
    let dataUrl = null;
    let textContent = '';
    let excerpt = '';

    try {
      dataUrl = await fileToDataUrl(file);
    } catch (err) {
      dataUrl = null;
    }

    if (previewKind === 'text') {
      textContent = await fileToText(file);
      excerpt = textContent.slice(0, 1000);
    }

    return normalizeItem({
      name: file.name,
      originalName: file.name,
      type: file.type || 'application/octet-stream',
      ext: getExt(file.name),
      size: file.size || 0,
      category: inferCategory(file),
      tags: [],
      description: '',
      favorite: false,
      pinned: false,
      fingerprint: makeFingerprint(file),
      storage: {
        kind: 'local',
        dataUrl: dataUrl
      },
      preview: {
        kind: previewKind,
        excerpt: excerpt,
        textContent: textContent,
        textType: isRdfLike(file.type, file.name) ? 'rdf' : 'text'
      },
      usage: {
        inChatContext: false,
        inEditor: false,
        inPublishing: false,
        inSiteAssets: false
      },
      publishing: {
        ipfsReady: false,
        ipfsCid: null,
        publishName: null
      }
    });
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList || []);
    const created = [];

    for (const file of files) {
      try {
        let nextItem = null;

        if (getWorkspaceFileApi()) {
          nextItem = await createItemFromWorkspaceFile(file);

          if (!nextItem) {
            throw new Error('Workspace File Store import failed');
          }
        } else {
          // Compatibility only for older builds that do not expose the
          // Workspace File Store bridge.
          nextItem = await createItemFromFile(file);
        }

        // IRGEZTNE_FILES_ONE_IMPORT_ONE_ITEM_R1G
        // Files is a user-facing library: every explicit import creates one
        // logical library item. Physical bytes remain content-addressed and
        // deduplicated by the Workspace File Store, so repeated content does
        // not require duplicate blob storage.
        state.items.unshift(nextItem);
        created.push(nextItem);
      } catch (err) {
        console.error('[NSLibraryStore] Failed to import file:', file && file.name, err);
      }
    }

    if (created.length) {
      state.activeId = created[0].id;
      syncState();
      commit();
    }

    return created;
  }

  function clearAll() {
    state.items = [];
    state.activeId = null;
    state.filters = {
      query: '',
      category: 'all',
      sort: 'recent'
    };
    commit();
  }

  const api = {
    getState: getState,
    getAllItems: getAllItems,
    subscribe: subscribe,
    addItem: addItem,
    updateItem: updateItem,
    removeItem: removeItem,
    toggleFavorite: toggleFavorite,
    togglePinned: togglePinned,
    addTag: addTag,
    removeTag: removeTag,
    getItemById: getItemById,
    setActiveItem: setActiveItem,
    setFilters: setFilters,
    getFilteredItems: getFilteredItems,
    importFiles: importFiles,
    clearAll: clearAll
  };

  window.NSLibraryStore = api;
})();
