#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const spreadsheetPath = path.join(root, 'src/modules/documents/office-spreadsheet-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const indexPath = path.join(root, 'index.html');

assert(fs.existsSync(spreadsheetPath), 'Spreadsheet module is missing.');
const modelSource = fs.readFileSync(modelPath, 'utf8');
const spreadsheetSource = fs.readFileSync(spreadsheetPath, 'utf8');
const documentsSource = fs.readFileSync(documentsPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
vm.runInNewContext(modelSource, sandbox, { filename: modelPath });
vm.runInNewContext(spreadsheetSource, sandbox, { filename: spreadsheetPath });

const sheetApi = sandbox.NSOfficeSpreadsheetV1;
const officeModel = sandbox.NSOfficeWorkingObjectV1;
assert(sheetApi, 'NSOfficeSpreadsheetV1 was not exposed.');
assert(!spreadsheetSource.includes('localStorage'), 'Spreadsheet must not create an independent store.');

const payload = sheetApi.createPayload({ rows: 4, columns: 3, sheetName: 'Budget' });
const sheetId = payload.activeSheetId;
sheetApi.setCell(payload, sheetId, 'A1', '10');
sheetApi.setCell(payload, sheetId, 'A2', '20');
sheetApi.setCell(payload, sheetId, 'A3', '=SUM(A1:A2)');
sheetApi.setCell(payload, sheetId, 'B1', '=AVERAGE(A1:A2)');
sheetApi.setCell(payload, sheetId, 'B2', '=A1*2+5');
sheetApi.setCell(payload, sheetId, 'C1', '=MAX(A1:A3)');

assert.strictEqual(sheetApi.getCellComputed(payload, sheetId, 'A3'), 30);
assert.strictEqual(sheetApi.getCellComputed(payload, sheetId, 'B1'), 15);
assert.strictEqual(sheetApi.getCellComputed(payload, sheetId, 'B2'), 25);
assert.strictEqual(sheetApi.getCellComputed(payload, sheetId, 'C1'), 30);

sheetApi.setColumn(payload, sheetId, 0, { name: 'Amount', type: 'currency' });
assert.strictEqual(payload.sheets[0].columns[0].name, 'Amount');
assert.strictEqual(payload.sheets[0].columns[0].type, 'currency');
assert(sheetApi.getCellDisplay(payload, sheetId, 'A1').includes('10'), 'Typed cell formatting is missing.');

const rowCount = payload.sheets[0].rowCount;
const columnCount = payload.sheets[0].columns.length;
sheetApi.addRow(payload, sheetId);
sheetApi.addColumn(payload, sheetId);
assert.strictEqual(payload.sheets[0].rowCount, rowCount + 1);
assert.strictEqual(payload.sheets[0].columns.length, columnCount + 1);
sheetApi.removeRow(payload, sheetId);
sheetApi.removeColumn(payload, sheetId);
assert.strictEqual(payload.sheets[0].rowCount, rowCount);
assert.strictEqual(payload.sheets[0].columns.length, columnCount);

payload.sheets[0].filter = { column: 'A', query: '20' };
assert.deepStrictEqual(Array.from(sheetApi.getVisibleRows(payload, sheetId)), [2]);
payload.sheets[0].filter = { column: '', query: '' };
payload.sheets[0].sort = { column: 'A', direction: 'desc' };
assert.deepStrictEqual(Array.from(sheetApi.getVisibleRows(payload, sheetId)).slice(0, 3), [3, 2, 1]);

const imported = sheetApi.fromCsv('Name,Value\n"Alpha, one",12\nBeta,7');
assert.strictEqual(sheetApi.getCellRaw(imported, imported.activeSheetId, 'A2'), 'Alpha, one');
assert.strictEqual(sheetApi.getCellRaw(imported, imported.activeSheetId, 'B3'), '7');
const exported = sheetApi.toCsv(imported, imported.activeSheetId);
assert(exported.includes('"Alpha, one"'), 'CSV quoting regressed.');

const object = officeModel.create('spreadsheet', {
  id: 'spreadsheet-1', title: 'Budget', payload: payload,
  relations: { projectId: 'project-1', taskIds: ['task-1'] }
});
const reopened = officeModel.normalize(JSON.parse(JSON.stringify(officeModel.serialize(object))));
assert.strictEqual(reopened.type, 'spreadsheet');
assert.strictEqual(sheetApi.getCellComputed(reopened.payload, sheetId, 'A3'), 30);
assert.strictEqual(reopened.relations.projectId, 'project-1');
assert.strictEqual(reopened.relations.taskIds[0], 'task-1');

const ruHtml = sheetApi.render(reopened, 'ru');
const enHtml = sheetApi.render(reopened, 'en');
assert(ruHtml.includes('data-sheet-title') && ruHtml.includes('Добавить строку'), 'RU Spreadsheet UI is incomplete.');
assert(enHtml.includes('data-sheet-title') && enHtml.includes('Add row'), 'EN Spreadsheet UI is incomplete.');
assert(documentsSource.includes('NSOfficeSpreadsheetV1'), 'Existing Office owner does not host Spreadsheet.');
assert(indexSource.indexOf('office-working-object-v1.js') < indexSource.indexOf('office-spreadsheet-v1.js'));
assert(indexSource.indexOf('office-spreadsheet-v1.js') < indexSource.indexOf('documents-v0.js'));

console.log('PASS: Spreadsheet formulas, typed columns, rows/columns, sort/filter, CSV and common-model round trip verified.');
