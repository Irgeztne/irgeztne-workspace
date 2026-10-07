(function (root) {
  'use strict';

  var DOCUMENTS_STORAGE_KEY = 'irgeztne.documents.v1';
  var MAP_PINS_STORAGE_KEY = 'irgeztne:map:v1:pins';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function safeString(value) {
    return String(value == null ? '' : value).trim();
  }

  function lower(value) {
    return safeString(value).toLowerCase();
  }

  function uniqueKey(parts) {
    return parts.map(function (part) { return safeString(part).replace(/\|/g, '/'); }).join('|');
  }

  function readLocalJson(key, fallback) {
    try {
      var raw = root.localStorage ? root.localStorage.getItem(key) : '';
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function getProjects() {
    var store = root.NSProjectStore;
    if (store && typeof store.getAll === 'function') return safeArray(store.getAll());
    return [];
  }

  function getFiles() {
    var store = root.NSLibraryStore;
    if (store && typeof store.getState === 'function') {
      var state = store.getState();
      return safeArray(state && state.items);
    }
    return [];
  }

  function getNotes() {
    var store = root.NSNotesStore;
    if (store && typeof store.getAll === 'function') return safeArray(store.getAll());
    return [];
  }

  function getDrafts() {
    try {
      if (root.__nsEditorV1Instance && root.__nsEditorV1Instance.store && typeof root.__nsEditorV1Instance.store.getDrafts === 'function') {
        return safeArray(root.__nsEditorV1Instance.store.getDrafts());
      }
      if (root.NSEditorV1 && typeof root.NSEditorV1.getDrafts === 'function') return safeArray(root.NSEditorV1.getDrafts());
    } catch (error) {}
    return [];
  }

  function normalizeDocument(item) {
    var source = item && typeof item === 'object' ? item : {};
    var payload = source.payload && typeof source.payload === 'object' ? source.payload : {};
    var relations = source.relations && typeof source.relations === 'object' ? source.relations : {};
    var commonOfficeType = ['document', 'spreadsheet', 'presentation', 'diagram', 'formula', 'form'].indexOf(safeString(source.type)) !== -1 && source.payload && typeof source.payload === 'object';
    if (commonOfficeType && source.type !== 'document') return null;
    return {
      id: safeString(source.id),
      title: safeString(source.title) || 'Untitled document',
      type: commonOfficeType ? (safeString(payload.documentType) || 'article') : (safeString(source.type) || 'article'),
      status: commonOfficeType ? (safeString(payload.status) || 'draft') : (safeString(source.status) || 'draft'),
      projectId: safeString(commonOfficeType ? relations.projectId : source.projectId),
      fileIds: safeArray(commonOfficeType ? relations.fileIds : source.fileIds).map(safeString),
      mapPointIds: safeArray(commonOfficeType ? relations.mapPointIds : source.mapPointIds).map(safeString),
      updatedAt: safeString(source.updatedAt || source.createdAt)
    };
  }

  function getDocuments() {
    if (root.NSDocumentsV1 && typeof root.NSDocumentsV1.getAll === 'function') {
      return safeArray(root.NSDocumentsV1.getAll()).map(normalizeDocument).filter(function (item) { return item && item.id; });
    }
    var state = readLocalJson(DOCUMENTS_STORAGE_KEY, { items: [] });
    return safeArray(state && state.items).map(normalizeDocument).filter(function (item) { return item && item.id; });
  }

  function normalizeMapPoint(item) {
    var source = item && typeof item === 'object' ? item : {};
    var links = source.links && typeof source.links === 'object' ? source.links : {};
    return {
      id: safeString(source.id),
      title: safeString(source.title) || 'Map point',
      type: safeString(source.type) || 'local',
      note: safeString(source.note),
      links: {
        project: safeString(links.project || source.project),
        document: safeString(links.document || source.document),
        file: safeString(links.file || source.file)
      },
      updatedAt: safeString(source.updatedAt || source.createdAt)
    };
  }

  function getMapPoints() {
    if (root.NSMapV1 && typeof root.NSMapV1.getAllPins === 'function') {
      return safeArray(root.NSMapV1.getAllPins()).map(normalizeMapPoint).filter(function (item) { return item.id; });
    }
    return safeArray(readLocalJson(MAP_PINS_STORAGE_KEY, [])).map(normalizeMapPoint).filter(function (item) { return item.id; });
  }

  function makeIndex(items, valueFns) {
    var index = Object.create(null);
    safeArray(items).forEach(function (item) {
      safeArray(valueFns).forEach(function (fn) {
        var value = lower(fn(item));
        if (value && !index[value]) index[value] = item;
      });
    });
    return index;
  }

  function resolveTitle(type, id, indexes) {
    var item = null;
    if (type === 'project') item = indexes.projectsById[id];
    if (type === 'file') item = indexes.filesById[id];
    if (type === 'note') item = indexes.notesById[id];
    if (type === 'draft') item = indexes.draftsById[id];
    if (type === 'document') item = indexes.documentsById[id];
    if (type === 'mapPoint') item = indexes.mapPointsById[id];

    if (!item) return id;
    return item.title || item.name || item.originalName || item.id || id;
  }

  function resolveMeta(type, id, indexes) {
    var item = null;
    if (type === 'file') item = indexes.filesById[id];
    if (type === 'note') item = indexes.notesById[id];
    if (type === 'draft') item = indexes.draftsById[id];
    if (type === 'document') item = indexes.documentsById[id];
    if (type === 'mapPoint') item = indexes.mapPointsById[id];
    if (!item) return type;
    if (type === 'file') return item.category || item.type || item.ext || 'file';
    if (type === 'note') return item.type || 'note';
    if (type === 'draft') return item.type || 'draft';
    if (type === 'document') return (item.type || 'document') + (item.status ? ' · ' + item.status : '');
    if (type === 'mapPoint') return (item.type || 'point') + (item.note ? ' · ' + item.note : '');
    return type;
  }

  function buildIndexes() {
    var projects = getProjects();
    var files = getFiles();
    var notes = getNotes();
    var drafts = getDrafts();
    var documents = getDocuments();
    var mapPoints = getMapPoints();

    return {
      projects: projects,
      files: files,
      notes: notes,
      drafts: drafts,
      documents: documents,
      mapPoints: mapPoints,
      projectsById: makeIndex(projects, [function (item) { return item.id; }]),
      projectsByLabel: makeIndex(projects, [function (item) { return item.id; }, function (item) { return item.title; }]),
      filesById: makeIndex(files, [function (item) { return item.id; }]),
      filesByLabel: makeIndex(files, [function (item) { return item.id; }, function (item) { return item.name; }, function (item) { return item.originalName; }]),
      notesById: makeIndex(notes, [function (item) { return item.id; }]),
      draftsById: makeIndex(drafts, [function (item) { return item.id; }]),
      documentsById: makeIndex(documents, [function (item) { return item.id; }]),
      documentsByLabel: makeIndex(documents, [function (item) { return item.id; }, function (item) { return item.title; }]),
      mapPointsById: makeIndex(mapPoints, [function (item) { return item.id; }])
    };
  }

  function createRelation(indexes, sourceType, sourceId, targetType, targetId, origin, label) {
    sourceId = safeString(sourceId);
    targetId = safeString(targetId);
    if (!sourceId || !targetId) return null;
    return {
      id: uniqueKey([sourceType, sourceId, targetType, targetId, origin || 'local']),
      sourceType: sourceType,
      sourceId: sourceId,
      sourceTitle: resolveTitle(sourceType, sourceId, indexes),
      targetType: targetType,
      targetId: targetId,
      targetTitle: resolveTitle(targetType, targetId, indexes),
      targetMeta: resolveMeta(targetType, targetId, indexes),
      origin: origin || 'local',
      label: label || sourceType + ' → ' + targetType
    };
  }

  function addRelation(list, seen, relation) {
    if (!relation || seen[relation.id]) return;
    seen[relation.id] = true;
    list.push(relation);
  }

  function getAllRelations() {
    var indexes = buildIndexes();
    var list = [];
    var seen = Object.create(null);

    indexes.projects.forEach(function (project) {
      safeArray(project.fileIds).forEach(function (fileId) {
        addRelation(list, seen, createRelation(indexes, 'project', project.id, 'file', fileId, 'projects:fileIds', 'Project file'));
      });
      safeArray(project.noteIds).forEach(function (noteId) {
        addRelation(list, seen, createRelation(indexes, 'project', project.id, 'note', noteId, 'projects:noteIds', 'Project note'));
      });
      safeArray(project.draftIds).forEach(function (draftId) {
        addRelation(list, seen, createRelation(indexes, 'project', project.id, 'draft', draftId, 'projects:draftIds', 'Project draft'));
      });
    });

    indexes.notes.forEach(function (note) {
      if (!note.projectId) return;
      addRelation(list, seen, createRelation(indexes, 'project', note.projectId, 'note', note.id, 'notes:projectId', 'Project note'));
    });

    indexes.documents.forEach(function (doc) {
      if (doc.projectId) {
        addRelation(list, seen, createRelation(indexes, 'project', doc.projectId, 'document', doc.id, 'documents:projectId', 'Project document'));
      }
      safeArray(doc.fileIds).forEach(function (fileId) {
        addRelation(list, seen, createRelation(indexes, 'document', doc.id, 'file', fileId, 'documents:fileIds', 'Document file'));
      });
      safeArray(doc.mapPointIds).forEach(function (pointId) {
        addRelation(list, seen, createRelation(indexes, 'document', doc.id, 'mapPoint', pointId, 'documents:mapPointIds', 'Document map point'));
      });
    });

    indexes.mapPoints.forEach(function (point) {
      var links = point.links || {};
      var project = indexes.projectsByLabel[lower(links.project)];
      var document = indexes.documentsByLabel[lower(links.document)];
      var file = indexes.filesByLabel[lower(links.file)];

      if (project) {
        addRelation(list, seen, createRelation(indexes, 'project', project.id, 'mapPoint', point.id, 'map:projectLink', 'Map point'));
      }
      if (document) {
        addRelation(list, seen, createRelation(indexes, 'document', document.id, 'mapPoint', point.id, 'map:documentLink', 'Map point'));
      }
      if (file) {
        addRelation(list, seen, createRelation(indexes, 'file', file.id, 'mapPoint', point.id, 'map:fileLink', 'Map point'));
      }
    });

    return list;
  }

  function getRelationsForProject(projectId) {
    projectId = safeString(projectId);
    if (!projectId) return [];
    return getAllRelations().filter(function (relation) {
      return (relation.sourceType === 'project' && relation.sourceId === projectId) ||
        (relation.targetType === 'project' && relation.targetId === projectId);
    });
  }

  function makeBucket() {
    return { files: [], notes: [], drafts: [], documents: [], mapPoints: [], packages: [], templates: [], other: [], all: [] };
  }

  function bucketName(type) {
    if (type === 'file') return 'files';
    if (type === 'note') return 'notes';
    if (type === 'draft') return 'drafts';
    if (type === 'document') return 'documents';
    if (type === 'mapPoint') return 'mapPoints';
    if (type === 'package') return 'packages';
    if (type === 'template') return 'templates';
    return 'other';
  }

  function getProjectBuckets(projectId) {
    var buckets = makeBucket();
    var seen = Object.create(null);
    getRelationsForProject(projectId).forEach(function (relation) {
      var targetType = relation.sourceType === 'project' ? relation.targetType : relation.sourceType;
      var targetId = relation.sourceType === 'project' ? relation.targetId : relation.sourceId;
      var key = uniqueKey([targetType, targetId]);
      if (seen[key]) return;
      seen[key] = true;
      var entry = clone(relation);
      entry.bucketType = targetType;
      entry.bucketId = targetId;
      entry.bucketTitle = relation.sourceType === 'project' ? relation.targetTitle : relation.sourceTitle;
      entry.bucketMeta = relation.sourceType === 'project' ? relation.targetMeta : relation.label;
      var name = bucketName(targetType);
      buckets[name].push(entry);
      buckets.all.push(entry);
    });
    return buckets;
  }

  function getSummary() {
    var relations = getAllRelations();
    return relations.reduce(function (acc, relation) {
      acc.total += 1;
      var name = bucketName(relation.targetType);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, { total: 0, files: 0, notes: 0, drafts: 0, documents: 0, mapPoints: 0, packages: 0, templates: 0, other: 0 });
  }

  function notify() {
    document.dispatchEvent(new CustomEvent('irg:relations-changed'));
  }

  root.NSRelationsStore = {
    getAllRelations: getAllRelations,
    getRelationsForProject: getRelationsForProject,
    getProjectBuckets: getProjectBuckets,
    getSummary: getSummary,
    notify: notify
  };
})(window);
