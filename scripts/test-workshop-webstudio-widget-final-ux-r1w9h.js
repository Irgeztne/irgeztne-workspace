#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const wb = read('src/modules/editor-workbench/editor-workbench.js');
const css = read('src/modules/editor-workbench/editor-workbench.css');
const studio = read('src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const bridge = read('docs/WEBSTUDIO-WIDGET-CONTRACT-v1.md');
const frozen = fs.readFileSync(path.join(root, 'docs/workshop/IRGEZTNE-SITE-WIDGET-CONTRACT-v1.md'));

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function between(text, start, end, label) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  must(a >= 0 && b > a, label + ' not found');
  return text.slice(a, b);
}

const frozenHash = crypto.createHash('sha256').update(frozen).digest('hex');
must(frozenHash === 'd1dbca9a437d5082433da4b42e139d1e63dd888c3c0ba5314ca04f4759a497ad', 'FROZEN Site Widget Contract changed');

has(wb, 'IRGEZTNE_WORKBENCH_WIDGET_FINAL_UX_CLOSEOUT_R1W9H', 'Workbench final Widget UX marker missing');
has(studio, 'IRGEZTNE_WIDGET_FINAL_UX_CLOSEOUT_R1W9H', 'Studio final Widget UX marker missing');
has(css, 'IRGEZTNE_WORKBENCH_WIDGET_FINAL_UX_CLOSEOUT_R1W9H', 'Final Widget UX CSS marker missing');

// Create vs edit language is explicit.
has(wb, "localText('Add to Site', 'Добавить на сайт')", 'Add-to-site label missing');
has(wb, "localText('Save changes', 'Сохранить изменения')", 'Existing-instance save-changes label missing');
must(!wb.includes("localText('Save Widget', 'Сохранить Widget')"), 'Ambiguous Save Widget label remains');

// Contract enum values remain stable while the UI gets localized labels.
for (const needle of [
  "flow: ['Flow', 'В потоке']",
  "region: ['Site region', 'Область сайта']",
  "bar: ['Bar', 'Полоса']",
  "floating: ['Floating', 'Плавающий']",
  "medium: ['Medium', 'Средний']",
  "wide: ['Wide', 'Широкий']",
  "full: ['Full width', 'На всю ширину']",
  "center: ['Center', 'По центру']",
  "'main-end': ['Main content end', 'Конец основного содержимого']",
  "'bottom-right': ['Bottom right', 'Снизу справа']"
]) has(wb, needle, 'Missing localized Widget placement label: ' + needle);
has(wb, "option.value = String(value);", 'Contract enum value is no longer preserved in select value');
has(wb, "option.textContent = widgetPlacementOptionLabelR1W9H(kind, value);", 'Localized option label is not presentation-only');

// A single submit remains pending until the parent confirms the state mutation.
const submit = between(wb, "if (action === 'widget-add-confirm-r1w9h' || action === 'widget-update-confirm-r1w9h')", "if (action === 'widget-instance-edit-r1w9h')", 'Widget submit handler');
has(submit, 'if (widgetSubmitPendingR1W9H) return;', 'Repeated Widget submit is not blocked');
has(submit, "confirmButton.disabled = true", 'Widget confirm is not disabled while pending');
has(submit, "confirmButton.setAttribute('aria-busy', 'true')", 'Widget confirm does not expose busy state');
has(submit, "send('widget-add-r1w9h'", 'Widget add message missing');
has(submit, "send('widget-update-r1w9h'", 'Widget update message missing');
must(!submit.includes('widgetConfigR1W9H.hidden = true'), 'Configurator still closes before parent confirms success');

// Parent acknowledges exact instance; only success closes the library and focuses the affected instance.
has(studio, "{ action: 'add', instanceId: instanceId }", 'Add success does not return created instance id');
has(studio, "{ action: 'update', instanceId: String(instance.instanceId || '') }", 'Update success does not return instance id');
has(studio, "type: 'widget-action-failed-r1w9h'", 'Widget failure acknowledgement missing');
has(wb, "if (result && (result.action === 'add' || result.action === 'update'))", 'Workbench success acknowledgement handling missing');
has(wb, 'setWidgetsPanelOpenR1W9G(false);', 'Successful add/update does not close Widget library');
has(wb, "target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });", 'Affected Widget instance is not focused after success');
has(wb, "card.classList.add('is-widget-focus-r1w9h')", 'Fresh Widget instance highlight missing');

has(bridge, 'Final Add/Edit UX closeout', 'Implementation bridge final UX section missing');
has(bridge, 'repeated clicks cannot create accidental duplicates', 'Implementation bridge duplicate-prevention note missing');

console.log('PASS: R1W9H final Widget UX makes Add vs Edit explicit, localizes placement labels without changing contract values, blocks duplicate submits, waits for parent acknowledgement, then closes and focuses the affected Site Widget Instance.');
