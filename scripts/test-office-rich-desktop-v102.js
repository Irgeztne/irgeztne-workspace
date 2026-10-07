const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/modules/documents/documents-v0.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/modules/documents/documents-v0.css'), 'utf8');

assert(source.includes('data-documents-rich-editor'), 'Visual document editor is missing.');
assert(source.includes('contenteditable="true"'), 'Normal Office editing is not visual.');
assert(source.includes('data-documents-rich-style'), 'Style control is missing.');
assert(source.includes("t('Стиль', 'Style')"), 'Style label is not localized.');
assert(source.includes("saving: t('Сохранение…', 'Saving…')"), 'Autosave state machine is incomplete.');
assert(css.includes('flex: 0 0 112px') && css.includes('width: 112px'), 'Full Office save state has no reserved width.');
assert(source.includes('data-documents-native-workspace'), 'Full Office desktop layout marker is missing.');

console.log('PASS: Full Office is a visual Document editor with a stable desktop layout and autosave state.');
