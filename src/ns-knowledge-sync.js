(function () {
  function hasDeps() {
    return Boolean(window.NSKnowledgeStore && window.NSPackStore);
  }

  function addSourceToPack(sourceId, packId) {
    if (!hasDeps()) return false;
    if (!sourceId || !packId) return false;

    const source = window.NSKnowledgeStore.getSourceById(sourceId);
    const pack = window.NSPackStore.getById(packId);

    if (!source || !pack) return false;

    window.NSPackStore.addSourceToPack(packId, sourceId);
    window.NSKnowledgeStore.addPackToSource(sourceId, packId);

    return true;
  }

  function removeSourceFromPack(sourceId, packId) {
    if (!hasDeps()) return false;
    if (!sourceId || !packId) return false;

    const source = window.NSKnowledgeStore.getSourceById(sourceId);
    const pack = window.NSPackStore.getById(packId);

    if (!source || !pack) return false;

    window.NSPackStore.removeSourceFromPack(packId, sourceId);
    window.NSKnowledgeStore.removePackFromSource(sourceId, packId);

    return true;
  }

  function getPacksForSource(sourceId) {
    if (!hasDeps()) return [];
    if (!sourceId) return [];

    return window.NSPackStore.getPacksBySourceId(sourceId) || [];
  }

  function getSourcesForPack(packId) {
    if (!hasDeps()) return [];
    if (!packId) return [];

    return window.NSKnowledgeStore.getSourcesByPackId(packId) || [];
  }

  function createPack(payload) {
    if (!hasDeps()) return null;
    return window.NSPackStore.createPack(payload || {});
  }

  function ensureDefaultPack() {
    if (!hasDeps()) return null;
    return window.NSPackStore.ensureDefaultPack();
  }

  function attachSourceToDefaultPack(sourceId) {
    ensureDefaultPack();
    return addSourceToPack(sourceId, 'pack_default');
  }

  const api = {
    addSourceToPack,
    removeSourceFromPack,
    getPacksForSource,
    getSourcesForPack,
    createPack,
    ensureDefaultPack,
    attachSourceToDefaultPack
  };

  window.NSKnowledgeSync = api;
})();
