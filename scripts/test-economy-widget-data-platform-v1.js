#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('index.html');
const panel = read('src/workspace-cabinet-panel-v0.js');
const panelCss = read('src/workspace-cabinet-panel-v040d.css');
const dataCore = read('src/modules/economy/economy-data-core-v1.js');
const widget = read('src/modules/economy/economy-widget-core-v1.js');
const widgetCss = read('src/modules/economy/economy-widget-v1.css');
const proof = read('proofs/economy-widget-standalone.html');
const bootstrap = read('src/modules/economy/economy-bootstrap-v1.js');
const main = read('main.js');
const packageJson = JSON.parse(read('package.json'));

assert(index.includes('economy-widget-v1.css'), 'Economy Widget stylesheet is not wired.');
assert(index.indexOf('economy-bootstrap-v1.js') < index.indexOf('economy-data-core-v1.js'));
assert(index.indexOf('economy-data-core-v1.js') < index.indexOf('economy-widget-core-v1.js'));
assert(index.indexOf('economy-widget-core-v1.js') < index.indexOf('workspace-cabinet-panel-v0.js'));
assert(panel.includes('data-ir-economy-widget'), 'Information panel has no Economy Widget slot.');
assert(panel.includes("mode: 'compact'"), 'Information panel must mount the compact shared widget core.');
assert(panel.includes('data-ir-wc-note') && panel.includes('irgeztne.workspace.quickNote.v0'), 'Existing Quick Note and its persistence key were not restored.');

for (const preserved of ['data-ir-wc-time', 'data-ir-wc-date', 'data-ir-wc-weather', 'data-ir-wc-calendar-toggle']) {
  assert(panel.includes(preserved), `Existing Information control ${preserved} was removed.`);
}
assert(panelCss.includes('.ir-wc-economy-slot'), 'Compact panel sizing for the Economy slot is missing.');

assert(widget.includes('<svg class="ir-economy-chart-svg"'), 'Responsive SVG chart renderer is missing.');
assert(widget.includes('data-economy-crosshair') && widget.includes('data-economy-tooltip'), 'Historical hover/crosshair interaction is missing.');
assert(widget.includes('filterPointsByRange') && widget.includes('data-economy-range'), 'Real observation range controls are missing.');
assert(widget.includes('data-economy-metric') && widget.includes('data-economy-instrument'), 'World metrics and Market instruments are not selectable.');
assert(!/bezier|quadraticCurve|cubic/i.test(widget), 'Chart must not use decorative curve generation.');
assert(!/chart\.js|highcharts|echarts|d3\./i.test(widget + widgetCss + index), 'An unapproved chart dependency was introduced.');
assert(widget.includes("ru: {") && widget.includes("en: {"), 'Widget locale dictionary is incomplete.');
assert(widget.includes('Official ECB reference rates — not live tradable quotes.'), 'Market-data limitation is not disclosed.');
assert(widgetCss.includes('@media (max-width: 520px)'), 'Compact chart is not responsive.');
assert(widgetCss.includes('--metric-accent') && widgetCss.includes('--eco-accent'), 'Data visualization palette is not independent from shell blue.');
assert(proof.includes('IRGEZTNEEconomyWidgetCoreV1.mount'), 'Standalone proof does not use the shared widget core.');
assert(proof.includes("proofLang === 'en'") && panel.includes('lang: getLang()') && panel.includes('theme:'), 'Full-view proof does not inherit RU/EN and theme from Information.');
assert(main.includes('ECONOMY_PROOF_URL') && main.includes("action: 'allow'"), 'Electron security handler still blocks the standalone Economy view.');
assert(main.includes('startIRGEZTNEDataPlatformV02'), 'Packaged Electron does not start the local Data Platform.');
assert(main.includes("path.join(DATA_DIR, 'economy-data-platform')"), 'Mutable Data Platform files must live in Electron userData.');
assert(main.includes('fs.copyFileSync(bundledSnapshot, runtimeSnapshot)'), 'First offline launch must seed userData from the bundled official snapshot.');
assert(packageJson.build.files.includes('data-platform/**/*'), 'Data Platform is missing from packaged Electron files.');
assert(packageJson.build.files.includes('proofs/economy-widget-standalone.html'), 'Standalone full-view proof is missing from packaged Electron files.');

const executableBrowserUrls = [dataCore, widget].join('\n').match(/https?:\/\/[^'"`\s)]+/g) || [];
assert.deepEqual(executableBrowserUrls.sort(), ['http://127.0.0.1:8788/v1/refresh', 'http://127.0.0.1:8788/v1/widget/economy'], 'Browser UI must only use the local Data Platform endpoints.');
assert(bootstrap.includes('https://data.worldbank.org/') && bootstrap.includes('https://data.ecb.europa.eu/'), 'Bundled observations must retain official provenance URLs.');

const sandbox = {
  window: null,
  console,
  localStorage: { getItem() { return null; }, setItem() {} },
  fetch: async () => { throw new Error('offline test'); },
  AbortController,
  setTimeout,
  clearTimeout
};
sandbox.window = sandbox;
vm.runInNewContext(bootstrap, sandbox, { filename: 'economy-bootstrap-v1.js' });
vm.runInNewContext(dataCore, sandbox, { filename: 'economy-data-core-v1.js' });
assert.ok(sandbox.IRGEZTNE_ECONOMY_BOOTSTRAP_V1.widgets.AZ, 'Bundled offline Azerbaijan widget is missing.');
const bundledAz = sandbox.IRGEZTNEEconomyDataCoreV1.bundled('AZ');
assert.ok(bundledAz.tabs.world.chart.points.length >= 10);
assert.ok(bundledAz.tabs.markets.chart.points.length >= 100);
assert.ok(bundledAz.market_instruments.length >= 8, 'Bundled Markets must expose real available ECB instruments.');

console.log('PASS: Information integration, shared compact/standalone core, RU/EN and dependency-free SVG contract verified.');
