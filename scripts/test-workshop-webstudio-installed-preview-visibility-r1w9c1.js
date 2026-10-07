#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const studio = fs.readFileSync(studioPath, 'utf8');

function has(text, needle, message) {
  if (!text.includes(needle)) throw new Error(message);
}

has(studio, 'IRGEZTNE_WORKSHOP_INSTALLED_TEMPLATE_PREVIEW_INTERACTION_R1W9C', 'R1W9C installed-template preview interaction is missing');
has(studio, 'data-v5-action="workshop-installed-template-preview-r1w9c"', 'Installed-template explicit preview action is missing');
has(studio, "action === 'workshop-installed-template-preview-r1w9c'", 'Installed-template preview click route is missing');

has(studio, 'IRGEZTNE_WORKSHOP_INSTALLED_TEMPLATE_PREVIEW_VISIBILITY_R1W9C1', 'R1W9C1 visibility guard marker is missing');
has(studio, 'const isCurrentWorkshopInstalledPreviewControl = (el) => {', 'R1W9C1 current-preview guard is missing');
has(studio, '[data-v5-action="workshop-installed-template-preview-r1w9c"]', 'R1W9C1 does not protect the current installed-template preview action');
has(studio, 'if (isCurrentWorkshopInstalledPreviewControl(el)) return false;', 'Legacy preview hider does not exempt current Workshop controls');

const legacyStart = studio.indexOf('IRGEZTNE_TEMPLATE_PREVIEW_HIDE_OLD_BUTTON_V070D');
const legacyEnd = studio.indexOf('IRGEZTNE_V070E_HIDE_OLD_TEMPLATE_PREVIEW_HINT', legacyStart);
if (legacyStart < 0 || legacyEnd < 0) throw new Error('Legacy V070D/V070E boundaries are missing');
const legacy = studio.slice(legacyStart, legacyEnd);
const guardIndex = legacy.indexOf('if (isCurrentWorkshopInstalledPreviewControl(el)) return false;');
const broadMatchIndex = legacy.indexOf("all.includes('template-preview')");
const hideIndex = legacy.indexOf("el.style.setProperty('display', 'none', 'important')");
if (guardIndex < 0 || broadMatchIndex < 0 || hideIndex < 0) throw new Error('Legacy hider structure is incomplete');
if (!(guardIndex < broadMatchIndex && guardIndex < hideIndex)) {
  throw new Error('Current Workshop preview controls are not exempted before the broad legacy hide rule');
}

console.log('PASS: R1W9C1 keeps the current Workshop installed-template preview controls visible while preserving the legacy V070D cleanup');
