(function (root) {
  const STORAGE_KEY = 'ns.browser.v8.projects.v1';

  const PROJECT_TYPES = [
    'article',
    'site',
    'research',
    'module',
    'package',
    'collection'
  ];

  const PROJECT_STATUSES = [
    'idea',
    'active',
    'review',
    'ready',
    'published',
    'archived'
  ];

  const DEFAULT_STATE = {
    items: [],
    meta: {
      version: 1,
      lastOpenedProjectId: '',
      lastUpdatedAt: ''
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId() {
    return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeType(value) {
    return PROJECT_TYPES.includes(value) ? value : 'article';
  }

  function normalizeStatus(value) {
    return PROJECT_STATUSES.includes(value) ? value : 'idea';
  }

  function uniqueIds(value) {
    return Array.from(new Set((Array.isArray(value) ? value : []).filter(Boolean).map(String)));
  }

  function normalizeProject(raw) {
    const createdAt = raw && raw.createdAt ? String(raw.createdAt) : nowIso();
    const updatedAt = raw && raw.updatedAt ? String(raw.updatedAt) : createdAt;

    return {
      id: raw && raw.id ? String(raw.id) : createId(),
      title: raw && raw.title ? String(raw.title).trim() : 'Проект без названия',
      type: normalizeType(raw && raw.type),
      status: normalizeStatus(raw && raw.status),
      description: raw && raw.description ? String(raw.description) : '',
      templateId: raw && raw.templateId ? String(raw.templateId) : '',
      fileIds: uniqueIds(raw && raw.fileIds),
      noteIds: uniqueIds(raw && raw.noteIds),
      draftIds: uniqueIds(raw && raw.draftIds),
      cover: raw && raw.cover ? String(raw.cover) : '',
      color: raw && raw.color ? String(raw.color) : '',
      pinned: Boolean(raw && raw.pinned),
      archived: Boolean(raw && raw.archived),
      createdAt: createdAt,
      updatedAt: updatedAt
    };
  }

  function ensureShape(data) {
    const safe = data && typeof data === 'object' ? data : {};
    const meta = safe.meta && typeof safe.meta === 'object' ? safe.meta : {};
    return {
      items: Array.isArray(safe.items) ? safe.items.map(normalizeProject) : [],
      meta: {
        version: 1,
        lastOpenedProjectId: meta.lastOpenedProjectId ? String(meta.lastOpenedProjectId) : '',
        lastUpdatedAt: meta.lastUpdatedAt ? String(meta.lastUpdatedAt) : ''
      }
    };
  }

  function sortByUpdated(items) {
    return clone(items).sort(function (a, b) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  function createStore() {
    let state = loadFromStorage();
    const listeners = [];

    function notify() {
      const snapshot = getState();
      listeners.slice().forEach(function (listener) {
        try {
          listener(snapshot);
        } catch (error) {
          console.warn('[NSProjectStore] subscriber failed:', error);
        }
      });
    }

    function readStorage() {
      try {
        return root.localStorage.getItem(STORAGE_KEY) || '';
      } catch (error) {
        console.warn('[NSProjectStore] readStorage failed:', error);
        return '';
      }
    }

    function writeStorage(text) {
      try {
        root.localStorage.setItem(STORAGE_KEY, text);
      } catch (error) {
        console.warn('[NSProjectStore] writeStorage failed:', error);
      }
    }

    function loadFromStorage() {
      try {
        const text = readStorage();
        if (text && String(text).trim()) {
          return ensureShape(JSON.parse(text));
        }
      } catch (error) {
        console.warn('[NSProjectStore] parse failed, using defaults:', error);
      }

      return clone(DEFAULT_STATE);
    }

    function persist() {
      state.meta.lastUpdatedAt = nowIso();
      writeStorage(JSON.stringify(state, null, 2));
      notify();
    }

    function getState() {
      return clone(state);
    }

    function getAll() {
      return sortByUpdated(state.items);
    }

    function getById(projectId) {
      const found = state.items.find(function (item) {
        return item.id === projectId;
      });
      return found ? clone(found) : null;
    }

    function getSummary() {
      return state.items.reduce(function (acc, item) {
        acc.total += 1;
        if (item.pinned) acc.pinned += 1;
        if (item.archived) acc.archived += 1;
        else acc.active += 1;
        return acc;
      }, {
        total: 0,
        active: 0,
        pinned: 0,
        archived: 0
      });
    }

    function getLastOpenedProjectId() {
      return state.meta.lastOpenedProjectId || '';
    }

    function setLastOpenedProjectId(projectId) {
      const nextId = projectId || '';
      if (state.meta.lastOpenedProjectId === nextId) return;
      state.meta.lastOpenedProjectId = nextId;
      persist();
    }

    function search(query, options) {
      const q = String(query || '').trim().toLowerCase();
      const showArchived = Boolean(options && options.showArchived);

      return getAll().filter(function (item) {
        if (!showArchived && item.archived) return false;
        if (!q) return true;

        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q)
        );
      });
    }

    function getCounts(projectId) {
      const project = getById(projectId);
      if (!project) {
        return { files: 0, notes: 0, drafts: 0 };
      }

      return {
        files: project.fileIds.length,
        notes: project.noteIds.length,
        drafts: project.draftIds.length
      };
    }

    function createProject(payload) {
      const timestamp = nowIso();
      const project = normalizeProject(Object.assign({}, payload || {}, {
        id: createId(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));

      state.items.unshift(project);
      state.meta.lastOpenedProjectId = project.id;
      persist();
      return clone(project);
    }

    function update(projectId, patch) {
      const index = state.items.findIndex(function (item) {
        return item.id === projectId;
      });

      if (index === -1) return null;

      const current = state.items[index];
      const next = normalizeProject(Object.assign({}, current, patch || {}, {
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: nowIso()
      }));

      state.items[index] = next;
      persist();
      return clone(next);
    }

    function setPinned(projectId, value) {
      return update(projectId, { pinned: Boolean(value) });
    }

    function archive(projectId) {
      return update(projectId, {
        archived: true,
        status: 'archived'
      });
    }

    function unarchive(projectId) {
      return update(projectId, {
        archived: false,
        status: 'active'
      });
    }

    function attachUnique(projectId, key, value) {
      const project = getById(projectId);
      if (!project || !value) return null;

      const next = uniqueIds(project[key].concat([String(value)]));
      const patch = {};
      patch[key] = next;
      return update(projectId, patch);
    }

    function detachValue(projectId, key, value) {
      const project = getById(projectId);
      if (!project) return null;

      const next = project[key].filter(function (item) {
        return item !== value;
      });

      const patch = {};
      patch[key] = next;
      return update(projectId, patch);
    }

    function attachFile(projectId, fileId) {
      return attachUnique(projectId, 'fileIds', fileId);
    }

    function detachFile(projectId, fileId) {
      return detachValue(projectId, 'fileIds', fileId);
    }

    function attachNote(projectId, noteId) {
      return attachUnique(projectId, 'noteIds', noteId);
    }

    function detachNote(projectId, noteId) {
      return detachValue(projectId, 'noteIds', noteId);
    }

    function attachDraft(projectId, draftId) {
      return attachUnique(projectId, 'draftIds', draftId);
    }

    function detachDraft(projectId, draftId) {
      return detachValue(projectId, 'draftIds', draftId);
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') {
        return function noop() {};
      }

      listeners.push(listener);

      return function unsubscribe() {
        const index = listeners.indexOf(listener);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    }

    return {
      PROJECT_TYPES: PROJECT_TYPES.slice(),
      PROJECT_STATUSES: PROJECT_STATUSES.slice(),
      getState: getState,
      getAll: getAll,
      getById: getById,
      getSummary: getSummary,
      getLastOpenedProjectId: getLastOpenedProjectId,
      setLastOpenedProjectId: setLastOpenedProjectId,
      search: search,
      getCounts: getCounts,
      create: createProject,
      update: update,
      setPinned: setPinned,
      archive: archive,
      unarchive: unarchive,
      attachFile: attachFile,
      detachFile: detachFile,
      attachNote: attachNote,
      detachNote: detachNote,
      attachDraft: attachDraft,
      detachDraft: detachDraft,
      subscribe: subscribe
    };
  }

  root.NSProjectStore = createStore();
})(window);
