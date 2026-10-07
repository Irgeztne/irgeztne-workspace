#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const bootstrapSource = read('src/modules/economy/economy-bootstrap-v1.js');
const dataCoreSource = read('src/modules/economy/economy-data-core-v1.js');
const widgetSource = read('src/modules/economy/economy-widget-core-v1.js');
const panelSource = read('src/workspace-cabinet-panel-v0.js');
const proofSource = read('proofs/economy-widget-standalone.html');
const styles = read('styles.css');

function createEnvironment(systemLocale, moduleState) {
  const persistent = moduleState || new Map();
  const sandbox = {
    window: null,
    document: { documentElement: { lang: 'ru' } },
    navigator: { language: systemLocale, languages: [systemLocale] },
    console,
    Intl,
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => { throw new Error('offline test'); },
    nsAPI: {
      storageGetModuleStateSync(key, fallback) {
        return persistent.has(key) ? JSON.parse(JSON.stringify(persistent.get(key))) : fallback;
      },
      storageSetModuleStateSync(key, value) {
        persistent.set(key, JSON.parse(JSON.stringify(value)));
        return { ok: true };
      }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(bootstrapSource, sandbox, { filename: 'economy-bootstrap-v1.js' });
  vm.runInNewContext(dataCoreSource, sandbox, { filename: 'economy-data-core-v1.js' });
  vm.runInNewContext(widgetSource, sandbox, { filename: 'economy-widget-core-v1.js' });
  return { sandbox, persistent };
}

function fakeRoot() {
  return {
    className: '',
    innerHTML: '',
    dataset: {},
    style: { setProperty() {} },
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function selectedOption(html, value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<option value="${escaped}" selected>`).test(html);
}

function countryFor(systemLocale, savedSelection) {
  const env = createEnvironment(systemLocale);
  return env.sandbox.IRGEZTNEEconomyWidgetCoreV1.__test.resolveInitialCountry(
    { systemLocale },
    savedSelection || {}
  );
}

assert.equal(countryFor('az-AZ'), 'AZ', 'az-AZ first use must open Azerbaijan.');
assert.equal(countryFor('en-US'), 'US', 'en-US first use must open United States.');
assert.equal(countryFor('en-GB'), 'GB', 'en-GB first use must open United Kingdom.');
assert.equal(countryFor('ja-JP'), 'JP', 'ja-JP first use must open Japan.');
assert.equal(countryFor('tr-TR'), 'TR', 'tr-TR first use must open Turkey.');
assert.equal(countryFor('fr-CA'), 'CA', 'fr-CA first use must open Canada.');
assert.equal(countryFor('pt-BR'), 'BR', 'pt-BR first use must open Brazil.');
assert.equal(countryFor('en-AU'), 'AU', 'en-AU first use must open Australia.');
assert.equal(countryFor('de-CH'), 'CH', 'de-CH first use must open Switzerland.');
assert.equal(countryFor('de-DE'), 'DE', 'Supported Germany locale must open Germany.');
assert.equal(countryFor('fr-FR'), 'FR', 'Supported France locale must open France.');
assert.equal(countryFor('ko-KR'), 'KR', 'Supported South Korea locale must open South Korea.');
assert.equal(countryFor('es-MX'), 'MX', 'Supported Mexico locale must open Mexico.');
assert.equal(countryFor('it-IT'), 'XM', 'Unsupported euro-area country must open Euro area.');
assert.equal(countryFor('ar-AE'), 'US', 'Unsupported region must use canonical United States fallback.');
assert.equal(countryFor('en'), 'US', 'Locale without a region must use canonical fallback.');
assert.equal(countryFor('en-US', { countryId: 'JP' }), 'JP', 'A valid saved country must win over system locale.');
assert.equal(countryFor('en-GB', { countryId: 'REMOVED' }), 'GB', 'An invalid saved country must fall through to locale resolution.');

const sharedState = new Map();
const firstRun = createEnvironment('en-US', sharedState);
const firstRoot = fakeRoot();
const firstApi = firstRun.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(firstRoot, {
  mode: 'compact', locale: 'ru', systemLocale: 'en-US'
});
assert(selectedOption(firstRoot.innerHTML, 'US'), 'Clean compact mount did not select the locale-derived country.');
assert.equal(firstApi.setCountry('JP'), true, 'Manual supported country selection failed.');

const restarted = createEnvironment('en-US', sharedState);
const restartedRoot = fakeRoot();
const restartedApi = restarted.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(restartedRoot, {
  mode: 'compact', locale: 'ru', systemLocale: 'en-US'
});
assert(selectedOption(restartedRoot.innerHTML, 'JP'), 'Japan was not restored after a simulated restart.');
restartedApi.setLocale('en');
assert(selectedOption(restartedRoot.innerHTML, 'JP'), 'RU → EN changed the geographic selection.');
restartedApi.setLocale('ru');
assert(selectedOption(restartedRoot.innerHTML, 'JP'), 'EN → RU changed the geographic selection.');

const helpers = restarted.sandbox.IRGEZTNEEconomyWidgetCoreV1.__test;
const usPayload = restarted.sandbox.IRGEZTNEEconomyDataCoreV1.bundled('US');
const instrument = (label) => usPayload.market_instruments.find((entry) => entry.label === label)?.id;
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'en-GB' }, {}, usPayload), instrument('EUR/GBP'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'ja-JP' }, {}, usPayload), instrument('EUR/JPY'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'de-CH' }, {}, usPayload), instrument('EUR/CHF'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'tr-TR' }, {}, usPayload), instrument('EUR/TRY'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'fr-CA' }, {}, usPayload), instrument('EUR/CAD'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'en-AU' }, {}, usPayload), instrument('EUR/AUD'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'pt-BR' }, {}, usPayload), instrument('EUR/BRL'));
assert.equal(helpers.resolveInitialInstrument({ systemLocale: 'ar-AE' }, {}, usPayload), instrument('EUR/USD'));

helpers.writeSelectionState({ instrumentId: instrument('EUR/JPY') });
const marketRestart = createEnvironment('en-US', sharedState);
const marketRoot = fakeRoot();
marketRestart.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(marketRoot, {
  mode: 'standalone', locale: 'ru', systemLocale: 'en-US', initialTab: 'markets'
});
assert(selectedOption(marketRoot.innerHTML, instrument('EUR/JPY')), 'Saved market instrument was not restored after restart.');

helpers.writeSelectionState({ countryId: 'REMOVED', instrumentId: 'fx.REMOVED/market.reference_rate' });
const invalidRestart = createEnvironment('en-GB', sharedState);
const invalidHelpers = invalidRestart.sandbox.IRGEZTNEEconomyWidgetCoreV1.__test;
const invalidPayload = invalidRestart.sandbox.IRGEZTNEEconomyDataCoreV1.bundled('GB');
const persistedInvalid = invalidHelpers.readSelectionState();
assert.equal(invalidHelpers.resolveInitialCountry({ systemLocale: 'en-GB' }, persistedInvalid), 'GB');
assert.equal(invalidHelpers.resolveInitialInstrument({ systemLocale: 'en-GB' }, persistedInvalid, invalidPayload), instrument('EUR/GBP'));

const compact = createEnvironment('az-AZ');
const compactRoot = fakeRoot();
compact.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(compactRoot, { mode: 'compact', locale: 'ru', systemLocale: 'az-AZ' });
const fullRoot = fakeRoot();
compact.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(fullRoot, { mode: 'standalone', locale: 'en', systemLocale: 'az-AZ' });
assert(selectedOption(compactRoot.innerHTML, 'AZ') && selectedOption(fullRoot.innerHTML, 'AZ'), 'Compact and Full do not share the same resolver contract.');

assert(!/initialCountry\s*:\s*['"]AZ['"]/.test(panelSource), 'Compact panel still hardcodes Azerbaijan.');
assert(!/params\.get\(['"]country['"]\)\s*\|\|\s*['"]AZ['"]/.test(proofSource), 'Full Economy still hardcodes Azerbaijan.');
assert(!/settings\.initialCountry\s*\|\|\s*['"]AZ['"]/.test(widgetSource), 'Economy core still hardcodes Azerbaijan.');
assert(widgetSource.includes('storageGetModuleStateSync') && widgetSource.includes('storageSetModuleStateSync'), 'Economy selection does not use the app-owned module state contract.');
assert(!widgetSource.includes('localStorage'), 'Economy selection introduced renderer localStorage.');
assert(/\.workspace-toggle-text\s*\{[^}]*font-size:\s*16px[^}]*font-weight:\s*800[^}]*line-height:\s*1/s.test(styles), 'Information control typography is not consistently strengthened.');

console.log('PASS: Economy first-use locale, saved World/Markets selection, invalid fallback, RU/EN stability, shared Compact/Full defaults and Information header weight verified.');
