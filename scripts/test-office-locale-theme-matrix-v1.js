#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname,'..');
const moduleNames = ['office-spreadsheet-v1','office-presentation-v1','office-diagram-v1','office-formula-v1','office-form-v1'];
const sandbox = { window:null, console, Date, Math, JSON, Object, Array, Set, String, Number };
sandbox.window=sandbox;
moduleNames.forEach((name) => vm.runInNewContext(fs.readFileSync(path.join(root,'src/modules/documents',name+'.js'),'utf8'),sandbox,{ filename:name }));

const cssFiles = ['documents-v0'].concat(moduleNames).map((name) => fs.readFileSync(path.join(root,'src/modules/documents',name+'.css'),'utf8'));
cssFiles.forEach((css,index) => {
  assert(css.includes('data-theme="light"'), (index ? moduleNames[index-1] : 'documents-v0') + ' has no inherited Light theme layer.');
  assert(!css.includes('@media (prefers-color-scheme'), 'Office must inherit the application theme, not create a separate theme switch.');
});

const presentationRu = sandbox.NSOfficePresentationV1.createPayload({ title:'Новая презентация', locale:'ru' });
const presentationEn = sandbox.NSOfficePresentationV1.createPayload({ title:'Untitled presentation', locale:'en' });
assert(presentationRu.slides[0].blocks.some((block) => block.text === 'Подзаголовок'));
assert(!presentationRu.slides[0].blocks.some((block) => block.text === 'Subtitle'));
assert(presentationEn.slides[0].blocks.some((block) => block.text === 'Subtitle'));

const objects = {
  spreadsheet:{ id:'s',title:'Budget',payload:sandbox.NSOfficeSpreadsheetV1.createPayload({ sheetName:'Sheet 1' }) },
  presentation:{ id:'p',title:'Deck',payload:presentationEn,relations:{ fileIds:[] } },
  diagram:{ id:'d',title:'Flow',payload:sandbox.NSOfficeDiagramV1.createPayload() },
  formula:{ id:'f',title:'Series',payload:sandbox.NSOfficeFormulaV1.createPayload({ source:'x^2' }) },
  form:{ id:'m',title:'Survey',payload:sandbox.NSOfficeFormV1.createPayload({ fields:[] }) }
};
const renders = [
  [sandbox.NSOfficeSpreadsheetV1,objects.spreadsheet,'Новый лист','New sheet'],
  [sandbox.NSOfficePresentationV1,objects.presentation,'Новый слайд','New slide'],
  [sandbox.NSOfficeDiagramV1,objects.diagram,'Прямоугольник','Rectangle'],
  [sandbox.NSOfficeFormulaV1,objects.formula,'Исходный код','Source'],
  [sandbox.NSOfficeFormV1,objects.form,'Поля','Fields']
];
['light','dark'].forEach(() => renders.forEach(([api,object,ruWord,enWord]) => {
  assert(api.render(object,'ru',[]).includes(ruWord));
  assert(api.render(object,'en',[]).includes(enWord));
}));

console.log('PASS: Office RU/EN × Light/Dark inherited-theme matrix and localized starter content verified.');
