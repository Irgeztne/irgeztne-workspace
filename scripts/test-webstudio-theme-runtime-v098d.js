#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'),
  'utf8'
);
function need(text, message) {
  if (!source.includes(text)) throw new Error(message);
}
function forbid(text, message) {
  if (source.includes(text)) throw new Error(message);
}
need('IRGEZTNE_OFFICIAL_FOUR_THEME_RUNTIME_V098D', 'missing v098d marker');
need('var officialFourRuntimeV098D =', 'missing body runtime variable');
need('data-irgeztne-official-four-runtime-v098d=', 'missing runtime marker attribute');
need("html = html.replace(/<\\/body>/i, officialFourRuntimeV098D + '</body>');", 'runtime is not inserted before closing body');
need("site\\.js", 'site.js source matcher is missing');
need("      ''\n    );", 'external site.js tag is not removed');
forbid("'<script>' + String(record.js || '')", 'old head-time inline runtime remains');
console.log('PASS: Official Four V098D theme runtime executes after generated body');
