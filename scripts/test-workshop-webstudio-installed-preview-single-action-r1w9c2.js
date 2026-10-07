#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const cssPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css');
const studio = fs.readFileSync(studioPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }

has(studio, 'IRGEZTNE_WORKSHOP_INSTALLED_TEMPLATE_PREVIEW_SINGLE_ACTION_R1W9C2', 'Missing R1W9C2 JS marker');
has(css, 'IRGEZTNE_WORKSHOP_INSTALLED_TEMPLATE_PREVIEW_SINGLE_ACTION_R1W9C2', 'Missing R1W9C2 CSS marker');

const cardStart = studio.indexOf('function workshopInstalledTemplateCardR1W9A(item)');
const cardEnd = studio.indexOf('function renderWorkshopInstalledTemplatesR1W9A()', cardStart);
must(cardStart >= 0 && cardEnd > cardStart, 'Installed-template card function not found');
const card = studio.slice(cardStart, cardEnd);

// The image remains a full pointer/keyboard hit target, but it must not render a second visible label.
has(card, 'class="ir-site-studio-v5-workshop-preview-hit-r1w9c"', 'Preview image hit target missing');
has(card, 'aria-label="', 'Preview image hit target lost its accessible name');
lacks(card, 'ir-site-studio-v5-workshop-preview-hit-r1w9c" data-v5-action="workshop-installed-template-preview-r1w9c" data-v5-workshop-package-id="\' + escapeHtml(packageId) + \'" data-v5-template-title="\' + escapeHtml(title) + \'" type="button" aria-label="\' + escapeHtml(t(\'Open preview\', \'Открыть превью\') + \': \' + title) + \'"><span>', 'Preview image still renders a duplicate visible Open Preview label');

const actionNeedle = 'ir-site-studio-v5-btn ir-site-studio-v5-btn--primary ir-site-studio-v5-template-lab-link-v083h" data-v5-action="workshop-installed-template-preview-r1w9c"';
has(card, actionNeedle, 'The one visible action-row Open Preview button is missing');

// The overlay itself is visually neutral; the only visible labelled action is in the normal actions row.
const overlayCssStart = css.indexOf('.ir-site-studio-v5-workshop-preview-hit-r1w9c {');
const overlayCssEnd = css.indexOf('}', overlayCssStart);
must(overlayCssStart >= 0 && overlayCssEnd > overlayCssStart, 'Preview hit-target CSS block not found');
const overlayCss = css.slice(overlayCssStart, overlayCssEnd + 1);
has(overlayCss, 'background: transparent;', 'Preview hit target is not visually neutral');
lacks(css, '.ir-site-studio-v5-workshop-preview-hit-r1w9c > span', 'Obsolete duplicate-label CSS remains');

// Preserve the actual routed preview action and sandbox gate.
has(studio, "action === 'workshop-installed-template-preview-r1w9c'", 'Preview click routing regressed');
has(studio, 'void openWorkshopInstalledTemplatePreviewR1W9A(', 'Preview no longer routes through the public adapter owner');
has(studio, 'sandbox="allow-scripts"', 'Installed-template preview sandbox regressed');

console.log('PASS: R1W9C2 keeps the preview image clickable/keyboard-accessible while showing only one visible Open Preview action on the installed-template card');
