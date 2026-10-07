#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/modules/documents/office-form-v1.js'), 'utf8');
const sandbox = { window: null, console, Date, Math, JSON, Object, Array, String, Number };
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'office-form-v1.js' });

const form = sandbox.NSOfficeFormV1;
assert(form, 'Forms editor API is missing.');
assert.deepStrictEqual(Array.from(form.FIELD_TYPES), ['short', 'long', 'email', 'number', 'select', 'radio', 'checkbox', 'date']);

const payload = form.createPayload({
  description: 'Release form',
  status: 'open',
  fields: [
    { id: 'name', type: 'short', label: 'Name', required: true },
    { id: 'email', type: 'email', label: 'Email', required: true },
    { id: 'consent', type: 'checkbox', label: 'Consent' }
  ]
});
assert.strictEqual(payload.fields.length, 3);
assert.strictEqual(payload.status, 'open');

const priority = form.addField(payload, 'select', { id: 'priority', label: 'Priority', options: ['Normal', 'High'] });
assert.strictEqual(priority.type, 'select');
form.updateField(payload, priority.id, { help: 'Choose one', required: true });
assert.strictEqual(priority.help, 'Choose one');
assert(form.moveField(payload, priority.id, -1));

form.addResponse(payload, { name: 'Ada', email: 'ada@example.test', consent: true, priority: 'High' });
form.addResponse(payload, { name: 'Lin', email: 'lin@example.test', consent: false, priority: 'Normal' });
assert.strictEqual(payload.responses.length, 2);

const enRows = form.responseRows(payload, 'en');
const ruRows = form.responseRows(payload, 'ru');
assert.strictEqual(enRows[0][0], 'Submitted at');
assert.strictEqual(ruRows[0][0], 'Отправлено');
assert(enRows.some((row) => row.includes('Yes')));
assert(ruRows.some((row) => row.includes('Да')));
assert(form.toCsv(payload, 'en').includes('ada@example.test'));

const ruMarkup = form.render({ id: 'form-1', title: 'Заявка', payload }, 'ru');
const enMarkup = form.render({ id: 'form-1', title: 'Application', payload }, 'en');
assert(ruMarkup.includes('data-office-form'));
assert(ruMarkup.includes('Создать таблицу ответов'));
assert(enMarkup.includes('Create response spreadsheet'));
assert(enMarkup.includes('Export CSV'));

assert(form.removeField(payload, priority.id));
assert.strictEqual(payload.fields.length, 3);

console.log('PASS: Forms fields, responses, RU/EN output, CSV and response-sheet action verified.');
