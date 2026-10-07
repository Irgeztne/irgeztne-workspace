#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const codeHub = read('src/v88-codehub-v1.js');
const studio = read('src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const workbench = read('src/modules/editor-workbench/editor-workbench.js');
const html = read('src/modules/editor-workbench/editor-workbench.html');
const css = read('src/modules/editor-workbench/editor-workbench.css');
const bridgeDoc = read('docs/WEBSTUDIO-WIDGET-CONTRACT-v1.md');
const frozenPath = path.join(root, 'docs/workshop/IRGEZTNE-SITE-WIDGET-CONTRACT-v1.md');
const frozen = fs.readFileSync(frozenPath);
const frozenText = frozen.toString('utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }
function between(text, start, end, label) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  must(a >= 0 && b > a, label + ' not found');
  return text.slice(a, b);
}

const frozenHash = crypto.createHash('sha256').update(frozen).digest('hex');
must(frozenHash === 'd1dbca9a437d5082433da4b42e139d1e63dd888c3c0ba5314ca04f4759a497ad', 'Frozen Site Widget Contract hash changed');
has(frozenText, 'Status:** Architecture Contract / FROZEN', 'Frozen Widget contract status missing');
has(frozenText, 'Runtime != Placement != Management', 'Frozen three-axis invariant missing');
has(frozenText, 'The external geometry belongs to Web Studio.', 'Frozen Host Surface ownership missing');

// Workshop Package Check / normalized descriptor.
has(codeHub, 'IRGEZTNE_WORKSHOP_WIDGET_CONTRACT_RECONCILIATION_R1W9H', 'Workshop R1W9H marker missing');
has(codeHub, "runtimeMode !== 'local' && runtimeMode !== 'hosted'", 'local/hosted runtime gate missing');
has(codeHub, "['local', 'external', 'hybrid']", 'management modes missing');
has(codeHub, 'WORKSHOP_WIDGET_PLACEMENT_MODES_R1W9H', 'placement vocabulary missing');
has(codeHub, "['inherit', 'variants', 'self-contained']", 'Host Theme mode gate missing');
has(codeHub, 'Secret-like fields are forbidden in public Widget configuration', 'secret-like setting rejection missing');
has(codeHub, 'Hosted Widget requires a valid HTTPS URL', 'hosted HTTPS boundary missing');
has(codeHub, 'External origins require Network: yes', 'network/origin consistency gate missing');
has(codeHub, 'materializeInstalledWidgetSnapshot: function (packageId)', 'public Widget materializer missing');
has(codeHub, 'Widget boolean setting default must be boolean', 'typed settings default validation missing');
has(codeHub, 'Widget numeric setting default is outside the allowed range', 'numeric settings default validation missing');
has(codeHub, 'Unsupported Widget capability:', 'unknown capability fail-closed gate missing');
has(codeHub, 'Local instance storage is reserved and not enabled in Widget v1 yet.', 'reserved capability must fail cleanly');

// Web Studio instance lifecycle is outside page.bodyHtml.
has(studio, 'IRGEZTNE_WORKSHOP_WIDGET_CONTRACT_RECONCILIATION_R1W9H', 'Studio R1W9H marker missing');
has(studio, 'page.workshopWidgetInstancesV1', 'separate page-local Widget instance state missing');
has(studio, 'migrateLegacyWorkshopWidgetPlaceholdersR1W9H', 'legacy Widget placeholder migration missing');
has(studio, "type: 'widget-instances-updated-r1w9h'", 'instance state update message missing');
has(studio, "data.type === 'widget-add-r1w9h'", 'Widget add message missing');
has(studio, "data.type === 'widget-update-r1w9h'", 'Widget update message missing');
has(studio, "data.type === 'widget-remove-r1w9h'", 'Widget remove message missing');
const addFn = between(studio, 'async function addWorkshopInstalledWidgetR1W9H', 'function updateWorkshopWidgetInstanceR1W9H', 'Widget add lifecycle');
has(addFn, 'workshopWidgetInstancesR1W9H(page, true).push(instance)', 'Widget add does not create separate Site Instance');
lacks(addFn, 'page.bodyHtml', 'New Widget add still mutates page.bodyHtml');
lacks(addFn, 'insertionMarkerToken', 'New Widget add still depends on DOM marker');

// Semantic Host Surfaces in all generated-site paths.
has(studio, 'function renderWorkshopWidgetSlotR1W9H', 'semantic Widget slot renderer missing');
has(studio, 'IRGEZTNE_WIDGET_HOST_SURFACE_RENDER_R1W9H', 'generated Host Surface integration missing');
has(studio, 'IRGEZTNE_WIDGET_HOST_SURFACE_OFFICIAL_FOUR_R1W9H', 'official-template Host Surface integration missing');
for (const slot of ['page-top','after-header','main-start','main-end','before-footer','page-bottom','floating']) {
  has(studio, `'${slot}'`, 'semantic slot missing: ' + slot);
}
has(studio, '.irgeztne-widget-host-r1w9h.mode-floating{position:fixed', 'floating Host Surface geometry missing');
has(studio, '.irgeztne-widget-host-r1w9h.mode-bar{width:100%', 'bar Host Surface geometry missing');
has(studio, '.irgeztne-widget-host-r1w9h.mode-floating.size-medium{width:min(680px', 'floating semantic size handling missing');
has(studio, 'workshopWidgetSafeColorTokenR1W9H', 'bounded Host Theme color normalization missing');
has(studio, 'workshopWidgetSafeFontTokenR1W9H', 'bounded Host Theme font normalization missing');
has(studio, 'window.IRGEZTNE_WIDGET_CONTEXT=', 'Host Theme/settings context injection missing');

// Workbench: choose -> configure -> placement -> add; no block marker insertion.
has(html, 'data-action="widgets-open-r1w9h"', 'global Site Widgets entry missing');
lacks(html, 'data-action="widgets-open-context-r1w9h"', 'Widget still appears inside structural Block menu');
has(html, 'id="ewbWidgetConfigR1W9H"', 'Widget configurator surface missing');
has(html, 'id="ewbWidgetInstancesR1W9H"', 'separate Widget instance inspector area missing');
has(workbench, 'IRGEZTNE_WORKBENCH_SITE_WIDGET_LIBRARY_R1W9H', 'Workbench R1W9H library marker missing');
has(workbench, "configureButton.dataset.action = 'widget-configure-r1w9h'", 'Configure-before-add action missing');
has(workbench, "confirm.dataset.action = existingInstance ? 'widget-update-confirm-r1w9h' : 'widget-add-confirm-r1w9h'", 'Widget confirm action missing');
has(workbench, "send('widget-add-r1w9h'", 'Workbench does not send configured Widget add');
has(workbench, "send('widget-update-r1w9h'", 'Workbench does not send Widget update');
has(workbench, "send('widget-remove-r1w9h'", 'Workbench does not send Widget remove');
lacks(workbench, '__IRGEZTNE_WIDGET_INSERT_', 'Rejected Widget DOM insertion marker remains active');
lacks(workbench, "send('widget-insert-r1w9g'", 'Rejected Component-like Widget insert action remains active');
has(workbench, 'renderWidgetInstancesR1W9H()', 'separate Widget instance renderer missing');
has(workbench, 'handleWidgetRuntimeHeightR1W9H(event, data)', 'content-height runtime bridge missing');
lacks(workbench, "action === 'widgets-open-context-r1w9h'", 'Workbench still couples Widget entry to selected Block');
has(css, 'IRGEZTNE_WORKBENCH_WIDGET_CONTRACT_RECONCILIATION_R1W9H', 'Widget reconciliation UI CSS missing');

// Documentation is reconciled, while the frozen contract remains authority.
has(bridgeDoc, 'Normative contract:', 'implementation bridge does not point to frozen authority');
has(bridgeDoc, 'New R1W9H instances never write Widget placement markers into `page.bodyHtml`.', 'implementation bridge still permits old placement model');
has(bridgeDoc, 'install\n-> configure\n-> choose placement', 'real lifecycle smoke sequence missing');

console.log('PASS: R1W9H reconciles Site Widget runtime with the FROZEN Widget Contract: configure-before-placement, separate site-local instances, semantic Host Surfaces, bounded runtime/theme context, and no Component-like bodyHtml insertion markers.');
