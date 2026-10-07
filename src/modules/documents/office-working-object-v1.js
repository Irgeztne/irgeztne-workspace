(function (root) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var TYPES = Object.freeze(['document', 'spreadsheet', 'presentation', 'diagram', 'formula', 'form']);

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value, fallback) {
    if (value == null) return fallback;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(type) {
    var prefix = type === 'document' ? 'doc' : 'office-' + type;
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function isType(value) {
    return TYPES.indexOf(String(value || '')) !== -1;
  }

  function uniqueIds(value) {
    var seen = Object.create(null);
    return (Array.isArray(value) ? value : []).reduce(function (list, entry) {
      var id = String(entry == null ? '' : entry).trim();
      if (!id || seen[id]) return list;
      seen[id] = true;
      list.push(id);
      return list;
    }, []);
  }

  function normalizeWorkspaceFileRefs(value) {
    var seen = Object.create(null);

    return (Array.isArray(value) ? value : []).reduce(function (list, entry) {
      if (!isObject(entry)) return list;

      var refId = String(entry.refId || '').trim();
      var fileId = String(entry.fileId || '').trim();

      if (!refId || !fileId || seen[refId]) return list;
      seen[refId] = true;

      list.push({
        refId: refId.slice(0, 200),
        fileId: fileId.slice(0, 200),
        displayName: String(entry.displayName || entry.originalName || fileId).slice(0, 500),
        originalName: String(entry.originalName || entry.displayName || fileId).slice(0, 500),
        mimeType: String(entry.mimeType || 'application/octet-stream').slice(0, 255),
        extension: String(entry.extension || '').slice(0, 40),
        sizeBytes: Math.max(0, Number(entry.sizeBytes || 0)),
        sha256: String(entry.sha256 || '').slice(0, 64),
        role: String(entry.role || 'attachment').slice(0, 120)
      });

      return list;
    }, []);
  }

  function normalizeRelations(source) {
    source = isObject(source) ? source : {};
    return Object.assign({}, clone(source, {}), {
      projectId: source.projectId ? String(source.projectId) : '',
      taskIds: uniqueIds(source.taskIds),
      fileIds: uniqueIds(source.fileIds),
      workspaceFileRefs: normalizeWorkspaceFileRefs(source.workspaceFileRefs),
      mapPointIds: uniqueIds(source.mapPointIds)
    });
  }

  function normalizeDocumentPayload(payload, legacy) {
    payload = isObject(payload) ? clone(payload, {}) : {};
    legacy = isObject(legacy) ? legacy : {};
    var historicalType = legacy.documentType || (legacy.type && !isType(legacy.type) ? legacy.type : 'article');
    payload.documentType = String(payload.documentType || historicalType || 'article');
    payload.status = String(payload.status || legacy.status || 'draft');
    payload.body = String(payload.body != null ? payload.body : (legacy.body || ''));
    payload.tags = Array.isArray(payload.tags)
      ? payload.tags.slice()
      : (Array.isArray(legacy.tags) ? legacy.tags.slice() : ['documents', 'writer']);
    return payload;
  }

  function defineAlias(target, name, ownerKey, valueKey, normalizeValue) {
    Object.defineProperty(target, name, {
      configurable: true,
      enumerable: false,
      get: function () {
        return target[ownerKey][valueKey];
      },
      set: function (value) {
        target[ownerKey][valueKey] = normalizeValue ? normalizeValue(value) : value;
      }
    });
  }

  function attachDocumentCompatibility(target) {
    if (!target || target.type !== 'document') return target;
    defineAlias(target, 'documentType', 'payload', 'documentType', function (value) { return String(value || 'article'); });
    defineAlias(target, 'status', 'payload', 'status', function (value) { return String(value || 'draft'); });
    defineAlias(target, 'body', 'payload', 'body', function (value) { return String(value == null ? '' : value); });
    defineAlias(target, 'tags', 'payload', 'tags', function (value) { return Array.isArray(value) ? value.slice() : []; });
    defineAlias(target, 'projectId', 'relations', 'projectId', function (value) { return String(value || ''); });
    defineAlias(target, 'taskIds', 'relations', 'taskIds', uniqueIds);
    defineAlias(target, 'fileIds', 'relations', 'fileIds', uniqueIds);
    defineAlias(target, 'workspaceFileRefs', 'relations', 'workspaceFileRefs', normalizeWorkspaceFileRefs);
    defineAlias(target, 'mapPointIds', 'relations', 'mapPointIds', uniqueIds);
    return target;
  }

  function normalize(raw, options) {
    options = isObject(options) ? options : {};
    var source = isObject(raw) ? raw : {};
    var commonShape = isType(source.type) && isObject(source.payload);
    var type = commonShape ? String(source.type) : 'document';
    var createdAt = source.createdAt ? String(source.createdAt) : (options.now || nowIso());
    var updatedAt = source.updatedAt ? String(source.updatedAt) : createdAt;
    var relationSource = Object.assign(
      {},
      commonShape && isObject(source.relations) ? source.relations : {},
      {
        projectId: commonShape && source.relations && source.relations.projectId != null ? source.relations.projectId : source.projectId,
        taskIds: commonShape && source.relations && source.relations.taskIds != null ? source.relations.taskIds : source.taskIds,
        fileIds: commonShape && source.relations && source.relations.fileIds != null ? source.relations.fileIds : source.fileIds,
        workspaceFileRefs: commonShape && source.relations && source.relations.workspaceFileRefs != null ? source.relations.workspaceFileRefs : source.workspaceFileRefs,
        mapPointIds: commonShape && source.relations && source.relations.mapPointIds != null ? source.relations.mapPointIds : source.mapPointIds
      }
    );
    var payload = commonShape ? clone(source.payload, {}) : normalizeDocumentPayload(null, source);
    if (type === 'document') payload = normalizeDocumentPayload(payload, source);

    var object = {
      id: source.id ? String(source.id) : (typeof options.idFactory === 'function' ? options.idFactory(type) : uid(type)),
      type: type,
      title: source.title ? String(source.title) : String(options.fallbackTitle || 'Untitled document'),
      createdAt: createdAt,
      updatedAt: updatedAt,
      schemaVersion: Number(source.schemaVersion) > 0 ? Number(source.schemaVersion) : SCHEMA_VERSION,
      payload: payload,
      relations: normalizeRelations(relationSource)
    };

    if (!commonShape) {
      Object.defineProperty(object, '_legacySource', {
        configurable: true,
        enumerable: false,
        writable: false,
        value: clone(source, {})
      });
    }
    Object.defineProperty(object, '_wasLegacy', {
      configurable: true,
      enumerable: false,
      writable: false,
      value: !commonShape
    });

    return attachDocumentCompatibility(object);
  }

  function serialize(value, options) {
    options = isObject(options) ? options : {};
    if (options.preserveLegacy && value && value._legacySource) {
      return clone(value._legacySource, {});
    }
    var object = normalize(value, options);
    return {
      id: object.id,
      type: object.type,
      title: object.title,
      createdAt: object.createdAt,
      updatedAt: object.updatedAt,
      schemaVersion: object.schemaVersion || SCHEMA_VERSION,
      payload: clone(object.payload, {}),
      relations: normalizeRelations(object.relations)
    };
  }

  function create(type, seed, options) {
    type = String(type || 'document');
    if (!isType(type)) throw new Error('Unsupported Office object type: ' + type);
    seed = isObject(seed) ? seed : {};
    var timestamp = seed.createdAt || (options && options.now) || nowIso();
    var payload = isObject(seed.payload) ? clone(seed.payload, {}) : {};
    if (type === 'document') payload = normalizeDocumentPayload(payload, seed);
    return normalize({
      id: seed.id,
      type: type,
      title: seed.title,
      createdAt: timestamp,
      updatedAt: seed.updatedAt || timestamp,
      schemaVersion: SCHEMA_VERSION,
      payload: payload,
      relations: isObject(seed.relations) ? seed.relations : {
        projectId: seed.projectId,
        taskIds: seed.taskIds,
        fileIds: seed.fileIds,
        workspaceFileRefs: seed.workspaceFileRefs,
        mapPointIds: seed.mapPointIds
      }
    }, options);
  }

  function applyPatch(value, patch) {
    if (!value || !isObject(patch)) return value;
    if (patch.title != null) value.title = String(patch.title);
    if (patch.updatedAt != null) value.updatedAt = String(patch.updatedAt);
    if (isObject(patch.payload)) value.payload = Object.assign({}, value.payload, clone(patch.payload, {}));
    if (isObject(patch.relations)) value.relations = normalizeRelations(Object.assign({}, value.relations, patch.relations));
    ['documentType', 'status', 'body', 'tags', 'projectId', 'taskIds', 'fileIds', 'workspaceFileRefs', 'mapPointIds'].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(patch, key) && key in value) value[key] = patch[key];
    });
    return attachDocumentCompatibility(value);
  }

  root.NSOfficeWorkingObjectV1 = Object.freeze({
    SCHEMA_VERSION: SCHEMA_VERSION,
    TYPES: TYPES,
    isType: isType,
    normalize: normalize,
    serialize: serialize,
    create: create,
    applyPatch: applyPatch,
    normalizeRelations: normalizeRelations,
    normalizeWorkspaceFileRefs: normalizeWorkspaceFileRefs,
    attachDocumentCompatibility: attachDocumentCompatibility
  });
})(window);
