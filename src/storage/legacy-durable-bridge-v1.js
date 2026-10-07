(function (root) {
  'use strict';

  // IRGEZTNE_LEGACY_DURABLE_BRIDGE_V1
  // IRGEZTNE_WORKSHOP_DRAFT_DURABILITY_R1W8F: CodeHub owns its durable state directly.
  // User-created legacy localStorage data is mirrored to Storage Core.
  // UI-only keys (theme, language, filters, layout, caches) are deliberately not tracked.
  // CodeHub/Workshop owns workspace.codehub.v1 directly; keeping it in this
  // generic richness-based bridge can resurrect a deleted draft after restart.
  const MAP = Object.freeze({
    'nsbrowser:v8:source-library': 'files.library.v1',
    'ns.browser.v8.projects.v1': 'workspace.projects.v1',
    'irgeztne.workspace.tasks.v1': 'workspace.tasks.v1',
    'ns.browser.v8.notes.v1': 'workspace.notes.v1',
    'nsbrowser:v8:knowledge-library': 'workspace.knowledge.v1',
    'nsbrowser:v1:knowledge-packs': 'workspace.knowledge-packs.v1',
    'ns.browser.v8.editor.v1': 'workspace.editor.v1',
    'ns.browser.v8.editor.v1.backup': 'workspace.editor.backup.v1',
    'irgeztne.sitePages.v0': 'workspace.site-pages.v1',
    'irgeztne.siteСтраницы.v0': 'workspace.site-pages.legacy.v1',
    'ns.browser.v8.site-profile.v1': 'workspace.site-profile.v1',
    'ns.browser.v8.vitrina.v1': 'workspace.vitrina.v1',
    'irgeztne:map:v1:pins': 'workspace.map.pins.v1',
    'irgeztne.ecosystem.rooms.v0': 'workspace.ecosystem.rooms.v1',
    'irgeztne.ecosystem.filiStore.v0': 'workspace.ecosystem.fili-store.v1',
    'irgeztne.ecosystem.filiSafe.v0': 'workspace.ecosystem.fili-safe.v1'
  });

  const api = root.nsAPI;
  if (!api || typeof api.storageGetModuleStateSync !== 'function' || typeof api.storageSetModuleStateSync !== 'function') {
    return;
  }

  const proto = root.Storage && root.Storage.prototype;
  if (!proto || proto.__irgeztneDurableBridgeV1) return;

  const nativeGet = proto.getItem;
  const nativeSet = proto.setItem;
  const nativeRemove = proto.removeItem;
  const nativeClear = proto.clear;
  let internalWrite = false;

  function isLocalStore(target) {
    try { return target === root.localStorage; } catch (_) { return false; }
  }

  function parseRaw(raw) {
    if (raw == null || raw === '') return null;
    try { return JSON.parse(raw); } catch (_) { return String(raw); }
  }

  function toRaw(value) {
    if (value == null) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  function score(value, depth) {
    depth = depth || 0;
    if (value == null) return 0;
    if (typeof value === 'string') return value.trim() ? Math.min(1000, value.length) : 0;
    if (typeof value === 'number' || typeof value === 'boolean') return 1;
    if (Array.isArray(value)) {
      return value.length * 100 + value.slice(0, 50).reduce(function (sum, item) {
        return sum + (depth < 2 ? score(item, depth + 1) : 1);
      }, 0);
    }
    if (typeof value === 'object') {
      const preferred = ['items','tasks','notes','drafts','pages','sites','packs','sources','pins','relations','links','evidence','checklist','sessions'];
      let total = 0;
      preferred.forEach(function (key) {
        if (Array.isArray(value[key])) total += value[key].length * 1000;
      });
      Object.keys(value).slice(0, 80).forEach(function (key) {
        if (preferred.indexOf(key) >= 0 || key === 'meta' || key === 'filters' || key === 'persistenceVersion') return;
        const child = value[key];
        if (child == null || child === '' || child === false) return;
        total += depth < 2 ? Math.min(100, score(child, depth + 1)) : 1;
      });
      return total;
    }
    return 0;
  }

  function writeDurable(localKey, raw) {
    const moduleId = MAP[localKey];
    if (!moduleId) return false;
    const value = parseRaw(raw);
    try {
      const result = api.storageSetModuleStateSync(moduleId, value);
      return Boolean(result && result.ok === true);
    } catch (error) {
      console.error('[IRGEZTNE Durable Bridge] save failed', localKey, error);
      return false;
    }
  }

  function hydrateKey(localKey) {
    const moduleId = MAP[localKey];
    if (!moduleId) return;
    let durable = null;
    let localRaw = null;
    try { durable = api.storageGetModuleStateSync(moduleId, null); } catch (_) {}
    try { localRaw = nativeGet.call(root.localStorage, localKey); } catch (_) {}
    const localValue = parseRaw(localRaw);
    const localScore = score(localValue);
    const durableScore = score(durable);

    // Never let a newly-created empty durable record erase richer legacy data.
    if (localScore > durableScore) {
      writeDurable(localKey, localRaw);
      return;
    }

    if (durable != null && (durableScore > 0 || localRaw == null)) {
      const raw = toRaw(durable);
      if (raw != null && raw !== localRaw) {
        internalWrite = true;
        try { nativeSet.call(root.localStorage, localKey, raw); }
        catch (error) { console.warn('[IRGEZTNE Durable Bridge] local cache restore failed', localKey, error); }
        finally { internalWrite = false; }
      }
    } else if (localRaw != null && durable == null) {
      writeDurable(localKey, localRaw);
    }
  }

  Object.keys(MAP).forEach(hydrateKey);

  proto.setItem = function (key, value) {
    const name = String(key);
    if (!internalWrite && isLocalStore(this) && MAP[name]) {
      // Durable first: localStorage quota failure must not lose user content.
      writeDurable(name, String(value));
    }
    return nativeSet.call(this, key, value);
  };

  proto.removeItem = function (key) {
    const name = String(key);
    if (!internalWrite && isLocalStore(this) && MAP[name]) {
      try { api.storageSetModuleStateSync(MAP[name], null); } catch (_) {}
    }
    return nativeRemove.call(this, key);
  };

  proto.clear = function () {
    const local = isLocalStore(this);
    const result = nativeClear.call(this);
    // A generic renderer clear is UI/cache reset, not permission to destroy
    // canonical user content. Restore tracked content from Storage Core.
    if (local && !internalWrite) {
      Object.keys(MAP).forEach(hydrateKey);
    }
    return result;
  };

  Object.defineProperty(proto, '__irgeztneDurableBridgeV1', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });

  root.__IRGEZTNE_DURABLE_BRIDGE_V1 = Object.freeze({
    trackedKeys: Object.keys(MAP),
    hydrate: function () { Object.keys(MAP).forEach(hydrateKey); }
  });
})(window);
