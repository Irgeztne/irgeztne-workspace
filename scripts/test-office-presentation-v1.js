#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const modulePath = path.join(root, 'src/modules/documents/office-presentation-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const indexPath = path.join(root, 'index.html');

assert(fs.existsSync(modulePath), 'Presentation module is missing.');
const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), sandbox, { filename: modelPath });
const source = fs.readFileSync(modulePath, 'utf8');
vm.runInNewContext(source, sandbox, { filename: modulePath });
const api = sandbox.NSOfficePresentationV1;
const model = sandbox.NSOfficeWorkingObjectV1;
assert(api, 'NSOfficePresentationV1 was not exposed.');
assert(!source.includes('localStorage'), 'Presentation must not create an independent store.');

const payload = api.createPayload({ title: 'Launch deck' });
assert.strictEqual(payload.slides.length, 1);
const firstId = payload.activeSlideId;
api.addTextBlock(payload, firstId, { text: 'Launch plan', x: 8, y: 10, width: 52, height: 20 });
api.addImageBlock(payload, firstId, { fileId: 'file-1', name: 'Cover', src: 'data:image/png;base64,AA==' });
assert.strictEqual(payload.slides[0].blocks.length, 4);

api.addSlide(payload, 'content');
const secondId = payload.activeSlideId;
api.addSlide(payload, 'two-column');
const thirdId = payload.activeSlideId;
assert.strictEqual(payload.slides.length, 3);
api.moveSlide(payload, thirdId, -1);
assert.strictEqual(payload.slides[1].id, thirdId);
api.duplicateSlide(payload, secondId);
assert.strictEqual(payload.slides.length, 4);
api.removeSlide(payload, payload.activeSlideId);
assert.strictEqual(payload.slides.length, 3);

const textBlock = payload.slides[0].blocks.find((block) => block.type === 'text');
api.updateBlock(payload, firstId, textBlock.id, { x: 18, y: 14, width: 64, height: 28, text: 'Updated launch plan' });
assert.strictEqual(textBlock.x, 18);
assert.strictEqual(textBlock.width, 64);
assert.strictEqual(textBlock.text, 'Updated launch plan');

const object = model.create('presentation', {
  id: 'presentation-1', title: 'Launch deck', payload,
  relations: { projectId: 'project-1', taskIds: ['task-1'], fileIds: ['file-1'] }
});
const reopened = model.normalize(JSON.parse(JSON.stringify(model.serialize(object))));
assert.strictEqual(reopened.type, 'presentation');
assert.strictEqual(reopened.payload.slides.length, 3);
assert.strictEqual(reopened.payload.slides[0].blocks[0].text, 'Updated launch plan');
assert.strictEqual(reopened.relations.fileIds[0], 'file-1');

const ru = api.render(reopened, 'ru', [{ id: 'file-1', name: 'Cover', storage: { dataUrl: 'data:image/png;base64,AA==' } }]);
const en = api.render(reopened, 'en', []);
assert(ru.includes('data-presentation-title') && ru.includes('Новый слайд') && ru.includes('Предпросмотр'));
assert(en.includes('data-presentation-title') && en.includes('New slide') && en.includes('Export HTML'));
const exported = api.buildHtml(reopened, 'en');
assert(exported.includes('<!doctype html>'));
assert(exported.includes('Updated launch plan'));
assert(exported.includes('data:image/png;base64,AA=='));

const documentsSource = fs.readFileSync(documentsPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
assert(documentsSource.includes('NSOfficePresentationV1'), 'Existing Office owner does not host Presentation.');
assert(indexSource.indexOf('office-presentation-v1.js') < indexSource.indexOf('documents-v0.js'));

console.log('PASS: Presentation slide CRUD/reorder, text/image blocks, move/resize model, preview/export and common-model round trip verified.');
