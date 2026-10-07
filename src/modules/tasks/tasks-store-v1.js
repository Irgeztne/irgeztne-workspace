(function (root) {
  'use strict';

  const STORAGE_KEY = 'irgeztne.workspace.tasks.v1'; // legacy migration/cache
  const DURABLE_STATE_KEY = 'workspace.tasks.v1';
  const DURABLE_PERSISTENCE_VERSION = 1;
  const SCHEMA_VERSION = 1;
  const TASK_STATES = [
    'INBOX', 'READY', 'ACTIVE', 'WAITING', 'BLOCKED', 'PAUSED',
    'REVIEW', 'DONE', 'VERIFIED', 'CANCELLED', 'SUPERSEDED', 'ARCHIVED'
  ];
  const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
  const EVIDENCE_TYPES = ['NOTE', 'TEST', 'URL', 'FILE', 'IMAGE', 'CHECKLIST'];
  const RELATION_TYPES = ['DEPENDS_ON', 'BLOCKS', 'RELATED_TO', 'CREATED_FROM', 'SUPERSEDES'];
  const LINK_TYPES = ['PROJECT', 'FILE', 'NOTE', 'WEB_STUDIO', 'WORKSHOP', 'URL'];

  // Tasks P2a — canonical lifecycle. State changes must go through transition().
  const ALLOWED_TRANSITIONS = {
    INBOX: ['READY', 'ACTIVE', 'CANCELLED', 'SUPERSEDED'],
    READY: ['ACTIVE', 'WAITING', 'BLOCKED', 'PAUSED', 'CANCELLED', 'SUPERSEDED'],
    ACTIVE: ['WAITING', 'BLOCKED', 'PAUSED', 'DONE', 'CANCELLED', 'SUPERSEDED'],
    WAITING: ['ACTIVE', 'BLOCKED', 'PAUSED', 'CANCELLED', 'SUPERSEDED'],
    BLOCKED: ['ACTIVE', 'WAITING', 'PAUSED', 'CANCELLED', 'SUPERSEDED'],
    PAUSED: ['ACTIVE', 'WAITING', 'BLOCKED', 'CANCELLED', 'SUPERSEDED'],
    DONE: ['REVIEW', 'ACTIVE', 'CANCELLED', 'SUPERSEDED'],
    REVIEW: ['VERIFIED', 'ACTIVE', 'CANCELLED', 'SUPERSEDED'],
    VERIFIED: ['ARCHIVED'],
    CANCELLED: ['ARCHIVED'],
    SUPERSEDED: ['ARCHIVED'],
    ARCHIVED: []
  };

  const DEFAULT_STATE = {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      version: 1,
      lastUpdatedAt: '',
      lastOpenedTaskId: '',
      lastActiveTaskId: '',
      lastView: 'focus',
      sidebarCollapsed: false
    },
    tasks: [],
    events: [],
    relations: [],
    links: [],
    checklist: [],
    evidence: [],
    sessions: []
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function cleanText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeState(value) {
    const next = String(value || '').toUpperCase();
    return TASK_STATES.includes(next) ? next : 'INBOX';
  }

  function normalizePriority(value) {
    const next = String(value || '').toUpperCase();
    return PRIORITIES.includes(next) ? next : 'NORMAL';
  }

  function normalizeTask(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    const updatedAt = source.updatedAt ? String(source.updatedAt) : createdAt;
    return {
      id: source.id ? String(source.id) : uid('task'),
      schemaVersion: 1,
      title: cleanText(source.title) || 'Untitled task',
      intent: cleanText(source.intent),
      outcome: cleanText(source.outcome),
      nextAction: cleanText(source.nextAction),
      state: normalizeState(source.state),
      priority: normalizePriority(source.priority),
      projectId: cleanText(source.projectId),
      dueAt: source.dueAt ? String(source.dueAt) : null,
      createdAt: createdAt,
      updatedAt: updatedAt,
      startedAt: source.startedAt ? String(source.startedAt) : null,
      completedAt: source.completedAt ? String(source.completedAt) : null,
      verifiedAt: source.verifiedAt ? String(source.verifiedAt) : null,
      archivedAt: source.archivedAt ? String(source.archivedAt) : null,
      waitingSince: source.waitingSince ? String(source.waitingSince) : null,
      blockedSince: source.blockedSince ? String(source.blockedSince) : null,
      blocker: cleanText(source.blocker),
      tags: Array.isArray(source.tags) ? Array.from(new Set(source.tags.filter(Boolean).map(String))) : [],
      deleted: Boolean(source.deleted)
    };
  }

  function normalizeEvent(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
      id: source.id ? String(source.id) : uid('event'),
      taskId: source.taskId ? String(source.taskId) : '',
      type: source.type ? String(source.type) : 'TASK_UPDATED',
      createdAt: source.createdAt ? String(source.createdAt) : nowIso(),
      payload: source.payload && typeof source.payload === 'object' ? clone(source.payload) : {}
    };
  }

  function normalizeChecklistItem(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    return {
      id: source.id ? String(source.id) : uid('check'),
      taskId: source.taskId ? String(source.taskId) : '',
      text: cleanText(source.text),
      done: Boolean(source.done),
      important: Boolean(source.important),
      createdAt: createdAt,
      updatedAt: source.updatedAt ? String(source.updatedAt) : createdAt
    };
  }

  function normalizeEvidence(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const type = String(source.type || 'NOTE').toUpperCase();
    const createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    return {
      id: source.id ? String(source.id) : uid('evidence'),
      taskId: source.taskId ? String(source.taskId) : '',
      type: EVIDENCE_TYPES.includes(type) ? type : 'NOTE',
      label: cleanText(source.label),
      value: cleanText(source.value),
      createdAt: createdAt,
      updatedAt: source.updatedAt ? String(source.updatedAt) : createdAt
    };
  }

  function normalizeRelation(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const type = String(source.type || 'RELATED_TO').toUpperCase();
    const createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    return {
      id: source.id ? String(source.id) : uid('relation'),
      type: RELATION_TYPES.includes(type) ? type : 'RELATED_TO',
      sourceTaskId: source.sourceTaskId ? String(source.sourceTaskId) : '',
      targetTaskId: source.targetTaskId ? String(source.targetTaskId) : '',
      label: cleanText(source.label),
      createdAt: createdAt,
      updatedAt: source.updatedAt ? String(source.updatedAt) : createdAt
    };
  }

  function normalizeLink(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const type = String(source.type || 'URL').toUpperCase();
    const createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    return {
      id: source.id ? String(source.id) : uid('link'),
      taskId: source.taskId ? String(source.taskId) : '',
      type: LINK_TYPES.includes(type) ? type : 'URL',
      targetId: cleanText(source.targetId),
      targetUri: cleanText(source.targetUri),
      label: cleanText(source.label),
      createdAt: createdAt,
      updatedAt: source.updatedAt ? String(source.updatedAt) : createdAt
    };
  }


  function normalizeSession(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const startedAt = source.startedAt ? String(source.startedAt) : nowIso();
    return {
      id: source.id ? String(source.id) : uid('session'),
      taskId: source.taskId ? String(source.taskId) : '',
      startedAt: startedAt,
      endedAt: source.endedAt ? String(source.endedAt) : null,
      summary: cleanText(source.summary),
      stoppedAt: cleanText(source.stoppedAt),
      nextAction: cleanText(source.nextAction),
      reason: cleanText(source.reason)
    };
  }

  function normalizeRoot(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      meta: {
        version: 1,
        lastUpdatedAt: meta.lastUpdatedAt ? String(meta.lastUpdatedAt) : '',
        lastOpenedTaskId: meta.lastOpenedTaskId ? String(meta.lastOpenedTaskId) : '',
        lastActiveTaskId: meta.lastActiveTaskId ? String(meta.lastActiveTaskId) : '',
        lastView: meta.lastView ? String(meta.lastView) : 'focus',
        sidebarCollapsed: Boolean(meta.sidebarCollapsed)
      },
      tasks: Array.isArray(source.tasks) ? source.tasks.map(normalizeTask) : [],
      events: Array.isArray(source.events) ? source.events.map(normalizeEvent) : [],
      relations: Array.isArray(source.relations) ? source.relations.map(normalizeRelation) : [],
      links: Array.isArray(source.links) ? source.links.map(normalizeLink) : [],
      checklist: Array.isArray(source.checklist) ? source.checklist.map(normalizeChecklistItem) : [],
      evidence: Array.isArray(source.evidence) ? source.evidence.map(normalizeEvidence) : [],
      sessions: Array.isArray(source.sessions) ? source.sessions.map(normalizeSession) : []
    };
  }

  let migrateLegacyOnBoot = false;

  function readDurableState() {
    try {
      const api = root.nsAPI;
      if (!api || typeof api.storageGetModuleStateSync !== 'function') return null;
      const value = api.storageGetModuleStateSync(DURABLE_STATE_KEY, null);
      return value && typeof value === 'object' ? value : null;
    } catch (error) {
      console.warn('[NSTaskStoreV1] durable read failed:', error);
      return null;
    }
  }

  function writeDurableState(value) {
    const api = root.nsAPI;
    if (!api || typeof api.storageSetModuleStateSync !== 'function') return false;
    const payload = clone(value);
    payload.persistenceVersion = DURABLE_PERSISTENCE_VERSION;
    try {
      const result = api.storageSetModuleStateSync(DURABLE_STATE_KEY, payload);
      return Boolean(result && result.ok === true);
    } catch (error) {
      console.error('[NSTaskStoreV1] durable save failed:', error);
      return false;
    }
  }

  function load() {
    const durableRaw = readDurableState();
    const durable = durableRaw ? normalizeRoot(durableRaw) : null;
    let legacy = null;
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (raw) legacy = normalizeRoot(JSON.parse(raw));
    } catch (error) {
      console.warn('[NSTaskStoreV1] legacy load failed:', error);
    }

    function richness(value) {
      if (!value) return 0;
      return (value.tasks || []).length * 1000 +
        (value.events || []).length * 20 +
        (value.relations || []).length * 20 +
        (value.links || []).length * 20 +
        (value.checklist || []).length * 10 +
        (value.evidence || []).length * 10 +
        (value.sessions || []).length * 10;
    }

    const durableScore = richness(durable);
    const legacyScore = richness(legacy);
    const durableStamp = durable ? Date.parse(durable.meta.lastUpdatedAt || '') || 0 : 0;
    const legacyStamp = legacy ? Date.parse(legacy.meta.lastUpdatedAt || '') || 0 : 0;

    if (legacy && (legacyScore > durableScore || (legacyScore > 0 && legacyStamp > durableStamp))) {
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

  let state = load();
  const listeners = [];

  if (migrateLegacyOnBoot) {
    if (writeDurableState(state)) migrateLegacyOnBoot = false;
  }

  function notify() {
    const snapshot = getState();
    listeners.slice().forEach(function (listener) {
      try { listener(snapshot); } catch (error) { console.warn('[NSTaskStoreV1] subscriber failed:', error); }
    });
    try {
      document.dispatchEvent(new CustomEvent('irgeztne:tasks-changed', { detail: snapshot }));
    } catch (error) {}
  }

  function persist() {
    state.meta.lastUpdatedAt = nowIso();
    const durableOk = writeDurableState(state);
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('[NSTaskStoreV1] legacy mirror failed:', error);
    }
    if (root.nsAPI && typeof root.nsAPI.storageSetModuleStateSync === 'function' && !durableOk) {
      throw new Error('TASK_DURABLE_SAVE_FAILED');
    }
    notify();
  }

  function getState() {
    return clone(state);
  }

  function getAll(options) {
    const includeArchived = Boolean(options && options.includeArchived);
    return clone(state.tasks)
      .filter(function (task) { return !task.deleted && (includeArchived || task.state !== 'ARCHIVED'); })
      .sort(function (a, b) { return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); });
  }

  function getById(taskId) {
    const found = state.tasks.find(function (task) { return task.id === taskId && !task.deleted; });
    return found ? clone(found) : null;
  }

  function touchTask(taskId, timestamp) {
    const index = state.tasks.findIndex(function (task) { return task.id === taskId && !task.deleted; });
    if (index >= 0) state.tasks[index].updatedAt = timestamp || nowIso();
  }

  function appendEvent(taskId, type, payload, skipPersist) {
    const event = normalizeEvent({ taskId: taskId, type: type, payload: payload || {}, createdAt: nowIso() });
    state.events.unshift(event);
    if (!skipPersist) persist();
    return clone(event);
  }

  function create(payload) {
    const title = cleanText(payload && payload.title);
    if (!title) return null;
    const timestamp = nowIso();
    const task = normalizeTask(Object.assign({}, payload || {}, {
      id: uid('task'),
      title: title,
      // New tasks always enter through INBOX. Later state changes use transition().
      state: 'INBOX',
      createdAt: timestamp,
      updatedAt: timestamp
    }));
    state.tasks.unshift(task);
    state.meta.lastOpenedTaskId = task.id;
    appendEvent(task.id, 'TASK_CREATED', { title: task.title }, true);
    persist();
    return clone(task);
  }

  function update(taskId, patch) {
    const index = state.tasks.findIndex(function (task) { return task.id === taskId && !task.deleted; });
    if (index < 0) return null;
    const current = state.tasks[index];
    const sourcePatch = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'state')) {
      const requestedState = normalizeState(sourcePatch.state);
      delete sourcePatch.state;
      if (requestedState !== current.state) {
        console.warn('[NSTaskStoreV1] state changes must use transition():', current.state, '->', requestedState);
      }
    }
    const next = normalizeTask(Object.assign({}, current, sourcePatch, {
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: nowIso()
    }));
    state.tasks[index] = next;
    if (Object.prototype.hasOwnProperty.call(sourcePatch, 'nextAction') && current.nextAction !== next.nextAction) {
      appendEvent(taskId, 'NEXT_ACTION_CHANGED', { previous: current.nextAction, next: next.nextAction }, true);
    } else {
      appendEvent(taskId, 'TASK_UPDATED', { fields: Object.keys(sourcePatch) }, true);
    }
    persist();
    return clone(next);
  }

  function getAllowedTransitions(taskId) {
    const task = getById(taskId);
    if (!task) return [];
    return (ALLOWED_TRANSITIONS[task.state] || []).slice();
  }

  function canTransition(taskId, nextState) {
    const task = getById(taskId);
    if (!task) return false;
    const target = normalizeState(nextState);
    if (target === task.state) return true;
    return (ALLOWED_TRANSITIONS[task.state] || []).includes(target);
  }

  function transition(taskId, nextState, metadata) {
    const index = state.tasks.findIndex(function (task) { return task.id === taskId && !task.deleted; });
    if (index < 0) return null;
    const current = state.tasks[index];
    const target = normalizeState(nextState);
    if (target === current.state) return clone(current);
    if (!(ALLOWED_TRANSITIONS[current.state] || []).includes(target)) {
      console.warn('[NSTaskStoreV1] blocked invalid transition:', current.state, '->', target, taskId);
      return null;
    }

    const timestamp = nowIso();
    const patch = { state: target, updatedAt: timestamp };
    let eventType = 'TASK_UPDATED';

    if (target === 'READY') eventType = 'TASK_READY';
    if (target === 'ACTIVE') {
      if (current.state === 'BLOCKED') eventType = 'TASK_UNBLOCKED';
      else if (current.state === 'REVIEW' || current.state === 'DONE') eventType = 'TASK_RETURNED_TO_WORK';
      else if (current.state === 'PAUSED' || current.state === 'WAITING') eventType = 'TASK_RESUMED';
      else eventType = 'TASK_STARTED';
      patch.startedAt = current.startedAt || timestamp;
      patch.waitingSince = null;
      patch.blockedSince = null;
      if (current.state === 'DONE' || current.state === 'REVIEW') {
        patch.completedAt = null;
        patch.verifiedAt = null;
      }
      state.meta.lastActiveTaskId = taskId;
    }
    if (target === 'WAITING') { eventType = 'TASK_WAITING'; patch.waitingSince = timestamp; }
    if (target === 'BLOCKED') { eventType = 'TASK_BLOCKED'; patch.blockedSince = timestamp; }
    if (target === 'PAUSED') eventType = 'TASK_PAUSED';
    if (target === 'REVIEW') eventType = 'TASK_SENT_TO_REVIEW';
    if (target === 'DONE') { eventType = 'TASK_COMPLETED'; patch.completedAt = timestamp; patch.verifiedAt = null; }
    if (target === 'VERIFIED') { eventType = 'TASK_VERIFIED'; patch.verifiedAt = timestamp; }
    if (target === 'CANCELLED') eventType = 'TASK_CANCELLED';
    if (target === 'SUPERSEDED') eventType = 'TASK_SUPERSEDED';
    if (target === 'ARCHIVED') { eventType = 'TASK_ARCHIVED'; patch.archivedAt = timestamp; }

    // A work session is context memory, not a timer. If lifecycle leaves ACTIVE,
    // close any still-open session so Continue/Resume never points at a ghost session.
    if (current.state === 'ACTIVE' && target !== 'ACTIVE') {
      finishSessionInternal(taskId, { reason: 'STATE_TRANSITION' }, timestamp, true);
    }

    state.tasks[index] = normalizeTask(Object.assign({}, current, patch));
    appendEvent(taskId, eventType, Object.assign({ previousState: current.state, nextState: target }, metadata || {}), true);
    persist();
    return clone(state.tasks[index]);
  }

  function setNextAction(taskId, text) {
    return update(taskId, { nextAction: cleanText(text) });
  }

  // Tasks P2b — Proof lives inside the canonical Task Store.
  function getChecklist(taskId) {
    const id = String(taskId || '');
    return clone(state.checklist.filter(function (item) { return item.taskId === id; })
      .sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); }));
  }

  function addChecklistItem(taskId, payload) {
    const task = getById(taskId);
    const text = cleanText(payload && (payload.text != null ? payload.text : payload));
    if (!task || !text) return null;
    const timestamp = nowIso();
    const item = normalizeChecklistItem({
      id: uid('check'), taskId: task.id, text: text, done: false,
      important: Boolean(payload && payload.important), createdAt: timestamp, updatedAt: timestamp
    });
    state.checklist.push(item);
    touchTask(task.id, timestamp);
    appendEvent(task.id, 'CHECKLIST_ITEM_ADDED', { checklistItemId: item.id, text: item.text }, true);
    persist();
    return clone(item);
  }

  function toggleChecklistItem(taskId, checklistItemId, done) {
    const task = getById(taskId);
    if (!task) return null;
    const index = state.checklist.findIndex(function (item) { return item.id === checklistItemId && item.taskId === task.id; });
    if (index < 0) return null;
    const current = state.checklist[index];
    const nextDone = typeof done === 'boolean' ? done : !current.done;
    if (nextDone === current.done) return clone(current);
    const next = normalizeChecklistItem(Object.assign({}, current, { done: nextDone, updatedAt: nowIso() }));
    state.checklist[index] = next;
    touchTask(task.id, next.updatedAt);
    appendEvent(task.id, nextDone ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_REOPENED', { checklistItemId: next.id, text: next.text }, true);
    persist();
    return clone(next);
  }

  function removeChecklistItem(taskId, checklistItemId) {
    const task = getById(taskId);
    if (!task) return false;
    const index = state.checklist.findIndex(function (item) { return item.id === checklistItemId && item.taskId === task.id; });
    if (index < 0) return false;
    const removed = state.checklist.splice(index, 1)[0];
    touchTask(task.id);
    appendEvent(task.id, 'CHECKLIST_ITEM_REMOVED', { checklistItemId: removed.id, text: removed.text }, true);
    persist();
    return true;
  }

  function getEvidence(taskId) {
    const id = String(taskId || '');
    return clone(state.evidence.filter(function (item) { return item.taskId === id; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }));
  }

  function addEvidence(taskId, payload) {
    const task = getById(taskId);
    if (!task) return null;
    const source = payload && typeof payload === 'object' ? payload : { value: payload };
    const type = String(source.type || 'NOTE').toUpperCase();
    const value = cleanText(source.value);
    const label = cleanText(source.label);
    if (!value && !label) return null;
    const timestamp = nowIso();
    const item = normalizeEvidence({
      id: uid('evidence'), taskId: task.id,
      type: EVIDENCE_TYPES.includes(type) ? type : 'NOTE',
      label: label, value: value, createdAt: timestamp, updatedAt: timestamp
    });
    state.evidence.unshift(item);
    touchTask(task.id, timestamp);
    appendEvent(task.id, 'EVIDENCE_ADDED', { evidenceId: item.id, evidenceType: item.type, label: item.label }, true);
    persist();
    return clone(item);
  }

  function removeEvidence(taskId, evidenceId) {
    const task = getById(taskId);
    if (!task) return false;
    const index = state.evidence.findIndex(function (item) { return item.id === evidenceId && item.taskId === task.id; });
    if (index < 0) return false;
    const removed = state.evidence.splice(index, 1)[0];
    touchTask(task.id);
    appendEvent(task.id, 'EVIDENCE_REMOVED', { evidenceId: removed.id, evidenceType: removed.type, label: removed.label }, true);
    persist();
    return true;
  }

  function getProofSummary(taskId) {
    const checklist = getChecklist(taskId);
    const evidence = getEvidence(taskId);
    const completed = checklist.filter(function (item) { return item.done; }).length;
    return {
      checklistTotal: checklist.length,
      checklistCompleted: completed,
      evidenceCount: evidence.length,
      hasProof: completed > 0 || evidence.length > 0
    };
  }

  function getRelations(taskId) {
    const id = String(taskId || '');
    return clone(state.relations.filter(function (item) {
      return item.sourceTaskId === id || item.targetTaskId === id;
    }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }));
  }

  function addRelation(taskId, payload) {
    const task = getById(taskId);
    const source = payload && typeof payload === 'object' ? payload : {};
    if (!task) return null;
    const type = String(source.type || 'RELATED_TO').toUpperCase();
    const targetTaskId = cleanText(source.targetTaskId);
    const target = getById(targetTaskId);
    if (!RELATION_TYPES.includes(type) || !target || target.id === task.id) return null;

    const duplicate = state.relations.find(function (item) {
      return item.sourceTaskId === task.id && item.targetTaskId === target.id && item.type === type;
    });
    if (duplicate) return clone(duplicate);

    const timestamp = nowIso();
    const item = normalizeRelation({
      id: uid('relation'),
      type: type,
      sourceTaskId: task.id,
      targetTaskId: target.id,
      label: cleanText(source.label),
      createdAt: timestamp,
      updatedAt: timestamp
    });
    state.relations.unshift(item);
    touchTask(task.id, timestamp);
    touchTask(target.id, timestamp);
    appendEvent(task.id, 'RELATION_ADDED', {
      relationId: item.id, relationType: item.type, targetTaskId: target.id, targetTitle: target.title, direction: 'outgoing'
    }, true);
    appendEvent(target.id, 'RELATION_ADDED', {
      relationId: item.id, relationType: item.type, targetTaskId: task.id, targetTitle: task.title, direction: 'incoming'
    }, true);
    persist();
    return clone(item);
  }

  function removeRelation(taskId, relationId) {
    const task = getById(taskId);
    if (!task) return false;
    const index = state.relations.findIndex(function (item) {
      return item.id === relationId && (item.sourceTaskId === task.id || item.targetTaskId === task.id);
    });
    if (index < 0) return false;
    const removed = state.relations.splice(index, 1)[0];
    const otherId = removed.sourceTaskId === task.id ? removed.targetTaskId : removed.sourceTaskId;
    const otherTask = getById(otherId);
    const timestamp = nowIso();
    touchTask(task.id, timestamp);
    if (otherTask) touchTask(otherTask.id, timestamp);
    appendEvent(task.id, 'RELATION_REMOVED', {
      relationId: removed.id, relationType: removed.type, targetTaskId: otherId, targetTitle: otherTask ? otherTask.title : ''
    }, true);
    if (otherTask) {
      appendEvent(otherTask.id, 'RELATION_REMOVED', {
        relationId: removed.id, relationType: removed.type, targetTaskId: task.id, targetTitle: task.title
      }, true);
    }
    persist();
    return true;
  }

  function getLinks(taskId) {
    const id = String(taskId || '');
    return clone(state.links.filter(function (item) { return item.taskId === id; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }));
  }

  function addLink(taskId, payload) {
    const task = getById(taskId);
    const source = payload && typeof payload === 'object' ? payload : {};
    if (!task) return null;
    const type = String(source.type || 'URL').toUpperCase();
    if (!LINK_TYPES.includes(type)) return null;

    const rawRef = cleanText(source.targetRef);
    const targetId = cleanText(source.targetId || (type === 'URL' ? '' : rawRef));
    const targetUri = cleanText(source.targetUri || (type === 'URL' ? rawRef : ''));
    const label = cleanText(source.label);
    if ((type === 'URL' && !targetUri) || (type !== 'URL' && !targetId)) return null;

    const duplicate = state.links.find(function (item) {
      return item.taskId === task.id && item.type === type &&
        item.targetId === targetId && item.targetUri === targetUri;
    });
    if (duplicate) return clone(duplicate);

    const timestamp = nowIso();
    const item = normalizeLink({
      id: uid('link'), taskId: task.id, type: type,
      targetId: targetId, targetUri: targetUri, label: label,
      createdAt: timestamp, updatedAt: timestamp
    });
    state.links.unshift(item);
    touchTask(task.id, timestamp);
    appendEvent(task.id, 'LINK_ADDED', {
      linkId: item.id, linkType: item.type, targetId: item.targetId, targetUri: item.targetUri, label: item.label
    }, true);
    persist();
    return clone(item);
  }

  function removeLink(taskId, linkId) {
    const task = getById(taskId);
    if (!task) return false;
    const index = state.links.findIndex(function (item) { return item.id === linkId && item.taskId === task.id; });
    if (index < 0) return false;
    const removed = state.links.splice(index, 1)[0];
    touchTask(task.id);
    appendEvent(task.id, 'LINK_REMOVED', {
      linkId: removed.id, linkType: removed.type, targetId: removed.targetId, targetUri: removed.targetUri, label: removed.label
    }, true);
    persist();
    return true;
  }

  function getRelationSummary(taskId) {
    const relations = getRelations(taskId);
    const links = getLinks(taskId);
    return {
      taskRelations: relations.length,
      workspaceLinks: links.length,
      total: relations.length + links.length
    };
  }

  function recordReferencesTask(record, taskId) {
    if (!record || typeof record !== 'object') return false;
    return [
      'taskId', 'ownerTaskId', 'sourceTaskId', 'targetTaskId',
      'fromTaskId', 'toTaskId', 'parentTaskId', 'childTaskId',
      'sourceId', 'targetId'
    ].some(function (key) { return record[key] != null && String(record[key]) === taskId; });
  }

  // Physical deletion is intentionally explicit and user-confirmed in the UI.
  // It is for accidental/test tasks; normal workflow should prefer Cancel / Archive / Supersede.
  function removeTask(taskId) {
    const id = String(taskId || '');
    const index = state.tasks.findIndex(function (task) { return task.id === id && !task.deleted; });
    if (index < 0) return false;

    state.tasks.splice(index, 1);
    state.events = state.events.filter(function (event) { return event.taskId !== id; });
    state.relations = state.relations.filter(function (record) { return !recordReferencesTask(record, id); });
    state.links = state.links.filter(function (record) { return !recordReferencesTask(record, id); });
    state.checklist = state.checklist.filter(function (record) { return !recordReferencesTask(record, id); });
    state.evidence = state.evidence.filter(function (record) { return !recordReferencesTask(record, id); });
    state.sessions = state.sessions.filter(function (record) { return !recordReferencesTask(record, id); });

    if (state.meta.lastActiveTaskId === id) state.meta.lastActiveTaskId = '';
    if (state.meta.lastOpenedTaskId === id) {
      const fallback = state.tasks.find(function (task) { return !task.deleted && task.state !== 'ARCHIVED'; }) ||
        state.tasks.find(function (task) { return !task.deleted; }) || null;
      state.meta.lastOpenedTaskId = fallback ? fallback.id : '';
    }

    persist();
    return true;
  }

  function setLastOpenedTaskId(taskId) {
    state.meta.lastOpenedTaskId = taskId || '';
    persist();
  }

  function setLastView(view) {
    state.meta.lastView = view || 'focus';
    persist();
  }

  function setSidebarCollapsed(value) {
    state.meta.sidebarCollapsed = Boolean(value);
    persist();
  }

  function getEvents(taskId) {
    return clone(state.events.filter(function (event) { return event.taskId === taskId; }));
  }

  function search(query, filters) {
    const q = cleanText(query).toLowerCase();
    const wantedState = filters && filters.state ? normalizeState(filters.state) : '';
    return getAll({ includeArchived: true }).filter(function (task) {
      if (wantedState && task.state !== wantedState) return false;
      if (!q) return true;
      return [task.title, task.intent, task.outcome, task.nextAction, task.blocker]
        .some(function (value) { return String(value || '').toLowerCase().includes(q); });
    });
  }

  function getTaskPulse(taskId) {
    const task = getById(taskId);
    if (!task) return null;
    const byState = {
      INBOX: 0, READY: 10, ACTIVE: 40, WAITING: 40, BLOCKED: 40, PAUSED: 40,
      REVIEW: 80, DONE: 90, VERIFIED: 100, CANCELLED: 100, SUPERSEDED: 100, ARCHIVED: 100
    };
    let signal = 'ON_TRACK';
    if (task.state === 'BLOCKED') signal = 'BLOCKED';
    else if (task.state === 'WAITING') signal = 'WAITING';
    else if (task.state === 'REVIEW') signal = 'READY_FOR_REVIEW';
    else if (task.state === 'ACTIVE' && !task.nextAction) signal = 'NO_NEXT_ACTION';
    else if (task.state === 'DONE') signal = 'NEEDS_VERIFICATION';
    else if (task.state === 'VERIFIED') signal = 'VERIFIED';
    return {
      signal: signal,
      progress: byState[task.state] == null ? 0 : byState[task.state],
      blocked: task.state === 'BLOCKED',
      hasNextAction: Boolean(task.nextAction),
      lastActivityAt: task.updatedAt
    };
  }

  // Tasks P2d — lightweight work sessions + Continue/Resume context.
  // Sessions deliberately record context, not billable time.
  function getSessions(taskId) {
    const id = String(taskId || '');
    return clone(state.sessions.filter(function (item) { return item.taskId === id; })
      .map(normalizeSession)
      .sort(function (a, b) { return new Date(b.startedAt) - new Date(a.startedAt); }));
  }

  function getActiveSession(taskId) {
    const id = String(taskId || '');
    const found = state.sessions.find(function (item) { return item.taskId === id && !item.endedAt; });
    return found ? clone(normalizeSession(found)) : null;
  }

  function getLastSession(taskId) {
    return getSessions(taskId).find(function (item) { return Boolean(item.endedAt); }) || null;
  }

  function startSession(taskId) {
    const task = getById(taskId);
    if (!task || task.state !== 'ACTIVE') return null;
    const existing = getActiveSession(task.id);
    if (existing) return existing;
    const timestamp = nowIso();
    const item = normalizeSession({ id: uid('session'), taskId: task.id, startedAt: timestamp });
    state.sessions.unshift(item);
    state.meta.lastActiveTaskId = task.id;
    touchTask(task.id, timestamp);
    appendEvent(task.id, 'SESSION_STARTED', { sessionId: item.id }, true);
    persist();
    return clone(item);
  }

  function finishSessionInternal(taskId, payload, timestamp, skipPersist) {
    const taskIndex = state.tasks.findIndex(function (task) { return task.id === taskId && !task.deleted; });
    if (taskIndex < 0) return null;
    const sessionIndex = state.sessions.findIndex(function (item) { return item.taskId === taskId && !item.endedAt; });
    if (sessionIndex < 0) return null;
    const source = payload && typeof payload === 'object' ? payload : {};
    const endedAt = timestamp || nowIso();
    const currentSession = normalizeSession(state.sessions[sessionIndex]);
    const next = normalizeSession(Object.assign({}, currentSession, {
      endedAt: endedAt,
      summary: cleanText(source.summary),
      stoppedAt: cleanText(source.stoppedAt),
      nextAction: cleanText(source.nextAction),
      reason: cleanText(source.reason)
    }));
    state.sessions[sessionIndex] = next;

    const currentTask = state.tasks[taskIndex];
    if (next.nextAction && currentTask.nextAction !== next.nextAction) {
      const previous = currentTask.nextAction;
      state.tasks[taskIndex] = normalizeTask(Object.assign({}, currentTask, { nextAction: next.nextAction, updatedAt: endedAt }));
      appendEvent(taskId, 'NEXT_ACTION_CHANGED', { previous: previous, next: next.nextAction, source: 'SESSION_FINISHED' }, true);
    } else {
      touchTask(taskId, endedAt);
    }
    appendEvent(taskId, 'SESSION_FINISHED', {
      sessionId: next.id,
      summary: next.summary,
      stoppedAt: next.stoppedAt,
      nextAction: next.nextAction,
      reason: next.reason
    }, true);
    if (!skipPersist) persist();
    return clone(next);
  }

  function finishSession(taskId, payload) {
    return finishSessionInternal(String(taskId || ''), payload || {}, nowIso(), false);
  }

  function getContinueContext() {
    const candidates = getAll();
    let task = null;

    const activeSession = state.sessions.find(function (item) { return !item.endedAt && getById(item.taskId); });
    if (activeSession) task = getById(activeSession.taskId);
    if (!task && state.meta.lastActiveTaskId) task = getById(state.meta.lastActiveTaskId);
    if (!task || ['DONE', 'VERIFIED', 'CANCELLED', 'SUPERSEDED', 'ARCHIVED'].includes(task.state)) {
      task = candidates.find(function (item) { return item.state === 'ACTIVE'; }) ||
        candidates.find(function (item) { return item.state === 'PAUSED'; }) ||
        candidates.find(function (item) { return item.state === 'BLOCKED'; }) ||
        candidates.find(function (item) { return item.state === 'WAITING'; }) ||
        candidates.find(function (item) { return item.state === 'READY' && item.nextAction; }) ||
        candidates.find(function (item) { return item.state === 'INBOX'; }) || null;
    }
    if (!task) return null;

    const checklist = getChecklist(task.id);
    const unfinished = checklist.filter(function (item) { return !item.done; })
      .sort(function (a, b) { return Number(Boolean(b.important)) - Number(Boolean(a.important)); })
      .slice(0, 4);
    const events = getEvents(task.id);
    return {
      task: clone(task),
      pulse: getTaskPulse(task.id),
      proof: getProofSummary(task.id),
      relations: getRelationSummary(task.id),
      activeSession: getActiveSession(task.id),
      lastSession: getLastSession(task.id),
      unfinishedChecklist: unfinished,
      blocker: task.blocker || (task.state === 'BLOCKED' ? 'BLOCKED' : ''),
      latestEvent: events[0] || null,
      events: events.slice(0, 6)
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  root.NSTaskStoreV1 = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    TASK_STATES: TASK_STATES.slice(),
    PRIORITIES: PRIORITIES.slice(),
    EVIDENCE_TYPES: EVIDENCE_TYPES.slice(),
    RELATION_TYPES: RELATION_TYPES.slice(),
    LINK_TYPES: LINK_TYPES.slice(),
    ALLOWED_TRANSITIONS: clone(ALLOWED_TRANSITIONS),
    getState: getState,
    getAll: getAll,
    getById: getById,
    create: create,
    update: update,
    getAllowedTransitions: getAllowedTransitions,
    canTransition: canTransition,
    transition: transition,
    setNextAction: setNextAction,
    getChecklist: getChecklist,
    addChecklistItem: addChecklistItem,
    toggleChecklistItem: toggleChecklistItem,
    removeChecklistItem: removeChecklistItem,
    getEvidence: getEvidence,
    addEvidence: addEvidence,
    removeEvidence: removeEvidence,
    getProofSummary: getProofSummary,
    getRelations: getRelations,
    addRelation: addRelation,
    removeRelation: removeRelation,
    getLinks: getLinks,
    addLink: addLink,
    removeLink: removeLink,
    getRelationSummary: getRelationSummary,
    removeTask: removeTask,
    setLastOpenedTaskId: setLastOpenedTaskId,
    setLastView: setLastView,
    setSidebarCollapsed: setSidebarCollapsed,
    getEvents: getEvents,
    search: search,
    getTaskPulse: getTaskPulse,
    getSessions: getSessions,
    getActiveSession: getActiveSession,
    getLastSession: getLastSession,
    startSession: startSession,
    finishSession: finishSession,
    getContinueContext: getContinueContext,
    subscribe: subscribe
  };
})(window);
