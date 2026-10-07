#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const codeHubPath = path.join(root, 'src/v88-codehub-v1.js');
const baseContractPath = path.join(root, 'docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md');
const templateContractPath = path.join(root, 'docs/WEBSTUDIO-TEMPLATE-CONTRACT-v1.md');
const studio = fs.readFileSync(studioPath, 'utf8');
const codeHub = fs.readFileSync(codeHubPath, 'utf8');
const baseContract = fs.readFileSync(baseContractPath, 'utf8');
const templateContract = fs.readFileSync(templateContractPath, 'utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }
function sliceBetween(text, startNeedle, endNeedle, label) {
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  must(start >= 0 && end > start, label + ' not found');
  return text.slice(start, end);
}

// Public Workshop handoff must re-verify real installed bytes before copying them out.
has(codeHub, 'IRGEZTNE_WORKSHOP_WEBSTUDIO_TEMPLATE_MATERIALIZATION_R1W9D', 'Missing R1W9D CodeHub materialization marker');
has(codeHub, 'materializeInstalledTemplateSnapshot: function (packageId)', 'Missing public materialization adapter');
const materialize = sliceBetween(codeHub,
  'async function materializeWorkshopInstalledTemplateSnapshotR1W9D(packageId)',
  'async function uninstallWorkshopInstalledPackage',
  'Workshop materialization function');
has(materialize, 'await getWorkshopBytes(file.blobKey)', 'Materialization does not load installed bytes');
has(materialize, 'bytes.byteLength !== Number(file.size || 0)', 'Materialization does not re-check file size');
has(materialize, 'await sha256ArrayBuffer(bytes)', 'Materialization does not re-hash bytes');
has(materialize, "digest !== String(file.sha256 || '').toLowerCase()", 'Materialization does not compare SHA-256 with manifest');
has(materialize, "format: 'irgeztne-webstudio-template-snapshot'", 'Materialization handoff format missing');
has(materialize, 'previewSrcdoc: await buildWorkshopLivePreview(record)', 'Safe preview payload missing');

// Web Studio owns an independent byte store and must not reach into Workshop private stores.
has(studio, 'IRGEZTNE_WORKSHOP_TEMPLATE_SITE_SNAPSHOT_R1W9D', 'Missing Web Studio snapshot marker');
has(studio, "var WORKSHOP_SITE_SNAPSHOT_DB_R1W9D = 'irgeztne-webstudio-template-site-snapshots-v1';", 'Dedicated Web Studio snapshot DB missing');
has(studio, "var WORKSHOP_SITE_SNAPSHOT_STORE_R1W9D = 'snapshots';", 'Dedicated Web Studio snapshot store missing');
const snapshotHelpers = sliceBetween(studio,
  'function openWorkshopSiteSnapshotDbR1W9D()',
  'function workshopInstalledTemplateCardR1W9A(item)',
  'Web Studio snapshot helpers');
lacks(snapshotHelpers, 'getWorkshopBytes(', 'Web Studio snapshot layer reaches into Workshop byte storage');
lacks(snapshotHelpers, 'WORKSHOP_INSTALLED_', 'Web Studio snapshot layer reaches into Workshop installed registry internals');
has(snapshotHelpers, 'storeWorkshopTemplateSnapshotR1W9D', 'Snapshot write helper missing');
has(snapshotHelpers, 'readWorkshopTemplateSnapshotR1W9D', 'Snapshot read helper missing');
has(snapshotHelpers, "var snapshotId = 'workshop-site:'", 'Site-owned snapshot identity missing');

// User-facing use action must be explicit and distinct from preview.
const card = sliceBetween(studio,
  'function workshopInstalledTemplateCardR1W9A(item)',
  'function renderWorkshopInstalledTemplatesR1W9A()',
  'Installed-template card');
has(card, "data-v5-action=\"workshop-installed-template-preview-r1w9c\"", 'Installed template lost Open Preview action');
has(card, "data-v5-action=\"workshop-installed-template-use-r1w9d\"", 'Installed template has no Choose Template action');
has(card, "t('Choose template', 'Выбрать шаблон')", 'Choose Template label missing');

// Create path: package -> verified handoff -> Web Studio DB -> state metadata -> preview.
const createSnapshot = sliceBetween(studio,
  'async function createWorkshopTemplateLocalSiteR1W9D(manager, name, author, draft)',
  'async function createLocalSite()',
  'Workshop site creation path');
has(createSnapshot, 'api.materializeInstalledTemplateSnapshot(packageId)', 'Create path bypasses public Workshop adapter');
has(createSnapshot, 'storeWorkshopTemplateSnapshotR1W9D(profile.id, payload)', 'Create path does not persist site-local bytes');
has(createSnapshot, "state.site.templateSource = 'workshop-installed-snapshot'", 'Created site is not marked as a snapshot');
has(createSnapshot, 'state.site.workshopTemplateSnapshot = snapshotMeta', 'Created site does not retain its snapshot pointer');
has(createSnapshot, "activeTab = 'preview'", 'Created snapshot does not open its local preview');
has(studio, 'await createWorkshopTemplateLocalSiteR1W9D(manager, name, author, draft);', 'Create website does not branch to Workshop snapshot materialization');

// Preview/open/export must use Web Studio's snapshot, not the installed Workshop package.
const refreshPreview = sliceBetween(studio, 'async function refreshPreviewFrame()', 'async function downloadCurrentHtml()', 'Preview function');
has(refreshPreview, 'readWorkshopTemplateSnapshotR1W9D', 'Snapshot preview does not read site-local store');
has(refreshPreview, "frame.setAttribute('sandbox', 'allow-scripts')", 'Snapshot preview sandbox missing');
has(refreshPreview, 'frame.srcdoc = String(snapshotRecordR1W9D.previewSrcdoc)', 'Snapshot preview does not render stored safe srcdoc');
has(refreshPreview, 'Workshop is no longer consulted for this site.', 'Preview does not state independence boundary');

const openSite = sliceBetween(studio, 'async function openSiteInBrowser(forcePublic)', 'async function openCurrentPageInBrowser()', 'Open site function');
has(openSite, 'readWorkshopTemplateSnapshotR1W9D', 'Open site does not use local snapshot');
has(openSite, 'api.materializeSitePreview({', 'Open site does not materialize a safe standalone snapshot');
has(openSite, "package: { 'index.html': String(workshopSnapshotRecordR1W9D.previewSrcdoc) }", 'Open site does not use safe stored srcdoc');
lacks(openSite, 'snapshotWinR1W9D.document.write', 'Unsafe Electron popup document.write path remains for Workshop snapshot');

const openPage = sliceBetween(studio, 'async function openCurrentPageInBrowser()', 'async function refreshPreviewFrame()', 'Open current page function');
has(openPage, 'if (workshopTemplateSnapshotMetaR1W9D(state))', 'Open current page can still render the fake structured placeholder');
has(openPage, 'await openSiteInBrowser(false)', 'Open current page does not route to the real snapshot');

const zipExport = sliceBetween(studio, 'async function downloadSiteZip()', 'function scrollPublishAnchor', 'ZIP export function');
has(zipExport, 'readWorkshopTemplateSnapshotR1W9D', 'ZIP export does not use local snapshot');
has(zipExport, 'workshopSnapshotExportPackageR1W9D', 'ZIP export does not reconstruct the original snapshot files');
has(zipExport, 'exportSiteZip(snapshotPayloadR1W9D)', 'ZIP export does not use the existing ZIP boundary');

const publish = sliceBetween(studio, 'async function publishFoundation()', 'function copyText(text)', 'Publish foundation');
has(publish, 'workshopTemplateSnapshotMetaR1W9D(state)', 'Remote publish is not guarded for snapshot sites');
has(publish, 'separate adapter gate', 'Remote publish guard does not explain the release boundary');

// Do not pretend arbitrary HTML/CSS/JS became structured editable Web Studio content.
has(studio, 'Structured conversion into Editor blocks is a separate adapter gate and is not simulated here.', 'Editor limitation is not explicit');
has(templateContract, 'Arbitrary HTML/CSS/JS is still not claimed as converted', 'Template contract overclaims structured conversion');
has(templateContract, 'R1W9D is not a real PASS until user smoke proves creation, restart durability and source-package removal independence.', 'Real smoke gate missing from template contract');
has(templateContract, 'does not claim Backup Center portability', 'Backup boundary is not explicit');
has(baseContract, 'Backup Center transport of detached snapshot bytes remain separate', 'Base contract does not preserve backup boundary');

console.log('PASS: R1W9D implements verified installed-template materialization into an independent Web Studio snapshot, routes preview/open/ZIP through that snapshot, blocks premature remote publish, and does not claim structured editability or real PASS before user smoke');
