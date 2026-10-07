const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const storeSource = fs.readFileSync(path.join(root, 'src/ns-project-store.js'), 'utf8');
const projectsSource = fs.readFileSync(path.join(root, 'src/modules/projects/projects-v0.js'), 'utf8');
const storage = new Map();
const context = {
  window: {},
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  },
  crypto: { randomUUID: () => 'project-v102' },
  Date,
  console,
  setTimeout,
  clearTimeout
};
context.window = context;
vm.runInNewContext(storeSource, context, { filename: 'ns-project-store.js' });
const store = context.NSProjectStore;
assert(store, 'Canonical NSProjectStore is missing.');
let notifications = 0;
store.subscribe(() => { notifications += 1; });
const created = store.create({ title: 'Shared project', type: 'article' });
assert.strictEqual(store.getById(created.id).title, 'Shared project');
store.update(created.id, { title: 'Saved project' });
assert.strictEqual(store.getById(created.id).title, 'Saved project');
store.archive(created.id);
assert.strictEqual(store.getById(created.id).archived, true);
store.unarchive(created.id);
assert.strictEqual(store.getById(created.id).archived, false);
const removed = store.remove(created.id);
assert(removed && removed.id === created.id);
assert.strictEqual(store.getById(created.id), null);
assert(notifications >= 5, 'CRUD mutations do not notify all mounted surfaces.');
assert(projectsSource.includes("document.querySelectorAll('[data-projects-root]')"), 'Full and Compact are not rendered from the same owner.');
assert(projectsSource.includes('root.confirm'), 'Delete confirmation is missing.');
const emptyBlock = projectsSource.slice(projectsSource.indexOf('if (!projects.length)'), projectsSource.indexOf('return projects.map'));
assert(!emptyBlock.includes('data-projects-new'), 'Empty state still duplicates the New Project action.');

console.log('PASS: Full and Compact Projects share one CRUD store, update subscribers, and have one empty-state CTA hierarchy.');
