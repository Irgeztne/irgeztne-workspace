#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const modulePath = path.join(root, 'src/modules/documents/office-diagram-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const indexPath = path.join(root, 'index.html');

assert(fs.existsSync(modulePath), 'Diagram module is missing.');
const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), sandbox, { filename: modelPath });
const source = fs.readFileSync(modulePath, 'utf8');
vm.runInNewContext(source, sandbox, { filename: modulePath });
const api = sandbox.NSOfficeDiagramV1;
const model = sandbox.NSOfficeWorkingObjectV1;
assert(api, 'NSOfficeDiagramV1 was not exposed.');
assert(!source.includes('localStorage'), 'Diagram must not create an independent store.');

const payload = api.createPayload();
const rectangle = api.addElement(payload, 'rectangle', { x: 80, y: 90, width: 260, height: 140, text: 'Process' });
const ellipse = api.addElement(payload, 'ellipse', { x: 520, y: 120, width: 220, height: 140 });
const text = api.addElement(payload, 'text', { x: 160, y: 360, text: 'Diagram note' });
const line = api.addElement(payload, 'line', { x: 340, y: 160, x2: 520, y2: 180 });
const arrow = api.addElement(payload, 'arrow', { x: 340, y: 210, x2: 520, y2: 240 });
assert.strictEqual(payload.elements.length, 5);
assert.strictEqual(payload.selectedId, arrow.id);

api.updateElement(payload, rectangle.id, { x: 110, y: 115, width: 300, height: 170 });
assert.strictEqual(rectangle.x, 110);
assert.strictEqual(rectangle.width, 300);
api.moveLayer(payload, rectangle.id, 'front');
assert.strictEqual(payload.elements[payload.elements.length - 1].id, rectangle.id);
api.moveLayer(payload, rectangle.id, 'back');
assert.strictEqual(payload.elements[0].id, rectangle.id);
api.setZoom(payload, 1.5);
assert.strictEqual(payload.zoom, 1.5);
api.removeElement(payload, text.id);
assert.strictEqual(payload.elements.length, 4);

const svg = api.buildSvg(payload, { title: 'Flow' });
assert(svg.includes('<rect'));
assert(svg.includes('<ellipse'));
assert(svg.includes('<line'));
assert(svg.includes('marker-end="url(#arrowhead)"'));
assert(svg.includes('Process'));
assert(source.includes('canvas.toBlob'), 'PNG export route is missing.');

const object = model.create('diagram', {
  id: 'diagram-1', title: 'Flow', payload,
  relations: { projectId: 'project-1', taskIds: ['task-1'] }
});
const reopened = model.normalize(JSON.parse(JSON.stringify(model.serialize(object))));
assert.strictEqual(reopened.type, 'diagram');
assert.strictEqual(reopened.payload.elements.length, 4);
assert.strictEqual(reopened.payload.zoom, 1.5);
assert.strictEqual(reopened.relations.projectId, 'project-1');

const ru = api.render(reopened, 'ru');
const en = api.render(reopened, 'en');
assert(ru.includes('data-diagram-title') && ru.includes('Прямоугольник') && ru.includes('Экспорт PNG'));
assert(en.includes('data-diagram-title') && en.includes('Ellipse') && en.includes('Export SVG'));

const documentsSource = fs.readFileSync(documentsPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
assert(documentsSource.includes('NSOfficeDiagramV1'), 'Existing Office owner does not host Diagram.');
assert(indexSource.indexOf('office-diagram-v1.js') < indexSource.indexOf('documents-v0.js'));

console.log('PASS: Diagram shapes/lines/arrows, move/resize model, layers, zoom, SVG/PNG routes and common-model round trip verified.');
