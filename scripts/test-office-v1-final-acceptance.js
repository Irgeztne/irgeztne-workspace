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

const sandbox = { window:null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window = sandbox;
moduleFiles.forEach((file) => vm.runInNewContext(read(file), sandbox, { filename:file }));

const model = sandbox.NSOfficeWorkingObjectV1;
const sheet = sandbox.NSOfficeSpreadsheetV1;
const presentation = sandbox.NSOfficePresentationV1;
const diagram = sandbox.NSOfficeDiagramV1;
const formula = sandbox.NSOfficeFormulaV1;
const form = sandbox.NSOfficeFormV1;
const templates = sandbox.NSOfficeTemplatesV1;
const cyrillic = /[А-Яа-яЁё]/;

function strings(value, output) {
  output = output || [];
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => strings(entry, output));
  else if (value && typeof value === 'object') Object.keys(value).forEach((key) => strings(value[key], output));
  return output;
}

function createObject(type, seed, id) {
  const payload = type === 'document'
    ? {
        locale:seed.locale,
        documentType:seed.documentType,
        status:seed.status,
        body:seed.body,
        richBody:seed.richBody,
        tags:seed.tags
      }
    : seed.payload;
  return model.create(type, { id, title:seed.title, payload });
}

function mutateSeed(type, seed) {
  if (type === 'document') seed.body += '\nchanged';
  else if (type === 'spreadsheet') seed.payload.sheets[0].cells.A1.raw += ' changed';
  else if (type === 'presentation') seed.payload.slides[0].blocks[0].text += ' changed';
  else if (type === 'diagram') seed.payload.elements.find((entry) => entry.text).text += ' changed';
  else if (type === 'formula') seed.payload.source += ' + 1';
  else if (type === 'form') seed.payload.fields[0].label += ' changed';
}

const expectedCounts = { document:5, spreadsheet:4, presentation:4, diagram:4, formula:4, form:4 };
assert.strictEqual(templates.count, 25, 'Office template registry must remain frozen at 25.');
assert.deepStrictEqual(
  Object.fromEntries(Object.keys(expectedCounts).map((type) => [type, templates.getAll(type, 'en').length])),
  expectedCounts
);

// Complete template registry audit: all English metadata and generated content are Cyrillic-free.
Object.keys(expectedCounts).forEach((type) => {
  const ru = templates.getAll(type, 'ru');
  const en = templates.getAll(type, 'en');
  assert.deepStrictEqual(Array.from(ru, (entry) => entry.id), Array.from(en, (entry) => entry.id));
  en.forEach((entry) => {
    const seed = templates.createSeed(entry.id, 'en');
    strings({ entry, seed }).forEach((text) => assert(!cyrillic.test(text), `${entry.id} leaks Cyrillic into EN: ${text}`));
    assert(strings({ entry:ru.find((candidate) => candidate.id === entry.id), seed:templates.createSeed(entry.id, 'ru') }).some((text) => cyrillic.test(text)), `${entry.id} has no RU content`);
  });
});

// Live acceptance examples reported by the user.
const processEn = templates.createSeed('diagram-process', 'en');
assert.deepStrictEqual(
  Array.from(processEn.payload.elements.filter((entry) => entry.text), (entry) => entry.text),
  ['Input', 'Prepare', 'Deliver', 'Review', 'Outcome']
);
assert.strictEqual(templates.createSeed('formula-math', 'en').title, 'Quadratic formula');
assert.deepStrictEqual(
  Array.from(templates.createSeed('form-application', 'en').payload.fields, (field) => field.label),
  ['Name', 'Email', 'Topic', 'Description', 'Priority']
);

// UI locale chooses a new template's content locale, then serialization/reopen preserves it.
const representative = {
  document:'document-report',
  spreadsheet:'sheet-plan',
  presentation:'presentation-project',
  diagram:'diagram-process',
  formula:'formula-math',
  form:'form-application'
};
Object.entries(representative).forEach(([type, id]) => {
  ['ru', 'en'].forEach((locale) => {
    const seed = templates.createSeed(id, locale);
    const object = createObject(type, seed, `${locale}-${type}`);
    const stored = model.serialize(object);
    const reopened = model.normalize(JSON.parse(JSON.stringify(stored)));
    assert.strictEqual(reopened.type, type);
    assert.strictEqual(reopened.title, seed.title);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(reopened.payload)), JSON.parse(JSON.stringify(stored.payload)));
    const beforeLocaleSwitch = JSON.stringify(model.serialize(reopened));
    templates.createSeed(id, locale === 'ru' ? 'en' : 'ru');
    assert.strictEqual(JSON.stringify(model.serialize(reopened)), beforeLocaleSwitch, `${id} was rewritten by a locale switch`);
  });
});

// Every use of every template produces independent mutable state.
Object.keys(expectedCounts).forEach((type) => {
  templates.getAll(type, 'en').forEach((entry) => {
    const first = templates.createSeed(entry.id, 'en');
    const second = templates.createSeed(entry.id, 'en');
    const secondBefore = JSON.stringify(second);
    mutateSeed(type, first);
    assert.strictEqual(JSON.stringify(second), secondBefore, `${entry.id} shares state between instances`);
  });
});

