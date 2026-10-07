#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root,'src/modules/documents/office-working-object-v1.js');
const documentsPath = path.join(root,'src/modules/documents/documents-v0.js');
const source = fs.readFileSync(documentsPath,'utf8');
const roots = [{ innerHTML:'', getAttribute(name) { return name === 'data-documents-surface' ? 'cabinet' : ''; }, querySelector() { return null; } }];
const document = {
  readyState:'loading', documentElement:{ lang:'en' }, body:{ appendChild() {} }, addEventListener() {}, dispatchEvent() {},
  querySelector() { return null; }, querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
  createElement() { return { click() {}, remove() {} }; }
};
const sandbox = {
  window:null, document, localStorage:{ getItem() { return null; }, setItem() {} }, CustomEvent:function () {},
  console, Date, Math, JSON, Object, Array, Set, String, Number, navigator:{}, Blob:function () {},
  URL:{ createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }, setTimeout() {}, clearTimeout() {}
};
sandbox.window=sandbox; sandbox.addEventListener=function () {}; sandbox.confirm=function () { return true; }; sandbox.prompt=function (m,v) { return v; };
vm.runInNewContext(fs.readFileSync(modelPath,'utf8'),sandbox,{ filename:modelPath });
vm.runInNewContext(source,sandbox,{ filename:documentsPath });

const docs = sandbox.NSDocumentsV1;
assert.strictEqual(typeof docs.formatSelection,'function','Document formatting helper is missing.');
assert.strictEqual(docs.formatSelection('Title',0,5,'heading').text,'## Title');
assert.strictEqual(docs.formatSelection('bold',0,4,'bold').text,'**bold**');
assert.strictEqual(docs.formatSelection('italic',0,6,'italic').text,'*italic*');
assert.strictEqual(docs.formatSelection('underline',0,9,'underline').text,'<u>underline</u>');
assert.strictEqual(docs.formatSelection('one\ntwo',0,7,'list').text,'- one\n- two');
assert(docs.formatSelection('site',0,4,'link').text.includes('[site](https://)'));
assert(source.includes('data-documents-format="undo"') && source.includes('data-documents-format="redo"'));
assert(source.includes("data-documents-save-state=\"saved\"") || source.includes("data-documents-save-state=\\\"saved\\\""));
assert(source.includes("setDocumentSaveState('dirty')") && source.includes("setDocumentSaveState('saved')"));

const created = sandbox.NSOfficeV1.createSpreadsheet({ title:'No document exports' });
sandbox.NSOfficeV1.openObjectById(created.id);
sandbox.NSOfficeV1.renderAll();
assert(!roots[0].innerHTML.includes('data-documents-action="export-md"'),'Document export leaked into Spreadsheet editor.');
assert(!roots[0].innerHTML.includes('data-documents-action="export-html"'),'Document export leaked into Spreadsheet editor.');

console.log('PASS: Document formatting, visible saved/dirty state and type-scoped export controls verified.');
