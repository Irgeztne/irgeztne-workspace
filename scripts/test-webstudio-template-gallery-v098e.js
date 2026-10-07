#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}
function between(haystack, start, end) {
  const a = haystack.indexOf(start);
  if (a < 0) throw new Error(`Missing block start: ${start}`);
  const b = haystack.indexOf(end, a);
  if (b < 0) throw new Error(`Missing block end: ${end}`);
  return haystack.slice(a, b);
}

has(source, 'IRGEZTNE_TEMPLATE_GALLERY_ZERO_MATERIALIZE_R2', 'Missing zero-materialize gallery owner');
has(source, 'data-v5-template-card-preview-v098e="1"', 'Missing gallery iframe marker');
has(source, "mode: 'inline-canonical'", 'Legacy catalogue thumbnail is not inline-canonical');
has(source, "if (activeTab === 'templates')", 'Gallery loader is not scheduled');

const gallery = between(source, 'async function loadTemplateGalleryCardsV098E()', '// IRGEZTNE_WORKSHOP_TEMPLATE_LIBRARY_BRIDGE_R1W9A');
if (gallery.includes('materializeSitePreview')) throw new Error('Templates gallery still materializes preview packages to disk');
if (gallery.includes('templateGalleryPreviewCacheV098E')) throw new Error('Templates gallery still depends on materialized preview cache');
has(gallery, 'frame.srcdoc = templateGalleryDarkHtmlV098E(', 'Gallery does not render canonical inline first frame');

const legacy = between(source, 'async function loadOfficialTemplateThumbnailR1M', 'async function loadTemplateGalleryCardsV098E');
if (legacy.includes('materializeSitePreview')) throw new Error('Legacy template thumbnail still materializes preview packages to disk');
has(legacy, 'frame.srcdoc = templateGalleryDarkHtmlV098E(', 'Legacy template thumbnail is not inline-canonical');

has(main, "path.join(app.getPath('temp'), 'irgeztne-workspace-previews')", 'Generated previews are not in OS temp');
has(main, 'clearSitePreviewTempDir();', 'Preview temp root is not cleared on app startup');

has(css, 'IRGEZTNE_TEMPLATE_GALLERY_VISUAL_CORRECTION_V098E', 'Missing V098E gallery CSS');
has(css, 'background: linear-gradient(180deg, #ffffff 0%, #eef5ff 100%)', 'Concrete header background remains');
has(css, 'background: #07101d !important;', 'Gallery frame lacks stable dark canvas');
console.log('PASS: Web Studio gallery is instant/inline and generated preview packages use bounded OS temp');
