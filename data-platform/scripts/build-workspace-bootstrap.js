import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES } from '../src/config.js';
import { readSnapshot } from '../src/store.js';
import { economyWidgetSlice } from '../src/slices.js';

const snapshot = await readSnapshot();
if (!snapshot.generated_at || !(snapshot.series || []).length) throw new Error('Refresh Data Platform before building widget bootstrap');
const fullWidgets = Object.fromEntries(COUNTRIES.map((country) => [country.id, economyWidgetSlice(snapshot, country.id, 'compact')]));
const firstWidget = fullWidgets[COUNTRIES[0].id];
const shared = {
  market_instruments: firstWidget.market_instruments,
  markets_tab: firstWidget.tabs.markets
};
const widgets = Object.fromEntries(Object.entries(fullWidgets).map(([id, widget]) => [id, {
  ...widget,
  market_instruments: [],
  tabs: {
    ...widget.tabs,
    markets: {
      default_instrument_id: widget.tabs.markets.default_instrument_id,
      status: widget.tabs.markets.status,
      disclaimer: widget.tabs.markets.disclaimer
    }
  }
}]));
const output = { version: snapshot.version, generated_at: snapshot.generated_at, countries: COUNTRIES, shared, widgets };
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/modules/economy/economy-bootstrap-v1.js');
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, `window.IRGEZTNE_ECONOMY_BOOTSTRAP_V1 = ${JSON.stringify(output)};\n`);
console.log(target);