// Object-content locale owns future generated labels; the current UI locale cannot mix an existing object.
const ruSheet = templates.createSeed('sheet-plan', 'ru').payload;
sheet.addSheet(ruSheet, '', 'en');
assert(/^Лист /.test(ruSheet.sheets.find((entry) => entry.id === ruSheet.activeSheetId).name));
assert.strictEqual(ruSheet.locale, 'ru');
const enSheet = templates.createSeed('sheet-plan', 'en').payload;
sheet.addSheet(enSheet, '', 'ru');
assert(/^Sheet /.test(enSheet.sheets.find((entry) => entry.id === enSheet.activeSheetId).name));

const ruPresentation = templates.createSeed('presentation-project', 'ru').payload;
const ruSlide = presentation.addSlide(ruPresentation, 'content', 'en');
assert(/^Слайд /.test(ruSlide.title));
assert(ruSlide.blocks.some((block) => cyrillic.test(block.text)));
assert(/копия$/.test(presentation.duplicateSlide(ruPresentation, ruSlide.id).title));
const enPresentation = templates.createSeed('presentation-project', 'en').payload;
const enSlide = presentation.addSlide(enPresentation, 'content', 'ru');
assert(/^Slide /.test(enSlide.title));
assert(!enSlide.blocks.some((block) => cyrillic.test(block.text)));
assert(/copy$/.test(presentation.duplicateSlide(enPresentation, enSlide.id).title));

assert.strictEqual(templates.createSeed('diagram-process', 'ru').payload.locale, 'ru');
assert.strictEqual(templates.createSeed('diagram-process', 'en').payload.locale, 'en');
assert.strictEqual(templates.createSeed('form-application', 'ru').payload.locale, 'ru');
assert.strictEqual(templates.createSeed('form-application', 'en').payload.locale, 'en');

// Formula render hardening: friendly syntax and TeX-like templates create real MathML structures.
const quadratic = formula.renderExpression('x_{1,2} = (-b +- sqrt(b^2 - 4 a c))/(2 a)');
assert.strictEqual(quadratic.ok, true);
['<msqrt>', '<mfrac>', '<msub>', '<msup>', '<mo>±</mo>'].forEach((token) => assert(quadratic.mathml.includes(token), `Quadratic MathML misses ${token}`));
const statistics = formula.renderExpression(templates.createSeed('formula-statistics', 'en').payload.source);
assert.strictEqual(statistics.ok, true);
assert(statistics.mathml.includes('<mfrac>') && statistics.mathml.includes('<msubsup>') && statistics.mathml.includes('<msub>'));
['ru', 'en'].forEach((locale) => {
  ['formula-math', 'formula-physics', 'formula-statistics', 'formula-economics'].forEach((id) => {
    const seed = templates.createSeed(id, locale);
    const result = formula.renderExpression(seed.payload.source);
    assert.strictEqual(result.ok, true, `${id}/${locale} failed to render`);
    assert(result.mathml.includes('<math'));
    assert(formula.buildSvg({ title:seed.title, payload:seed.payload }, locale).includes(seed.title));
  });
});

const formulaHtml = formula.render(createObject('formula', templates.createSeed('formula-math', 'en'), 'formula-toolbar'), 'en');
['render', 'copy', 'export-mathml', 'export-svg'].forEach((action) => assert(formulaHtml.includes(`data-formula-action="${action}"`)));
const formulaCss = read('src/modules/documents/office-formula-v1.css');
assert(formulaCss.includes('.ns-office-formula__toolbar { display:flex;'));
assert(formulaCss.includes('width:100%; gap:6px;'));
assert(formulaCss.includes('.ns-office-formula__object-title { flex:1 1 260px;'));
assert(formulaCss.includes('.ns-office-formula__toolbar button { flex:0 0 auto; min-height:32px; padding:0 9px; white-space:nowrap; }'));

// All four diagrams retain localized labels and orthogonal, behind-the-node routing.
['diagram-process', 'diagram-flow', 'diagram-hierarchy', 'diagram-relations'].forEach((id) => {
  ['ru', 'en'].forEach((locale) => {
    const seed = templates.createSeed(id, locale);
    const edges = seed.payload.elements.filter((entry) => entry.type === 'line' || entry.type === 'arrow');
    const nodes = seed.payload.elements.filter((entry) => entry.type !== 'line' && entry.type !== 'arrow');
    assert.strictEqual(nodes.length, 5);
    assert(edges.length >= 4);
    edges.forEach((edge) => assert(edge.x === edge.x2 || edge.y === edge.y2, `${id}/${edge.id} is diagonal`));
    assert(seed.payload.elements.indexOf(edges[edges.length - 1]) < seed.payload.elements.indexOf(nodes[0]), `${id} connectors cover nodes`);
    const svg = diagram.buildSvg(seed.payload);
    nodes.forEach((node) => assert(svg.includes(node.text), `${id}/${locale} SVG loses ${node.text}`));
    strings(nodes.map((node) => node.text)).forEach((text) => {
      if (locale === 'en') assert(!cyrillic.test(text), `${id} EN label leak: ${text}`);
    });
  });
});
const diagramSource = read('src/modules/documents/office-diagram-v1.js');
assert(diagramSource.includes('canvas.toBlob'), 'Diagram PNG export no longer produces a canvas blob.');

