#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const files = [
  'src/modules/documents/office-working-object-v1.js',
  'src/modules/documents/office-spreadsheet-v1.js',
  'src/modules/documents/office-presentation-v1.js',
  'src/modules/documents/office-diagram-v1.js',
  'src/modules/documents/office-formula-v1.js',
  'src/modules/documents/office-form-v1.js',
  'src/modules/documents/office-templates-v1.js'
];
const sandbox = { window:null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
files.forEach((file) => vm.runInNewContext(read(file), sandbox, { filename:file }));

const formula = sandbox.NSOfficeFormulaV1;
const templates = sandbox.NSOfficeTemplatesV1;
const model = sandbox.NSOfficeWorkingObjectV1;

const friendly = formula.renderExpression('x = (-b +- sqrt(b^2 - 4 a c))/(2 a)');
assert.strictEqual(friendly.ok, true);
assert(friendly.mathml.includes('<msqrt>') && friendly.mathml.includes('<mfrac>') && friendly.mathml.includes('<mo>±</mo>'));
assert(!friendly.mathml.includes('<mi>sqrt</mi>') && !friendly.mathml.includes('<mo>+</mo><mo>-</mo>'));
assert(formula.renderExpression('A_i^2').mathml.includes('<msubsup>'));

['formula-math','formula-physics','formula-statistics','formula-economics'].forEach((id) => {
  const seed = templates.createSeed(id, 'en');
  const rendered = formula.renderExpression(seed.payload.source);
  assert.strictEqual(rendered.ok, true, `${id} does not parse`);
  assert(rendered.mathml.includes('<math'), `${id} has no MathML`);
});
assert(formula.renderExpression(templates.createSeed('formula-math','en').payload.source).mathml.includes('<msqrt>'));
assert(formula.renderExpression(templates.createSeed('formula-statistics','en').payload.source).mathml.includes('<mfrac>'));
assert(formula.renderExpression(templates.createSeed('formula-physics','en').payload.source).mathml.includes('<msup>'));

['diagram-process','diagram-flow','diagram-hierarchy','diagram-relations'].forEach((id) => {
  const seed = templates.createSeed(id, 'en');
  const edges = seed.payload.elements.filter((element) => element.type === 'line' || element.type === 'arrow');
  const nodes = seed.payload.elements.filter((element) => element.type !== 'line' && element.type !== 'arrow');
  assert(edges.length >= 4, `${id} has too few connectors`);
  assert.strictEqual(nodes.length, 5, `${id} must keep five working nodes`);
  edges.forEach((edge) => assert(edge.x === edge.x2 || edge.y === edge.y2, `${id}/${edge.id} is a diagonal connector`));
  const firstNodeIndex = seed.payload.elements.findIndex((element) => element.type !== 'line' && element.type !== 'arrow');
  assert(seed.payload.elements.slice(0, firstNodeIndex).every((element) => element.type === 'line' || element.type === 'arrow'), `${id} connectors must render below nodes`);
  seed.payload.elements.forEach((element) => {
    ['x','y'].forEach((key) => assert(element[key] >= 0, `${id}/${element.id} is outside the canvas`));
    if (element.type === 'line' || element.type === 'arrow') {
      assert(element.x2 <= 1200 && element.y2 <= 720, `${id}/${element.id} ends outside the canvas`);
    } else {
      assert(element.x + element.width <= 1200 && element.y + element.height <= 720, `${id}/${element.id} exceeds the canvas`);
    }
  });
});

const expectedCounts = { document:5, spreadsheet:4, presentation:4, diagram:4, formula:4, form:4 };
Object.entries(expectedCounts).forEach(([type, count]) => {
  const ru = templates.getAll(type, 'ru');
  const en = templates.getAll(type, 'en');
  assert.strictEqual(ru.length, count, `${type} RU template count changed`);
  assert.strictEqual(en.length, count, `${type} EN template count changed`);
  assert.deepStrictEqual(Array.from(ru, (item) => item.id), Array.from(en, (item) => item.id), `${type} RU/EN template IDs diverged`);
  ru.forEach((item, index) => {
    assert(item.title && item.description && en[index].title && en[index].description, `${item.id} has an empty locale value`);
    const ruObject = model.create(type, Object.assign({ id:`ru-${item.id}` }, templates.createSeed(item.id, 'ru')));
    const enObject = model.create(type, Object.assign({ id:`en-${item.id}` }, templates.createSeed(item.id, 'en')));
    assert(ruObject.title && enObject.title, `${item.id} localized seed has no title`);
    assert.strictEqual(model.normalize(model.serialize(ruObject)).type, type, `${item.id} RU seed failed reopen`);
    assert.strictEqual(model.normalize(model.serialize(enObject)).type, type, `${item.id} EN seed failed reopen`);
  });
});

const shell = read('src/modules/office-shell/office-shell-v1.js');
const ruLabels = ['Документы','Таблицы','Презентации','Диаграммы','Формулы','Формы'];
const enLabels = ['Documents','Spreadsheets','Presentations','Diagrams','Formulas','Forms'];
ruLabels.concat(enLabels).forEach((label) => assert(shell.includes(label), `Office shell locale is missing ${label}`));
assert(shell.includes("document.documentElement.lang === 'en'"), 'Office shell does not inherit the Workspace locale.');
assert(shell.includes("document.addEventListener('irg:language-changed', render)"), 'Office shell does not rerender on locale changes.');

console.log('PASS: final Office v1 formula rendering, orthogonal Diagram templates, six-surface RU/EN registry, template reopen and locale rerender contract verified.');
