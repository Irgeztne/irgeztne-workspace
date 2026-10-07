(function () {
  'use strict';

  const STORAGE_KEY = 'irgeztne.documents.v1'; // legacy migration/cache only
  const DURABLE_STATE_KEY = 'office.documents.v1';
  const DURABLE_PERSISTENCE_VERSION = 2;
  const FALLBACK_TITLE_RU = 'Документ без названия';
  const FALLBACK_TITLE_EN = 'Untitled document';
  const OFFICE_DEFAULT_TITLES = Object.freeze({
    document: Object.freeze({ ru: FALLBACK_TITLE_RU, en: FALLBACK_TITLE_EN }),
    spreadsheet: Object.freeze({ ru: 'Новая таблица', en: 'Untitled spreadsheet' }),
    presentation: Object.freeze({ ru: 'Новая презентация', en: 'Untitled presentation' }),
    diagram: Object.freeze({ ru: 'Новая диаграмма', en: 'Untitled diagram' }),
    formula: Object.freeze({ ru: 'Новая формула', en: 'Untitled formula' }),
    form: Object.freeze({ ru: 'Новая форма', en: 'Untitled form' })
  });
  const OfficeObject = window.NSOfficeWorkingObjectV1;
  const Spreadsheet = window.NSOfficeSpreadsheetV1;
  const Presentation = window.NSOfficePresentationV1;
  const Diagram = window.NSOfficeDiagramV1;
  const Formula = window.NSOfficeFormulaV1;
  const Form = window.NSOfficeFormV1;
  const Templates = window.NSOfficeTemplatesV1;

  if (!OfficeObject) {
    throw new Error('NSOfficeWorkingObjectV1 must load before documents-v0.js');
  }

  const dirtyIds = new Set();
  const collapsedOfficeLibraries = new Set();
  const openTemplatePickers = new Set();
  const state = loadState();
  const roots = new Set();
  let booted = false;
  let saveStateTimer = 0;
  let currentSaveState = 'saved';
  let lastSaveSucceeded = true;
  let pendingExternalSaveState = '';
  let pendingExternalContext = null;
  let renderingDocuments = false;
  let documentCaretBoost = null;
  let documentCaretBoostFrame = 0;

  // IRGEZTNE_DOCUMENTS_CARET_BOOST_V1
  // Chromium's native contenteditable caret is only one device pixel wide on
  // some Linux displays. Keep the native caret intact and paint a small
  // non-interactive overlay on top of it so the insertion point is easy to find.
  function ensureDocumentCaretBoost() {
    if (documentCaretBoost && documentCaretBoost.isConnected) return documentCaretBoost;
    const node = document.createElement('div');
    node.className = 'ns-documents-v1__caret-boost';
    node.setAttribute('aria-hidden', 'true');
    node.hidden = true;
    document.body.appendChild(node);
    documentCaretBoost = node;
    return node;
  }

  function hideDocumentCaretBoost() {
    if (documentCaretBoost) documentCaretBoost.hidden = true;
  }

  function caretRectForSelection(editor, selection) {
    if (!editor || !selection || selection.rangeCount < 1 || !selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return null;

    const direct = range.getBoundingClientRect();
    if (direct && direct.height > 2 && Number.isFinite(direct.left) && Number.isFinite(direct.top)) {
      return { left: direct.left, top: direct.top, height: direct.height };
    }

    // At the end of a text node Chromium can report a zero-height collapsed
    // range. Measure the adjacent glyph without changing the editor DOM.
    const container = range.startContainer;
    const offset = range.startOffset;
    if (container && container.nodeType === Node.TEXT_NODE && container.nodeValue) {
      const length = container.nodeValue.length;
      const probe = range.cloneRange();
      if (offset > 0) {
        probe.setStart(container, offset - 1);
        probe.setEnd(container, offset);
        const rect = probe.getBoundingClientRect();
        if (rect && rect.height > 2) return { left: rect.right, top: rect.top, height: rect.height };
      }
      if (offset < length) {
        probe.setStart(container, offset);
        probe.setEnd(container, offset + 1);
        const rect = probe.getBoundingClientRect();
        if (rect && rect.height > 2) return { left: rect.left, top: rect.top, height: rect.height };
      }
    }

    return null;
  }

  function updateDocumentCaretBoost() {
    documentCaretBoostFrame = 0;
    const active = document.activeElement;
    const editor = active && active.closest ? active.closest('[data-documents-rich-editor]') : null;
    if (!editor || !editor.closest('.ns-documents-v1--office-shell')) {
      hideDocumentCaretBoost();
      return;
    }

    const selection = window.getSelection ? window.getSelection() : null;
    const rect = caretRectForSelection(editor, selection);
    if (!rect) {
      hideDocumentCaretBoost();
      return;
    }

    const editorRect = editor.getBoundingClientRect();
    if (rect.top < editorRect.top - 1 || rect.top > editorRect.bottom + 1) {
      hideDocumentCaretBoost();
      return;
    }

    const node = ensureDocumentCaretBoost();
    const height = Math.max(15, Math.min(28, rect.height));
    node.style.left = Math.round(rect.left) + 'px';
    node.style.top = Math.round(rect.top + Math.max(0, (rect.height - height) / 2)) + 'px';
    node.style.height = Math.round(height) + 'px';
    node.hidden = false;
  }

  function scheduleDocumentCaretBoost() {
    if (documentCaretBoostFrame) return;
    documentCaretBoostFrame = window.requestAnimationFrame(updateDocumentCaretBoost);
  }

  function isRu() {
    return document.documentElement.lang === 'ru';
  }

  function t(ru, en) {
    return isRu() ? ru : en;
  }

  function defaultTitleForType(type) {
    const titles = OFFICE_DEFAULT_TITLES[String(type || 'document')] || OFFICE_DEFAULT_TITLES.document;
    return titles[isRu() ? 'ru' : 'en'];
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uniqueIds(value) {
    return Array.from(new Set((Array.isArray(value) ? value : []).filter(Boolean).map(String)));
  }

  function normalizeDocument(raw) {
    return OfficeObject.normalize(raw, {
      fallbackTitle: defaultTitleForType('document'),
      idFactory: () => uid('doc')
    });
  }

  function normalizeStoredState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
      items: Array.isArray(value.items) ? value.items.map(normalizeDocument) : [],
      activeId: String(value.activeId || ''),
      savedAt: String(value.savedAt || ''),
      persistenceVersion: Math.max(0, Number(value.persistenceVersion || 0))
    };
  }

  function storedStateStamp(candidate) {
    if (!candidate) return 0;
    const explicit = Date.parse(candidate.savedAt || '');
    if (Number.isFinite(explicit)) return explicit;
    return (candidate.items || []).reduce((latest, item) => {
      const value = Date.parse(item && item.updatedAt || '');
      return Number.isFinite(value) ? Math.max(latest, value) : latest;
    }, 0);
  }

  function readLegacyLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeStoredState(JSON.parse(raw)) : null;
    } catch (error) {
      console.warn('[IRGEZTNE Office] Failed to read legacy local state', error);
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
    } catch (error) {
      console.warn('[IRGEZTNE Office] Failed to read Storage Core state', error);
      return null;
    }
  }

  function loadState() {
    // Storage Core is the canonical owner. localStorage is consulted only for
    // one-time migration from older builds that did not yet have a durable copy.
    const durableCandidate = readDurableState();

    if (
      durableCandidate &&
      durableCandidate.persistenceVersion >= DURABLE_PERSISTENCE_VERSION
    ) {
      return {
        items: durableCandidate.items,
        activeId: durableCandidate.activeId
      };
    }

    const localCandidate = readLegacyLocalState();

    // Migration compatibility for the previous mirror build: if a non-empty
    // durable state already exists, keep it unless localStorage is demonstrably
    // newer. An empty unversioned durable state must never erase real legacy data.
    let candidate = null;
    if (durableCandidate && durableCandidate.items.length) {
      if (
        localCandidate &&
        localCandidate.items.length &&
        storedStateStamp(localCandidate) > storedStateStamp(durableCandidate)
      ) {
        candidate = localCandidate;
      } else {
        candidate = durableCandidate;
      }
    } else {
      candidate = localCandidate || durableCandidate;
    }

    return candidate
      ? { items: candidate.items, activeId: candidate.activeId }
      : { items: [], activeId: '' };
  }

  function serializeCurrentState() {
    return {
      items: state.items.map((item) => OfficeObject.serialize(item, {
        preserveLegacy: !dirtyIds.has(item.id)
      })),
      activeId: state.activeId,
      savedAt: nowIso(),
      persistenceVersion: DURABLE_PERSISTENCE_VERSION
    };
  }

  function writeDurableState(payload) {
    try {
      const api = window.nsAPI;
      if (!api || typeof api.storageSetModuleStateSync !== 'function') {
        console.warn('[IRGEZTNE Office] Storage Core bridge is unavailable');
        return false;
      }

      const result = api.storageSetModuleStateSync(
        DURABLE_STATE_KEY,
        payload
      );

      if (!result || result.ok !== true) {
        console.warn('[IRGEZTNE Office] Storage Core rejected document state');
        return false;
      }

      return true;
    } catch (error) {
      console.warn('[IRGEZTNE Office] Failed to save Storage Core state', error);
      return false;
    }
  }

  function writeLegacyLocalMirror(payload) {
    try {
      // Compatibility cache only. Clearing browser/site data must not delete
      // the canonical Office documents because Storage Core owns them now.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[IRGEZTNE Office] Failed to update legacy local mirror', error);
    }
  }

  function saveState() {
    const payload = serializeCurrentState();
    const durableSaved = writeDurableState(payload);

    // Keep the old renderer copy only as a migration/cache aid. It is never
    // preferred over a versioned canonical Storage Core state on startup.
    if (durableSaved) {
      writeLegacyLocalMirror(payload);
    }

    lastSaveSucceeded = durableSaved;
    return durableSaved;
  }

  function getActive() {
    const documents = getDocumentItems();
    const active = documents.find((item) => item.id === state.activeId);
    return active || documents[0] || null;
  }

  function getActiveObject() {
    if (!state.activeId && state.items.length) state.activeId = state.items[0].id;
    return state.items.find((item) => item.id === state.activeId) || null;
  }

  function getActiveObjectForType(type) {
    type = String(type || 'document');
    const active = state.items.find((item) => item.id === state.activeId && item.type === type);
    return active || state.items.find((item) => item.type === type) || null;
  }

  function getDocumentItems() {
    return state.items.filter((item) => item && item.type === 'document');
  }

  function markDirty(item) {
    if (item && item.id) dirtyIds.add(String(item.id));
  }

  function createDocument(seed) {
    seed = seed || {};
    const createdAt = nowIso();
    const item = OfficeObject.create('document', {
      id: seed.id || uid('doc'),
      title: seed.title || defaultTitleForType('document'),
      createdAt,
      updatedAt: seed.updatedAt || createdAt,
      payload: Object.assign({
        locale: seed.locale === 'ru' || seed.locale === 'en' ? seed.locale : '',
        documentType: seed.documentType || seed.type || 'article',
        status: seed.status || 'draft',
        body: seed.body || '',
        tags: Array.isArray(seed.tags) ? seed.tags.slice() : ['documents', 'writer']
      }, typeof seed.richBody === 'string' ? { richBody: seed.richBody } : {}),
      relations: {
        projectId: seed.projectId || '',
        taskIds: uniqueIds(seed.taskIds),
        fileIds: uniqueIds(seed.fileIds),
        workspaceFileRefs: OfficeObject.normalizeWorkspaceFileRefs(seed.workspaceFileRefs),
        mapPointIds: uniqueIds(seed.mapPointIds)
      }
    }, { fallbackTitle: defaultTitleForType('document') });
    state.items.unshift(item);
    state.activeId = item.id;
    markDirty(item);
    persistAndRender();
    setStatus(t('Новый документ создан.', 'New document created.'));
    return item;
  }

  function createObject(type, seed) {
    type = String(type || 'document');
    seed = seed || {};
    const fallbackTitle = defaultTitleForType(type);
    const item = OfficeObject.create(type, Object.assign({}, seed, {
      title: seed.title || fallbackTitle
    }), { fallbackTitle });
    state.items.unshift(item);
    state.activeId = item.id;
    markDirty(item);
    saveState();
    renderAll();
    emitRelationsChanged();
    emitOfficeChanged('create', item);
    return item;
  }

  function createSpreadsheet(seed) {
    seed = seed || {};
    return createObject('spreadsheet', Object.assign({}, seed, {
      title: seed.title || defaultTitleForType('spreadsheet'),
      payload: Spreadsheet
        ? (seed.payload && Array.isArray(seed.payload.sheets)
          ? Spreadsheet.normalizePayload(seed.payload)
          : Spreadsheet.createPayload(Object.assign({ locale:isRu() ? 'ru' : 'en', sheetName:t('Лист 1', 'Sheet 1') }, seed.payload || {})))
        : { sheets: [], activeSheetId: '' }
    }));
  }

  function createPresentation(seed) {
    seed = seed || {};
    return createObject('presentation', Object.assign({}, seed, {
      title: seed.title || defaultTitleForType('presentation'),
      payload: Presentation
        ? (seed.payload && Array.isArray(seed.payload.slides)
          ? Presentation.normalizePayload(seed.payload)
          : Presentation.createPayload({ title: seed.title || defaultTitleForType('presentation'), locale:isRu() ? 'ru' : 'en' }))
        : { slides: [], activeSlideId: '' }
    }));
  }

  function createDiagram(seed) {
    seed = seed || {};
    return createObject('diagram', Object.assign({}, seed, {
      title: seed.title || defaultTitleForType('diagram'),
      payload: Diagram ? (seed.payload ? Diagram.normalizePayload(seed.payload) : Diagram.createPayload({ locale:isRu() ? 'ru' : 'en' })) : { locale:isRu() ? 'ru' : 'en', elements: [], zoom: 1, selectedId: '' }
    }));
  }

  function createFormula(seed) {
    seed = seed || {};
    return createObject('formula', Object.assign({}, seed, {
      title: seed.title || defaultTitleForType('formula'),
      payload: Formula ? Formula.createPayload(seed.payload || {}) : { source: 'E = mc^2', renderedMathML: '', error: '' }
    }));
  }

  function createForm(seed) {
    seed = seed || {};
    return createObject('form', Object.assign({}, seed, {
      title: seed.title || defaultTitleForType('form'),
      payload: Form
        ? (seed.payload ? Form.normalizePayload(seed.payload) : Form.createPayload({
          locale: isRu() ? 'ru' : 'en',
          description: seed.description || '',
          status: seed.status || 'draft',
          fields: seed.fields || []
        }))
        : { description: '', status: 'draft', fields: [], responses: [], responseSheetId: '' }
    }));
  }

  function updateObjectRecord(objectId, patch) {
    const item = getObjectById(objectId);
    if (!item) return null;
    OfficeObject.applyPatch(item, Object.assign({}, patch || {}, { updatedAt: nowIso() }));
    markDirty(item);
    saveState();
    emitRelationsChanged();
    emitOfficeChanged('update', item);
    return item;
  }

  function updateObject(objectId, patch) {
    const item = updateObjectRecord(objectId, patch);
    if (item) renderAll();
    return item;
  }

  function saveObject(value) {
    if (!value || !value.id) return null;
    const index = state.items.findIndex((item) => item.id === String(value.id));
    if (index < 0) return null;
    const normalized = OfficeObject.normalize(OfficeObject.serialize(value), {
      fallbackTitle: t('Новый объект Office', 'Untitled Office object')
    });
    normalized.updatedAt = nowIso();
    state.items[index] = normalized;
    markDirty(normalized);
    saveState();
    renderAll();
    emitRelationsChanged();
    emitOfficeChanged('save', normalized);
    return normalized;
  }

  function getWorkspaceFileRefs(item) {
    if (!item) return [];
    const relations = item.relations && typeof item.relations === 'object'
      ? item.relations
      : {};
    return OfficeObject.normalizeWorkspaceFileRefs(
      relations.workspaceFileRefs || []
    );
  }

  function setWorkspaceFileRefs(item, refs) {
    if (!item) return;
    item.relations = Object.assign({}, item.relations || {}, {
      workspaceFileRefs: OfficeObject.normalizeWorkspaceFileRefs(refs)
    });
  }

  function getWorkspaceFileBridge() {
    const api = window.nsAPI;
    if (!api || typeof api !== 'object') return null;

    if (
      typeof api.workspaceFileAttach !== 'function' ||
      typeof api.workspaceFileRemoveReference !== 'function'
    ) {
      return null;
    }

    return api;
  }

  function workspaceFileRefFromAttachResult(result, fallbackRole) {
    const file = result && result.file ? result.file : {};
    const ref = result && result.ref ? result.ref : {};

    return {
      refId: String(ref.refId || ''),
      fileId: String(file.fileId || ref.fileId || ''),
      displayName: String(file.displayName || file.originalName || ''),
      originalName: String(file.originalName || file.displayName || ''),
      mimeType: String(file.mimeType || 'application/octet-stream'),
      extension: String(file.extension || ''),
      sizeBytes: Math.max(0, Number(file.sizeBytes || 0)),
      sha256: String(file.sha256 || ''),
      role: String(ref.role || fallbackRole || 'attachment')
    };
  }

  async function removeWorkspaceFileRef(item, refId) {
    if (!item || !refId) return { ok:false, code:'WORKSPACE_FILE_INVALID_CONTEXT' };

    const refs = getWorkspaceFileRefs(item);
    const target = refs.find((entry) => entry.refId === String(refId));

    if (!target) {
      return { ok:true, removed:false };
    }

    const api = getWorkspaceFileBridge();
    if (!api) {
      return { ok:false, code:'WORKSPACE_FILE_BRIDGE_UNAVAILABLE' };
    }

    let result;
    try {
      result = await api.workspaceFileRemoveReference(target.refId);
    } catch (error) {
      return { ok:false, code:'WORKSPACE_FILE_REMOVE_FAILED' };
    }

    if (!result || result.ok !== true) {
      return {
        ok:false,
        code: result && result.error && result.error.code
          ? String(result.error.code)
          : 'WORKSPACE_FILE_REMOVE_FAILED'
      };
    }

    setWorkspaceFileRefs(
      item,
      refs.filter((entry) => entry.refId !== target.refId)
    );

    item.updatedAt = nowIso();
    markDirty(item);
    saveState();

    return {
      ok:true,
      removed:Boolean(result.removed)
    };
  }

  async function releaseWorkspaceFileRefs(item) {
    const refs = getWorkspaceFileRefs(item);

    for (const ref of refs) {
      const released = await removeWorkspaceFileRef(item, ref.refId);
      if (!released.ok) return released;
    }

    return { ok:true };
  }

  async function removeObject(objectId) {
    const id = String(objectId || '');
    const item = getObjectById(id);
    if (!item) return false;

    const released = await releaseWorkspaceFileRefs(item);

    if (!released.ok) {
      setStatus(
        t(
          'Не удалось освободить файловые связи. Объект не удалён.',
          'Could not release file links. The object was not deleted.'
        )
      );
      return false;
    }

    state.items = state.items.filter((entry) => entry.id !== id);
    dirtyIds.delete(id);
    if (state.activeId === id) {
      state.activeId = state.items[0] ? state.items[0].id : '';
    }

    saveState();
    renderAll();
    emitRelationsChanged();
    emitOfficeChanged('remove', item);
    return true;
  }

  async function deleteOfficeObject(objectId) {
    const item = getObjectById(objectId);
    if (!item) return false;

    const label = getOfficeTypeLabel(item.type)
      .toLocaleLowerCase(isRu() ? 'ru' : 'en');

    if (
      !window.confirm(
        t(
          'Удалить ' + label + ' «' + item.title + '»?',
          'Delete ' + label + ' “' + item.title + '”?'
        )
      )
    ) {
      return false;
    }

    const removed = await removeObject(item.id);

    if (removed) {
      setStatus(t('Объект Office удалён.', 'Office object deleted.'));
    }

    return removed;
  }

  function getObjectById(objectId) {
    const id = String(objectId || '');
    return state.items.find((item) => item.id === id) || null;
  }

  function openObjectById(objectId) {
    const item = getObjectById(objectId);
    if (!item) return false;
    state.activeId = item.id;
    saveState();
    renderAll();
    emitOfficeChanged('open', item);
    return true;
  }

  function updateActive(patch) {
    const item = getActive();
    if (!item) return;
    OfficeObject.applyPatch(
      item,
      Object.assign({}, patch, { updatedAt: nowIso() })
    );
    markDirty(item);
    saveState();
    renderAll();
  }

  async function deleteActive() {
    const item = getActive();
    if (!item) return false;

    const ok = window.confirm(
      t('Удалить этот документ?', 'Delete this document?')
    );

    if (!ok) return false;

    const removed = await removeObject(item.id);

    if (removed) {
      persistAndRender();
      setStatus(t('Документ удалён.', 'Document deleted.'));
    }

    return removed;
  }

  async function duplicateActive() {
    const item = getActive();
    if (!item || item.type !== 'document') return null;

    const sourceWorkspaceRefs = getWorkspaceFileRefs(item);
    const api = sourceWorkspaceRefs.length ? getWorkspaceFileBridge() : null;

    if (sourceWorkspaceRefs.length && !api) {
      setStatus(
        t(
          'Файловый сервис недоступен. Копия не создана.',
          'File service is unavailable. Copy was not created.'
        )
      );
      return null;
    }

    const contentLocale =
      item.payload &&
      (item.payload.locale === 'ru' || item.payload.locale === 'en')
        ? item.payload.locale
        : (isRu() ? 'ru' : 'en');

    const copyId = uid('doc');

    const copy = createDocument({
      id: copyId,
      title: item.title + (contentLocale === 'ru' ? ' · копия' : ' · copy'),
      locale: contentLocale,
      documentType: item.documentType,
      status: 'draft',
      body: item.body,
      richBody:
        item.payload && typeof item.payload.richBody === 'string'
          ? item.payload.richBody
          : undefined,
      tags: Array.isArray(item.tags) ? item.tags.slice() : ['documents'],
      projectId: item.projectId || '',
      fileIds: Array.isArray(item.fileIds) ? item.fileIds.slice() : [],
      workspaceFileRefs: [],
      mapPointIds: Array.isArray(item.mapPointIds)
        ? item.mapPointIds.slice()
        : [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    for (const sourceRef of sourceWorkspaceRefs) {
      let attached;

      try {
        attached = await api.workspaceFileAttach({
          fileId: sourceRef.fileId,
          ownerType: 'document',
          ownerId: copy.id,
          role: sourceRef.role || 'attachment'
        });
      } catch (error) {
        attached = null;
      }

      if (!attached || attached.ok !== true || !attached.ref || !attached.file) {
        setStatus(
          t(
            'Копия создана, но не все файловые связи удалось продублировать.',
            'Copy created, but not all file links could be duplicated.'
          )
        );
        return copy;
      }

      const nextRef = workspaceFileRefFromAttachResult(
        attached,
        sourceRef.role
      );

      if (!nextRef.refId || !nextRef.fileId) {
        setStatus(
          t(
            'Копия создана, но файловая связь вернулась в неверном формате.',
            'Copy created, but a file link returned an invalid result.'
          )
        );
        return copy;
      }

      setWorkspaceFileRefs(
        copy,
        getWorkspaceFileRefs(copy).concat(nextRef)
      );

      copy.updatedAt = nowIso();
      markDirty(copy);
      saveState();
    }

    renderAll();
    emitRelationsChanged();
    emitOfficeChanged('save', copy);

    setStatus(
      t(
        'Документ продублирован.',
        'Document duplicated.'
      )
    );

    return copy;
  }

  function persistAndRender() {
    saveState();
    renderAll();
    emitRelationsChanged();
    emitOfficeChanged('save', getActiveObject());
  }

  function wordCount(text) {
    const clean = String(text || '').trim();
    if (!clean) return 0;
    return clean.split(/\s+/).filter(Boolean).length;
  }

  function formatSelection(text, start, end, format) {
    text = String(text == null ? '' : text);
    start = Math.max(0, Math.min(text.length, Number(start) || 0));
    end = Math.max(start, Math.min(text.length, Number(end) || start));
    const selected = text.slice(start, end);
    let replacement = selected;
    let selectStart = start;
    let selectEnd = end;
    if (format === 'heading') replacement = '## ' + (selected || t('Заголовок', 'Heading'));
    if (format === 'bold') replacement = '**' + (selected || t('жирный текст', 'bold text')) + '**';
    if (format === 'italic') replacement = '*' + (selected || t('курсив', 'italic')) + '*';
    if (format === 'underline') replacement = '<u>' + (selected || t('подчёркнутый текст', 'underlined text')) + '</u>';
    if (format === 'list') replacement = (selected || t('пункт списка', 'list item')).split('\n').map((line) => '- ' + line.replace(/^\s*[-*]\s+/, '')).join('\n');
    if (format === 'link') replacement = '[' + (selected || t('ссылка', 'link')) + '](https://)';
    if (format === 'bold') { selectStart = start + 2; selectEnd = start + replacement.length - 2; }
    else if (format === 'italic') { selectStart = start + 1; selectEnd = start + replacement.length - 1; }
    else if (format === 'underline') { selectStart = start + 3; selectEnd = start + replacement.length - 4; }
    else { selectStart = start; selectEnd = start + replacement.length; }
    return { text: text.slice(0, start) + replacement + text.slice(end), selectionStart: selectStart, selectionEnd: selectEnd };
  }

  function setDocumentSaveState(status) {
    const labels = {
      dirty: t('Изменено', 'Modified'),
      saving: t('Сохранение…', 'Saving…'),
      saved: t('Сохранено', 'Saved')
    };
    currentSaveState = labels[status] ? status : 'saved';
    pendingExternalSaveState = currentSaveState;

    // IRGEZTNE Workspace v102e — old-Office input invariant.
    // While a Documents control owns focus, autosave is state-only:
    // no textContent/attribute writes, no badge churn, no sibling DOM mutation.
    // The accepted classic Office followed the same essential input path:
    // input -> model -> saveState(), with rendering deferred to structural actions.
    // This is intentionally stricter than v102d because even harmless-looking
    // sibling mutations wake the global language MutationObserver and can disturb
    // Chromium/Electron selection inside contenteditable.
    if (getFocusedDocumentsSurface()) return;

    document.querySelectorAll('[data-documents-root]').forEach((root) => {
      root.querySelectorAll('[data-documents-save-state]').forEach((node) => {
        node.setAttribute('data-documents-save-state', currentSaveState);
        node.textContent = labels[currentSaveState] || labels.saved;
      });
    });

    flushExternalOfficeState(false);
  }

  function getFocusedDocumentsSurface() {
    const active = document.activeElement;
    if (!active || !active.closest || !active.closest('[data-documents-root]')) return null;
    return active.closest('[data-documents-root]');
  }

  function queueExternalOfficeContext(type, title) {
    pendingExternalContext = { type: String(type || 'document'), title: String(title || '') };
    flushExternalOfficeState(false);
  }

  function flushExternalOfficeState(force) {
    // Older Office shell builds may rebuild their inner surface from these
    // public setters. Never call them during a documents render or while any
    // control inside the documents surface owns focus: toolbar clicks must not
    // destroy the current editor/selection either.
    if (!force && (renderingDocuments || getFocusedDocumentsSurface())) return;
    const shell = window.IRGEZTNEOfficeShell;
    if (!shell) return;
    if (pendingExternalContext && typeof shell.setObjectContext === 'function') {
      shell.setObjectContext(pendingExternalContext.type, pendingExternalContext.title);
      pendingExternalContext = null;
    }
    if (pendingExternalSaveState && typeof shell.setSaveState === 'function') {
      shell.setSaveState(pendingExternalSaveState);
      pendingExternalSaveState = '';
    }
  }

  function scheduleSavedState() {
    window.clearTimeout(saveStateTimer);
    setDocumentSaveState('saving');
    saveStateTimer = window.setTimeout(
      () => setDocumentSaveState(lastSaveSucceeded ? 'saved' : 'dirty'),
      260
    );
  }

  function renderFormattingToolbar() {
    const saveLabels = {
      dirty: t('Изменено', 'Modified'),
      saving: t('Сохранение…', 'Saving…'),
      saved: t('Сохранено', 'Saved')
    };
    const saveStateAttribute = currentSaveState === 'saved'
      ? 'data-documents-save-state="saved"'
      : 'data-documents-save-state="' + currentSaveState + '"';
    return [
      '<div class="ns-documents-v1__format-toolbar" role="toolbar" aria-label="' + escapeHtml(t('Форматирование текста', 'Text formatting')) + '">',
      '<label class="ns-documents-v1__style-control"><span>' + escapeHtml(t('Стиль', 'Style')) + '</span><select data-documents-rich-style title="' + escapeHtml(t('Стиль абзаца', 'Paragraph style')) + '"><option value="p">' + escapeHtml(t('Обычный', 'Normal')) + '</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option></select></label>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="bold" title="' + escapeHtml(t('Жирный', 'Bold')) + '" aria-label="' + escapeHtml(t('Жирный', 'Bold')) + '"><strong>B</strong></button>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="italic" title="' + escapeHtml(t('Курсив', 'Italic')) + '" aria-label="' + escapeHtml(t('Курсив', 'Italic')) + '"><em>I</em></button>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="underline" title="' + escapeHtml(t('Подчёркнутый', 'Underline')) + '" aria-label="' + escapeHtml(t('Подчёркнутый', 'Underline')) + '"><u>U</u></button>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="insertUnorderedList" title="' + escapeHtml(t('Маркированный список', 'Bulleted list')) + '">• ' + escapeHtml(t('Список', 'List')) + '</button>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="createLink" title="' + escapeHtml(t('Добавить ссылку', 'Add link')) + '">↗ ' + escapeHtml(t('Ссылка', 'Link')) + '</button>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-action="insert-workspace-image" title="' + escapeHtml(t('Вставить изображение', 'Insert image')) + '">▧ ' + escapeHtml(t('Изображение', 'Image')) + '</button>',
      '<span class="ns-documents-v1__format-separator" aria-hidden="true"></span>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="undo" data-documents-format="undo" title="' + escapeHtml(t('Отменить', 'Undo')) + '">↶</button>',
      '<button type="button" class="ns-documents-v1__btn" data-documents-rich-command="redo" data-documents-format="redo" title="' + escapeHtml(t('Повторить', 'Redo')) + '">↷</button>',
      '<span class="ns-documents-v1__save-state" ' + saveStateAttribute + '>' + escapeHtml(saveLabels[currentSaveState] || saveLabels.saved) + '</span>',
      '</div>'
    ].join('');
  }

  function documentBodyHtml(item) {
    if (item && item.payload && typeof item.payload.richBody === 'string') return item.payload.richBody;
    const body = escapeHtml(item && item.body || '');
    return body ? body.replace(/\n/g, '<br>') : '';
  }

  function renderRichDocumentBody(item, compact) {
    return '<div class="ns-documents-v1__rich-editor' + (compact ? ' is-compact' : '') + '" contenteditable="true" role="textbox" aria-multiline="true" data-ir-no-translate="true" data-documents-rich-editor data-documents-id="' + escapeHtml(item.id) + '" data-placeholder="' + escapeHtml(t('Начните писать…', 'Start writing…')) + '">' + documentBodyHtml(item) + '</div>';
  }


  // IRGEZTNE_DOCUMENTS_LINK_DIALOG_V7
  function normalizeDocumentLinkHref(value) {
    let href = String(value == null ? '' : value).trim();
    if (!href) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) href = 'https://' + href;
    return /^https?:\/\//i.test(href) ? href : '';
  }

  function insertDocumentLinkFromBookmark(editor, bookmark, rawHref) {
    if (!editor) return false;

    const href = normalizeDocumentLinkHref(rawHref);
    if (!href) {
      setStatus(t(
        'Введите адрес http:// или https://.',
        'Enter an http:// or https:// address.'
      ));
      return false;
    }

    let restoredRange =
      richRangeFromBookmark(editor, bookmark) ||
      storedRichRange(editor) ||
      richRangeForEditor(editor);

    if (!restoredRange) {
      restoredRange = document.createRange();
      restoredRange.selectNodeContents(editor);
      restoredRange.collapse(false);
    }

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.title = t('Открыть ссылку', 'Open link');

    if (restoredRange.collapsed) {
      anchor.textContent = href;
      restoredRange.insertNode(anchor);
    } else {
      const contents = restoredRange.extractContents();
      anchor.appendChild(contents);
      restoredRange.insertNode(anchor);
    }

    try { editor.focus({ preventScroll:true }); }
    catch (_) { editor.focus(); }

    const caret = document.createRange();
    caret.setStartAfter(anchor);
    caret.collapse(true);
    const selection = window.getSelection && window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(caret);
    }

    // IRGEZTNE_DOCUMENTS_FINAL_V8
    if (!editor.contains(anchor)) {
      editor.appendChild(anchor);
    }
    editor.dispatchEvent(new Event('input', { bubbles:true }));
    setStatus(t(
      'Ссылка добавлена. Нажмите на неё, чтобы открыть.',
      'Link added. Click it to open.'
    ));
    return true;
  }

  function openDocumentLinkDialog(editor) {
    if (!editor) return false;

    document.querySelectorAll('[data-documents-link-dialog]').forEach((node) => node.remove());

    const sourceRange = richRangeForEditor(editor) || storedRichRange(editor);
    const bookmark = richRangeBookmark(editor, sourceRange);
    const selectedText = sourceRange && !sourceRange.collapsed
      ? String(sourceRange.toString() || '').trim()
      : '';

    const backdrop = document.createElement('div');
    backdrop.className = 'ns-documents-v1__link-dialog-backdrop';
    backdrop.setAttribute('data-documents-link-dialog', '');
    backdrop.innerHTML = [
      '<form class="ns-documents-v1__link-dialog" data-documents-link-form>',
      '  <div class="ns-documents-v1__link-dialog-title">' + escapeHtml(t('Добавить ссылку', 'Add link')) + '</div>',
      selectedText
        ? '  <div class="ns-documents-v1__link-dialog-selection">' + escapeHtml(selectedText) + '</div>'
        : '',
      '  <label class="ns-documents-v1__link-dialog-label">',
      '    <span>' + escapeHtml(t('Адрес', 'Address')) + '</span>',
      '    <input type="url" inputmode="url" autocomplete="off" spellcheck="false" data-documents-link-input placeholder="' + escapeHtml(t('Введите адрес сайта', 'Enter website address')) + '">',
      '    <small class="ns-documents-v1__link-dialog-hint">' + escapeHtml(t('Например: https://example.com', 'Example: https://example.com')) + '</small>',
      '  </label>',
      '  <div class="ns-documents-v1__link-dialog-error" data-documents-link-error hidden></div>',
      '  <div class="ns-documents-v1__link-dialog-actions">',
      '    <button type="button" data-documents-link-cancel>' + escapeHtml(t('Отмена', 'Cancel')) + '</button>',
      '    <button type="submit" class="is-primary">' + escapeHtml(t('Вставить ссылку', 'Insert link')) + '</button>',
      '  </div>',
      '</form>'
    ].join('');

    document.body.appendChild(backdrop);

    const form = backdrop.querySelector('[data-documents-link-form]');
    const input = backdrop.querySelector('[data-documents-link-input]');
    const errorNode = backdrop.querySelector('[data-documents-link-error]');
    const cancel = backdrop.querySelector('[data-documents-link-cancel]');

    const restoreOriginalSelection = () => {
      const range = richRangeFromBookmark(editor, bookmark);
      if (!range) return;
      try { editor.focus({ preventScroll:true }); }
      catch (_) { editor.focus(); }
      const selection = window.getSelection && window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    };

    const closeDialog = (restoreSelection) => {
      if (backdrop.isConnected) backdrop.remove();
      if (restoreSelection) restoreOriginalSelection();
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const href = normalizeDocumentLinkHref(input.value);
      if (!href) {
        errorNode.hidden = false;
        errorNode.textContent = t(
          'Введите адрес вида https://example.com',
          'Enter an address such as https://example.com'
        );
        input.focus();
        return;
      }
      closeDialog(false);
      insertDocumentLinkFromBookmark(editor, bookmark, href);
    });

    cancel.addEventListener('click', (event) => {
      event.preventDefault();
      closeDialog(true);
    });

    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) {
        event.preventDefault();
        closeDialog(true);
      }
    });

    backdrop.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog(true);
      }
    });

    window.setTimeout(() => {
      if (!input.isConnected) return;
      input.focus();
    }, 0);

    return true;
  }

  // IRGEZTNE_DOCUMENTS_INLINE_IMAGE_V1
  function workspaceImageUrl(fileId) {
    return 'irgeztne-asset://workspace-file/' +
      encodeURIComponent(String(fileId || ''));
  }

  function getWorkspaceAttachmentRefs(item) {
    return getWorkspaceFileRefs(item).filter(
      (ref) => ref.role !== 'image'
    );
  }

  function documentsRootIdentity(root) {
    if (!root || !root.getAttribute) return null;
    return {
      surface: String(root.getAttribute('data-documents-surface') || 'workspace'),
      officeType: String(root.getAttribute('data-office-type') || '')
    };
  }

  function findLiveDocumentsRoot(identity, preferredRoot) {
    if (preferredRoot && preferredRoot.isConnected) return preferredRoot;
    if (!identity) return null;

    const candidates = Array.from(document.querySelectorAll('[data-documents-root]'))
      .filter((root) => {
        const current = documentsRootIdentity(root);
        return current &&
          current.surface === identity.surface &&
          current.officeType === identity.officeType;
      });

    return candidates.find((root) => root.getClientRects().length > 0) || candidates[0] || null;
  }

  function findRichEditorForItem(item, preferredRoot) {
    if (!item) return null;
    const id = String(item.id);

    if (preferredRoot && preferredRoot.querySelectorAll) {
      const scoped = Array.from(
        preferredRoot.querySelectorAll('[data-documents-rich-editor]')
      ).find((node) => node.getAttribute('data-documents-id') === id);
      if (scoped) return scoped;
    }

    const candidates = Array.from(
      document.querySelectorAll('[data-documents-rich-editor]')
    ).filter((node) => node.getAttribute('data-documents-id') === id);

    return candidates.find((node) => node.getClientRects().length > 0) || candidates[0] || null;
  }

  // IRGEZTNE_DOCUMENTS_CARET_MEMORY_V1
  let lastRichSelection = null;

  function richRangeForEditor(editor) {
    const selection = window.getSelection && window.getSelection();
    if (!editor || !selection || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    if (
      editor.contains(range.startContainer) &&
      editor.contains(range.endContainer)
    ) {
      return range.cloneRange();
    }

    return null;
  }

  function rememberRichSelection() {
    const selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const editor = Array.from(
      document.querySelectorAll('[data-documents-rich-editor]')
    ).find((node) =>
      node.contains(range.startContainer) &&
      node.contains(range.endContainer)
    );

    if (!editor) return;

    lastRichSelection = {
      documentId: editor.getAttribute('data-documents-id') || '',
      range: range.cloneRange()
    };
  }

  function storedRichRange(editor) {
    if (!editor || !lastRichSelection) return null;
    if (
      lastRichSelection.documentId !==
      (editor.getAttribute('data-documents-id') || '')
    ) return null;

    try {
      const range = lastRichSelection.range.cloneRange();
      if (
        editor.contains(range.startContainer) &&
        editor.contains(range.endContainer)
      ) return range;
    } catch (_) {}

    return null;
  }

  function restoreRichSelection(editor) {
    const range = storedRichRange(editor);
    if (!range) return false;

    try {
      editor.focus({ preventScroll:true });
    } catch (_) {
      editor.focus();
    }

    const selection = window.getSelection && window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  // IRGEZTNE_DOCUMENTS_ASYNC_CARET_BOOKMARK_V1
  function richNodePath(root, node) {
    const path = [];
    let current = node;

    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) return null;

      const index = Array.prototype.indexOf.call(
        parent.childNodes,
        current
      );

      if (index < 0) return null;

      path.unshift(index);
      current = parent;
    }

    return current === root ? path : null;
  }

  function richNodeFromPath(root, path) {
    let current = root;

    for (const index of path || []) {
      if (!current || !current.childNodes) return null;
      current = current.childNodes[index];
    }

    return current || null;
  }

  function richRangeBookmark(editor, range) {
    if (!editor || !range) return null;

    const startPath = richNodePath(editor, range.startContainer);
    const endPath = richNodePath(editor, range.endContainer);

    if (!startPath || !endPath) return null;

    return {
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset
    };
  }

  function richRangeFromBookmark(editor, bookmark) {
    if (!editor || !bookmark) return null;

    try {
      const start = richNodeFromPath(editor, bookmark.startPath);
      const end = richNodeFromPath(editor, bookmark.endPath);

      if (!start || !end) return null;

      const range = document.createRange();

      const maxStart = start.nodeType === Node.TEXT_NODE
        ? start.nodeValue.length
        : start.childNodes.length;

      const maxEnd = end.nodeType === Node.TEXT_NODE
        ? end.nodeValue.length
        : end.childNodes.length;

      range.setStart(
        start,
        Math.min(bookmark.startOffset, maxStart)
      );

      range.setEnd(
        end,
        Math.min(bookmark.endOffset, maxEnd)
      );

      return range;
    } catch (_) {
      return null;
    }
  }

  async function reconcileWorkspaceImageRefs(item, editor) {
    if (!item || !editor) return;

    const presentFileIds = new Set(
      Array.from(
        editor.querySelectorAll('img[data-workspace-file-id]')
      )
        .map((node) =>
          String(node.getAttribute('data-workspace-file-id') || '')
        )
        .filter(Boolean)
    );

    const staleRefs = getWorkspaceFileRefs(item).filter(
      (ref) =>
        ref.role === 'image' &&
        !presentFileIds.has(ref.fileId)
    );

    for (const ref of staleRefs) {
      await removeWorkspaceFileRef(item, ref.refId);
    }
  }

  async function insertWorkspaceImage(sourceControl) {
    const item = getActive();

    if (!item || item.type !== 'document') return false;

    const sourceRoot = sourceControl && sourceControl.closest
      ? sourceControl.closest('[data-documents-root]')
      : null;
    const sourceRootIdentity = documentsRootIdentity(sourceRoot);
    const editor = findRichEditorForItem(item, sourceRoot);
    if (!editor) return false;

    const api = window.nsAPI;

    if (!api || typeof api.workspaceFilePickImport !== 'function') {
      setStatus(
        t(
          'Системный выбор изображений недоступен.',
          'System image picker is unavailable.'
        )
      );
      return false;
    }

    const selection = window.getSelection && window.getSelection();
    const savedRange =
      richRangeForEditor(editor) ||
      storedRichRange(editor);

    const caretBookmark = richRangeBookmark(
      editor,
      savedRange
    );

    let result;

    try {
      result = await api.workspaceFilePickImport({
        ownerType: 'document',
        ownerId: item.id,
        role: 'image',
        intent: 'image'
      });
    } catch (error) {
      result = null;
    }

    if (result && result.canceled) return false;

    if (
      !result ||
      result.ok !== true ||
      !result.file ||
      !result.ref
    ) {
      setStatus(
        t(
          'Не удалось вставить изображение.',
          'Could not insert the image.'
        )
      );
      return false;
    }

    const allowedExtensions = new Set([
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'
    ]);

    const extension = String(
      result.file.extension || ''
    ).toLowerCase();

    if (
      !allowedExtensions.has(extension) ||
      Number(result.file.sizeBytes || 0) > 64 * 1024 * 1024
    ) {
      if (
        result.ref.refId &&
        typeof api.workspaceFileRemoveReference === 'function'
      ) {
        try {
          await api.workspaceFileRemoveReference(result.ref.refId);
        } catch (_) {}
      }

      setStatus(
        t(
          'Этот файл нельзя вставить как изображение.',
          'This file cannot be inserted as an image.'
        )
      );
      return false;
    }

    const nextRef = workspaceFileRefFromAttachResult(
      result,
      'image'
    );

    if (!nextRef.refId || !nextRef.fileId) {
      return false;
    }

    setWorkspaceFileRefs(
      item,
      getWorkspaceFileRefs(item).concat(nextRef)
    );

    // Native file picker may have caused Office to refresh. Reacquire the
    // editor from the same Documents surface that initiated the action; Full
    // Office and the compact/workspace surface can render the same document.
    const liveRoot = findLiveDocumentsRoot(sourceRootIdentity, sourceRoot);
    const liveEditor = findRichEditorForItem(item, liveRoot);

    if (!liveEditor) {
      try {
        if (result.ref.refId) {
          await api.workspaceFileRemoveReference(result.ref.refId);
        }
      } catch (_) {}

      setWorkspaceFileRefs(
        item,
        getWorkspaceFileRefs(item).filter((ref) => ref.refId !== nextRef.refId)
      );

      setStatus(t(
        'Редактор документа был обновлён. Повторите вставку.',
        'The document editor was refreshed. Insert the image again.'
      ));

      return false;
    }

    const insertRange =
      richRangeFromBookmark(liveEditor, caretBookmark) ||
      richRangeForEditor(liveEditor) ||
      storedRichRange(liveEditor);

    const image = document.createElement('img');
    image.className = 'ns-documents-v1__inline-image';
    image.setAttribute(
      'data-workspace-file-id',
      nextRef.fileId
    );
    image.setAttribute(
      'src',
      workspaceImageUrl(nextRef.fileId)
    );
    image.setAttribute(
      'alt',
      nextRef.displayName ||
      nextRef.originalName ||
      t('Изображение', 'Image')
    );

    const br = document.createElement('br');

    try {
      if (
        insertRange &&
        liveEditor.contains(insertRange.commonAncestorContainer)
      ) {
        insertRange.deleteContents();
        insertRange.insertNode(image);
        insertRange.setStartAfter(image);
        insertRange.collapse(true);
        insertRange.insertNode(br);
        insertRange.setStartAfter(br);
        insertRange.collapse(true);

        const liveSelection =
          window.getSelection && window.getSelection();

        if (liveSelection) {
          liveSelection.removeAllRanges();
          liveSelection.addRange(insertRange);
        }
      } else {
        liveEditor.appendChild(image);
        liveEditor.appendChild(br);
      }
    } catch (_) {
      liveEditor.appendChild(image);
      liveEditor.appendChild(br);
    }

    liveEditor.focus();
    liveEditor.dispatchEvent(
      new Event('input', { bubbles:true })
    );

    try {
      image.scrollIntoView({ block:'nearest', inline:'nearest' });
    } catch (_) {}

    setStatus(
      t(
        'Изображение вставлено в документ.',
        'Image inserted into document.'
      )
    );

    return true;
  }

  function applyDocumentFormat(button) {
    const format = button && button.getAttribute('data-documents-format');
    if (!format) return;
    const root = button.closest('[data-documents-root]') || document;
    const textarea = root.querySelector('[data-documents-field="body"]');
    if (!textarea) return;
    textarea.focus();
    if (format === 'undo' || format === 'redo') {
      if (typeof document.execCommand === 'function') document.execCommand(format);
      return;
    }
    const result = formatSelection(textarea.value, textarea.selectionStart, textarea.selectionEnd, format);
    textarea.value = result.text;
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    textarea.dispatchEvent(new Event('input', { bubbles:true }));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function slugify(value) {
    const raw = String(value || 'document').trim().toLowerCase();
    const ascii = raw
      .replace(/[а]/g, 'a').replace(/[б]/g, 'b').replace(/[в]/g, 'v')
      .replace(/[г]/g, 'g').replace(/[д]/g, 'd').replace(/[её]/g, 'e')
      .replace(/[ж]/g, 'zh').replace(/[з]/g, 'z').replace(/[и]/g, 'i')
      .replace(/[й]/g, 'y').replace(/[к]/g, 'k').replace(/[л]/g, 'l')
      .replace(/[м]/g, 'm').replace(/[н]/g, 'n').replace(/[о]/g, 'o')
      .replace(/[п]/g, 'p').replace(/[р]/g, 'r').replace(/[с]/g, 's')
      .replace(/[т]/g, 't').replace(/[у]/g, 'u').replace(/[ф]/g, 'f')
      .replace(/[х]/g, 'h').replace(/[ц]/g, 'ts').replace(/[ч]/g, 'ch')
      .replace(/[ш]/g, 'sh').replace(/[щ]/g, 'sch').replace(/[ъь]/g, '')
      .replace(/[ы]/g, 'y').replace(/[э]/g, 'e').replace(/[ю]/g, 'yu').replace(/[я]/g, 'ya');
    return ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
  }

  function downloadFile(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function downloadBlob(filename, blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function buildMarkdownContent(item) {
    const title = item && item.title ? item.title : t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    const body = String(item && item.body || '');
    const meta = [
      '---',
      'type: irgeztne-document',
      'status: ' + (item.status || 'draft'),
      'documentType: ' + (item.documentType || 'article'),
      'updatedAt: ' + (item.updatedAt || nowIso()),
      '---',
      ''
    ].join('\n');

    return meta + '# ' + title + '\n\n' + body + '\n';
  }

  function buildHtmlContent(item) {
    const title = item && item.title ? item.title : t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    const paragraphs = String(item && item.body || '')
      .split(/\n{2,}/)
      .map((chunk) => '<p>' + escapeHtml(chunk).replace(/\n/g, '<br>') + '</p>')
      .join('\n');
    const richBody = item && item.payload && typeof item.payload.richBody === 'string'
      ? item.payload.richBody
      : '';

    return [
      '<!doctype html>',
      '<html lang="' + (isRu() ? 'ru' : 'en') + '">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(title) + '</title>',
      '<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:860px;margin:48px auto;padding:0 24px;line-height:1.65;color:#111827}h1{line-height:1.15}</style>',
      '</head>',
      '<body>',
      '<article>',
      '<h1>' + escapeHtml(title) + '</h1>',
      richBody || paragraphs || '<p></p>',
      '</article>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  // IRGEZTNE Workspace v031f: isolated clipboard actions without shell rerender.
  function setCopyFeedback(sourceButton, message, success) {
    const button = sourceButton && sourceButton.closest
      ? sourceButton.closest('[data-documents-action]')
      : null;
    const root = button && button.closest
      ? button.closest('[data-documents-root]')
      : null;
    const statusNode = root
      ? root.querySelector('[data-documents-status]')
      : null;

    if (statusNode) {
      statusNode.textContent = message || '';
      statusNode.setAttribute('data-copy-result', success ? 'success' : 'error');
    } else {
      setStatus(message);
    }

    if (!button) return;

    const originalLabel = button.getAttribute('data-copy-original-label') || button.textContent || '';
    button.setAttribute('data-copy-original-label', originalLabel);
    button.textContent = success
      ? t('Скопировано ✓', 'Copied ✓')
      : t('Ошибка копирования', 'Copy failed');
    button.setAttribute('data-copy-state', success ? 'success' : 'error');

    if (button.__irgeztneCopyFeedbackTimer) {
      window.clearTimeout(button.__irgeztneCopyFeedbackTimer);
    }

    button.__irgeztneCopyFeedbackTimer = window.setTimeout(() => {
      if (!button.isConnected) return;
      button.textContent = originalLabel;
      button.removeAttribute('data-copy-state');
    }, 1600);
  }

  function fallbackCopy(content, successMessage, sourceButton) {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const copied = document.execCommand('copy');
      if (!copied) {
        throw new Error('document.execCommand("copy") returned false');
      }
      setCopyFeedback(sourceButton, successMessage, true);
      return true;
    } catch (error) {
      console.warn('[IRGEZTNE Office] copy failed', error);
      setCopyFeedback(
        sourceButton,
        t('Не удалось скопировать. Используйте экспорт файлом.', 'Could not copy. Use file export instead.'),
        false
      );
      return false;
    } finally {
      textarea.remove();
    }
  }

  function copyText(content, successMessage, sourceButton) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => setCopyFeedback(sourceButton, successMessage, true))
        .catch(() => fallbackCopy(content, successMessage, sourceButton));
      return;
    }

    fallbackCopy(content, successMessage, sourceButton);
  }

  function copyMarkdown(sourceButton) {
    const item = getActive();
    if (!item) return;
    copyText(
      buildMarkdownContent(item),
      t('Markdown скопирован.', 'Markdown copied.'),
      sourceButton
    );
  }

  function copyHtml(sourceButton) {
    const item = getActive();
    if (!item) return;
    copyText(
      buildHtmlContent(item),
      t('HTML скопирован.', 'HTML copied.'),
      sourceButton
    );
  }

  function exportMarkdown() {
    const item = getActive();
    if (!item) return;
    const title = item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    downloadFile(slugify(title) + '.md', 'text/markdown;charset=utf-8', buildMarkdownContent(item));
    setStatus(t('Markdown экспортирован.', 'Markdown exported.'));
  }

  function exportHtml() {
    const item = getActive();
    if (!item) return;
    const title = item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    downloadFile(slugify(title) + '.html', 'text/html;charset=utf-8', buildHtmlContent(item));
    setStatus(t('HTML экспортирован.', 'HTML exported.'));
  }

  // IRGEZTNE_DOCUMENT_BUNDLE_EXPORT_R1L
  function bundleFileName(ref) {
    return String(ref && (ref.displayName || ref.originalName || ref.fileId) || 'attachment')
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'attachment';
  }

  function buildBundleHtmlContent(item, assetRefs) {
    let html = buildHtmlContent(item);
    (assetRefs || []).forEach((ref) => {
      if (!ref || !ref.fileId) return;
      const extension = String(ref.extension || '').replace(/^\./, '').toLowerCase();
      const name = 'inline-' + String(ref.fileId).replace(/[^a-zA-Z0-9._-]+/g, '-') + (extension ? '.' + extension : '');
      html = html.split(workspaceImageUrl(ref.fileId)).join('assets/' + encodeURIComponent(name));
    });
    return html;
  }

  async function exportDocumentBundle() {
    const item = getActive();
    if (!item || item.type !== 'document') return false;

    const api = window.nsAPI;
    if (!api || typeof api.exportDocumentBundle !== 'function') {
      setStatus(t('Экспорт комплекта недоступен.', 'Document package export is unavailable.'));
      return false;
    }

    const attachmentRefs = getWorkspaceAttachmentRefs(item);
    const imageRefs = getWorkspaceFileRefs(item).filter((ref) => ref && ref.role === 'image');
    const files = [];
    const seen = new Set();

    attachmentRefs.forEach((ref) => {
      if (!ref || !ref.fileId) return;
      const key = 'attachment:' + ref.fileId + ':' + (ref.refId || '');
      if (seen.has(key)) return;
      seen.add(key);
      files.push({ fileId: ref.fileId, name: bundleFileName(ref), kind: 'attachment' });
    });

    imageRefs.forEach((ref) => {
      if (!ref || !ref.fileId) return;
      const extension = String(ref.extension || '').replace(/^\./, '').toLowerCase();
      const name = 'inline-' + String(ref.fileId).replace(/[^a-zA-Z0-9._-]+/g, '-') + (extension ? '.' + extension : '');
      const key = 'asset:' + ref.fileId;
      if (seen.has(key)) return;
      seen.add(key);
      files.push({ fileId: ref.fileId, name, kind: 'asset' });
    });

    setStatus(t('Готовлю комплект документа…', 'Preparing document package…'));

    let result = null;
    try {
      result = await api.exportDocumentBundle({
        title: item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN),
        markdown: buildMarkdownContent(item),
        html: buildBundleHtmlContent(item, imageRefs),
        files
      });
    } catch (_) {
      result = null;
    }

    if (result && result.canceled) {
      setStatus(t('Экспорт отменён.', 'Export canceled.'));
      return false;
    }

    if (!result || result.ok !== true) {
      const code = result && result.error && result.error.code ? String(result.error.code) : '';
      setStatus(
        code === 'DOCUMENT_BUNDLE_TOO_LARGE'
          ? t('Комплект слишком большой для безопасного экспорта.', 'The document package is too large for safe export.')
          : t('Не удалось экспортировать комплект документа.', 'Could not export the document package.')
      );
      return false;
    }

    setStatus(
      t('Комплект документа экспортирован: ', 'Document package exported: ') +
      String(result.fileName || '')
    );
    return true;
  }


  function formatTypeStatus(item) {
    return escapeHtml((item.documentType || 'article') + ' · ' + (item.status || 'draft'));
  }

  function renderCompactItem(item, activeId) {
    const active = item.id === activeId;
    return [
      '<button type="button" class="ns-documents-v1__compact-item' + (active ? ' is-active' : '') + '" data-documents-action="select" data-documents-id="' + escapeHtml(item.id) + '">',
      '  <strong>' + escapeHtml(item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN)) + '</strong>',
      '  <span>' + formatTypeStatus(item) + '</span>',
      '</button>'
    ].join('');
  }

  function renderWorkspaceRoot(root, active, sorted, totalWords) {
    const latest = sorted.slice(0, 6);
    const activeWords = active ? wordCount(active.body) : 0;

    root.innerHTML = [
      '<div class="ns-documents-v1 ns-documents-v1--workspace ns-documents-v1--office-classic">',
      '  <section class="ns-documents-v1__office-classic-head">',
      '    <div>',
      '      <div class="ns-documents-v1__kicker">IRGEZTNE OFFICE</div>',
      '      <h2 class="ns-documents-v1__office-classic-title">' + escapeHtml(t('Офис / Документы', 'Office / Documents')) + '</h2>',
      '      <p class="ns-documents-v1__office-classic-copy">' + escapeHtml(t('Быстрый редактор документов. Таблицы, презентации, диаграммы и формулы открываются в полном Office.', 'Quick document editor. Spreadsheets, presentations, diagrams, and formulas open in Full Office.')) + '</p>',
      '    </div>',
      '    <div class="ns-documents-v1__office-classic-head-actions">',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new">' + escapeHtml(t('Новый документ', 'New document')) + '</button>',
      '      <button class="ns-documents-v1__btn" data-open-section="documents">' + escapeHtml(t('Открыть в Office', 'Open in Office')) + '</button>',
      '    </div>',
      '  </section>',

      '  <section class="ns-documents-v1__office-classic-library">',
      '    <div class="ns-documents-v1__office-classic-section-head">',
      '      <strong>' + escapeHtml(t('Библиотека документов', 'Document library')) + '</strong>',
      '      <span>' + sorted.length + '</span>',
      '    </div>',
      '    <div class="ns-documents-v1__office-classic-list">',
      latest.length ? latest.map((item) => renderCompactItem(item, active && active.id)).join('') : '<div class="ns-documents-v1__office-classic-empty">' + escapeHtml(t('Документов пока нет. Создайте первый документ.', 'No documents yet. Create the first document.')) + '</div>',
      '    </div>',
      '  </section>',

      active ? [
        '  <section class="ns-documents-v1__office-classic-editor">',
        '    <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Название', 'Title')) + '</span><input class="ns-documents-v1__input" data-documents-field="title" value="' + escapeHtml(active.title || '') + '"></label>',
        '    <div class="ns-documents-v1__office-classic-selects">',
        '      <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Тип', 'Type')) + '</span><select class="ns-documents-v1__select" data-documents-field="documentType">' + renderTypeOptions(active.documentType) + '</select></label>',
        '      <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Статус', 'Status')) + '</span><select class="ns-documents-v1__select" data-documents-field="status">' + renderStatusOptions(active.status) + '</select></label>',
        '    </div>',
        renderFormattingToolbar(),
        '    <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Текст', 'Text')) + '</span>' + renderRichDocumentBody(active, true) + '</label>',
        '    <div class="ns-documents-v1__office-classic-meta">',
        '      <span>' + escapeHtml(t('Слов в документе', 'Words in document')) + ': <strong>' + activeWords + '</strong></span>',
        '      <span>' + escapeHtml(t('Всего документов', 'Total documents')) + ': <strong>' + sorted.length + '</strong></span>',
        '    </div>',
        '    <div class="ns-documents-v1__office-classic-actions">',
        '      <button type="button" class="ns-documents-v1__btn" data-documents-action="copy-md">' + escapeHtml(t('Копировать MD', 'Copy MD')) + '</button>',
        '      <button type="button" class="ns-documents-v1__btn" data-documents-action="copy-html">' + escapeHtml(t('Копировать HTML', 'Copy HTML')) + '</button>',
        '      <button class="ns-documents-v1__btn" data-documents-action="export-md">' + escapeHtml(t('Экспорт MD', 'Export MD')) + '</button>',
        '      <button class="ns-documents-v1__btn" data-documents-action="export-html">' + escapeHtml(t('Экспорт HTML', 'Export HTML')) + '</button>',
        '      <button class="ns-documents-v1__btn" data-documents-action="duplicate">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button>',
        '      <button class="ns-documents-v1__btn ns-documents-v1__btn--danger" data-documents-action="delete">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
        '    </div>',
        '    <p class="ns-documents-v1__office-classic-note">' + escapeHtml(t('Сохранение автоматическое. Связи с проектами и файлами остаются в большом Office.', 'Saving is automatic. Project and file relations remain in the big Office.')) + '</p>',
        '  </section>'
      ].join('') : [
        '  <section class="ns-documents-v1__office-classic-editor ns-documents-v1__office-classic-editor--empty">',
        '    <p>' + escapeHtml(t('Выберите документ или создайте новый.', 'Select a document or create a new one.')) + '</p>',
        '    <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new">' + escapeHtml(t('Создать документ', 'Create document')) + '</button>',
        '  </section>'
      ].join(''),
      '  <div class="ns-documents-v1__status" data-documents-status></div>',
      '</div>'
    ].join('');
  }

  function renderCabinetRoot(root, active, sorted, totalWords, surface) {
    root.innerHTML = [
      '<div class="ns-documents-v1 ns-documents-v1--' + escapeHtml(surface) + '">',
      '  <section class="ns-documents-v1__hero">',
      '    <div>',
      '      <div class="ns-documents-v1__kicker">IRGEZTNE Office</div>',
      '      <h2 class="ns-documents-v1__title">' + escapeHtml(t('Офис', 'Office')) + '</h2>',
      '      <p class="ns-documents-v1__copy">' + escapeHtml(t('Документы и рабочие объекты Office используют одно локальное хранилище и общие связи.', 'Documents and Office working objects share one local store and relation model.')) + '</p>',
      '    </div>',
      '    <div class="ns-documents-v1__actions">',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new">' + escapeHtml(t('Новый документ', 'New document')) + '</button>',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new-spreadsheet">' + escapeHtml(t('Новая таблица', 'New spreadsheet')) + '</button>',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new-presentation">' + escapeHtml(t('Новая презентация', 'New presentation')) + '</button>',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new-diagram">' + escapeHtml(t('Новая диаграмма', 'New diagram')) + '</button>',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new-formula">' + escapeHtml(t('Новая формула', 'New formula')) + '</button>',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new-form">' + escapeHtml(t('Новая форма', 'New form')) + '</button>',
      active && active.type === 'document' ? '      <button class="ns-documents-v1__btn" data-documents-action="export-md">' + escapeHtml(t('Экспорт MD', 'Export MD')) + '</button>' : '',
      active && active.type === 'document' ? '      <button class="ns-documents-v1__btn" data-documents-action="export-html">' + escapeHtml(t('Экспорт HTML', 'Export HTML')) + '</button>' : '',
      active && active.type === 'document' ? '      <button type="button" class="ns-documents-v1__btn" data-documents-action="copy-md">' + escapeHtml(t('Копировать MD', 'Copy MD')) + '</button>' : '',
      active && active.type === 'document' ? '      <button type="button" class="ns-documents-v1__btn" data-documents-action="copy-html">' + escapeHtml(t('Копировать HTML', 'Copy HTML')) + '</button>' : '',
      '    </div>',
      '  </section>',
      '  <section class="ns-documents-v1__layout">',
      '    <aside class="ns-documents-v1__side-card">',
      '      <div class="ns-documents-v1__toolbar">',
      '        <strong>' + escapeHtml(t('Объекты Office', 'Office objects')) + '</strong>',
      '        <span class="ns-documents-v1__chip">' + sorted.length + '</span>',
      '      </div>',
      '      <div class="ns-documents-v1__list">',
      sorted.length ? sorted.map(renderOfficeItem).join('') : '<div class="ns-documents-v1__empty">' + escapeHtml(t('Объектов Office пока нет.', 'No Office objects yet.')) + '</div>',
      '      </div>',
      '      <div class="ns-documents-v1__meta-grid">',
      '        <div class="ns-documents-v1__meta-card"><span class="ns-documents-v1__meta-label">' + escapeHtml(t('Объекты', 'Objects')) + '</span><strong>' + sorted.length + '</strong></div>',
      '        <div class="ns-documents-v1__meta-card"><span class="ns-documents-v1__meta-label">' + escapeHtml(t('Слова', 'Words')) + '</span><strong>' + totalWords + '</strong></div>',
      '        <div class="ns-documents-v1__meta-card"><span class="ns-documents-v1__meta-label">' + escapeHtml(t('Тип', 'Type')) + '</span><strong>' + escapeHtml(active ? getOfficeTypeLabel(active.type) : '—') + '</strong></div>',
      '      </div>',
      '    </aside>',
      '    <main class="ns-documents-v1__editor-card">',
      active ? renderOfficeEditor(active) : renderEmptyEditor(),
      '    </main>',
      '  </section>',
      '  <section class="ns-documents-v1__future-card">',
      '    <div>',
      '      <div class="ns-documents-v1__small-label">' + escapeHtml(t('Связи', 'Relations')) + '</div>',
      '      <p class="ns-documents-v1__hint">' + escapeHtml(t('Связи хранят только ссылки на проекты, задачи, файлы и точки карты.', 'Relations keep references to projects, tasks, files, and map points.')) + '</p>',
      '    </div>',
      '    <div class="ns-documents-v1__chips"><span class="ns-documents-v1__chip">Notes</span><span class="ns-documents-v1__chip">Files</span><span class="ns-documents-v1__chip">Projects</span><span class="ns-documents-v1__chip">Web Studio</span><span class="ns-documents-v1__chip">Markdown/HTML</span></div>',
      '  </section>',
      '  <div class="ns-documents-v1__status" data-documents-status></div>',
      '</div>'
    ].join('');
  }


  function renderRoot(root) {
    if (!root) return;
    roots.add(root);
    const surface = String(root.getAttribute('data-documents-surface') || 'workspace');
    const documents = getDocumentItems();
    const totalWords = documents.reduce((sum, item) => sum + wordCount(item.body), 0);

    if (surface === 'workspace') {
      const activeDocument = getActive();
      const sortedDocuments = documents.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      renderWorkspaceRoot(root, activeDocument, sortedDocuments, totalWords);
      return;
    }

    if (surface === 'office-shell') {
      renderShellSurface(root, String(root.getAttribute('data-office-type') || 'document'));
      return;
    }

    const activeObject = getActiveObject();
    const sortedObjects = state.items.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    renderCabinetRoot(root, activeObject, sortedObjects, totalWords, surface);
    bindOfficeEditor(root, activeObject);
  }


  function getProjects() {
    const store = window.NSProjectStore;
    if (!store || typeof store.getAll !== 'function') return [];
    return store.getAll();
  }

  function getProjectTitle(projectId) {
    if (!projectId) return t('Без проекта', 'No project');
    const store = window.NSProjectStore;
    if (store && typeof store.getById === 'function') {
      const project = store.getById(projectId);
      if (project && project.title) return project.title;
    }
    return projectId;
  }

  function getFiles() {
    try {
      const store = window.NSLibraryStore;
      if (store && typeof store.getAllItems === 'function') return store.getAllItems().filter(Boolean);
    } catch (error) {}
    return [];
  }

  function getFileTitle(fileId) {
    const id = String(fileId || '');
    if (!id) return '';
    try {
      const store = window.NSLibraryStore;
      if (store && typeof store.getItemById === 'function') {
        const file = store.getItemById(id);
        if (file) return file.name || file.originalName || id;
      }
    } catch (error) {}
    return id;
  }

  function getMapPoints() {
    try {
      const map = window.NSMapV1;
      if (map && typeof map.getAllPins === 'function') return map.getAllPins().filter(Boolean);
    } catch (error) {}
    return [];
  }

  function getMapPointTitle(pointId) {
    const id = String(pointId || '');
    if (!id) return '';
    const point = getMapPoints().find((item) => String(item.id) === id);
    return point ? (point.title || id) : id;
  }

  function renderFileOptions(value, selectedIds, selectedWorkspaceFileIds) {
    const selected = new Set(uniqueIds(selectedIds));
    const selectedWorkspace = new Set(uniqueIds(selectedWorkspaceFileIds));
    const files = getFiles().filter((file) => {
      if (!file || !file.id || selected.has(String(file.id))) return false;
      const workspaceFileId =
        file.storage && file.storage.fileId
          ? String(file.storage.fileId)
          : '';
      return !workspaceFileId || !selectedWorkspace.has(workspaceFileId);
    });
    const options = ['<option value="">' + escapeHtml(t('Выбрать файл…', 'Choose file…')) + '</option>'];
    files.forEach((file) => {
      const id = String(file.id);
      options.push('<option value="' + escapeHtml(id) + '"' + (id === value ? ' selected' : '') + '>' + escapeHtml(file.name || file.originalName || id) + '</option>');
    });
    return options.join('');
  }

  // IRGEZTNE_OFFICE_FILES_FRESH_PICKER_R1C
  function refreshFilesLibraryPicker(scope) {
    const item = getActive();
    if (!item || item.type !== 'document') return false;

    const root =
      scope && typeof scope.querySelectorAll === 'function'
        ? scope
        : document;

    const html = renderFileOptions(
      '',
      item.fileIds,
      getWorkspaceAttachmentRefs(item).map((ref) => ref.fileId)
    );

    let refreshed = false;
    root.querySelectorAll('[data-documents-link-select="file"]').forEach((select) => {
      select.innerHTML = html;
      select.value = '';
      refreshed = true;
    });

    return refreshed;
  }

  function renderMapPointOptions(value, selectedIds) {
    const selected = new Set(uniqueIds(selectedIds));
    const points = getMapPoints().filter((point) => point && point.id && !selected.has(String(point.id)));
    const options = ['<option value="">' + escapeHtml(t('Выбрать точку карты…', 'Choose map point…')) + '</option>'];
    points.forEach((point) => {
      const id = String(point.id);
      const label = (point.title || id) + (point.type ? ' · ' + point.type : '');
      options.push('<option value="' + escapeHtml(id) + '"' + (id === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>');
    });
    return options.join('');
  }

  function renderLinkedPills(ids, titleGetter, kind) {
    const list = uniqueIds(ids);
    if (!list.length) {
      return '<span class="ns-documents-v1__link-empty">' + escapeHtml(t('Пока ничего не связано.', 'Nothing linked yet.')) + '</span>';
    }
    return list.map((id) => {
      return '<span class="ns-documents-v1__link-pill"><span>' + escapeHtml(titleGetter(id)) + '</span><button type="button" data-documents-action="remove-link" data-documents-link-kind="' + escapeHtml(kind) + '" data-documents-link-id="' + escapeHtml(id) + '" aria-label="' + escapeHtml(t('Убрать связь', 'Remove link')) + '">×</button></span>';
    }).join('');
  }

  function renderProjectOptions(value) {
    const projects = getProjects();
    return ['<option value="">' + escapeHtml(t('Без проекта', 'No project')) + '</option>'].concat(projects.map((project) => {
      return '<option value="' + escapeHtml(project.id) + '"' + (project.id === value ? ' selected' : '') + '>' + escapeHtml(project.title || project.id) + '</option>';
    })).join('');
  }

  function emitRelationsChanged() {
    document.dispatchEvent(new CustomEvent('irg:relations-changed'));
  }

  function emitOfficeChanged(action, item) {
    document.dispatchEvent(new CustomEvent('irg:office-objects-changed', {
      detail: {
        action: action || 'save',
        id: item && item.id ? item.id : '',
        type: item && item.type ? item.type : ''
      }
    }));
  }

  function renderItem(item) {
    const active = item.id === state.activeId;
    return [
      '<button type="button" class="ns-documents-v1__item' + (active ? ' is-active' : '') + '" data-documents-action="select" data-documents-id="' + escapeHtml(item.id) + '">',
      '  <div class="ns-documents-v1__item-title">' + escapeHtml(item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN)) + '</div>',
      '  <div class="ns-documents-v1__item-meta">' + escapeHtml((item.documentType || 'article') + ' · ' + (item.status || 'draft')) + '</div>',
      item.projectId ? '  <div class="ns-documents-v1__item-meta">' + escapeHtml(t('Проект: ', 'Project: ') + getProjectTitle(item.projectId)) + '</div>' : '',
      '</button>'
    ].join('');
  }

  function getOfficeTypeLabel(type) {
    const labels = {
      document: t('Документ', 'Document'),
      spreadsheet: t('Таблица', 'Spreadsheet'),
      presentation: t('Презентация', 'Presentation'),
      diagram: t('Диаграмма', 'Diagram'),
      formula: t('Формула', 'Formula'),
      form: t('Форма', 'Form')
    };
    return labels[type] || String(type || 'document');
  }

  function renderOfficeItem(item) {
    const active = item.id === state.activeId;
    const detail = item.type === 'document'
      ? (item.documentType || 'article') + ' · ' + (item.status || 'draft')
      : getOfficeTypeLabel(item.type);
    return [
      '<button type="button" class="ns-documents-v1__item' + (active ? ' is-active' : '') + '" data-documents-action="select-object" data-documents-id="' + escapeHtml(item.id) + '">',
      '  <div class="ns-documents-v1__item-title">' + escapeHtml(item.title || t('Объект без названия', 'Untitled object')) + '</div>',
      '  <div class="ns-documents-v1__item-meta">' + escapeHtml(detail) + '</div>',
      item.relations && item.relations.projectId ? '  <div class="ns-documents-v1__item-meta">' + escapeHtml(t('Проект: ', 'Project: ') + getProjectTitle(item.relations.projectId)) + '</div>' : '',
      '</button>'
    ].join('');
  }

  function renderOfficeEditor(item, nativeSurface) {
    if (item.type === 'document') return renderEditor(item, nativeSurface);
    if (item.type === 'spreadsheet' && Spreadsheet) return Spreadsheet.render(item, isRu() ? 'ru' : 'en');
    if (item.type === 'presentation' && Presentation) return Presentation.render(item, isRu() ? 'ru' : 'en', getFiles());
    if (item.type === 'diagram' && Diagram) return Diagram.render(item, isRu() ? 'ru' : 'en');
    if (item.type === 'formula' && Formula) return Formula.render(item, isRu() ? 'ru' : 'en');
    if (item.type === 'form' && Form) return Form.render(item, isRu() ? 'ru' : 'en');
    return '<div class="ns-documents-v1__empty">' + escapeHtml(t('Редактор этого типа будет подключён следующим этапом.', 'This type editor will be connected in the next stage.')) + '</div>';
  }

  function createByType(type, seed) {
    const officeType = String(type || 'document');

    // Creating a working object always leaves Template Library mode.
    openTemplatePickers.delete(officeType);

    if (officeType === 'document') return createDocument(seed);
    if (officeType === 'spreadsheet') return createSpreadsheet(seed);
    if (officeType === 'presentation') return createPresentation(seed);
    if (officeType === 'diagram') return createDiagram(seed);
    if (officeType === 'formula') return createFormula(seed);
    if (officeType === 'form') return createForm(seed);
    return null;
  }

  function createFromTemplate(templateId) {
    if (!Templates) return null;
    const template = Templates.getById(templateId);
    const seed = Templates.createSeed(templateId, isRu() ? 'ru' : 'en');
    if (!template || !seed) return null;
    openTemplatePickers.delete(template.type);
    const created = createByType(template.type, seed);
    if (created) setStatus(t('Объект создан из шаблона.', 'Object created from template.'));
    return created;
  }

  function typeLabels(type) {
    const labels = {
      document: [t('Документы', 'Documents'), t('Новый документ', 'New document')],
      spreadsheet: [t('Таблицы', 'Spreadsheets'), t('Новая таблица', 'New spreadsheet')],
      presentation: [t('Презентации', 'Presentations'), t('Новая презентация', 'New presentation')],
      diagram: [t('Диаграммы', 'Diagrams'), t('Новая диаграмма', 'New diagram')],
      formula: [t('Формулы', 'Formulas'), t('Новая формула', 'New formula')],
      form: [t('Формы', 'Forms'), t('Новая форма', 'New form')]
    };
    return labels[type] || labels.document;
  }

  function renderTemplatePicker(type) {
    if (!Templates) return '';
    const templates = Templates.getAll(type, isRu() ? 'ru' : 'en');
    if (!templates.length) return '';
    return [
      '<section class="ns-office-template-picker" data-office-template-picker="' + escapeHtml(type) + '">',
      '<div class="ns-office-template-picker__head"><div><strong>' + escapeHtml(t('Стартовые шаблоны', 'Starter templates')) + '</strong><p>' + escapeHtml(t('Небольшой рабочий набор без дублей.', 'A focused working set without duplicates.')) + '</p></div><button type="button" class="ns-documents-v1__btn" data-documents-action="toggle-templates" data-office-type="' + escapeHtml(type) + '">' + escapeHtml(t('Закрыть', 'Close')) + '</button></div>',
      '<div class="ns-office-template-picker__grid">',
      templates.map((template) => '<article class="ns-office-template-card"><h3>' + escapeHtml(template.title) + '</h3><p>' + escapeHtml(template.description) + '</p><button type="button" class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="create-template" data-office-template-id="' + escapeHtml(template.id) + '">' + escapeHtml(t('Использовать', 'Use template')) + '</button></article>').join(''),
      '</div></section>'
    ].join('');
  }

  function renderShellSurface(root, type) {
    const objects = state.items
      .filter((item) => item.type === type)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const active = getActiveObjectForType(type);
    const labels = typeLabels(type);
    const libraryCollapsed = collapsedOfficeLibraries.has(type);
    // Templates are an explicit library mode, never an automatic replacement
    // for the blank/empty working surface.
    const showTemplates = openTemplatePickers.has(type);
    const libraryToggleLabel = libraryCollapsed
      ? t('Открыть библиотеку объектов', 'Open object library')
      : t('Свернуть библиотеку объектов', 'Collapse object library');
    root.innerHTML = [
      '<section class="ns-documents-v1 ns-documents-v1--office-shell' + (libraryCollapsed ? ' is-library-collapsed' : '') + '" data-office-surface-type="' + escapeHtml(type) + '" data-office-library-state="' + (libraryCollapsed ? 'collapsed' : 'expanded') + '">',
      '  <aside class="ns-documents-v1__object-browser" aria-label="' + escapeHtml(labels[0]) + '">',
      '    <div class="ns-documents-v1__object-browser-head"><div class="ns-documents-v1__object-browser-title"><strong>' + escapeHtml(labels[0]) + '</strong><span class="ns-documents-v1__object-count">' + objects.length + '</span><button class="ns-documents-v1__library-toggle" type="button" data-documents-action="toggle-library" data-office-type="' + escapeHtml(type) + '" aria-expanded="' + (libraryCollapsed ? 'false' : 'true') + '" aria-label="' + escapeHtml(libraryToggleLabel) + '" title="' + escapeHtml(libraryToggleLabel) + '"><span aria-hidden="true">' + (libraryCollapsed ? '›' : '‹') + '</span></button></div><div class="ns-documents-v1__object-browser-actions"><button class="ns-documents-v1__btn ns-documents-v1__btn--primary" type="button" data-documents-action="new-current" data-office-type="' + escapeHtml(type) + '">' + escapeHtml(labels[1]) + '</button><button class="ns-documents-v1__btn" type="button" data-documents-action="toggle-templates" data-office-type="' + escapeHtml(type) + '">' + escapeHtml(t('Шаблоны', 'Templates')) + '</button>' + (active ? '<button class="ns-documents-v1__btn ns-documents-v1__btn--danger" type="button" data-documents-action="delete-current-object" data-documents-id="' + escapeHtml(active.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>' : '') + '</div></div>',
      '    <div class="ns-documents-v1__object-list">',
      objects.length ? objects.map((item) => '<button type="button" class="ns-documents-v1__object-item' + (active && active.id === item.id ? ' is-active' : '') + '" data-documents-action="select-object" data-documents-id="' + escapeHtml(item.id) + '"><strong>' + escapeHtml(item.title || labels[0]) + '</strong><span>' + escapeHtml(getOfficeTypeLabel(item.type)) + '</span></button>').join('') : '<div class="ns-documents-v1__object-empty">' + escapeHtml(t('Здесь пока нет объектов.', 'No objects here yet.')) + '</div>',
      '    </div>',
      '  </aside>',
      '  <main class="ns-documents-v1__native-editor">',
      showTemplates
        ? renderTemplatePicker(type)
        : (active ? renderOfficeEditor(active, true) : '<div class="ns-documents-v1__native-empty"><div class="ns-documents-v1__native-empty-icon">' + escapeHtml(type === 'formula' ? 'ƒ' : type.charAt(0).toUpperCase()) + '</div><h2>' + escapeHtml(labels[0]) + '</h2><p>' + escapeHtml(t('Создайте первый объект, чтобы начать работу.', 'Create the first object to start working.')) + '</p><button class="ns-documents-v1__btn ns-documents-v1__btn--primary" type="button" data-documents-action="new-current" data-office-type="' + escapeHtml(type) + '">' + escapeHtml(labels[1]) + '</button></div>'),
      '  </main>',
      '  <div class="ns-documents-v1__status" data-documents-status aria-live="polite"></div>',
      '</section>'
    ].join('');
    queueExternalOfficeContext(type, active ? active.title : '');
    if (active) bindOfficeEditor(root.querySelector('.ns-documents-v1__native-editor'), active);
  }

  function bindOfficeEditor(root, item) {
    if (!root || !item) return;
    const surfaceRoot = typeof root.closest === 'function'
      ? root.closest('[data-documents-root]')
      : null;
    function updateCurrent(patch) {
      const updated = updateObjectRecord(item.id, patch);
      if (updated && surfaceRoot) renderRoot(surfaceRoot);
      return updated;
    }
    const commonApi = {
      t,
      locale: isRu() ? 'ru' : 'en',
      save(payload, message) {
        setDocumentSaveState('saving');
        updateCurrent({ payload });
        scheduleSavedState();
        if (message) setStatus(message);
      },
      updateTitle(title) {
        setDocumentSaveState('saving');
        updateCurrent({ title });
        scheduleSavedState();
      },
      notice(message) { setStatus(message); },
      prompt(message, value) { return window.prompt(message, value); },
      confirm(message) { return window.confirm(message); },
      download: downloadFile,
      downloadBlob,
      copyText(content, message) {
        const done = () => { if (message) setStatus(message); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(content || '')).then(done).catch(() => setStatus(t('Не удалось скопировать.', 'Could not copy.')));
        else setStatus(t('Буфер обмена недоступен.', 'Clipboard is unavailable.'));
      },
      getFiles,
      addFileRelation(fileId) {
        if (!item.relations) item.relations = OfficeObject.normalizeRelations({});
        item.relations.fileIds = uniqueIds((item.relations.fileIds || []).concat(fileId));
      },
      createResponseSheet(formPayload, formObject) {
        if (!Spreadsheet || !Form) return null;
        const formLocale = formPayload && (formPayload.locale === 'ru' || formPayload.locale === 'en')
          ? formPayload.locale
          : (isRu() ? 'ru' : 'en');
        const rows = Form.responseRows(formPayload, formLocale);
        const columnCount = Math.max(1, Math.min(26, rows[0] ? rows[0].length : 1));
        const payload = Spreadsheet.createPayload({
          locale: formLocale,
          rows: Math.max(20, rows.length),
          columns: columnCount,
          sheetName: formLocale === 'ru' ? 'Ответы' : 'Responses'
        });
        const sheet = payload.sheets[0];
        rows.forEach((row, rowIndex) => row.slice(0, columnCount).forEach((value, columnIndex) => {
          const address = String.fromCharCode(65 + columnIndex) + (rowIndex + 1);
          Spreadsheet.setCell(payload, sheet.id, address, value);
          if (rowIndex === 0) Spreadsheet.setColumn(payload, sheet.id, columnIndex, { name: value || String.fromCharCode(65 + columnIndex) });
        }));
        payload.sourceFormId = formObject.id;
        return createSpreadsheet({
          title: (formObject.title || (formLocale === 'ru' ? 'Форма' : 'Form')) + ' · ' + (formLocale === 'ru' ? 'ответы' : 'responses'),
          payload
        });
      }
    };
    if (item.type === 'spreadsheet' && Spreadsheet) Spreadsheet.bind(root, item, commonApi);
    if (item.type === 'presentation' && Presentation) Presentation.bind(root, item, commonApi);
    if (item.type === 'diagram' && Diagram) Diagram.bind(root, item, commonApi);
    if (item.type === 'formula' && Formula) Formula.bind(root, item, commonApi);
    if (item.type === 'form' && Form) Form.bind(root, item, commonApi);
  }

  function renderEditor(item, nativeSurface) {
    const parts = [
      '<div class="ns-documents-v1__form-grid">',
      '  <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Название', 'Title')) + '</span><input class="ns-documents-v1__input" data-documents-field="title" value="' + escapeHtml(item.title || '') + '"></label>',
      '  <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Тип', 'Type')) + '</span><select class="ns-documents-v1__select" data-documents-field="documentType">' + renderTypeOptions(item.documentType) + '</select></label>',
      '</div>',
      '<div class="ns-documents-v1__relation-panel">',
      '  <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Проект', 'Project')) + '</span><select class="ns-documents-v1__select" data-documents-field="projectId">' + renderProjectOptions(item.projectId || '') + '</select></label>',
      '  <div class="ns-documents-v1__relation-copy"><strong>' + escapeHtml(t('Связи', 'Relations')) + '</strong><span>' + escapeHtml(item.projectId ? t('Документ связан с проектом: ', 'Document linked to project: ') + getProjectTitle(item.projectId) : t('Выберите проект, чтобы документ появился в связях проекта.', 'Choose a project so this document appears in project relations.')) + '</span></div>',
      item.projectId ? '  <button class="ns-documents-v1__btn" data-documents-action="open-project">' + escapeHtml(t('Открыть проект', 'Open project')) + '</button>' : '',
      '</div>',
      '<div class="ns-documents-v1__link-panel ns-documents-v1__link-panel--files-only">',
      '  <div class="ns-documents-v1__link-block">',
      '    <div class="ns-documents-v1__link-head"><strong>' + escapeHtml(t('Вложения документа', 'Document attachments')) + '</strong><span>' + (uniqueIds(item.fileIds).length + getWorkspaceAttachmentRefs(item).length) + '</span></div>',
      '    <div class="ns-documents-v1__link-list">' + renderDocumentAttachmentPills(item) + '</div>',
      '    <div class="ns-documents-v1__file-entry-actions"><button type="button" class="ns-documents-v1__btn" data-documents-action="pick-workspace-file">' + escapeHtml(t('Прикрепить с компьютера', 'Attach from computer')) + '</button><button type="button" class="ns-documents-v1__btn" data-documents-action="toggle-files-library-picker">' + escapeHtml(t('Прикрепить из Files', 'Attach from Files')) + '</button><button type="button" class="ns-documents-v1__btn ns-documents-v1__btn--bundle-export" data-documents-action="export-document-bundle">' + escapeHtml(t('Экспорт с вложениями', 'Export with attachments')) + '</button></div>',
      '    <div class="ns-documents-v1__link-add ns-documents-v1__files-library-chooser" data-documents-files-chooser hidden><select class="ns-documents-v1__select" data-documents-link-select="file">' + renderFileOptions('', item.fileIds, getWorkspaceAttachmentRefs(item).map((ref) => ref.fileId)) + '</select><button type="button" class="ns-documents-v1__btn" data-documents-action="add-file-link">' + escapeHtml(t('Добавить', 'Add')) + '</button></div>',
      '  </div>',
      '</div>',
      renderFormattingToolbar(),
      '<label class="ns-documents-v1__field ns-documents-v1__field--body"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Текст', 'Content')) + '</span>' + renderRichDocumentBody(item, false) + '</label>',
      '<div class="ns-documents-v1__toolbar ns-documents-v1__document-actions">',
      '  <label class="ns-documents-v1__field" style="max-width:180px"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Статус', 'Status')) + '</span><select class="ns-documents-v1__select" data-documents-field="status">' + renderStatusOptions(item.status) + '</select></label>',
      '  <button class="ns-documents-v1__btn" data-documents-action="duplicate">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button>',
      '  <button class="ns-documents-v1__btn ns-documents-v1__btn--danger" data-documents-action="delete">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '</div>',
      '<p class="ns-documents-v1__hint">' + escapeHtml(t('Сохраняется автоматически в хранилище Workspace. Можно копировать и экспортировать Markdown/HTML.', 'Saved automatically to Workspace storage. Markdown/HTML copy and export are available.')) + '</p>'
    ];
    if (nativeSurface) {
      parts.unshift('<section class="ns-documents-v1__document-workspace" data-documents-native-workspace>');
      parts.push('</section>');
    }
    return parts.join('');
  }

  function renderEmptyEditor() {
    return '<div class="ns-documents-v1__empty">' + escapeHtml(t('Выберите документ или создайте новый.', 'Select a document or create a new one.')) + '</div>';
  }

  function renderTypeOptions(value) {
    const options = [
      ['article', t('Статья', 'Article')],
      ['research', t('Исследование', 'Research')],
      ['report', t('Отчёт', 'Report')],
      ['proposal', t('Предложение', 'Proposal')],
      ['guide', t('Гайд', 'Guide')],
      ['note', t('Документ-заметка', 'Document note')]
    ];
    return options.map(([key, label]) => '<option value="' + key + '"' + (key === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>').join('');
  }

  function renderStatusOptions(value) {
    const options = [
      ['draft', t('Черновик', 'Draft')],
      ['ready', t('Готово', 'Ready')],
      ['archived', t('Архив', 'Archived')]
    ];
    return options.map(([key, label]) => '<option value="' + key + '"' + (key === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>').join('');
  }

  async function addLink(kind, sourceButton) {
    const item = getActive();
    if (!item) return;

    const relationBlock =
      sourceButton && typeof sourceButton.closest === 'function'
        ? sourceButton.closest('.ns-documents-v1__link-block')
        : null;
    const selector = relationBlock
      ? relationBlock.querySelector(
          '[data-documents-link-select="' + kind + '"]'
        )
      : document.querySelector(
          '[data-documents-link-select="' + kind + '"]'
        );
    const id = selector ? String(selector.value || '') : '';

    if (!id) {
      setStatus(
        kind === 'file'
          ? t('Выберите файл для связи.', 'Choose a file to link.')
          : t('Выберите точку карты для связи.', 'Choose a map point to link.')
      );
      return;
    }

    if (kind === 'file') {
      let libraryItem = null;

      try {
        const store = window.NSLibraryStore;
        if (store && typeof store.getItemById === 'function') {
          libraryItem = store.getItemById(id);
        }
      } catch (error) {}

      // A select can stay mounted while a file is removed in Files.
      // Never create a ghost document relation from a stale option.
      if (!libraryItem) {
        refreshFilesLibraryPicker(relationBlock || document);
        setStatus(
          t(
            'Этот файл уже удалён из Files. Список обновлён.',
            'This file was already removed from Files. The list was refreshed.'
          )
        );
        return;
      }

      const workspaceFileId =
        libraryItem.storage &&
        libraryItem.storage.fileId
          ? String(libraryItem.storage.fileId)
          : '';

      const api = getWorkspaceFileBridge();

      if (
        workspaceFileId &&
        api &&
        typeof api.workspaceFileAttach === 'function'
      ) {
        setDocumentSaveState('saving');

        let result = null;

        try {
          result = await api.workspaceFileAttach({
            fileId: workspaceFileId,
            ownerType: 'document',
            ownerId: item.id,
            role: 'attachment'
          });
        } catch (error) {
          result = null;
        }

        if (!result || result.ok !== true || !result.file || !result.ref) {
          setStatus(
            t(
              'Не удалось связать файл из Files с документом.',
              'Could not attach the Files item to this document.'
            )
          );
          scheduleSavedState();
          return;
        }

        const nextRef = workspaceFileRefFromAttachResult(
          result,
          'attachment'
        );

        setWorkspaceFileRefs(
          item,
          getWorkspaceFileRefs(item).concat(nextRef)
        );

        // A Workspace File Store-backed Files item no longer needs a second
        // legacy relation id for the same attachment.
        item.fileIds = uniqueIds(item.fileIds).filter(
          (entry) => entry !== id
        );
      } else {
        // Compatibility path for legacy Files items that predate Workspace
        // File Store ownership.
        item.fileIds = uniqueIds((item.fileIds || []).concat(id));
      }
    } else if (kind === 'map') {
      item.mapPointIds = uniqueIds((item.mapPointIds || []).concat(id));
    }

    item.updatedAt = nowIso();
    markDirty(item);
    persistAndRender();

    setStatus(
      kind === 'file'
        ? t('Файл связан с документом.', 'File linked to document.')
        : t('Точка карты связана с документом.', 'Map point linked to document.')
    );
  }

  function removeLink(kind, id) {
    const item = getActive();
    if (!item || !id) return;
    if (kind === 'file') {
      item.fileIds = uniqueIds(item.fileIds).filter((entry) => entry !== id);
    } else if (kind === 'map') {
      item.mapPointIds = uniqueIds(item.mapPointIds).filter((entry) => entry !== id);
    }
    item.updatedAt = nowIso();
    markDirty(item);
    persistAndRender();
    setStatus(t('Связь удалена.', 'Link removed.'));
  }


  // IRGEZTNE_OFFICE_ATTACHMENT_TO_DOCUMENT_FINAL_R1I
  function isWorkspaceImageAttachment(ref) {
    if (!ref) return false;

    const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']);
    const extension = String(ref.extension || '').replace(/^\./, '').toLowerCase();
    const mimeType = String(ref.mimeType || '').toLowerCase();
    const fileName = String(ref.originalName || ref.displayName || '').trim().toLowerCase();
    const match = fileName.match(/\.([a-z0-9]+)$/);
    const nameExtension = match ? match[1] : '';

    return imageExtensions.has(extension) ||
      imageExtensions.has(nameExtension) ||
      /^image\/(png|jpe?g|webp|gif|avif)$/.test(mimeType);
  }

  // IRGEZTNE_DOCUMENTS_WORKSPACE_FILE_UI_V1
  function renderWorkspaceFilePills(item) {
    return getWorkspaceAttachmentRefs(item).map((ref) => {
      const label = ref.displayName || ref.originalName || ref.fileId;
      const openButton =
        '<button type="button" class="ns-documents-v1__workspace-file-open" data-documents-action="open-workspace-file-ref" data-documents-workspace-ref-id="' +
        escapeHtml(ref.refId) +
        '" title="' +
        escapeHtml(t('Открыть вложение', 'Open attachment')) +
        '">' + escapeHtml(t('Открыть', 'Open')) + '</button>';

      const insertButton = isWorkspaceImageAttachment(ref)
        ? '<button type="button" class="ns-documents-v1__workspace-file-insert" data-documents-action="insert-workspace-attachment-image" data-documents-workspace-ref-id="' +
          escapeHtml(ref.refId) +
          '" title="' +
          escapeHtml(t('Вставить изображение в документ', 'Insert image into document')) +
          '">' + escapeHtml(t('В документ', 'Insert')) + '</button>'
        : '';

      return '<span class="ns-documents-v1__link-pill ns-documents-v1__workspace-file-pill">' +
        '<span class="ns-documents-v1__workspace-file-pill-name" title="' + escapeHtml(label) + '">' +
        escapeHtml(label) +
        '</span>' +
        openButton +
        insertButton +
        '<button type="button" data-documents-action="remove-workspace-file-ref" data-documents-workspace-ref-id="' +
        escapeHtml(ref.refId) +
        '" aria-label="' +
        escapeHtml(t('Отвязать файл от документа', 'Unlink file from document')) +
        '" title="' +
        escapeHtml(t('Отвязать файл от документа', 'Unlink file from document')) +
        '">×</button>' +
        '</span>';
    }).join('');
  }

  function renderDocumentAttachmentPills(item) {
    const legacyIds = uniqueIds(item && item.fileIds);
    const workspaceRefs = getWorkspaceAttachmentRefs(item);

    if (!legacyIds.length && !workspaceRefs.length) {
      return '<span class="ns-documents-v1__link-empty">' +
        escapeHtml(t('Пока ничего не связано.', 'Nothing linked yet.')) +
        '</span>';
    }

    return (
      (legacyIds.length
        ? renderLinkedPills(legacyIds, getFileTitle, 'file')
        : '') +
      renderWorkspaceFilePills(item)
    );
  }

  // IRGEZTNE_WORKSPACE_FILE_OPEN_R1N
  async function openWorkspaceAttachment(refId) {
    const item = getActive();
    if (!item || item.type !== 'document' || !refId) return false;

    const attachmentRef = getWorkspaceAttachmentRefs(item).find(
      (ref) => ref.refId === String(refId)
    );

    if (!attachmentRef || !attachmentRef.fileId) {
      setStatus(t('Вложение не найдено.', 'Attachment was not found.'));
      return false;
    }

    const api = window.nsAPI;
    if (!api || typeof api.workspaceFileOpen !== 'function') {
      setStatus(t('Открытие вложений недоступно.', 'Attachment opening is unavailable.'));
      return false;
    }

    setStatus(t('Открываю вложение…', 'Opening attachment…'));

    let result = null;
    try {
      result = await api.workspaceFileOpen(attachmentRef.fileId);
    } catch (_) {
      result = null;
    }

    if (result && result.ok === true) {
      setStatus(t('Вложение открыто.', 'Attachment opened.'));
      return true;
    }

    const code = String(result && result.error && result.error.code || '');

    if (code === 'WORKSPACE_FILE_OPEN_REQUIRES_SAVE') {
      setStatus(
        t(
          'Этот тип файла нельзя безопасно открывать напрямую. Используйте экспорт с вложениями.',
          'This file type cannot be opened directly safely. Use Export with attachments.'
        )
      );
      return false;
    }

    if (code === 'WORKSPACE_FILE_OPEN_TOO_LARGE') {
      setStatus(
        t(
          'Файл слишком большой для прямого открытия. Используйте экспорт с вложениями.',
          'The file is too large to open directly. Use Export with attachments.'
        )
      );
      return false;
    }

    setStatus(t('Не удалось открыть вложение.', 'Could not open attachment.'));
    return false;
  }

  async function insertWorkspaceAttachmentImage(refId, sourceControl) {
    const item = getActive();
    if (!item || item.type !== 'document' || !refId) return false;

    const attachmentRef = getWorkspaceAttachmentRefs(item).find(
      (ref) => ref.refId === String(refId)
    );

    if (!attachmentRef || !isWorkspaceImageAttachment(attachmentRef)) {
      setStatus(t('Это вложение нельзя вставить как изображение.', 'This attachment cannot be inserted as an image.'));
      return false;
    }

    const sourceRoot = sourceControl && sourceControl.closest
      ? sourceControl.closest('[data-documents-root]')
      : null;
    const sourceRootIdentity = documentsRootIdentity(sourceRoot);
    let editor = findRichEditorForItem(item, sourceRoot);
    if (!editor) return false;

    const savedRange = richRangeForEditor(editor) || storedRichRange(editor);
    const bookmark = savedRange ? richRangeBookmark(editor, savedRange) : null;

    let imageRef = getWorkspaceFileRefs(item).find(
      (ref) => ref.role === 'image' && ref.fileId === attachmentRef.fileId
    ) || null;

    if (!imageRef) {
      const api = getWorkspaceFileBridge();
      if (!api || typeof api.workspaceFileAttach !== 'function') {
        setStatus(t('Файловый сервис недоступен.', 'File service is unavailable.'));
        return false;
      }

      setDocumentSaveState('saving');

      let result = null;
      try {
        result = await api.workspaceFileAttach({
          fileId: attachmentRef.fileId,
          ownerType: 'document',
          ownerId: item.id,
          role: 'image'
        });
      } catch (_) {
        result = null;
      }

      if (!result || result.ok !== true || !result.file || !result.ref) {
        setStatus(t('Не удалось подготовить изображение для документа.', 'Could not prepare the image for the document.'));
        scheduleSavedState();
        return false;
      }

      imageRef = workspaceFileRefFromAttachResult(result, 'image');
      setWorkspaceFileRefs(item, getWorkspaceFileRefs(item).concat(imageRef));
      item.updatedAt = nowIso();
      markDirty(item);
      saveState();
    }

    const liveRoot = findLiveDocumentsRoot(sourceRootIdentity, sourceRoot);
    editor = findRichEditorForItem(item, liveRoot) || editor;
    if (!editor) return false;

    let insertRange = richRangeForEditor(editor) || storedRichRange(editor);
    if ((!insertRange || !editor.contains(insertRange.commonAncestorContainer)) && bookmark) {
      insertRange = richRangeFromBookmark(editor, bookmark);
    }

    const image = document.createElement('img');
    image.className = 'ns-documents-v1__inline-image';
    image.setAttribute('data-workspace-file-id', imageRef.fileId);
    image.setAttribute('src', workspaceImageUrl(imageRef.fileId));
    image.setAttribute('alt', attachmentRef.displayName || attachmentRef.originalName || t('Изображение', 'Image'));

    const br = document.createElement('br');

    try {
      if (insertRange && editor.contains(insertRange.commonAncestorContainer)) {
        insertRange.deleteContents();
        insertRange.insertNode(image);
        insertRange.setStartAfter(image);
        insertRange.collapse(true);
        insertRange.insertNode(br);
        insertRange.setStartAfter(br);
        insertRange.collapse(true);

        const selection = window.getSelection && window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(insertRange);
        }
      } else {
        editor.appendChild(image);
        editor.appendChild(br);
      }
    } catch (_) {
      editor.appendChild(image);
      editor.appendChild(br);
    }

    try {
      editor.focus({ preventScroll:true });
    } catch (_) {
      editor.focus();
    }

    editor.dispatchEvent(new Event('input', { bubbles:true }));
    setStatus(t('Изображение вставлено в документ.', 'Image inserted into document.'));
    return true;
  }

  async function importWorkspaceFileFromComputer() {
    const item = getActive();

    if (!item || item.type !== 'document') return false;

    const api = window.nsAPI;

    if (!api || typeof api.workspaceFilePickImport !== 'function') {
      setStatus(
        t(
          'Системный выбор файлов недоступен.',
          'System file picker is unavailable.'
        )
      );
      return false;
    }

    let result;

    try {
      result = await api.workspaceFilePickImport({
        ownerType: 'document',
        ownerId: item.id,
        role: 'attachment'
      });
    } catch (error) {
      result = null;
    }

    if (result && result.canceled) return false;

    if (!result || result.ok !== true || !result.file || !result.ref) {
      setStatus(
        t(
          'Не удалось добавить файл с компьютера.',
          'Could not add the file from this computer.'
        )
      );
      return false;
    }

    const nextRef = workspaceFileRefFromAttachResult(
      result,
      'attachment'
    );

    if (!nextRef.refId || !nextRef.fileId) {
      setStatus(
        t(
          'Файловый сервис вернул неверный результат.',
          'File service returned an invalid result.'
        )
      );
      return false;
    }

    setWorkspaceFileRefs(
      item,
      getWorkspaceFileRefs(item).concat(nextRef)
    );

    item.updatedAt = nowIso();
    markDirty(item);
    persistAndRender();

    setStatus(
      t(
        'Файл добавлен с компьютера.',
        'File added from computer.'
      )
    );

    return true;
  }

  async function unlinkWorkspaceFileFromActive(refId) {
    const item = getActive();
    if (!item || !refId) return false;

    const result = await removeWorkspaceFileRef(item, refId);

    if (!result.ok) {
      setStatus(
        t(
          'Не удалось удалить файловую связь.',
          'Could not remove the file link.'
        )
      );
      return false;
    }

    renderAll();
    emitRelationsChanged();
    emitOfficeChanged('save', item);
    setStatus(t('Файловая связь удалена.', 'File link removed.'));
    return true;
  }

  function textOffsetWithin(root, node, offset) {
    const range = document.createRange();
    range.selectNodeContents(root);
    try {
      range.setEnd(node, offset);
    } catch (error) {
      return 0;
    }
    return range.toString().length;
  }

  function captureDocumentFocus() {
    const active = document.activeElement;
    if (!active || !active.closest) return null;
    const root = active.closest('[data-documents-root]');
    if (!root) return null;
    const richEditor = active.closest('[data-documents-rich-editor]');
    if (richEditor) {
      const selection = window.getSelection && window.getSelection();
      const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
      const inside = range && richEditor.contains(range.startContainer) && richEditor.contains(range.endContainer);
      return {
        root,
        kind: 'rich',
        id: richEditor.getAttribute('data-documents-id') || '',
        start: inside ? textOffsetWithin(richEditor, range.startContainer, range.startOffset) : null,
        end: inside ? textOffsetWithin(richEditor, range.endContainer, range.endOffset) : null
      };
    }
    const field = active.closest('[data-documents-field]');
    if (!field || typeof field.selectionStart !== 'number') return null;
    return {
      root,
      kind: 'field',
      field: field.getAttribute('data-documents-field') || '',
      start: field.selectionStart,
      end: field.selectionEnd
    };
  }

  function pointAtTextOffset(root, requestedOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, Number(requestedOffset) || 0);
    let last = null;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      last = node;
      const length = String(node.nodeValue || '').length;
      if (remaining <= length) return { node, offset: remaining };
      remaining -= length;
    }
    if (last) return { node: last, offset: String(last.nodeValue || '').length };
    return { node: root, offset: 0 };
  }

  function restoreDocumentFocus(context) {
    if (!context || !context.root || !context.root.isConnected) return;
    if (context.kind === 'field') {
      const field = Array.from(context.root.querySelectorAll('[data-documents-field]'))
        .find((node) => node.getAttribute('data-documents-field') === context.field);
      if (!field) return;
      field.focus({ preventScroll:true });
      if (typeof field.setSelectionRange === 'function') field.setSelectionRange(context.start, context.end);
      return;
    }
    const editor = Array.from(context.root.querySelectorAll('[data-documents-rich-editor]'))
      .find((node) => node.getAttribute('data-documents-id') === context.id);
    if (!editor) return;
    editor.focus({ preventScroll:true });
    if (context.start == null || !window.getSelection) return;
    const start = pointAtTextOffset(editor, context.start);
    const end = pointAtTextOffset(editor, context.end == null ? context.start : context.end);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function renderAll() {
    const focus = captureDocumentFocus();
    renderingDocuments = true;
    try {
      document.querySelectorAll('[data-documents-root]').forEach((root) => renderRoot(root));
      restoreDocumentFocus(focus);
    } finally {
      renderingDocuments = false;
    }
    // Intentional renders (new/open/close) may safely update the outer shell.
    // Locale renders restore the editor focus first, so the guard keeps its
    // caret and selection intact.
    flushExternalOfficeState(false);
  }

  function openDocumentById(documentId) {
    const id = String(documentId || '');
    if (!id || !state.items.some((item) => item.id === id && item.type === 'document')) return false;
    state.activeId = id;
    saveState();
    renderAll();
    return true;
  }

  function getById(documentId) {
    const id = String(documentId || '');
    return state.items.find((item) => item.id === id && item.type === 'document') || null;
  }

  function setStatus(message) {
    document.querySelectorAll('[data-documents-status]').forEach((node) => {
      node.textContent = message || '';
    });
  }

  function bindEvents() {
    document.addEventListener('selectionchange', scheduleDocumentCaretBoost);
    document.addEventListener('focusin', (event) => {
      if (event.target && event.target.closest && event.target.closest('[data-documents-rich-editor]')) {
        scheduleDocumentCaretBoost();
      }
    });
    document.addEventListener('focusout', (event) => {
      if (event.target && event.target.closest && event.target.closest('[data-documents-rich-editor]')) {
        window.setTimeout(scheduleDocumentCaretBoost, 0);
      }
    });
    document.addEventListener('keyup', (event) => {
      if (event.target && event.target.closest && event.target.closest('[data-documents-rich-editor]')) {
        scheduleDocumentCaretBoost();
      }
    });
    document.addEventListener('pointerup', (event) => {
      if (event.target && event.target.closest && event.target.closest('[data-documents-rich-editor]')) {
        scheduleDocumentCaretBoost();
      }
    });
    document.addEventListener('scroll', scheduleDocumentCaretBoost, true);
    window.addEventListener('resize', scheduleDocumentCaretBoost);
    // IRGEZTNE Workspace v031f2 Office copy isolation.
    // Copy buttons are handled before the common Workspace click owner, so the
    // upper shell/navigation is not redrawn and the action runs exactly once.
    document.addEventListener('mousedown', (event) => {
      const richCommand = event.target && event.target.closest
        ? event.target.closest('[data-documents-rich-command]')
        : null;
      if (richCommand) event.preventDefault();
    });

    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest(
            '[data-documents-action="copy-md"], ' +
            '[data-documents-action="copy-html"]'
          )
        : null;

      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const item = getActive();
      if (!item) return;

      const action = target.getAttribute('data-documents-action');
      const isMarkdown = action === 'copy-md';
      const content = isMarkdown
        ? buildMarkdownContent(item)
        : buildHtmlContent(item);
      const successMessage = isMarkdown
        ? t('Markdown скопирован.', 'Markdown copied.')
        : t('HTML скопирован.', 'HTML copied.');
      const failureMessage = t(
        'Не удалось скопировать. Используйте экспорт файлом.',
        'Could not copy. Use file export instead.'
      );
      const root = target.closest('[data-documents-root]');
      const statusNode = root
        ? root.querySelector('[data-documents-status]')
        : null;
      const originalLabel =
        target.getAttribute('data-office-copy-original-label') ||
        target.textContent ||
        '';

      target.setAttribute('data-office-copy-original-label', originalLabel);

      const showResult = (ok, message) => {
        if (statusNode) {
          statusNode.textContent = message;
          statusNode.setAttribute('data-copy-result', ok ? 'success' : 'error');
        }

        target.textContent = ok
          ? t('Скопировано ✓', 'Copied ✓')
          : t('Ошибка копирования', 'Copy failed');
        target.setAttribute('data-copy-state', ok ? 'success' : 'error');

        if (target.__irgeztneOfficeCopyTimer) {
          window.clearTimeout(target.__irgeztneOfficeCopyTimer);
        }

        target.__irgeztneOfficeCopyTimer = window.setTimeout(() => {
          if (!target.isConnected) return;
          target.textContent = originalLabel;
          target.removeAttribute('data-copy-state');
        }, 1600);
      };

      const fallbackCopy = () => {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.setAttribute('readonly', '');
        textarea.setAttribute('aria-hidden', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
          const copied = document.execCommand('copy');
          if (!copied) throw new Error('copy returned false');
          showResult(true, successMessage);
        } catch (error) {
          console.warn('[IRGEZTNE Office] isolated copy failed', error);
          showResult(false, failureMessage);
        } finally {
          textarea.remove();
        }
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content)
          .then(() => showResult(true, successMessage))
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    }, true);
    // Copy buttons are captured before the Workspace shell can interpret the
    // click as a navigation action and rebuild the upper toolbar.
    document.addEventListener('click', (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest('[data-documents-action="copy-md"], [data-documents-action="copy-html"]')
        : null;
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const action = target.getAttribute('data-documents-action');
      if (action === 'copy-md') copyMarkdown(target);
      if (action === 'copy-html') copyHtml(target);
    }, true);

    document.addEventListener('selectionchange', () => {
      rememberRichSelection();
    });

    document.addEventListener('mousedown', (event) => {
      const control = event.target.closest(
        '[data-documents-rich-command], [data-documents-action="insert-workspace-image"], [data-documents-action="insert-workspace-attachment-image"]'
      );
      if (control) event.preventDefault();
    }, true);

    document.addEventListener('change', (event) => {
      const style = event.target.closest('[data-documents-rich-style]');
      if (!style) return;

      const root = style.closest('[data-documents-root]') || document;
      const editor = root.querySelector('[data-documents-rich-editor]');
      if (editor) restoreRichSelection(editor);
    }, true);

    document.addEventListener('click', (event) => {
      // IRGEZTNE_DOCUMENTS_EXTERNAL_LINK_V6
      // A normal click inside contenteditable edits text instead of reliably
      // following the anchor. Open document links through the validated bridge.
      const richLink = event.target.closest('[data-documents-rich-editor] a[href]');
      if (richLink) {
        const href = String(richLink.getAttribute('href') || '').trim();
        if (/^https?:\/\//i.test(href)) {
          event.preventDefault();
          event.stopPropagation();

          const api = window.nsAPI;
          if (api && typeof api.openExternalUrl === 'function') {
            Promise.resolve(api.openExternalUrl(href)).then((result) => {
              if (!result || result.ok !== true) {
                setStatus(t('Не удалось открыть ссылку.', 'Could not open the link.'));
              }
            }).catch(() => {
              setStatus(t('Не удалось открыть ссылку.', 'Could not open the link.'));
            });
          } else {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        }
        return;
      }

      const richButton = event.target.closest('[data-documents-rich-command]');
      if (richButton) {
        event.preventDefault();
        const root = richButton.closest('[data-documents-root]') || document;
        const editor = root.querySelector('[data-documents-rich-editor]');
        if (!editor) return;
        const command = richButton.getAttribute('data-documents-rich-command');
        try {
          editor.focus({ preventScroll:true });
        } catch (_) {
          editor.focus();
        }
        restoreRichSelection(editor);
        if (command === 'createLink') {
          // Electron does not provide a reliable native prompt flow here.
          // Use the in-app dialog and keep the selected text bookmarked.
          openDocumentLinkDialog(editor);
          return;
        } else if (typeof document.execCommand === 'function') {
          document.execCommand(command, false, null);
        }
        editor.dispatchEvent(new Event('input', { bubbles:true }));
        return;
      }
      const formatButton = event.target.closest('[data-documents-format]');
      if (formatButton) {
        event.preventDefault();
        applyDocumentFormat(formatButton);
        return;
      }
      const button = event.target.closest('[data-documents-action]');
      if (!button) return;
      const action = button.getAttribute('data-documents-action');

      if (action === 'insert-workspace-image') {
        void insertWorkspaceImage(button);
        return;
      }

      if (action === 'insert-workspace-attachment-image') {
        void insertWorkspaceAttachmentImage(
          String(button.getAttribute('data-documents-workspace-ref-id') || ''),
          button
        );
        return;
      }

      if (action === 'toggle-library') {
        const type = String(button.getAttribute('data-office-type') || 'document');
        if (collapsedOfficeLibraries.has(type)) collapsedOfficeLibraries.delete(type);
        else collapsedOfficeLibraries.add(type);
        renderAll();
        return;
      }
      if (action === 'toggle-templates') {
        const type = String(button.getAttribute('data-office-type') || 'document');
        if (openTemplatePickers.has(type)) openTemplatePickers.delete(type);
        else openTemplatePickers.add(type);
        renderAll();
        return;
      }
      if (action === 'create-template') {
        createFromTemplate(button.getAttribute('data-office-template-id'));
        return;
      }
      if (action === 'new-current') createByType(button.getAttribute('data-office-type'));
      if (action === 'new') createDocument();
      if (action === 'new-spreadsheet') createSpreadsheet();
      if (action === 'new-presentation') createPresentation();
      if (action === 'new-diagram') createDiagram();
      if (action === 'new-formula') createFormula();
      if (action === 'new-form') createForm();
      if (action === 'select') {
        state.activeId = button.getAttribute('data-documents-id') || '';
        persistAndRender();
      }
      if (action === 'select-object') {
        const selectedId = button.getAttribute('data-documents-id') || '';
        const selected = getObjectById(selectedId);

        state.activeId = selectedId;

        if (selected && selected.type) {
          openTemplatePickers.delete(selected.type);
        }

        saveState();
        renderAll();
        emitOfficeChanged('open', getActiveObject());
      }
      if (action === 'delete-current-object') deleteOfficeObject(button.getAttribute('data-documents-id'));
      if (action === 'delete') deleteActive();
      if (action === 'duplicate') duplicateActive();
      if (action === 'toggle-files-library-picker') {
        const block = button.closest('.ns-documents-v1__link-block');
        const chooser = block && block.querySelector('[data-documents-files-chooser]');

        if (chooser) {
          if (chooser.hasAttribute('hidden')) {
            // Always rebuild the list from the live Files store.
            // Office surfaces may stay mounted while Files changes elsewhere.
            refreshFilesLibraryPicker(block || chooser);
            chooser.removeAttribute('hidden');
            const select = chooser.querySelector('[data-documents-link-select="file"]');
            if (select) select.focus();
          } else {
            chooser.setAttribute('hidden', '');
          }
        }

        return;
      }
      if (action === 'add-file-link') void addLink('file', button);
      if (action === 'pick-workspace-file') void importWorkspaceFileFromComputer();
      if (action === 'open-workspace-file-ref') void openWorkspaceAttachment(String(button.getAttribute('data-documents-workspace-ref-id') || ''));
      if (action === 'remove-workspace-file-ref') void unlinkWorkspaceFileFromActive(String(button.getAttribute('data-documents-workspace-ref-id') || ''));
      if (action === 'add-map-link') void addLink('map', button);
      if (action === 'remove-link') removeLink(String(button.getAttribute('data-documents-link-kind') || ''), String(button.getAttribute('data-documents-link-id') || ''));
      if (action === 'export-md') exportMarkdown();
      if (action === 'export-html') exportHtml();
      if (action === 'export-document-bundle') void exportDocumentBundle();
      // copy-md/copy-html are handled once in the isolated capture listener above.
      if (action === 'open-project') {
        const item = getActive();
        if (item && item.projectId) {
          document.dispatchEvent(new CustomEvent('ns-notes:open-project', { detail: { projectId: item.projectId, source: 'documents', documentId: item.id } }));
        }
      }
    });

    document.addEventListener('input', (event) => {
      const richEditor = event.target.closest('[data-documents-rich-editor]');
      if (richEditor) {
        const item = getObjectById(richEditor.getAttribute('data-documents-id'));
        if (!item || item.type !== 'document') return;
        setDocumentSaveState('dirty');
        item.payload = Object.assign({}, item.payload || {}, {
          richBody: richEditor.innerHTML
        });
        item.body = richEditor.innerText.replace(/\u00a0/g, ' ');
        item.updatedAt = nowIso();
        markDirty(item);
        saveState();
        void reconcileWorkspaceImageRefs(item, richEditor);
        scheduleSavedState();
        return;
      }
      const field = event.target.closest('[data-documents-field]');
      if (!field) return;
      const key = field.getAttribute('data-documents-field');
      const item = getActive();
      if (!item || !key) return;
      setDocumentSaveState('dirty');
      item[key] = field.value;
      item.updatedAt = nowIso();
      markDirty(item);
      saveState();
      if (key === 'title' && window.IRGEZTNEOfficeShell && typeof window.IRGEZTNEOfficeShell.setObjectContext === 'function') {
        queueExternalOfficeContext(item.type, item.title);
      }
      scheduleSavedState();
      if (key === 'projectId') emitRelationsChanged();
      document.querySelectorAll('.ns-documents-v1__meta-card strong').forEach(() => {});
    });

    document.addEventListener('change', (event) => {
      const style = event.target.closest('[data-documents-rich-style]');
      if (style) {
        const root = style.closest('[data-documents-root]') || document;
        const editor = root.querySelector('[data-documents-rich-editor]');
        if (!editor) return;
        editor.focus();
        if (typeof document.execCommand === 'function') {
          document.execCommand('formatBlock', false, style.value || 'p');
        }
        editor.dispatchEvent(new Event('input', { bubbles:true }));
        return;
      }
      const field = event.target.closest('[data-documents-field]');
      if (!field) return;
      const key = field.getAttribute('data-documents-field');
      if (!key) return;
      updateActive({ [key]: field.value });
      if (key === 'projectId') emitRelationsChanged();
    });

    document.addEventListener('focusout', (event) => {
      if (!event.target || !event.target.closest || !event.target.closest('[data-documents-root]')) return;
      window.setTimeout(() => {
        // If focus really left Documents, it is now safe to paint the final
        // save badge and flush the pending Office-shell context. Moving focus
        // between controls inside the same Documents root remains DOM-silent.
        if (!getFocusedDocumentsSurface()) setDocumentSaveState(currentSaveState);
      }, 0);
    });
  }

  function boot() {
    if (booted) return;
    booted = true;
    bindEvents();
    // Commit the selected startup state to canonical Storage Core immediately.
    // On first run after migration this imports a surviving legacy localStorage
    // state; on later runs the versioned durable state remains authoritative.
    saveState();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('irg:language-changed', renderAll);
  if (document.readyState !== 'loading') boot();

  window.NSDocumentsV1 = {
    createDocument,
    getAll: () => getDocumentItems().slice(),
    getById,
    getActive,
    openDocumentById,
    formatSelection,
    renderAll
  };

  window.NSOfficeV1 = {
    STORAGE_KEY,
    schemaVersion: OfficeObject.SCHEMA_VERSION,
    types: OfficeObject.TYPES,
    createObject,
    createSpreadsheet,
    createPresentation,
    createDiagram,
    createFormula,
    createForm,
    createFromTemplate,
    updateObject,
    saveObject,
    removeObject,
    getAllObjects: () => state.items.slice(),
    getObjectById,
    getActiveObject,
    openObjectById,
    renderAll
  };
})();
