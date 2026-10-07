(function (root) {
  'use strict';
  // IRGEZTNE_PROJECTS_LIVING_CORE_V07PR1

  const STORAGE_KEY = 'ns.browser.v8.projects.v1'; // legacy migration/cache
  const DURABLE_STATE_KEY = 'workspace.projects.v1';
  const DURABLE_PERSISTENCE_VERSION = 1;
  const ACTIVITY_LIMIT = 60;
  const IRGEZTNE_PROJECT_STORE_FINAL_POLISH_V07PR1E = true;

  const PROJECT_TYPES = [
    'article',
    'site',
    'research',
    'module',
    'package',
    'collection'
  ];

  // Keep the accepted publication-aware status contract for this release pass.
  // Project lifecycle simplification is intentionally deferred until its consumers are audited.
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

  function createId(prefix) {
    return (prefix || 'proj') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function cleanText(value) {
    return String(value == null ? '' : value).trim();
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

  function normalizeActivityItem(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      id: source.id ? String(source.id) : createId('pact'),
      type: cleanText(source.type) || 'PROJECT_UPDATED',
      createdAt: source.createdAt ? String(source.createdAt) : nowIso(),
      payload: source.payload && typeof source.payload === 'object' ? clone(source.payload) : {}
    };
  }

  function normalizeActivity(value) {
    return (Array.isArray(value) ? value : [])
      .map(normalizeActivityItem)
      .sort(function (a, b) { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); })
      .slice(0, ACTIVITY_LIMIT);
  }

  function normalizeLastWork(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const type = cleanText(source.type).toUpperCase();
    if (!type) return null;
    return {
      type: type,
      id: cleanText(source.id),
      label: cleanText(source.label),
      updatedAt: source.updatedAt ? String(source.updatedAt) : nowIso()
    };
  }

  function normalizeProject(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    const updatedAt = source.updatedAt ? String(source.updatedAt) : createdAt;

    return {
      id: source.id ? String(source.id) : createId('proj'),
      title: cleanText(source.title) || 'Проект без названия',
      type: normalizeType(source.type),
      status: normalizeStatus(source.status),
      description: source.description ? String(source.description) : '',
      goal: cleanText(source.goal),
      outcome: cleanText(source.outcome),
      nextAction: cleanText(source.nextAction),
      templateId: source.templateId ? String(source.templateId) : '',
      fileIds: uniqueIds(source.fileIds),
      noteIds: uniqueIds(source.noteIds),
      draftIds: uniqueIds(source.draftIds),
      cover: source.cover ? String(source.cover) : '',
      color: source.color ? String(source.color) : '',
      pinned: Boolean(source.pinned),
      archived: Boolean(source.archived),
      activity: normalizeActivity(source.activity),
      lastWork: normalizeLastWork(source.lastWork),
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

  function prependActivity(project, type, payload, timestamp) {
    const event = normalizeActivityItem({
      id: createId('pact'),
      type: type,
      createdAt: timestamp || nowIso(),
      payload: payload || {}
    });
    const next = normalizeActivity([event].concat(project.activity || []));
    return { event: event, activity: next };
  }

  function createStore() {
    let migrateLegacyOnBoot = false;
    let state = loadFromStorage();
    const listeners = [];

    if (migrateLegacyOnBoot) {
      if (writeDurableStorage()) migrateLegacyOnBoot = false;
    }

    function notify() {
      const snapshot = getState();
      listeners.slice().forEach(function (listener) {
        try {
          listener(snapshot);
        } catch (error) {
          console.warn('[NSProjectStore] subscriber failed:', error);
        }
      });
      try {
        document.dispatchEvent(new CustomEvent('irgeztne:projects-changed', { detail: snapshot }));
      } catch (error) {}
    }

    function readStorage() {
      try {
        return root.localStorage.getItem(STORAGE_KEY) || '';
      } catch (error) {
        console.warn('[NSProjectStore] legacy read failed:', error);
        return '';
      }
    }

    function writeStorage(text) {
      try {
        root.localStorage.setItem(STORAGE_KEY, text);
      } catch (error) {
        console.warn('[NSProjectStore] legacy mirror failed:', error);
      }
    }

    function readDurableStorage() {
      try {
        const api = root.nsAPI;
        if (!api || typeof api.storageGetModuleStateSync !== 'function') return null;
        const value = api.storageGetModuleStateSync(DURABLE_STATE_KEY, null);
        return value && typeof value === 'object' ? value : null;
      } catch (error) {
        console.warn('[NSProjectStore] durable read failed:', error);
        return null;
      }
    }

    function writeDurableStorage() {
      const api = root.nsAPI;
      if (!api || typeof api.storageSetModuleStateSync !== 'function') return false;
      const payload = clone(state);
      payload.persistenceVersion = DURABLE_PERSISTENCE_VERSION;
      try {
        const result = api.storageSetModuleStateSync(DURABLE_STATE_KEY, payload);
        return Boolean(result && result.ok === true);
      } catch (error) {
        console.error('[NSProjectStore] durable save failed:', error);
        return false;
      }
    }

    function loadFromStorage() {
      const durableRaw = readDurableStorage();
      const durable = durableRaw ? ensureShape(durableRaw) : null;
      let legacy = null;
      try {
        const text = readStorage();
        if (text && String(text).trim()) legacy = ensureShape(JSON.parse(text));
      } catch (error) {
        console.warn('[NSProjectStore] legacy parse failed:', error);
      }

      const durableCount = durable ? durable.items.length : 0;
      const legacyCount = legacy ? legacy.items.length : 0;
      const durableStamp = durable ? Date.parse(durable.meta.lastUpdatedAt || '') || 0 : 0;
      const legacyStamp = legacy ? Date.parse(legacy.meta.lastUpdatedAt || '') || 0 : 0;

      if (legacy && (legacyCount > durableCount || (legacyCount > 0 && legacyStamp > durableStamp))) {
        migrateLegacyOnBoot = true;
        return legacy;
      }
      if (durable) return durable;
      if (legacy) {
        migrateLegacyOnBoot = true;
        return legacy;
      }
      return clone(DEFAULT_STATE);
    }

    function persist() {
      state.meta.lastUpdatedAt = nowIso();
      const durableOk = writeDurableStorage();
      writeStorage(JSON.stringify(state, null, 2));
      if (root.nsAPI && typeof root.nsAPI.storageSetModuleStateSync === 'function' && !durableOk) {
        throw new Error('PROJECT_DURABLE_SAVE_FAILED');
      }
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
          item.goal.toLowerCase().includes(q) ||
          item.outcome.toLowerCase().includes(q) ||
          item.nextAction.toLowerCase().includes(q) ||
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
      let project = normalizeProject(Object.assign({}, payload || {}, {
        id: createId('proj'),
        createdAt: timestamp,
        updatedAt: timestamp
      }));
      const activity = prependActivity(project, 'PROJECT_CREATED', { title: project.title }, timestamp);
      project.activity = activity.activity;

      state.items.unshift(project);
      state.meta.lastOpenedProjectId = project.id;
      persist();
      return clone(project);
    }

    function sameProjectContent(left, right) {
      const a = normalizeProject(left);
      const b = normalizeProject(right);
      delete a.updatedAt;
      delete b.updatedAt;
      delete a.activity;
      delete b.activity;
      return JSON.stringify(a) === JSON.stringify(b);
    }

    function inferActivities(current, next, sourcePatch) {
      const fields = Object.keys(sourcePatch || {});
      const events = [];
      if (current.status !== next.status) {
        events.push({ type: 'PROJECT_STATUS_CHANGED', payload: { previous: current.status, next: next.status } });
      }
      if (current.nextAction !== next.nextAction) {
        events.push({ type: 'NEXT_ACTION_CHANGED', payload: { previous: current.nextAction, next: next.nextAction } });
      }
      const contextFields = fields.filter(function (field) {
        return (field === 'goal' && current.goal !== next.goal) || (field === 'outcome' && current.outcome !== next.outcome);
      });
      if (contextFields.length) {
        events.push({ type: 'PROJECT_CONTEXT_CHANGED', payload: { fields: contextFields } });
      }
      const detailsChanged = current.title !== next.title || current.description !== next.description || current.type !== next.type || current.templateId !== next.templateId || current.color !== next.color;
      if (detailsChanged) {
        events.push({ type: 'PROJECT_UPDATED', payload: { fields: fields } });
      }
      return events;
    }

    function update(projectId, patch, options) {
      const index = state.items.findIndex(function (item) {
        return item.id === projectId;
      });

      if (index === -1) return null;

      const current = state.items[index];
      const sourcePatch = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
      const timestamp = nowIso();
      let next = normalizeProject(Object.assign({}, current, sourcePatch, {
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: timestamp
      }));

      const config = options && typeof options === 'object' ? options : {};
      if (sameProjectContent(current, next)) {
        return clone(current);
      }

      let activitySpecs = [];
      if (config.activityType) {
        activitySpecs = [{ type: config.activityType, payload: config.activityPayload || {} }];
      } else if (config.recordActivity !== false) {
        activitySpecs = inferActivities(current, next, sourcePatch);
      }
      for (let activityIndex = activitySpecs.length - 1; activityIndex >= 0; activityIndex -= 1) {
        const spec = activitySpecs[activityIndex];
        next.activity = prependActivity(next, spec.type, spec.payload, timestamp).activity;
      }

      state.items[index] = next;
      persist();
      return clone(next);
    }

    function recordActivity(projectId, type, payload) {
      const index = state.items.findIndex(function (item) { return item.id === projectId; });
      if (index < 0 || !type) return null;
      const timestamp = nowIso();
      let next = normalizeProject(Object.assign({}, state.items[index], { updatedAt: timestamp }));
      const appended = prependActivity(next, String(type), payload || {}, timestamp);
      next.activity = appended.activity;
      state.items[index] = next;
      persist();
      return clone(appended.event);
    }

    function getActivity(projectId, limit) {
      const project = getById(projectId);
      if (!project) return [];
      const max = Number(limit) > 0 ? Number(limit) : ACTIVITY_LIMIT;
      return clone(project.activity.slice(0, max));
    }

    function setLastWork(projectId, ref) {
      const index = state.items.findIndex(function (item) { return item.id === projectId; });
      if (index < 0) return null;
      const normalized = normalizeLastWork(Object.assign({}, ref || {}, { updatedAt: nowIso() }));
      if (!normalized) return null;
      const current = state.items[index];
      const same = current.lastWork && current.lastWork.type === normalized.type && current.lastWork.id === normalized.id && current.lastWork.label === normalized.label;
      if (same) return clone(current.lastWork);
      state.items[index] = normalizeProject(Object.assign({}, current, {
        lastWork: normalized,
        updatedAt: normalized.updatedAt
      }));
      persist();
      return clone(normalized);
    }

    function setPinned(projectId, value) {
      const project = getById(projectId);
      if (!project) return null;
      const nextValue = Boolean(value);
      if (project.pinned === nextValue) return project;
      return update(projectId, { pinned: nextValue }, {
        activityType: nextValue ? 'PROJECT_PINNED' : 'PROJECT_UNPINNED',
        activityPayload: {}
      });
    }

    function archive(projectId) {
      return update(projectId, {
        archived: true,
        status: 'archived'
      }, {
        activityType: 'PROJECT_ARCHIVED',
        activityPayload: {}
      });
    }

    function unarchive(projectId) {
      return update(projectId, {
        archived: false,
        status: 'active'
      }, {
        activityType: 'PROJECT_UNARCHIVED',
        activityPayload: {}
      });
    }

    function removeProject(projectId) {
      const index = state.items.findIndex(function (item) {
        return item.id === projectId;
      });

      if (index === -1) return null;

      const removed = state.items.splice(index, 1)[0];
      if (state.meta.lastOpenedProjectId === projectId) {
        state.meta.lastOpenedProjectId = state.items[0] ? state.items[0].id : '';
      }
      persist();
      return clone(removed);
    }

    function attachUnique(projectId, key, value, activityType, activityPayload) {
      const project = getById(projectId);
      if (!project || !value) return null;
      const stringValue = String(value);
      if (project[key].includes(stringValue)) return project;

      const next = uniqueIds(project[key].concat([stringValue]));
      const patch = {};
      patch[key] = next;
      return update(projectId, patch, {
        activityType: activityType,
        activityPayload: Object.assign({ id: stringValue }, activityPayload || {})
      });
    }

    function detachValue(projectId, key, value, activityType, activityPayload) {
      const project = getById(projectId);
      if (!project) return null;
      const stringValue = String(value);
      if (!project[key].includes(stringValue)) return project;

      const next = project[key].filter(function (item) {
        return item !== stringValue;
      });

      const patch = {};
      patch[key] = next;
      return update(projectId, patch, {
        activityType: activityType,
        activityPayload: Object.assign({ id: stringValue }, activityPayload || {})
      });
    }

    function attachFile(projectId, fileId) {
      return attachUnique(projectId, 'fileIds', fileId, 'FILE_ATTACHED');
    }

    function detachFile(projectId, fileId) {
      return detachValue(projectId, 'fileIds', fileId, 'FILE_DETACHED');
    }

    function attachNote(projectId, noteId) {
      return attachUnique(projectId, 'noteIds', noteId, 'NOTE_ATTACHED');
    }

    function detachNote(projectId, noteId) {
      return detachValue(projectId, 'noteIds', noteId, 'NOTE_DETACHED');
    }

    function attachDraft(projectId, draftId) {
      return attachUnique(projectId, 'draftIds', draftId, 'DRAFT_ATTACHED');
    }

    function detachDraft(projectId, draftId) {
      return detachValue(projectId, 'draftIds', draftId, 'DRAFT_DETACHED');
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
      STORAGE_KEY: STORAGE_KEY,
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
      recordActivity: recordActivity,
      getActivity: getActivity,
      setLastWork: setLastWork,
      setPinned: setPinned,
      archive: archive,
      unarchive: unarchive,
      remove: removeProject,
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
