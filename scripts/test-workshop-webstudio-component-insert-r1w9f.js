#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const codeHubPath = path.join(root, 'src/v88-codehub-v1.js');
const baseContractPath = path.join(root, 'docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md');
const themeContractPath = path.join(root, 'docs/WEBSTUDIO-THEME-CONTRACT-v1.md');
const componentContractPath = path.join(root, 'docs/WEBSTUDIO-COMPONENT-CONTRACT-v1.md');

const studio = fs.readFileSync(studioPath, 'utf8');
const codeHub = fs.readFileSync(codeHubPath, 'utf8');
const baseContract = fs.readFileSync(baseContractPath, 'utf8');
const themeContract = fs.readFileSync(themeContractPath, 'utf8');
const componentContract = fs.readFileSync(componentContractPath, 'utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }
function sliceBetween(text, startNeedle, endNeedle, label) {
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  must(start >= 0 && end > start, label + ' not found');
  return text.slice(start, end);
}

// Component v1 package contract is one package = one non-executable page block.
has(codeHub, 'IRGEZTNE_WORKSHOP_COMPONENT_DOCUMENT_R1W9F', 'Component document validator marker missing');
has(codeHub, "const WORKSHOP_COMPONENT_FORMAT_R1W9F = 'irgeztne-webstudio-component';", 'Component format missing');
has(codeHub, "raw.toLowerCase() !== 'component.html'", 'Component v1 does not pin its root entry');
has(codeHub, "script|style|iframe|object|embed|link|meta|form", 'Component executable/embedded tag boundary missing');
has(codeHub, "javascript\\s*:", 'Component javascript URL rejection missing');

const verify = sliceBetween(codeHub, 'async function verifyWorkshopInstallArchive(entries)', 'async function installWorkshopZipFile(file)', 'ZIP verifier');
has(verify, "String(file.path || '').toLowerCase() === 'component.json'", 'Component ZIP does not require component.json');
has(verify, "role || '') !== 'main'", 'component.json role:main is not enforced');
has(verify, "kind || '') !== 'data'", 'component.json kind:data is not enforced');
has(verify, "String(file.path || '').toLowerCase() === String(verifiedComponentR1W9F.entry || '').toLowerCase()", 'component.html entry is not resolved from verified component document');
has(verify, "role || '') !== 'component'", 'component.html role:component is not enforced');
has(verify, "kind || '') !== 'html'", 'component.html kind:html is not enforced');
has(verify, "mime || '').toLowerCase() !== 'text/html'", 'component.html MIME boundary missing');
has(verify, 'extraComponentFilesR1W9F.length', 'Component v1 two-file envelope is not enforced');
has(verify, 'validateWorkshopComponentHtmlR1W9F(componentHtmlR1W9F.entry.bytes)', 'Verified component HTML is not validated');

const install = sliceBetween(codeHub, 'async function installWorkshopZipFile(file)', 'function safeWorkshopFileName', 'Install function');
has(install, "component: verified.component && typeof verified.component === 'object'", 'Installed registry does not retain safe Component projection');

// Public adapter re-reads and re-hashes both component metadata and HTML.
has(codeHub, 'getInstalledComponents: function ()', 'Public installed-component discovery adapter missing');
has(codeHub, 'materializeInstalledComponentSnapshot: function (packageId)', 'Public Component materialization adapter missing');
const materialize = sliceBetween(codeHub,
  'async function materializeWorkshopInstalledComponentSnapshotR1W9F(packageId)',
  'async function uninstallWorkshopInstalledPackage',
  'Component materializer');
has(materialize, 'await getWorkshopBytes(manifestFile.blobKey)', 'Component materializer does not re-read component.json');
has(materialize, 'await sha256ArrayBuffer(manifestBytes)', 'Component materializer does not re-hash component.json');
has(materialize, 'await getWorkshopBytes(htmlFile.blobKey)', 'Component materializer does not re-read component.html');
has(materialize, 'await sha256ArrayBuffer(htmlBytes)', 'Component materializer does not re-hash component.html');
has(materialize, 'validateWorkshopComponentHtmlR1W9F(new Uint8Array(htmlBytes))', 'Component materializer does not revalidate HTML');
has(materialize, "format: 'irgeztne-webstudio-component-snapshot'", 'Component handoff format missing');

// Web Studio discovers through public adapter and inserts a site-local copy into ordinary page state.
has(studio, 'IRGEZTNE_WORKSHOP_WEBSTUDIO_COMPONENT_INSERT_R1W9F', 'Web Studio Component insert marker missing');
const componentUi = sliceBetween(studio, 'function workshopInstalledComponentsR1W9F()', 'function renderPageTab(state, page)', 'Component UI/insert block');
has(componentUi, 'api.getInstalledComponents()', 'Editor component library bypasses public discovery adapter');
has(componentUi, "t('Installed components / blocks', 'Установленные компоненты / блоки')", 'Installed component library label missing');
has(componentUi, 'data-v5-action="workshop-installed-component-insert-r1w9f"', 'Insert Block action missing');
lacks(componentUi, 'WORKSHOP_INSTALLED_', 'Web Studio Component UI reaches into Workshop registry internals');
lacks(componentUi, 'getWorkshopBytes(', 'Web Studio Component UI reaches into Workshop byte store');

const insert = sliceBetween(studio,
  'async function insertWorkshopInstalledComponentR1W9F(packageId, insertionContextR1W9F2)',
  'function renderPageTab(state, page)',
  'Component insert function');
has(insert, 'api.materializeInstalledComponentSnapshot', 'Component insert bypasses materialization adapter');
has(insert, "payload.format !== 'irgeztne-webstudio-component-snapshot'", 'Component insert does not validate handoff');
has(insert, 'sanitizeHtml(String(payload.html || \'\'))', 'Component HTML is not sanitized again in Web Studio');
has(insert, 'page.bodyHtml = sanitizeHtml', 'Inserted component is not copied into ordinary page bodyHtml');
has(insert, 'IRGEZTNE_WORKSHOP_COMPONENT_INSERT_POSITION_R1W9F2', 'R1W9F2 positioned insertion extension is not reconciled with R1W9F core');
has(insert, 'page.workshopComponentInsertions.push', 'Inserted component provenance is not recorded');
has(insert, 'writeState(state)', 'Inserted component is not persisted with site state');
has(insert, 'workshopTemplateSnapshotMetaR1W9D(state)', 'Detached Workshop template snapshot is not blocked');
has(studio, 'installedComponents: workshopInstalledComponentsForWorkbenchR1W9F1()', 'Installed component discovery is not handed to Editor Workbench');

// Click routing.
has(studio, "action === 'workshop-installed-component-insert-r1w9f'", 'Component insert click route missing');
has(studio, 'void insertWorkshopInstalledComponentR1W9F', 'Component insert click does not call adapter');

// Contract reconciliation and semantics.
has(componentContract, 'exactly **one reusable page block**', 'Component contract loses one-package/one-block rule');
has(componentContract, 'Installing is not inserting.', 'Component contract loses Installed != Inserted');
has(componentContract, '`NSCodeHubV1.materializeInstalledComponentSnapshot(packageId)`', 'Component public adapter is undocumented');
has(componentContract, 'uninstalling the source Component later does not remove already inserted instances', 'Component uninstall independence is undocumented');
has(componentContract, 'Interactive behavior belongs to the separate **Site Widget** type', 'Component/Widget boundary is missing');
has(componentContract, 'No R1W9F REAL PASS is claimed before that smoke.', 'Component real-smoke gate wording missing');
has(componentContract, '**R1W9F Component adapter = REAL PASS / FROZEN.**', 'Component real-smoke result is not reconciled');

has(baseContract, '`theme`: R1W9E defines the declarative Theme Contract; the real user smoke passed', 'Base contract does not reconcile R1W9E REAL PASS');
has(baseContract, '`component`: R1W9F completed the real user smoke', 'Base contract does not reconcile R1W9F Component REAL PASS');
has(themeContract, '**R1W9E = REAL PASS / FROZEN**', 'Theme contract is not reconciled with real user smoke');

console.log('PASS: R1W9F Component contract remains valid and the 08.09.2026 real smoke is reconciled as REAL PASS / FROZEN.');
