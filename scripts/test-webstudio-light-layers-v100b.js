#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const workshopCss = fs.readFileSync(path.join(root, 'src/v88-codehub-v1.css'), 'utf8');
const studioCss = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css'), 'utf8');

const workshopMarker = 'IRGEZTNE_WEBSTUDIO_WORKSHOP_LIGHT_LAYERS_V100B';
const studioMarker = 'IRGEZTNE_WEBSTUDIO_LIGHT_LAYERS_V100B';
assert(workshopCss.includes(workshopMarker), 'Workshop light layering pass is missing.');
assert(studioCss.includes(studioMarker), 'Web Studio light layering pass is missing.');

const workshopLight = workshopCss.slice(workshopCss.indexOf(workshopMarker));
const studioLight = studioCss.slice(studioCss.indexOf(studioMarker));

[
  '--codehub-host-canvas: #e7eef7',
  '--codehub-host-surface: #fcfdff',
  '--codehub-host-control: #e1edfb',
  '--codehub-host-muted: #465d78',
  '.ns-codehub-v1__summary.panel-card',
  '.ns-codehub-v1__type-card strong',
  ':hover', ':active', ':disabled', ':focus-visible'
].forEach((contract) => assert(workshopLight.includes(contract), 'Workshop light contract missing: ' + contract));

[
  'background: #e5edf6 !important',
  'background: #fcfdff !important',
  '#eaf3ff 0%, #dceafa 100%',
  'color: #465d78 !important',
  'border-color: rgba(67, 104, 151, .42) !important',
  ':hover', ':disabled', ':focus-visible'
].forEach((contract) => assert(studioLight.includes(contract), 'Web Studio light contract missing: ' + contract));

assert(!studioLight.includes('ir-site-studio-v5-theme-dark'), 'Light pass leaked into the dark theme selector.');
assert(workshopCss.includes('--codehub-host-input: #09162a'), 'Existing dark Workshop input token was removed.');
assert(workshopCss.includes('--codehub-host-text: #eaf2ff'), 'Existing dark Workshop text token was removed.');

console.log('PASS: Web Studio/Workshop light layers and UI states are scoped without dark-theme changes.');
