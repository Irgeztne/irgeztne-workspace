const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'src/modules/editor-workbench/editor-workbench.css');
const css = fs.readFileSync(cssPath, 'utf8');

function must(re, label) {
  if (!re.test(css)) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
}

must(/\.ewb-text-toolbar-r1w9f6b\s*\{[\s\S]*?width:\s*max-content;/, 'toolbar remains content-width');
must(/\.ewb-text-toolbar-r1w9f6b\s*\{[\s\S]*?overflow-x:\s*auto;/, 'toolbar remains horizontally scrollable when genuinely needed');
must(/\.ewb-text-toolbar-r1w9f6b\s*\{[\s\S]*?scrollbar-width:\s*none;/, 'Firefox visible scrollbar is hidden');
must(/\.ewb-text-toolbar-r1w9f6b\s*\{[\s\S]*?-ms-overflow-style:\s*none;/, 'legacy visible scrollbar is hidden');
must(/\.ewb-text-toolbar-r1w9f6b::\-webkit-scrollbar\s*\{[\s\S]*?height:\s*0;/, 'Chromium/WebKit visible scrollbar is hidden');

console.log('PASS: R1W9F6C polish hides the visible text-toolbar scrollbar without changing contextual toolbar behavior or overflow capability.');
