#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const modulePath = path.join(root, 'src/modules/documents/office-formula-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const indexPath = path.join(root, 'index.html');

assert(fs.existsSync(modulePath), 'Formula module is missing.');
const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), sandbox, { filename: modelPath });
const source = fs.readFileSync(modulePath, 'utf8');
vm.runInNewContext(source, sandbox, { filename: modulePath });
const api = sandbox.NSOfficeFormulaV1;
const model = sandbox.NSOfficeWorkingObjectV1;
assert(api, 'NSOfficeFormulaV1 was not exposed.');
assert(!source.includes('localStorage'), 'Formula must not create an independent store.');

const valid = api.renderExpression('\\frac{a_1 + \\alpha}{\\sqrt{b^2}}');
assert.strictEqual(valid.ok, true);
assert(valid.mathml.includes('<mfrac>'));
assert(valid.mathml.includes('<msqrt>'));
assert(valid.mathml.includes('α'));
assert(valid.mathml.includes('<msub>'));
assert(valid.mathml.includes('<msup>'));

const friendly = api.renderExpression('x = (-b +- sqrt(b^2 - 4 a c))/(2 a)');
assert.strictEqual(friendly.ok, true);
assert(friendly.mathml.includes('<msqrt>'), 'Friendly sqrt(...) syntax did not become a MathML root.');
assert(friendly.mathml.includes('<mo>±</mo>'), 'Friendly +- syntax did not become ±.');
assert(friendly.mathml.includes('<mfrac>'), 'Friendly slash syntax did not become a MathML fraction.');
assert(!friendly.mathml.includes('<mi>sqrt</mi>'), 'Literal sqrt leaked into the professional preview.');

const scripts = api.renderExpression('A_i^2');
assert.strictEqual(scripts.ok, true);
assert(scripts.mathml.includes('<msubsup>'), 'Combined index and exponent did not use msubsup.');

const invalid = api.renderExpression('\\frac{a}{b');
assert.strictEqual(invalid.ok, false);
assert(invalid.error.length > 5, 'Formula parse error is not readable.');
const unsupported = api.renderExpression('\\unknown{x}');
assert.strictEqual(unsupported.ok, false);

const payload = api.createPayload({ source: 'E = mc^2' });
assert.strictEqual(payload.error, '');
assert(payload.renderedMathML.includes('<math'));
const brokenPayload = api.updateSource(payload, '\\sqrt{');
assert(brokenPayload.error, 'Invalid source did not produce a stored error state.');
api.updateSource(brokenPayload, '\\sum_{i=1}^{n} i');
assert.strictEqual(brokenPayload.error, '');

const object = model.create('formula', {
  id: 'formula-1', title: 'Series', payload: brokenPayload,
  relations: { projectId: 'project-1', taskIds: ['task-1'] }
});
const reopened = model.normalize(JSON.parse(JSON.stringify(model.serialize(object))));
assert.strictEqual(reopened.type, 'formula');
assert.strictEqual(reopened.payload.source, '\\sum_{i=1}^{n} i');
assert.strictEqual(reopened.error, undefined);
assert.strictEqual(reopened.relations.taskIds[0], 'task-1');

const svg = api.buildSvg(reopened, 'en');
assert(svg.includes('<svg'));
assert(svg.includes('∑'));
const ru = api.render(reopened, 'ru');
const en = api.render(reopened, 'en');
assert(ru.includes('data-formula-title') && ru.includes('Исходный код') && ru.includes('Экспорт SVG'));
assert(en.includes('data-formula-title') && en.includes('Render') && en.includes('Copy MathML'));

const documentsSource = fs.readFileSync(documentsPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
assert(documentsSource.includes('NSOfficeFormulaV1'), 'Existing Office owner does not host Formula.');
assert(indexSource.indexOf('office-formula-v1.js') < indexSource.indexOf('documents-v0.js'));

console.log('PASS: Formula parsing/render errors, MathML/SVG output, save shape, RU/EN and common-model round trip verified.');
