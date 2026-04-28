(function (root) {
  const STORAGE_KEY = "ns.browser.v8.notes.v1";

  const NOTE_TYPES = [
    "note",
    "idea",
    "reference",
    "quote",
    "outline",
    "todo"
  ];

  const DEFAULT_STATE = {
    items: [],
    meta: {
      version: 1,
      lastOpenedNoteId: "",
      lastUpdatedAt: ""
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function createId() {
    return "note_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeType(value) {
    return NOTE_TYPES.includes(value) ? value : "note";
  }

  function uniqueIds(value) {
    return Array.from(new Set((Array.isArray(value) ? value : []).filter(Boolean).map(String)));
  }

  function autoTitle(title, text) {
    const cleanTitle = String(title || "").trim();
    if (cleanTitle) return cleanTitle;
    const cleanText = String(text || "").replace(/\s+/g, " ").trim();
    if (!cleanText) return "Заметка без названия";
    return cleanText.slice(0, 54) + (cleanText.length > 54 ? "…" : "");
  }

  function normalizeNote(raw) {
    const createdAt = raw && raw.createdAt ? String(raw.createdAt) : nowIso();
    const updatedAt = raw && raw.updatedAt ? String(raw.updatedAt) : createdAt;
    const text = raw && raw.text ? String(raw.text) : "";
    return {
      id: raw && raw.id ? String(raw.id) : createId(),
      title: autoTitle(raw && raw.title, text),
      type: normalizeType(raw && raw.type),
      text: text,
      projectId: raw && raw.projectId ? String(raw.projectId) : "",
      linkedFileIds: uniqueIds(raw && raw.linkedFileIds),
      linkedDraftIds: uniqueIds(raw && raw.linkedDraftIds),
      pinned: Boolean(raw && raw.pinned),
      archived: Boolean(raw && raw.archived),
      createdAt: createdAt,
      updatedAt: updatedAt
    };
  }

  function ensureShape(data) {
    const safe = data && typeof data === "object" ? data : {};
    const meta = safe.meta && typeof safe.meta === "object" ? safe.meta : {};
    return {
      items: Array.isArray(safe.items) ? safe.items.map(normalizeNote) : [],
      meta: {
        version: 1,
        lastOpenedNoteId: meta.lastOpenedNoteId ? String(meta.lastOpenedNoteId) : "",
        lastUpdatedAt: meta.lastUpdatedAt ? String(meta.lastUpdatedAt) : ""
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
          console.warn("[NSNotesStore] subscriber failed:", error);
        }
      });
    }

    function readStorage() {
      try {
        return root.localStorage.getItem(STORAGE_KEY) || "";
      } catch (error) {
        console.warn("[NSNotesStore] readStorage failed:", error);
        return "";
      }
    }

    function writeStorage(text) {
      try {
        root.localStorage.setItem(STORAGE_KEY, text);
      } catch (error) {
        console.warn("[NSNotesStore] writeStorage failed:", error);
      }
    }

    function loadFromStorage() {
      try {
        const text = readStorage();
        if (text && String(text).trim()) {
          return ensureShape(JSON.parse(text));
        }
      } catch (error) {
        console.warn("[NSNotesStore] parse failed, using defaults:", error);
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

    function getById(noteId) {
      const found = state.items.find(function (item) {
        return item.id === noteId;
      });
      return found ? clone(found) : null;
    }

    function getLastOpenedNoteId() {
      return state.meta.lastOpenedNoteId || "";
    }

    function setLastOpenedNoteId(noteId) {
      state.meta.lastOpenedNoteId = noteId || "";
      persist();
    }

    function search(query, options) {
      const q = String(query || "").trim().toLowerCase();
      const opts = options || {};
      const showArchived = Boolean(opts.showArchived);
      const type = opts.type && opts.type !== "all" ? String(opts.type) : "";
      const projectId = opts.projectId ? String(opts.projectId) : "";

      return getAll().filter(function (item) {
        if (!showArchived && item.archived) return false;
        if (type && item.type !== type) return false;
        if (projectId && item.projectId !== projectId) return false;
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.text.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q)
        );
      });
    }

    function getByProjectId(projectId) {
      if (!projectId) return [];
      return getAll().filter(function (item) {
        return item.projectId === projectId;
      });
    }

    function syncProjectLink(noteId, prevProjectId, nextProjectId) {
      const projectStore = root.NSProjectStore;
      if (!projectStore) return;
      if (prevProjectId && prevProjectId !== nextProjectId && typeof projectStore.detachNote === "function") {
        projectStore.detachNote(prevProjectId, noteId);
      }
      if (nextProjectId && typeof projectStore.attachNote === "function") {
        projectStore.attachNote(nextProjectId, noteId);
      }
    }

    function createNote(payload) {
      const timestamp = nowIso();
      const note = normalizeNote(Object.assign({}, payload || {}, {
        id: createId(),
        createdAt: timestamp,
        updatedAt: timestamp
      }));

      state.items.unshift(note);
      state.meta.lastOpenedNoteId = note.id;
      persist();
      syncProjectLink(note.id, "", note.projectId);
      return clone(note);
    }

    function update(noteId, patch) {
      const index = state.items.findIndex(function (item) {
        return item.id === noteId;
      });
      if (index === -1) return null;

      const current = state.items[index];
      const next = normalizeNote(Object.assign({}, current, patch || {}, {
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: nowIso()
      }));

      state.items[index] = next;
      persist();
      syncProjectLink(next.id, current.projectId, next.projectId);
      return clone(next);
    }

    function setPinned(noteId, value) {
      return update(noteId, { pinned: Boolean(value) });
    }

    function archive(noteId) {
      return update(noteId, { archived: true });
    }

    function unarchive(noteId) {
      return update(noteId, { archived: false });
    }

    function remove(noteId) {
      const index = state.items.findIndex(function (item) {
        return item.id === noteId;
      });
      if (index === -1) return false;

      const current = state.items[index];
      state.items.splice(index, 1);
      if (state.meta.lastOpenedNoteId === noteId) {
        state.meta.lastOpenedNoteId = state.items[0] ? state.items[0].id : "";
      }
      persist();
      syncProjectLink(noteId, current.projectId, "");
      return true;
    }

    function attachToProject(noteId, projectId) {
      return update(noteId, { projectId: projectId || "" });
    }

    function detachFromProject(noteId) {
      return update(noteId, { projectId: "" });
    }

    function attachUnique(noteId, key, value) {
      const note = getById(noteId);
      if (!note || !value) return null;
      const patch = {};
      patch[key] = uniqueIds(note[key].concat([String(value)]));
      return update(noteId, patch);
    }

    function detachValue(noteId, key, value) {
      const note = getById(noteId);
      if (!note) return null;
      const patch = {};
      patch[key] = note[key].filter(function (item) {
        return item !== value;
      });
      return update(noteId, patch);
    }

    function attachFile(noteId, fileId) {
      return attachUnique(noteId, "linkedFileIds", fileId);
    }

    function detachFile(noteId, fileId) {
      return detachValue(noteId, "linkedFileIds", fileId);
    }

    function attachDraft(noteId, draftId) {
      return attachUnique(noteId, "linkedDraftIds", draftId);
    }

    function detachDraft(noteId, draftId) {
      return detachValue(noteId, "linkedDraftIds", draftId);
    }

    function subscribe(listener) {
      if (typeof listener !== "function") {
        return function noop() {};
      }
      listeners.push(listener);
      return function unsubscribe() {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }

    return {
      NOTE_TYPES: NOTE_TYPES.slice(),
      getState: getState,
      getAll: getAll,
      getById: getById,
      getLastOpenedNoteId: getLastOpenedNoteId,
      setLastOpenedNoteId: setLastOpenedNoteId,
      search: search,
      getByProjectId: getByProjectId,
      create: createNote,
      update: update,
      setPinned: setPinned,
      archive: archive,
      unarchive: unarchive,
      remove: remove,
      attachToProject: attachToProject,
      detachFromProject: detachFromProject,
      attachFile: attachFile,
      detachFile: detachFile,
      attachDraft: attachDraft,
      detachDraft: detachDraft,
      subscribe: subscribe
    };
  }

  root.NSNotesStore = createStore();
})(window);
