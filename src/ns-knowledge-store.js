(function () {
  const STORAGE_KEY = 'nsbrowser:v8:knowledge-library';

  const DEFAULT_STATE = {
    sources: [],
    links: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeNow() {
    return new Date().toISOString();
  }

  function buildKnowledgeId(fileId) {
    return 'ks_' + String(fileId || '');
  }

  function getExt(name) {
    if (!name || typeof name !== 'string') return '';
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function isKnowledgeEligibleItem(item) {
    if (!item) return false;

    const type = String(item.type || '').toLowerCase();
    const ext = String(item.ext || getExt(item.name)).toLowerCase();

    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/html',
      'text/css',
      'application/json',
      'text/csv',
      'application/xml',
      'text/xml',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/bmp',
      'image/x-icon',
      'image/vnd.microsoft.icon'
    ];

    const allowedExts = [
      'pdf',
      'txt',
      'md',
      'json',
      'csv',
      'html',
      'htm',
      'xml',
      'js',
      'css',
      'png',
      'jpg',
      'jpeg',
      'webp',
      'gif',
      'svg',
      'bmp',
      'ico'
    ];

    if (allowedTypes.includes(type)) return true;
    if (allowedExts.includes(ext)) return true;

    return false;
  }

  function normalizeLink(input) {
    const now = safeNow();

    return {
      sourceId: input && input.sourceId ? String(input.sourceId) : '',
      targetId: input && input.targetId ? String(input.targetId) : '',
      type: input && input.type ? String(input.type) : 'reference',
      label: input && input.label ? String(input.label) : '',
      createdAt: input && input.createdAt ? input.createdAt : now,
      updatedAt: input && input.updatedAt ? input.updatedAt : now
    };
  }

  function normalizeSource(input) {
    const now = safeNow();

    return {
      id: input.id || buildKnowledgeId(input.fileId),
      fileId: input.fileId || null,

      title: input.title || input.name || 'Untitled Source',
      sourceType: input.sourceType || 'library-file',

      fileName: input.fileName || '',
      mimeType: input.mimeType || '',
      ext: input.ext || '',
      size: Number(input.size || 0),

      category: input.category || 'research',
      tags: safeArray(input.tags).map(String),
      description: typeof input.description === 'string' ? input.description : '',

      favorite: Boolean(input.favorite),
      pinned: Boolean(input.pinned),

      enabled: input.enabled !== false,
      status: input.status || 'ready',

      packIds: Array.isArray(input.packIds)
        ? [...new Set(input.packIds.filter(Boolean))]
        : [],

      preview: {
        kind: input.preview?.kind || 'file',
        excerpt: input.preview?.excerpt || '',
        textContent: input.preview?.textContent || ''
      },

      usage: {
        inChatContext: Boolean(input.usage?.inChatContext),
        inEditor: Boolean(input.usage?.inEditor),
        inPublishing: Boolean(input.usage?.inPublishing),
        inSiteAssets: Boolean(input.usage?.inSiteAssets)
      },

      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now
    };
  }

  function mapLibraryItemToKnowledgeSource(item, existingSource) {
    const now = safeNow();

    return normalizeSource({
      id: existingSource?.id || buildKnowledgeId(item.id),
      fileId: item.id,

      title: item.name || item.originalName || 'Untitled Source',
      sourceType: 'library-file',

      fileName: item.name || '',
      mimeType: item.type || '',
      ext: item.ext || '',
      size: item.size || 0,

      category: item.category || 'research',
      tags: safeArray(item.tags),
      description: item.description || '',

      favorite: Boolean(item.favorite),
      pinned: Boolean(item.pinned),

      enabled: true,
      status: 'ready',

      packIds: Array.isArray(existingSource?.packIds)
        ? [...new Set(existingSource.packIds.filter(Boolean))]
        : [],

      preview: {
        kind: item.preview?.kind || 'file',
        excerpt: item.preview?.excerpt || '',
        textContent: item.preview?.textContent || ''
      },

      usage: {
        inChatContext: Boolean(item.usage?.inChatContext),
        inEditor: Boolean(item.usage?.inEditor),
        inPublishing: Boolean(item.usage?.inPublishing),
        inSiteAssets: Boolean(item.usage?.inSiteAssets)
      },

      createdAt: existingSource?.createdAt || item.createdAt || now,
      updatedAt: now
    });
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_STATE);

      const parsed = JSON.parse(raw);

      return {
        sources: safeArray(parsed.sources).map(normalizeSource),
        links: safeArray(parsed.links).map(normalizeLink).filter(function (link) {
          return link.sourceId && link.targetId;
        })
      };
    } catch (err) {
      console.error('[NSKnowledgeStore] Failed to read state:', err);
      return clone(DEFAULT_STATE);
    }
  }

  const state = readState();
  const listeners = new Set();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('[NSKnowledgeStore] Failed to save state:', err);
    }
  }

  function emitChange() {
    const snapshot = api.getState();

    listeners.forEach(function (listener) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[NSKnowledgeStore] Listener error:', err);
      }
    });

    try {
      window.dispatchEvent(
        new CustomEvent('ns:knowledge-store-changed', {
          detail: snapshot
        })
      );
    } catch (err) {
      console.error('[NSKnowledgeStore] Failed to dispatch change event:', err);
    }
  }

  function commit() {
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
    return clone(state);
  }

  function getAllSources() {
    return clone(state.sources);
  }

  function getAllLinks() {
    return clone(state.links);
  }

  function getSourceById(id) {
    return state.sources.find(function (source) {
      return source.id === id;
    }) || null;
  }

  function getSourceByFileId(fileId) {
    return state.sources.find(function (source) {
      return source.fileId === fileId;
    }) || null;
  }

  function removeSource(sourceId) {
    const index = state.sources.findIndex(function (source) {
      return source.id === sourceId;
    });

    if (index === -1) return false;

    state.sources.splice(index, 1);

    state.links = state.links.filter(function (link) {
      return link.sourceId !== sourceId && link.targetId !== sourceId;
    });

    commit();
    return true;
  }

  function syncFromLibraryItems(items) {
    const libraryItems = safeArray(items);
    const nextSources = [];

    libraryItems.forEach(function (item) {
      if (!item || !item.id) return;
      if (!isKnowledgeEligibleItem(item)) return;

      const existing = state.sources.find(function (source) {
        return source.fileId === item.id;
      });

      const mapped = mapLibraryItemToKnowledgeSource(item, existing);
      nextSources.push(mapped);
    });

    const previousSources = state.sources.slice();
    const nextSourceIds = nextSources.map(function (source) {
      return source.id;
    });

    state.sources = nextSources;

    state.links = safeArray(state.links)
      .map(normalizeLink)
      .filter(function (link) {
        return nextSourceIds.includes(link.sourceId) && nextSourceIds.includes(link.targetId);
      });

    commit();

    try {
      if (window.NSKnowledgeSync && typeof window.NSKnowledgeSync.ensureDefaultPack === 'function') {
        window.NSKnowledgeSync.ensureDefaultPack();

        nextSources.forEach(function (source) {
          const existedBefore = previousSources.some(function (prev) {
            return prev.id === source.id;
          });

          if (!existedBefore && typeof window.NSKnowledgeSync.attachSourceToDefaultPack === 'function') {
            window.NSKnowledgeSync.attachSourceToDefaultPack(source.id);
          }
        });
      }
    } catch (err) {
      console.error('[NSKnowledgeStore] Failed to attach new sources to default pack:', err);
    }

    return clone(state.sources);
  }

  function toggleFavorite(sourceId) {
    const source = getSourceById(sourceId);
    if (!source) return null;

    source.favorite = !source.favorite;
    source.updatedAt = safeNow();
    commit();
    return clone(source);
  }

  function togglePinned(sourceId) {
    const source = getSourceById(sourceId);
    if (!source) return null;

    source.pinned = !source.pinned;
    source.updatedAt = safeNow();
    commit();
    return clone(source);
  }

  function addPackToSource(sourceId, packId) {
    const source = getSourceById(sourceId);
    if (!source || !packId) return false;

    if (!Array.isArray(source.packIds)) {
      source.packIds = [];
    }

    if (!source.packIds.includes(packId)) {
      source.packIds.push(packId);
      source.updatedAt = safeNow();
      commit();
    }

    return true;
  }

  function removePackFromSource(sourceId, packId) {
    const source = getSourceById(sourceId);
    if (!source || !Array.isArray(source.packIds)) return false;

    const next = source.packIds.filter(function (id) {
      return id !== packId;
    });

    if (next.length !== source.packIds.length) {
      source.packIds = next;
      source.updatedAt = safeNow();
      commit();
    }

    return true;
  }

  function getSourcesByPackId(packId) {
    return clone(
      state.sources.filter(function (source) {
        return Array.isArray(source.packIds) && source.packIds.includes(packId);
      })
    );
  }

  function linkSources(sourceId, targetId, type, label) {
    if (!sourceId || !targetId) return false;
    if (sourceId === targetId) return false;

    const source = getSourceById(sourceId);
    const target = getSourceById(targetId);

    if (!source || !target) return false;

    const linkType = type ? String(type) : 'reference';
    const linkLabel = label ? String(label) : '';

    const existing = state.links.find(function (link) {
      return (
        link.sourceId === sourceId &&
        link.targetId === targetId &&
        String(link.type || 'reference') === linkType
      );
    });

    if (existing) {
      existing.label = linkLabel;
      existing.updatedAt = safeNow();
      commit();
      return true;
    }

    state.links.push(normalizeLink({
      sourceId: sourceId,
      targetId: targetId,
      type: linkType,
      label: linkLabel
    }));

    commit();
    return true;
  }

  function unlinkSources(sourceId, targetId, type) {
    if (!sourceId || !targetId) return false;

    const beforeLength = state.links.length;

    state.links = state.links.filter(function (link) {
      const samePair = link.sourceId === sourceId && link.targetId === targetId;

      if (!samePair) return true;
      if (!type) return false;

      return String(link.type || 'reference') !== String(type);
    });

    if (state.links.length !== beforeLength) {
      commit();
      return true;
    }

    return false;
  }

  function getLinkedSources(sourceId) {
    return clone(
      state.links.filter(function (link) {
        return link.sourceId === sourceId;
      })
    );
  }

  function getBacklinkedSources(targetId) {
    return clone(
      state.links.filter(function (link) {
        return link.targetId === targetId;
      })
    );
  }

  const api = {
    getState,
    getAllSources,
    getAllLinks,
    getSourceById,
    getSourceByFileId,
    subscribe,
    syncFromLibraryItems,
    removeSource,
    toggleFavorite,
    togglePinned,
    isKnowledgeEligibleItem,
    addPackToSource,
    removePackFromSource,
    getSourcesByPackId,
    linkSources,
    unlinkSources,
    getLinkedSources,
    getBacklinkedSources
  };

  window.NSKnowledgeStore = api;
})();
