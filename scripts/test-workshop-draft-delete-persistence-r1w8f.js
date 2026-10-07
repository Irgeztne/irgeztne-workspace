const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const storeSource = fs.readFileSync(require('path').join(__dirname, '../src/ns-codehub-store.js'), 'utf8');
const bridgeSource = fs.readFileSync(require('path').join(__dirname, '../src/storage/legacy-durable-bridge-v1.js'), 'utf8');

const STORAGE_KEY = 'nsbrowser:v1:codehub-items';
const DURABLE_KEY = 'workspace.codehub.v1';

function makeItem(id, title, stamp) {
  return {
    id,
    type: 'template',
    title,
    author: { name: 'EI', id: '', source: 'local' },
    version: '0.1.0',
    license: 'MPL-2.0',
    description: { short: 'test', full: '' },
    tags: [],
    status: 'draft',
    distribution: 'free',
    trust: 'local',
    preview: { cover: '', gallery: [], note: '', surface: 'editor' },
    files: [],
    compatibility: { product: 'webstudio', minAppVersion: '1.0.0' },
    createdAt: stamp,
    updatedAt: stamp,
    archived: false
  };
}

function makeStorage(shared) {
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(shared, key) ? shared[key] : null;
    },
    setItem(key, value) {
      shared[key] = String(value);
    },
    removeItem(key) {
      delete shared[key];
    },
    clear() {
      for (const key of Object.keys(shared)) delete shared[key];
    }
  };
}

function loadStore(sharedLocal, sharedDurable) {
  const localStorage = makeStorage(sharedLocal);
  const nsAPI = {
    storageGetModuleStateSync(key, fallback) {
      return Object.prototype.hasOwnProperty.call(sharedDurable, key)
        ? JSON.parse(JSON.stringify(sharedDurable[key]))
        : fallback;
    },
    storageSetModuleStateSync(key, value) {
      sharedDurable[key] = value == null ? null : JSON.parse(JSON.stringify(value));
      return { ok: true };
    }
  };
  const window = { localStorage, nsAPI };
  const context = {
    window,
    localStorage,
    console,
    Set,
    Date,
    Math,
    JSON
  };
  vm.createContext(context);
  vm.runInContext(storeSource, context, { filename: 'ns-codehub-store.js' });
  return context.window.NSCodeHubStore;
}

const t0 = '2026-09-05T08:00:00.000Z';
const twoItems = [
  makeItem('pkg_a', 'IRGEZTNE Test Template', t0),
  makeItem('pkg_b', 'RGEZTNE Test Templateвания', t0)
];
const staleThird = makeItem('pkg_spurious', 'Пакет без названия', '2026-09-05T08:10:00.000Z');

const sharedLocal = {
  [STORAGE_KEY]: JSON.stringify({
    schemaVersion: '1.1',
    items: twoItems,
    activeItemId: 'pkg_a'
  })
};
const sharedDurable = {
  [DURABLE_KEY]: {
    schemaVersion: '1.1',
    items: [staleThird].concat(twoItems),
    activeItemId: 'pkg_spurious'
  }
};

let store = loadStore(sharedLocal, sharedDurable);
assert.strictEqual(store.getAll().length, 2, 'legacy local deletion must beat stale richer durable mirror on upgrade');
assert.strictEqual(sharedDurable[DURABLE_KEY].items.length, 2, 'upgrade must rewrite durable state from visible local state');
assert.strictEqual(sharedDurable[DURABLE_KEY].persistenceVersion, 1, 'durable state must use direct persistence version');
assert.ok(sharedDurable[DURABLE_KEY].meta.lastUpdatedAt, 'durable state must include lastUpdatedAt');

const accidental = store.createItem({ type: 'template' });
assert.strictEqual(store.getAll().length, 3, 'new draft should be created once');
assert.strictEqual(accidental.title, 'Пакет без названия', 'new draft should use the expected default title');

assert.strictEqual(store.deleteItem(accidental.id), true, 'deleteItem should remove the accidental draft');
assert.strictEqual(store.getAll().length, 2, 'deleted draft should disappear immediately');
assert.strictEqual(sharedDurable[DURABLE_KEY].items.length, 2, 'delete must update durable state too');

store = loadStore(sharedLocal, sharedDurable);
assert.strictEqual(store.getAll().length, 2, 'deleted draft must stay deleted after store reload');
assert.ok(!store.getAll().some(item => item.id === accidental.id), 'deleted draft must not resurrect');

assert.ok(!bridgeSource.includes("'nsbrowser:v1:codehub-items': 'workspace.codehub.v1'"),
  'generic durable bridge must no longer manage CodeHub state');
assert.ok(bridgeSource.includes('CodeHub/Workshop owns workspace.codehub.v1 directly'),
  'bridge should document the direct CodeHub durability boundary');

console.log('PASS: R1W8F CodeHub direct durability keeps deleted creator drafts deleted across reload and removes the stale richness-bridge path');
