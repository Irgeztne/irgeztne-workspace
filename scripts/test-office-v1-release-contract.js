#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const moduleFiles = [
  'src/modules/documents/office-working-object-v1.js',
  'src/modules/documents/office-spreadsheet-v1.js',
  'src/modules/documents/office-presentation-v1.js',
  'src/modules/documents/office-diagram-v1.js',
  'src/modules/documents/office-formula-v1.js',
  'src/modules/documents/office-form-v1.js',
  'src/modules/documents/office-templates-v1.js'
];

const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
moduleFiles.forEach((file) => vm.runInNewContext(read(file), sandbox, { filename: file }));

const model = sandbox.NSOfficeWorkingObjectV1;
const templates = sandbox.NSOfficeTemplatesV1;
assert.deepStrictEqual(Array.from(model.TYPES), ['document', 'spreadsheet', 'presentation', 'diagram', 'formula', 'form']);
assert.strictEqual(templates.count, 25);

const expectedCounts = { document: 5, spreadsheet: 4, presentation: 4, diagram: 4, formula: 4, form: 4 };
Object.entries(expectedCounts).forEach(([type, expected]) => {
  const entries = templates.getAll(type, 'ru');
  assert.strictEqual(entries.length, expected, `${type} template count changed`);
  assert.strictEqual(new Set(entries.map((entry) => entry.id)).size, expected, `${type} template IDs are not unique`);
  entries.forEach((entry) => {
    const seed = templates.createSeed(entry.id, 'ru');
    const object = model.create(type, Object.assign({ id: 'release-' + entry.id }, seed), { now: '2026-08-20T00:00:00.000Z' });
    const reopened = model.normalize(model.serialize(object));
    assert.strictEqual(reopened.type, type, `${entry.id} did not survive common-store reopen`);
    assert(reopened.title, `${entry.id} has no title`);
    assert(reopened.payload && typeof reopened.payload === 'object', `${entry.id} has no payload`);
  });
});

const index = read('index.html');
const documents = read('src/modules/documents/documents-v0.js');
const shell = read('src/modules/office-shell/office-shell-v1.js');
const relations = read('src/ns-relations-store.js');
assert(index.indexOf('office-form-v1.js') < index.indexOf('documents-v0.js'), 'Forms must load before the Office owner.');
assert(index.indexOf('office-templates-v1.js') < index.indexOf('documents-v0.js'), 'Templates must load before the Office owner.');
assert(index.includes('office-form-v1.css'), 'Forms stylesheet is not wired.');
assert(shell.includes("{ id: 'form', icon: '≡' }"), 'Forms navigation entry is missing.');
assert(shell.includes("form: 'Формы'") && shell.includes("form: 'Forms'"), 'Forms navigation is not bilingual.');
assert(documents.includes('createResponseSheet(formPayload, formObject)'), 'Form → response spreadsheet bridge is missing.');
assert(documents.includes('createFromTemplate'), 'Unified template creation contract is missing.');
assert(relations.includes("'form'"), 'The relation reader does not recognize Forms as an Office object.');
assert(shell.includes("dirty:") && shell.includes("saving:") && shell.includes("saved:"), 'Saved / Modified / Saving states are incomplete.');

console.log('PASS: Office v1 six-type model, 25 templates, Forms wiring, relations and save-state contract verified.');