// Representative RU/EN UI render smoke; rendering another locale must not mutate stored content.
const renderers = {
  spreadsheet:(object, locale) => sheet.render(object, locale),
  presentation:(object, locale) => presentation.render(object, locale, []),
  diagram:(object, locale) => diagram.render(object, locale),
  formula:(object, locale) => formula.render(object, locale),
  form:(object, locale) => form.render(object, locale)
};
Object.entries(renderers).forEach(([type, render]) => {
  const id = representative[type];
  const enObject = createObject(type, templates.createSeed(id, 'en'), `render-${type}`);
  const before = JSON.stringify(model.serialize(enObject));
  const enHtml = render(enObject, 'en');
  assert(!cyrillic.test(enHtml), `${type} EN UI contains Cyrillic`);
  render(enObject, 'ru');
  assert.strictEqual(JSON.stringify(model.serialize(enObject)), before, `${type} render mutated content`);
});

// Light/Dark styles are shared by Full and floating DOM instances for all six editors.
[
  'src/modules/documents/documents-v0.css',
  'src/modules/documents/office-spreadsheet-v1.css',
  'src/modules/documents/office-presentation-v1.css',
  'src/modules/documents/office-diagram-v1.css',
  'src/modules/documents/office-formula-v1.css',
  'src/modules/documents/office-form-v1.css'
].forEach((file) => {
  const css = read(file);
  assert(css.includes('data-theme="light"'), `${file} has no Light theme contract`);
  assert(!/transform\s*:\s*(translate|scale)/.test(css.match(/button:hover[^}]*}/g)?.join('\n') || ''), `${file} hover moves controls`);
});

// Forms contract: response -> localized rows/CSV -> an independent response spreadsheet payload.
const formSeed = templates.createSeed('form-application', 'en');
const responsePayload = formSeed.payload;
responsePayload.status = 'open';
const answers = {};
responsePayload.fields.forEach((field, index) => { answers[field.id] = index === 1 ? 'person@example.com' : `Answer ${index + 1}`; });
form.addResponse(responsePayload, answers);
const responseRows = form.responseRows(responsePayload, responsePayload.locale);
assert.strictEqual(responseRows.length, 2);
assert.deepStrictEqual(Array.from(responseRows[0].slice(0, 3)), ['Submitted at', 'Name', 'Email']);
const formCsv = form.toCsv(responsePayload, responsePayload.locale);
assert(formCsv.includes('Submitted at,Name,Email,Topic,Description,Priority'));
const responseSheet = sheet.createPayload({ locale:responsePayload.locale, rows:20, columns:responseRows[0].length, sheetName:'Responses' });
responseRows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => sheet.setCell(responseSheet, responseSheet.activeSheetId, String.fromCharCode(65 + columnIndex) + (rowIndex + 1), value)));
assert.strictEqual(responseSheet.locale, 'en');
assert(sheet.toCsv(responseSheet).includes('Submitted at,Name,Email'));
assert.strictEqual(responsePayload.responseSheetId, '', 'Response spreadsheet creation mutated the template form.');

// Save state, locale rerender, six-section navigation, collapse, and persistence contracts stay wired.
const documentsSource = read('src/modules/documents/documents-v0.js');
const shellSource = read('src/modules/office-shell/office-shell-v1.js');
const shellCss = read('src/modules/office-shell/office-shell-v1.css');
['dirty', 'saving', 'saved'].forEach((state) => {
  assert(documentsSource.includes(state), `Documents misses ${state} state`);
  assert(shellSource.includes(state), `Office shell misses ${state} state`);
});
assert(documentsSource.includes("document.addEventListener('irg:language-changed', renderAll)"));
assert(shellSource.includes("document.addEventListener('irg:language-changed', render)"));
['document', 'spreadsheet', 'presentation', 'diagram', 'formula', 'form'].forEach((type) => assert(shellSource.includes(`id: '${type}'`)));
assert(shellSource.includes('data-office-shell-toggle'));
assert(shellCss.includes('.ns-office-shell-v103.is-collapsed'));
assert(documentsSource.includes('preserveLegacy: !dirtyIds.has(item.id)'));
assert(documentsSource.includes('createResponseSheet(formPayload, formObject)'));

console.log('PASS: Office v1 FINAL acceptance — 25-template RU/EN content, six editors, locale ownership, persistence, independent seeds, Formula MathML/toolbar, Diagram routing/exports, Forms response chain, themes and navigation contracts verified.');
