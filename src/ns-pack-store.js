(function () {
  const STORAGE_KEY = 'nsbrowser:v1:knowledge-packs';
  const DEFAULT_PACK_ID = 'pack_default';

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix = 'pack') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function createDefaultPack() {
    const now = Date.now();
    return {
      id: DEFAULT_PACK_ID,
      name: 'Default Pack',
      description: 'Default working knowledge pack',
      color: '#6d4aff',
      icon: '📦',
      sourceIds: [],
      pinned: true,
      favorite: true,
      system: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  function normalizePack(pack) {
    const now = Date.now();
    const sourceIds = Array.isArray(pack?.sourceIds)
      ? [...new Set(pack.sourceIds.filter(Boolean))]
      : [];

    return {
      id: typeof pack?.id === 'string' && pack.id.trim() ? pack.id : uid('pack'),
      name: typeof pack?.name === 'string' && pack.name.trim() ? pack.name.trim() : 'Пак без названия',
      description: typeof pack?.description === 'string' ? pack.description : '',
      color: typeof pack?.color === 'string' && pack.color.trim() ? pack.color : '#6d4aff',
      icon: typeof pack?.icon === 'string' && pack.icon.trim() ? pack.icon : '📦',
      sourceIds,
      pinned: Boolean(pack?.pinned),
      favorite: Boolean(pack?.favorite),
      system: Boolean(pack?.system),
      createdAt: typeof pack?.createdAt === 'number' ? pack.createdAt : now,
      updatedAt: typeof pack?.updatedAt === 'number' ? pack.updatedAt : now,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          packs: [createDefaultPack()],
          activePackId: DEFAULT_PACK_ID,
        };
      }

      const parsed = JSON.parse(raw);
      const packs = Array.isArray(parsed?.packs)
        ? parsed.packs.map(normalizePack)
        : [];

      if (!packs.some((pack) => pack.id === DEFAULT_PACK_ID)) {
        packs.unshift(createDefaultPack());
      }

      return {
        packs,
        activePackId:
          typeof parsed?.activePackId === 'string' && parsed.activePackId
            ? parsed.activePackId
            : DEFAULT_PACK_ID,
      };
    } catch (error) {
      console.warn('[NSPackStore] loadState failed:', error);
      return {
        packs: [createDefaultPack()],
        activePackId: DEFAULT_PACK_ID,
      };
    }
  }

  let state = loadState();
  const listeners = new Set();

  function emitChange() {
    const snapshot = api.getState();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[NSPackStore] listener failed:', error);
      }
    });
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[NSPackStore] saveState failed:', error);
    }
    emitChange();
  }

  function findPackIndex(packId) {
    return state.packs.findIndex((pack) => pack.id === packId);
  }

  function ensureDefaultPackInternal() {
    const existingIndex = findPackIndex(DEFAULT_PACK_ID);
    if (existingIndex !== -1) return state.packs[existingIndex];

    const defaultPack = createDefaultPack();
    state.packs.unshift(defaultPack);
    if (!state.activePackId) {
      state.activePackId = DEFAULT_PACK_ID;
    }
    return defaultPack;
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
      return deepClone(state.packs);
    },

    getById(packId) {
      const pack = state.packs.find((item) => item.id === packId);
      return pack ? deepClone(pack) : null;
    },

    getDefaultPack() {
      return this.getById(DEFAULT_PACK_ID);
    },

    ensureDefaultPack() {
      const beforeLength = state.packs.length;
      const pack = ensureDefaultPackInternal();
      if (state.packs.length !== beforeLength) {
        saveState();
      }
      return deepClone(pack);
    },

    getActivePack() {
      const active =
        state.packs.find((pack) => pack.id === state.activePackId) ||
        state.packs.find((pack) => pack.id === DEFAULT_PACK_ID) ||
        state.packs[0] ||
        null;

      return active ? deepClone(active) : null;
    },

    setActivePack(packId) {
      const exists = state.packs.some((pack) => pack.id === packId);
      if (!exists) return false;

      state.activePackId = packId;
      saveState();
      return true;
    },

    createPack(payload = {}) {
      const pack = normalizePack({
        ...payload,
        id: payload?.id || uid('pack'),
        system: false,
        pinned: Boolean(payload?.pinned),
        favorite: Boolean(payload?.favorite),
      });

      state.packs.unshift(pack);
      saveState();
      return deepClone(pack);
    },

    updatePack(packId, updates = {}) {
      const index = findPackIndex(packId);
      if (index === -1) return null;

      const current = state.packs[index];
      const next = normalizePack({
        ...current,
        ...updates,
        id: current.system ? current.id : (updates?.id || current.id),
        system: current.system,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
        sourceIds: Array.isArray(updates?.sourceIds)
          ? [...new Set(updates.sourceIds.filter(Boolean))]
          : current.sourceIds,
      });

      state.packs[index] = next;
      saveState();
      return deepClone(next);
    },

    deletePack(packId) {
      if (!packId || packId === DEFAULT_PACK_ID) return false;

      const index = findPackIndex(packId);
      if (index === -1) return false;

      const pack = state.packs[index];
      if (pack.system) return false;

      state.packs.splice(index, 1);

      if (state.activePackId === packId) {
        state.activePackId = DEFAULT_PACK_ID;
      }

      saveState();
      return true;
    },

    addSourceToPack(packId, sourceId) {
      if (!packId || !sourceId) return false;

      const index = findPackIndex(packId);
      if (index === -1) return false;

      const pack = state.packs[index];
      if (!Array.isArray(pack.sourceIds)) {
        pack.sourceIds = [];
      }

      if (!pack.sourceIds.includes(sourceId)) {
        pack.sourceIds.push(sourceId);
        pack.updatedAt = Date.now();
        saveState();
      }

      return true;
    },

    removeSourceFromPack(packId, sourceId) {
      if (!packId || !sourceId) return false;

      const index = findPackIndex(packId);
      if (index === -1) return false;

      const pack = state.packs[index];
      const currentIds = Array.isArray(pack.sourceIds) ? pack.sourceIds : [];
      const nextIds = currentIds.filter((id) => id !== sourceId);

      if (nextIds.length !== currentIds.length) {
        pack.sourceIds = nextIds;
        pack.updatedAt = Date.now();
        saveState();
      }

      return true;
    },

    hasSource(packId, sourceId) {
      const pack = state.packs.find((item) => item.id === packId);
      if (!pack || !Array.isArray(pack.sourceIds)) return false;
      return pack.sourceIds.includes(sourceId);
    },

    getPacksBySourceId(sourceId) {
      if (!sourceId) return [];
      return deepClone(
        state.packs.filter((pack) => Array.isArray(pack.sourceIds) && pack.sourceIds.includes(sourceId))
      );
    },

    clearAllCustomPacks() {
      state.packs = state.packs.filter((pack) => pack.system || pack.id === DEFAULT_PACK_ID);
      state.activePackId = DEFAULT_PACK_ID;
      ensureDefaultPackInternal();
      saveState();
      return true;
    },
  };

  ensureDefaultPackInternal();

  if (!state.activePackId || !state.packs.some((pack) => pack.id === state.activePackId)) {
    state.activePackId = DEFAULT_PACK_ID;
  }
  window.NSPackStore = api;
if (window.NSPackStore && typeof window.NSPackStore.ensureDefaultPack === 'function') {
  window.NSPackStore.ensureDefaultPack();
}
})();
