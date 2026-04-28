(function () {
  const STORAGE_KEY = 'nsbrowser:v1:codehub-items';
  const SCHEMA_VERSION = '1.0';
  const DEFAULT_AUTHOR = 'Local creator';
  const VALID_TYPES = ['template', 'theme', 'pack', 'widget', 'asset-pack', 'starter'];
  const VALID_STATUSES = ['draft', 'ready', 'submitted', 'approved', 'rejected', 'archived'];
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
      role: normalizeFileRole(file && file.role),
      kind: normalizeString(file && file.kind, '') || guessKind(file && (file.path || file.name), file && file.mime),
      size: Number.isFinite(file && file.size) ? Number(file.size) : 0,
      mime: normalizeString(file && file.mime, ''),
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
    return {
      nsBrowser: normalizeString(value && value.nsBrowser, '8.x') || '8.x',
      moduleTarget: normalizeStringArray(value && value.moduleTarget).length
        ? normalizeStringArray(value && value.moduleTarget)
        : ['catalog'],
      surface: normalizeStringArray(value && value.surface).length
        ? normalizeStringArray(value && value.surface)
        : ['workspace', 'cabinet'],
      minAppVersion: normalizeString(value && value.minAppVersion, '8.0.0') || '8.0.0'
    };
  }

  function normalizeAuthor(value) {
    if (typeof value === 'string') {
      return {
        name: normalizeString(value, DEFAULT_AUTHOR),
        id: '',
        source: 'local'
      };
    }

    return {
      name: normalizeString(value && value.name, DEFAULT_AUTHOR),
      id: normalizeString(value && value.id, ''),
      source: normalizeString(value && value.source, 'local') || 'local'
    };
  }

  function normalizeItem(item) {
    const createdAt = normalizeString(item && item.createdAt, '') || nowIso();
    const updatedAt = normalizeString(item && item.updatedAt, '') || createdAt;
    const type = normalizeString(item && item.type, 'template').toLowerCase();
    const status = normalizeString(item && item.status, 'draft').toLowerCase();
    const trust = normalizeString(item && item.trust, 'local').toLowerCase();

    const files = Array.isArray(item && item.files)
      ? item.files.map(normalizeFileEntry).sort(function (a, b) {
          return a.order - b.order;
        })
      : [];

    return {
      id: normalizeString(item && item.id, '') || uid('pkg'),
      type: VALID_TYPES.includes(type) ? type : 'template',
      title: normalizeString(item && item.title, 'Пакет без названия') || 'Пакет без названия',
      author: normalizeAuthor(item && item.author),
      version: normalizeString(item && item.version, '0.1.0') || '0.1.0',
      description: normalizeDescription(item && item.description),
      tags: normalizeStringArray(item && item.tags).slice(0, 8),
      status: VALID_STATUSES.includes(status) ? status : 'draft',
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
      items: [],
      activeItemId: ''
    };
  }

  function normalizeState(raw) {
    const base = createDefaultState();
    if (!raw || typeof raw !== 'object') return base;

    const items = Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [];
    const activeItemId = normalizeString(raw.activeItemId, '');

    return {
      schemaVersion: normalizeString(raw.schemaVersion, SCHEMA_VERSION) || SCHEMA_VERSION,
      items: items,
      activeItemId: items.some(function (item) { return item.id === activeItemId; }) ? activeItemId : (items[0] ? items[0].id : '')
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn('[NSCodeHubStore] loadState failed:', error);
      return createDefaultState();
    }
  }

  let state = loadState();
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

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[NSCodeHubStore] saveState failed:', error);
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
    }

    if (!normalized.author || !normalized.author.name) {
      errors.push('Author name is required.');
    }

    if (!normalized.description.short) {
      errors.push('Нужно краткое описание.');
    }

    if (!normalized.preview.cover) {
      errors.push('Cover preview is required.');
    }

    if (!normalized.files.length) {
      errors.push('Add at least one file to the package.');
    }

    if (!normalized.compatibility.nsBrowser) {
      errors.push('NS Browser compatibility is required.');
    }

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
        status: 'draft',
        trust: 'local',
        author: { name: DEFAULT_AUTHOR, id: '', source: 'local' },
        description: { short: '', full: '' },
        preview: { cover: '', gallery: [], note: '', surface: 'editor' },
        files: [],
        compatibility: { nsBrowser: '8.x', moduleTarget: ['catalog'], surface: ['workspace', 'cabinet'], minAppVersion: '8.0.0' },
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
      this.updateItem(id, { status: 'ready' });
      return validation;
    },

    markSubmitted(id) {
      const validation = this.validateItem(id);
      if (!validation.isReady) return validation;
      this.updateItem(id, { status: 'submitted' });
      return validation;
    },

    getSubmittedItems() {
      return state.items.filter(function (item) {
        return item.status === 'submitted' && item.archived !== true;
      }).map(deepClone);
    },

    getCounts() {
      const counts = {
        all: state.items.length,
        draft: 0,
        ready: 0,
        submitted: 0,
        approved: 0,
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

  window.NSCodeHubStore = api;
})();
