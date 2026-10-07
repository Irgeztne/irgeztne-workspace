(function () {
  // IRGEZTNE_WORKSHOP_DRAFT_DURABILITY_R1W8F
  const STORAGE_KEY = 'nsbrowser:v1:codehub-items';
  const DURABLE_STATE_KEY = 'workspace.codehub.v1';
  const DURABLE_PERSISTENCE_VERSION = 1;
  const SCHEMA_VERSION = '1.1';
  const DEFAULT_AUTHOR = '';
  const LEGACY_DEFAULT_AUTHOR = 'Local creator';
  const VALID_TYPES = ['template', 'theme', 'component', 'widget'];
  const VALID_STATUSES = ['draft', 'validated', 'ready', 'submitted', 'review', 'published', 'rejected', 'archived'];
  const VALID_DISTRIBUTIONS = ['free', 'freemium', 'pro'];
  const VALID_TRUST = ['local', 'reviewed', 'official'];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return [prefix || 'pkg', Date.now(), Math.random().toString(36).slice(2, 8)].join('_');
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeString(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : (fallback || '');
  }

  function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(function (item) {
      return normalizeString(item, '');
    }).filter(Boolean))];
  }

  function normalizeGallery(value) {
    if (Array.isArray(value)) {
      return normalizeStringArray(value).slice(0, 6);
    }

    if (typeof value === 'string') {
      return normalizeStringArray(value.split(/\r?\n|,/g)).slice(0, 6);
    }

    return [];
  }

  function normalizeFileRole(value) {
    const role = normalizeString(value, 'asset').toLowerCase();
    return ['main', 'style', 'template', 'asset', 'cover', 'preview', 'manifest', 'data'].includes(role)
      ? role
      : 'asset';
  }

  function guessKind(fileName, mimeType) {
    const lowerName = normalizeString(fileName, '').toLowerCase();
    const mime = normalizeString(mimeType, '').toLowerCase();

    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(lowerName)) return 'image';
    if (/\.css$/i.test(lowerName)) return 'stylesheet';
    if (/\.json$/i.test(lowerName)) return 'data';
    if (/\.(txt|md)$/i.test(lowerName)) return 'text';
    if (/\.html?$/i.test(lowerName)) return 'document';
    return 'asset';
  }

  function normalizeFileEntry(file, index) {
    return {
      id: normalizeString(file && file.id, '') || uid('file'),
      path: normalizeString(file && (file.path || file.name), 'untitled-file'),
      originalName: normalizeString(file && (file.originalName || file.name || file.path), ''),
      role: normalizeFileRole(file && file.role),
      kind: normalizeString(file && file.kind, '') || guessKind(file && (file.path || file.name), file && file.mime),
      size: Number.isFinite(file && file.size) ? Number(file.size) : 0,
      mime: normalizeString(file && file.mime, ''),
      sha256: normalizeString(file && file.sha256, '').toLowerCase(),
      blobKey: normalizeString(file && file.blobKey, ''),
      byteState: normalizeString(file && file.byteState, file && file.blobKey ? 'ready' : 'missing'),
      order: Number.isFinite(file && file.order) ? Number(file.order) : index
    };
  }

  function normalizeDescription(value) {
    if (typeof value === 'string') {
      return {
        short: value.trim(),
        full: value.trim()
      };
    }

    return {
      short: normalizeString(value && value.short, ''),
      full: normalizeString(value && value.full, '')
    };
  }

  function normalizePreview(value) {
    return {
      cover: normalizeString(value && value.cover, ''),
      gallery: normalizeGallery(value && value.gallery),
      note: normalizeString(value && value.note, ''),
      surface: normalizeString(value && value.surface, 'editor') || 'editor'
    };
  }

  function normalizeCompatibility(value) {
    const minAppVersion = normalizeString(value && value.minAppVersion, '1.0.0') || '1.0.0';
    return {
      product: 'webstudio',
      minAppVersion: minAppVersion
    };
  }

  function normalizeType(value) {
    const type = normalizeString(value, 'template').toLowerCase();
    if (VALID_TYPES.includes(type)) return type;
    if (type === 'pack' || type === 'asset-pack') return 'component';
    if (type === 'starter') return 'template';
    return 'template';
  }

  function normalizeStatus(value) {
    const status = normalizeString(value, 'draft').toLowerCase();
    if (VALID_STATUSES.includes(status)) return status;
    if (status === 'approved') return 'published';
    return 'draft';
  }

  function normalizeDistribution(value) {
    const distribution = normalizeString(value, 'free').toLowerCase();
    return VALID_DISTRIBUTIONS.includes(distribution) ? distribution : 'free';
  }

  function normalizeAuthor(value) {
    if (typeof value === 'string') {
      const name = normalizeString(value, DEFAULT_AUTHOR);
      return {
        name: name === LEGACY_DEFAULT_AUTHOR ? '' : name,
        id: '',
        source: 'local'
      };
    }

    const name = normalizeString(value && value.name, DEFAULT_AUTHOR);
    return {
      name: name === LEGACY_DEFAULT_AUTHOR ? '' : name,
      id: normalizeString(value && value.id, ''),
      source: normalizeString(value && value.source, 'local') || 'local'
    };
  }

  function normalizeItem(item) {
    const createdAt = normalizeString(item && item.createdAt, '') || nowIso();
    const updatedAt = normalizeString(item && item.updatedAt, '') || createdAt;
    const type = normalizeType(item && item.type);
    const status = normalizeStatus(item && item.status);
    const trust = normalizeString(item && item.trust, 'local').toLowerCase();

    const files = Array.isArray(item && item.files)
      ? item.files.map(normalizeFileEntry).sort(function (a, b) {
          return a.order - b.order;
        })
      : [];

    return {
      id: normalizeString(item && item.id, '') || uid('pkg'),
      type: type,
      title: normalizeString(item && item.title, 'Пакет без названия') || 'Пакет без названия',
      author: normalizeAuthor(item && item.author),
      version: normalizeString(item && item.version, '0.1.0') || '0.1.0',
      license: normalizeString(item && item.license, ''),
      description: normalizeDescription(item && item.description),
      tags: normalizeStringArray(item && item.tags).slice(0, 8),
      status: status,
      distribution: normalizeDistribution(item && item.distribution),
      trust: VALID_TRUST.includes(trust) ? trust : 'local',
      preview: normalizePreview(item && item.preview),
      files: files,
      compatibility: normalizeCompatibility(item && item.compatibility),
      createdAt: createdAt,
      updatedAt: updatedAt,
      archived: Boolean(item && item.archived)
    };
  }

  function createDefaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      persistenceVersion: DURABLE_PERSISTENCE_VERSION,
      items: [],
      activeItemId: '',
      meta: {
        lastUpdatedAt: ''
      }
    };
  }

  function normalizeState(raw) {
    const base = createDefaultState();
    if (!raw || typeof raw !== 'object') return base;

    const rawSchemaVersion = normalizeString(raw.schemaVersion, '1.0') || '1.0';
    const isLegacyStatusModel = rawSchemaVersion !== SCHEMA_VERSION;
    const items = Array.isArray(raw.items) ? raw.items.map(function (entry) {
      const migrated = Object.assign({}, entry || {});
      if (isLegacyStatusModel) {
        const oldStatus = normalizeString(migrated.status, 'draft').toLowerCase();
        if (oldStatus === 'ready') migrated.status = 'validated';
        else if (oldStatus === 'submitted') migrated.status = 'ready';
        else if (oldStatus === 'approved') migrated.status = 'published';
      }
      return normalizeItem(migrated);
    }) : [];
    const activeItemId = normalizeString(raw.activeItemId, '');
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};

    return {
      schemaVersion: SCHEMA_VERSION,
      persistenceVersion: Math.max(0, Number(raw.persistenceVersion || 0)),
      items: items,
      activeItemId: items.some(function (item) { return item.id === activeItemId; }) ? activeItemId : (items[0] ? items[0].id : ''),
      meta: {
        lastUpdatedAt: normalizeString(meta.lastUpdatedAt, '')
      }
    };
  }

  function readLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn('[NSCodeHubStore] local read failed:', error);
      return null;
    }
  }

  function readDurableState() {
    try {
      const ns = window.nsAPI;
      if (!ns || typeof ns.storageGetModuleStateSync !== 'function') return null;
      const raw = ns.storageGetModuleStateSync(DURABLE_STATE_KEY, null);
      return raw && typeof raw === 'object' ? normalizeState(raw) : null;
    } catch (error) {
      console.warn('[NSCodeHubStore] durable read failed:', error);
      return null;
    }
  }

  function stateStamp(candidate) {
    if (!candidate || !candidate.meta) return 0;
    return Date.parse(candidate.meta.lastUpdatedAt || '') || 0;
  }

  function loadState() {
    const local = readLocalState();
    const durable = readDurableState();

    if (local && durable) {
      const localModern = Number(local.persistenceVersion || 0) >= DURABLE_PERSISTENCE_VERSION;
      const durableModern = Number(durable.persistenceVersion || 0) >= DURABLE_PERSISTENCE_VERSION;

      if (localModern || durableModern) {
        const localStamp = stateStamp(local);
        const durableStamp = stateStamp(durable);
        if (localStamp > durableStamp) return local;
        if (durableStamp > localStamp) return durable;
        if (localModern && !durableModern) return local;
        if (durableModern && !localModern) return durable;
      }

      // First upgrade from the old localStorage-only model: the visible local
      // state is authoritative. This is important for deletions, because a
      // stale durable mirror may contain an item that the user already removed.
      return local;
    }

    return local || durable || createDefaultState();
  }

  let state = loadState();
  const needsInitialDurableMirror = Number(state.persistenceVersion || 0) < DURABLE_PERSISTENCE_VERSION || !state.meta || !state.meta.lastUpdatedAt;
  const listeners = new Set();

  function emitChange() {
    const snapshot = api.getState();
    listeners.forEach(function (listener) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[NSCodeHubStore] listener failed:', error);
      }
    });
  }

  function writeDurableState() {
    try {
      const ns = window.nsAPI;
      if (!ns || typeof ns.storageSetModuleStateSync !== 'function') return false;
      const result = ns.storageSetModuleStateSync(DURABLE_STATE_KEY, deepClone(state));
      return Boolean(result && result.ok === true);
    } catch (error) {
      console.error('[NSCodeHubStore] durable save failed:', error);
      return false;
    }
  }

  function writeLocalState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error('[NSCodeHubStore] local save failed:', error);
      return false;
    }
  }

  function saveState() {
    if (!state.meta || typeof state.meta !== 'object') state.meta = { lastUpdatedAt: '' };
    state.schemaVersion = SCHEMA_VERSION;
    state.persistenceVersion = DURABLE_PERSISTENCE_VERSION;
    state.meta.lastUpdatedAt = nowIso();

    const durableOk = writeDurableState();
    writeLocalState();

    if (window.nsAPI && typeof window.nsAPI.storageSetModuleStateSync === 'function' && !durableOk) {
      console.error('[NSCodeHubStore] durable state was not saved; local state remains authoritative for recovery.');
    }
    emitChange();
  }

  function findItemIndex(id) {
    return state.items.findIndex(function (item) {
      return item.id === id;
    });
  }

  function touchItem(item) {
    const next = normalizeItem(Object.assign({}, item, { updatedAt: nowIso() }));
    return next;
  }

  function validateItemPayload(item) {
    const normalized = normalizeItem(item);
    const errors = [];
    const warnings = [];

    if (!normalized.title || normalized.title === 'Пакет без названия') {
      errors.push('Package title is required.');
    }

    if (!VALID_TYPES.includes(normalized.type)) {
      errors.push('Package type is not supported.');
    }

    if (!normalized.version) {
      errors.push('Version is required.');
    } else if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(normalized.version)) {
      errors.push('Version must use semantic x.y.z format.');
    }

    if (
      !normalized.author ||
      !normalized.author.name ||
      normalized.author.name === DEFAULT_AUTHOR
    ) {
      errors.push('Author name is required.');
    }

    if (!normalized.license) {
      errors.push('Package license is required.');
    }

    if (!normalized.description.short) {
      errors.push('Нужно краткое описание.');
    }

    if (!normalized.preview.cover) {
      errors.push('Cover preview is required.');
    } else if (!normalized.files.some(function (file) { return file.path === normalized.preview.cover && file.kind === 'image'; })) {
      errors.push('Cover preview must reference an image included in the package.');
    }

    if (!normalized.files.length) {
      errors.push('Add at least one file to the package.');
    } else {
      const seenPaths = new Set();
      const dangerousExtensions = /\.(?:exe|msi|dll|so|dylib|app|deb|rpm|appimage|bat|cmd|ps1|sh|jar)$/i;
      let hasPrimaryFile = false;

      normalized.files.forEach(function (file) {
        const filePath = String(file && file.path || '').trim();
        const normalizedPath = filePath.replace(/\\/g, '/');

        if (file && (file.role === 'main' || file.role === 'template')) {
          hasPrimaryFile = true;
        }

        if (
          !filePath ||
          normalizedPath.startsWith('/') ||
          /^[A-Za-z]:\//.test(normalizedPath) ||
          normalizedPath.split('/').includes('..') ||
          normalizedPath.includes('\u0000')
        ) {
          errors.push('Unsafe package file path: ' + (filePath || '(empty)'));
        }

        const lowerPath = normalizedPath.toLowerCase();
        if (seenPaths.has(lowerPath)) {
          errors.push('Duplicate package file path: ' + filePath);
        } else {
          seenPaths.add(lowerPath);
        }

        if (dangerousExtensions.test(normalizedPath)) {
          errors.push('Executable or installer file is not allowed in Workshop v1: ' + filePath);
        }

        if (!file.blobKey || file.byteState !== 'ready') {
          errors.push('Real file bytes are missing for package file: ' + filePath);
        }

        if (!/^[a-f0-9]{64}$/.test(String(file.sha256 || ''))) {
          errors.push('SHA-256 is missing or invalid for package file: ' + filePath);
        }
      });

      if (!hasPrimaryFile) {
        errors.push('At least one main or template file is required.');
      }
    }

    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(normalized.compatibility.minAppVersion)) {
      errors.push('Minimum Workspace version must use semantic x.y.z format.');
    }

    const imagePaths = new Set(normalized.files.filter(function (file) { return file.kind === 'image'; }).map(function (file) { return file.path; }));
    normalized.preview.gallery.forEach(function (path) {
      if (!imagePaths.has(path)) errors.push('Gallery preview must reference an image included in the package: ' + path);
    });

    if (normalized.tags.length === 0) {
      warnings.push('Tags are empty. Add 1–3 tags for better filtering later.');
    }

    if (!normalized.description.full) {
      warnings.push('Full description is empty.');
    }

    if (normalized.preview.gallery.length === 0) {
      warnings.push('Gallery images are empty.');
    }

    return {
      item: normalized,
      errors: errors,
      warnings: warnings,
      isReady: errors.length === 0
    };
  }

  const api = {
    subscribe(listener) {
      if (typeof listener !== 'function') {
        return function unsubscribe() {};
      }

      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    },

    getState() {
      return deepClone(state);
    },

    getAll() {
      return deepClone(state.items);
    },

    getById(id) {
      const item = state.items.find(function (entry) {
        return entry.id === id;
      });
      return item ? deepClone(item) : null;
    },

    getActiveItem() {
      return this.getById(state.activeItemId);
    },

    setActiveItem(id) {
      if (!id || !state.items.some(function (item) { return item.id === id; })) return null;
      state.activeItemId = id;
      saveState();
      return this.getById(id);
    },

    createItem(payload) {
      const item = normalizeItem(Object.assign({
        id: uid('pkg'),
        title: 'Пакет без названия',
        type: 'template',
        version: '0.1.0',
        license: '',
        status: 'draft',
        distribution: 'free',
        trust: 'local',
        author: { name: DEFAULT_AUTHOR, id: '', source: 'local' },
        description: { short: '', full: '' },
        preview: { cover: '', gallery: [], note: '', surface: 'editor' },
        files: [],
        compatibility: { product: 'webstudio', minAppVersion: '1.0.0' },
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archived: false
      }, payload || {}));

      state.items.unshift(item);
      state.activeItemId = item.id;
      saveState();
      return deepClone(item);
    },

    updateItem(id, patch) {
      const index = findItemIndex(id);
      if (index === -1) return null;

      const current = state.items[index];
      const merged = Object.assign({}, current, patch || {});
      if (patch && patch.description) {
        merged.description = Object.assign({}, current.description || {}, patch.description || {});
      }
      if (patch && patch.author) {
        merged.author = Object.assign({}, current.author || {}, patch.author || {});
      }
      if (patch && patch.preview) {
        merged.preview = Object.assign({}, current.preview || {}, patch.preview || {});
      }
      if (patch && patch.compatibility) {
        merged.compatibility = Object.assign({}, current.compatibility || {}, patch.compatibility || {});
      }
      if (patch && Array.isArray(patch.files)) {
        merged.files = patch.files;
      }
      if (patch && Array.isArray(patch.tags)) {
        merged.tags = patch.tags;
      }

      state.items[index] = touchItem(merged);
      saveState();
      return deepClone(state.items[index]);
    },

    deleteItem(id) {
      const index = findItemIndex(id);
      if (index === -1) return false;
      state.items.splice(index, 1);
      if (state.activeItemId === id) {
        state.activeItemId = state.items[0] ? state.items[0].id : '';
      }
      saveState();
      return true;
    },

    duplicateItem(id) {
      const source = this.getById(id);
      if (!source) return null;
      return this.createItem(Object.assign({}, source, {
        id: uid('pkg'),
        title: (source.title || 'Пакет без названия') + ' Копия',
        status: 'draft',
        trust: 'local',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        archived: false
      }));
    },

    archiveItem(id) {
      return this.updateItem(id, {
        archived: true,
        status: 'archived'
      });
    },

    restoreItem(id) {
      return this.updateItem(id, {
        archived: false,
        status: 'draft'
      });
    },

    setStatus(id, status) {
      if (!VALID_STATUSES.includes(status)) return null;
      return this.updateItem(id, { status: status });
    },

    setPreview(id, previewPatch) {
      return this.updateItem(id, {
        preview: previewPatch || {}
      });
    },

    setFiles(id, files) {
      const normalized = Array.isArray(files) ? files.map(normalizeFileEntry) : [];
      return this.updateItem(id, { files: normalized });
    },

    addFile(id, fileEntry) {
      const item = this.getById(id);
      if (!item) return null;
      const nextFiles = item.files.concat([normalizeFileEntry(fileEntry, item.files.length)]);
      return this.setFiles(id, nextFiles);
    },

    removeFile(id, fileEntryId) {
      const item = this.getById(id);
      if (!item) return null;
      const nextFiles = item.files.filter(function (file) {
        return file.id !== fileEntryId;
      });
      return this.setFiles(id, nextFiles);
    },

    validateItem(id) {
      const item = typeof id === 'string' ? this.getById(id) : id;
      if (!item) {
        return {
          item: null,
          errors: ['Package was not found.'],
          warnings: [],
          isReady: false
        };
      }
      return validateItemPayload(item);
    },

    markReady(id) {
      const validation = this.validateItem(id);
      if (!validation.isReady) return validation;
      this.updateItem(id, { status: 'validated' });
      return validation;
    },

    markSubmitted(id) {
      const validation = this.validateItem(id);
      if (!validation.isReady) return validation;
      this.updateItem(id, { status: 'ready' });
      return validation;
    },

    getSubmittedItems() {
      return state.items.filter(function (item) {
        return item.status === 'ready' && item.archived !== true;
      }).map(deepClone);
    },

    getCounts() {
      const counts = {
        all: state.items.length,
        draft: 0,
        validated: 0,
        ready: 0,
        submitted: 0,
        review: 0,
        published: 0,
        rejected: 0,
        archived: 0
      };

      state.items.forEach(function (item) {
        const key = VALID_STATUSES.includes(item.status) ? item.status : 'draft';
        counts[key] += 1;
      });

      return counts;
    }
  };

  // On first load of the direct-durable model, mirror the chosen state to both
  // stores after the API exists so notifications are safe.
  if (needsInitialDurableMirror) {
    saveState();
  }

  window.NSCodeHubStore = api;
})();
