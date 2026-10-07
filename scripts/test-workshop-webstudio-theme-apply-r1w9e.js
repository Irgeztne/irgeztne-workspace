#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const codeHubPath = path.join(root, 'src/v88-codehub-v1.js');
const baseContractPath = path.join(root, 'docs/workshop/IRGEZTNE-WEB-STUDIO-PACKAGE-CONTRACT-v1.md');
const templateContractPath = path.join(root, 'docs/WEBSTUDIO-TEMPLATE-CONTRACT-v1.md');
const themeContractPath = path.join(root, 'docs/WEBSTUDIO-THEME-CONTRACT-v1.md');
const studio = fs.readFileSync(studioPath, 'utf8');
const codeHub = fs.readFileSync(codeHubPath, 'utf8');
const baseContract = fs.readFileSync(baseContractPath, 'utf8');
const templateContract = fs.readFileSync(templateContractPath, 'utf8');
const themeContract = fs.readFileSync(themeContractPath, 'utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }
function sliceBetween(text, startNeedle, endNeedle, label) {
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  must(start >= 0 && end > start, label + ' not found');
  return text.slice(start, end);
}

// Workshop must validate a small declarative theme, not executable Web Studio internals.
has(codeHub, 'IRGEZTNE_WORKSHOP_THEME_DOCUMENT_R1W9E', 'Theme document validator marker missing');
has(codeHub, "const WORKSHOP_THEME_FORMAT_R1W9E = 'irgeztne-webstudio-theme';", 'Theme document format missing');
has(codeHub, "const WORKSHOP_THEME_FIELDS_R1W9E = ['accentColor', 'menuColor', 'buttonColor', 'backgroundColor', 'textColor', 'fontFamily', 'headingFont'];", 'Theme supported field boundary missing');
const verify = sliceBetween(codeHub, 'async function verifyWorkshopInstallArchive(entries)', 'async function installWorkshopZipFile(file)', 'ZIP verifier');
has(verify, "String(file.path || '').toLowerCase() === 'theme.json'", 'Theme ZIP does not require root theme.json');
has(verify, "role || '') !== 'main'", 'theme.json role:main is not enforced');
has(verify, "kind || '') !== 'data'", 'theme.json kind:data is not enforced');
has(verify, "mime || '').toLowerCase() !== 'application/json'", 'theme.json application/json MIME is not enforced');
has(verify, 'parseWorkshopThemeDocumentR1W9E(themeFileR1W9E.entry.bytes)', 'Verified Theme bytes are not parsed');

const install = sliceBetween(codeHub, 'async function installWorkshopZipFile(file)', 'function safeWorkshopFileName', 'Install function');
has(install, "theme: verified.theme && typeof verified.theme === 'object'", 'Installed registry does not retain safe Theme projection');

// Public adapter must re-read and re-hash actual installed theme.json before apply.
has(codeHub, 'IRGEZTNE_WORKSHOP_WEBSTUDIO_THEME_MATERIALIZATION_R1W9E', 'Theme materialization marker missing');
has(codeHub, 'getInstalledThemes: function ()', 'Public installed-theme discovery adapter missing');
has(codeHub, 'materializeInstalledThemeSnapshot: function (packageId)', 'Public Theme materialization adapter missing');
const materialize = sliceBetween(codeHub,
  'async function materializeWorkshopInstalledThemeSnapshotR1W9E(packageId)',
  'async function uninstallWorkshopInstalledPackage',
  'Theme materializer');
has(materialize, 'await getWorkshopBytes(themeFile.blobKey)', 'Theme materializer does not re-read installed bytes');
has(materialize, 'bytes.byteLength !== Number(themeFile.size || 0)', 'Theme materializer does not re-check size');
has(materialize, 'await sha256ArrayBuffer(bytes)', 'Theme materializer does not re-hash bytes');
has(materialize, "digest !== String(themeFile.sha256 || '').toLowerCase()", 'Theme materializer does not compare SHA-256');
has(materialize, 'parseWorkshopThemeDocumentR1W9E(new Uint8Array(bytes))', 'Theme materializer does not re-parse verified bytes');
has(materialize, "format: 'irgeztne-webstudio-theme-snapshot'", 'Theme materialization handoff format missing');

// Web Studio Design must expose installed Themes through the public adapter only.
has(studio, 'IRGEZTNE_WORKSHOP_WEBSTUDIO_THEME_APPLY_R1W9E', 'Web Studio Theme apply marker missing');
const themeUi = sliceBetween(studio, 'function workshopInstalledThemesR1W9E()', 'function renderIdentityTab(state)', 'Theme UI/apply block');
has(themeUi, 'api.getInstalledThemes()', 'Design does not use public installed-theme discovery');
has(themeUi, "data-v5-action=\"workshop-installed-theme-apply-r1w9e\"", 'Apply Theme action missing');
has(themeUi, "t('Installed themes', 'Установленные темы')", 'Installed Themes section label missing');
lacks(themeUi, 'WORKSHOP_INSTALLED_', 'Web Studio Theme UI reaches into Workshop installed registry internals');
lacks(themeUi, 'getWorkshopBytes(', 'Web Studio Theme UI reaches into Workshop byte store');

// Apply copies only Design values into site-local state, never identity/content.
const apply = sliceBetween(studio,
  'async function applyWorkshopInstalledThemeR1W9E(packageId)',
  'function renderIdentityTab(state)',
  'Theme apply function');
has(apply, 'api.materializeInstalledThemeSnapshot', 'Apply bypasses Theme materialization adapter');
has(apply, "payload.format !== 'irgeztne-webstudio-theme-snapshot'", 'Apply does not validate handoff format');
has(apply, 'WORKSHOP_THEME_FIELDS_R1W9E.forEach', 'Apply does not copy bounded Design fields');
has(apply, 'state.site.workshopThemeSnapshot = {', 'Apply provenance snapshot missing');
has(apply, 'writeState(state)', 'Applied Theme is not persisted in normal Web Studio state');
has(apply, "activeTab = 'identity'", 'Apply does not remain in Design for visual confirmation');
has(apply, 'workshopTemplateSnapshotMetaR1W9D(state)', 'Detached Workshop template snapshot is not blocked from Theme apply');
['logoLetters','logoBackgroundColor','faviconLetters','name','author','tagline','pages','menuGroups','publishSettings'].forEach((forbidden) => {
  must(!new RegExp('state\\.site\\.' + forbidden + '\\s*=').test(apply), 'Theme apply mutates forbidden identity/content field: ' + forbidden);
});

// Existing structured renderer already consumes the exact copied fields.
['site.accentColor','site.menuColor','site.buttonColor','site.backgroundColor','site.textColor','site.fontFamily','site.headingFont'].forEach((needle) => {
  has(studio, needle, 'Existing renderer/Design state does not consume ' + needle);
});

// Contract must preserve Installed != Applied and no arbitrary CSS/JS v1.
has(themeContract, 'Installing is not applying.', 'Theme contract loses Installed != Applied');
has(themeContract, 'No arbitrary CSS/JavaScript in Theme v1', 'Theme contract permits unbounded executable styling');
has(themeContract, '`NSCodeHubV1.materializeInstalledThemeSnapshot(packageId)`', 'Theme public adapter is undocumented');
has(themeContract, 'uninstalling the Theme later does not revert or damage the site', 'Theme uninstall independence is undocumented');
has(themeContract, 'REAL PASS is claimed before that smoke', 'Theme real-smoke gate wording missing');
has(baseContract, '`template`: R1W9D received real user PASS', 'Base contract still treats R1W9D as pending');
has(baseContract, '`theme`: R1W9E defines the declarative Theme Contract', 'Base contract does not register R1W9E Theme candidate');
has(templateContract, 'R1W9D is **REAL PASS / FROZEN**', 'Template contract was not reconciled with real R1W9D smoke');

console.log('PASS: R1W9E validates declarative Theme packages, exposes them through the public Workshop adapter, applies only bounded existing Design fields as site-local state, blocks detached HTML snapshots, and preserves uninstall independence semantics pending real user smoke');
