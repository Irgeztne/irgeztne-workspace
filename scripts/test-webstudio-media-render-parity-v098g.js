#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const studioPath = path.join(
  root,
  'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'
);
const workbenchPath = path.join(
  root,
  'src/modules/editor-workbench/editor-workbench.js'
);

function fail(message) {
  console.error('FAIL:', message);
  process.exit(1);
}

for (const file of [studioPath, workbenchPath]) {
  if (!fs.existsSync(file)) fail(`missing ${file}`);
}

const studio = fs.readFileSync(studioPath, 'utf8');
const workbench = fs.readFileSync(workbenchPath, 'utf8');

if (!studio.includes('IRGEZTNE_MEDIA_RENDER_PARITY_V098G')) {
  fail('V098G marker is missing');
}

if (!/landingCssV072A\(accent\)[\s\S]{0,900}siteGeneratedEditorContentCssV076C\(\)/.test(studio)) {
  fail('Landing does not include generated editor-media CSS');
}

if (!/String\(record\.css \|\| ''\) \+ '\\n' \+ siteGeneratedEditorContentCssV076C\(\)/.test(studio)) {
  fail('Official Four canonical CSS does not include editor-media CSS');
}

const requiredCssContracts = [
  'main figure.ewb-image,main figure.ewb-video,main figure.ewb-video-card',
  'main figure.is-size-small',
  'main figure.is-size-medium',
  'main figure.is-size-large',
  'main figure.is-size-full',
  'main figure.is-align-left',
  'main figure.is-align-center',
  'main figure.is-align-right',
  'main figure.ewb-video video',
  'main .ewb-video-frame iframe'
];

for (const contract of requiredCssContracts) {
  if (!studio.includes(contract)) fail(`missing generated CSS contract: ${contract}`);
}

const workbenchContracts = [
  'data-media-command="move-up"',
  'data-media-command="move-down"',
  "'figure.ewb-image, figure.ewb-video, figure.ewb-video-card'",
  "'is-size-small'",
  "'is-size-medium'",
  "'is-size-large'",
  "'is-size-full'",
  "'is-align-left'",
  "'is-align-center'",
  "'is-align-right'"
];

for (const contract of workbenchContracts) {
  if (!workbench.includes(contract)) fail(`missing Workbench contract: ${contract}`);
}

console.log('PASS: Web Studio V098G media placement/render parity verified');
