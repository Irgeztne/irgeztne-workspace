#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const filesSource = fs.readFileSync(path.join(root, 'src/modules/files/files-v0.js'), 'utf8');
const filesCss = fs.readFileSync(path.join(root, 'src/modules/files/files-v0.css'), 'utf8');

assert(filesSource.includes('data-library-dropzone\n          role="button"'), 'Dropzone is not exposed as an interactive control.');
assert(filesSource.includes('tabindex="0"'), 'Dropzone is not keyboard reachable.');
assert(filesSource.includes('function openFilePicker()'), 'Dropzone file-picker bridge is missing.');
assert(filesSource.includes('uploadInput.click();'), 'Dropzone does not activate the existing upload input.');
assert(filesSource.includes("dropzone.addEventListener('click'"), 'Pointer activation is missing.');
assert(filesSource.includes("dropzone.addEventListener('keydown'"), 'Keyboard activation is missing.');
assert(filesSource.includes("event.key !== 'Enter' && event.key !== ' '"), 'Enter/Space keyboard contract regressed.');
assert(filesSource.includes("dropzone.addEventListener('drop', async function"), 'Existing drag/drop import path regressed.');
assert(filesSource.includes('await window.NSLibraryStore.importFiles(files);'), 'Drop import no longer uses the Files store owner.');
assert(filesCss.includes('.ns-library-dropzone:focus-visible'), 'Visible keyboard focus styling is missing.');

console.log('PASS: Files dropzone opens the existing picker and preserves drag/drop import.');
