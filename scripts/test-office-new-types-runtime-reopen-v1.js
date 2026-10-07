#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const files = [
  'src/modules/documents/office-working-object-v1.js',
  'src/modules/documents/office-spreadsheet-v1.js',
  'src/modules/documents/office-presentation-v1.js',
  'src/modules/documents/office-diagram-v1.js',
  'src/modules/documents/office-formula-v1.js',
  'src/modules/documents/documents-v0.js'
].map((file) => path.join(root, file));
const sources = files.map((file) => fs.readFileSync(file, 'utf8'));
const storage = {};

function runtime() {
  const roots = [
    { innerHTML:'', dataset:{}, getAttribute(name) { return name === 'data-documents-surface' ? 'workspace' : ''; }, querySelector() { return null; } },
    { innerHTML:'', dataset:{}, getAttribute(name) { return name === 'data-documents-surface' ? 'cabinet' : ''; }, querySelector() { return null; } }
  ];
  class CustomEvent { constructor(type, options) { this.type=type; this.detail=options && options.detail; } }
  const document = {
    readyState:'loading', documentElement:{ lang:'en' }, body:{ appendChild() {} },
    addEventListener() {}, dispatchEvent() { return true; }, querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
    createElement() { return { style:{}, setAttribute() {}, click() {}, remove() {} }; }
  };
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage,key) ? storage[key] : null; },
    setItem(key,value) { storage[key]=String(value); }
  };
  const sandbox = {
    window:null, document, localStorage, CustomEvent, console, Date, Math, JSON, Object, Array, Set, String, Number,
    navigator:{}, Blob:function Blob() {}, URL:{ createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() { return 1; }, clearTimeout() {}, confirm() { return true; }, prompt(message,value) { return value; }
  };
  sandbox.window=sandbox;
  sandbox.addEventListener=function () {};
  sandbox.confirm=function () { return true; };
  sandbox.prompt=function (message,value) { return value; };
  sources.forEach((source,index) => vm.runInNewContext(source,sandbox,{ filename:files[index] }));
  return { sandbox, roots };
}

const first = runtime();
const presentation = first.sandbox.NSOfficeV1.createPresentation({ title:'Runtime deck' });
const presentationPayload = first.sandbox.NSOfficePresentationV1.normalizePayload(presentation.payload);
first.sandbox.NSOfficePresentationV1.addSlide(presentationPayload,'two-column');
first.sandbox.NSOfficePresentationV1.addTextBlock(presentationPayload,presentationPayload.activeSlideId,{ text:'Persisted block' });
first.sandbox.NSOfficeV1.updateObject(presentation.id,{ payload:presentationPayload, relations:{ projectId:'project-deck', fileIds:['image-1'] } });

const diagram = first.sandbox.NSOfficeV1.createDiagram({ title:'Runtime diagram' });
const diagramPayload = first.sandbox.NSOfficeDiagramV1.normalizePayload(diagram.payload);
first.sandbox.NSOfficeDiagramV1.addElement(diagramPayload,'rectangle',{ text:'Persisted node' });
first.sandbox.NSOfficeDiagramV1.addElement(diagramPayload,'arrow',{});
first.sandbox.NSOfficeV1.updateObject(diagram.id,{ payload:diagramPayload, relations:{ taskIds:['task-diagram'] } });

const formula = first.sandbox.NSOfficeV1.createFormula({ title:'Runtime formula', payload:{ source:'\\sum_{i=1}^{n} i' } });
first.sandbox.NSOfficeV1.updateObject(formula.id,{ relations:{ projectId:'project-formula' } });

const persisted = JSON.parse(storage['irgeztne.documents.v1']);
assert.strictEqual(persisted.items.filter((item) => ['presentation','diagram','formula'].includes(item.type)).length,3);

// Discard the first JS runtime; the second instance must reconstruct only from the shared Office storage.
const reopened = runtime();
const reopenedPresentation = reopened.sandbox.NSOfficeV1.getObjectById(presentation.id);
const reopenedDiagram = reopened.sandbox.NSOfficeV1.getObjectById(diagram.id);
const reopenedFormula = reopened.sandbox.NSOfficeV1.getObjectById(formula.id);
assert.strictEqual(reopenedPresentation.payload.slides.length,2);
assert(reopenedPresentation.payload.slides.some((slide) => slide.blocks.some((block) => block.text === 'Persisted block')));
assert.strictEqual(reopenedPresentation.relations.fileIds[0],'image-1');
assert.strictEqual(reopenedDiagram.payload.elements.length,2);
assert.strictEqual(reopenedDiagram.payload.elements[0].text,'Persisted node');
assert.strictEqual(reopenedDiagram.relations.taskIds[0],'task-diagram');
assert.strictEqual(reopenedFormula.payload.source,'\\sum_{i=1}^{n} i');
assert(reopenedFormula.payload.renderedMathML.includes('<math'));
assert.strictEqual(reopenedFormula.relations.projectId,'project-formula');

[
  [presentation.id,'Presentation'],
  [diagram.id,'Diagram'],
  [formula.id,'Formula']
].forEach(([id,label]) => {
  assert(reopened.sandbox.NSOfficeV1.openObjectById(id));
  reopened.sandbox.NSOfficeV1.renderAll();
  assert(reopened.roots[1].innerHTML.includes(label), label + ' editor did not render after runtime reopen.');
});

console.log('PASS: Presentation, Diagram and Formula save → close → reopen through the shared Office owner.');
