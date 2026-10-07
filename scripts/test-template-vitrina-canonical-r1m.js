#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const vitrina = fs.readFileSync(path.join(root, 'src/preview4-official-templates-v1.js'), 'utf8');
const studio = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
function has(text, needle, message) { if (!text.includes(needle)) throw new Error(message); }
has(vitrina, 'IRGEZTNE_TEMPLATE_VITRINA_CANONICAL_PREVIEWS_R1M', 'Missing canonical vitrina owner');
has(vitrina, 'data-preview4-canonical-template-frame-r1m="1"', 'Templates vitrina does not render canonical iframe thumbnails');
has(vitrina, 'owner.loadTemplateThumbnail(frame, id)', 'Templates vitrina does not call Web Studio canonical thumbnail bridge');
has(vitrina, 'const baseWidth = 1440;', 'Canonical vitrina fit does not use stable desktop width');
has(vitrina, 'const baseHeight = 900;', 'Canonical vitrina fit does not use stable desktop height');
has(vitrina, 'height: 158px !important;', 'Compact Templates thumbnail height is not protected from legacy global rule');
has(studio, 'IRGEZTNE_TEMPLATE_VITRINA_CANONICAL_BRIDGE_R1M', 'Missing Web Studio read-only canonical bridge');
has(studio, 'loadTemplateThumbnail: loadOfficialTemplateThumbnailR1M', 'Canonical bridge is not exported');
has(studio, 'templatePreviewPayloadV095A(id)', 'Bridge is not based on canonical template payload');
has(studio, "typeof api.materializeSitePreview === 'function'", 'Bridge does not use the real materialized package path');
has(studio, 'templatePreviewHtmlV094A(id)', 'Bridge lacks renderer fallback');
console.log('PASS: Templates vitrina uses current canonical Web Studio previews with fit and fallback');
