#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, SOURCE_REGISTRY } from '../data-platform/src/config.js';
import { latestRecords } from '../data-platform/src/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_PATH = path.join(ROOT, 'data-platform', 'data', 'latest.json');
const FETCHED_AT = '2026-09-01T09:57:09.786Z';

// Official World Bank indicator observations retrieved from the existing
// NY.GDP.MKTP.CD and FP.CPI.TOTL.ZG source pages on 2026-09-01.
const OBSERVATIONS = {
  DE: {
    gdp: [
      [2011, 3823575803793.78], [2012, 3596483233406.25], [2013, 3807023797050.99],
      [2014, 3964870735760.77], [2015, 3425099578746.09], [2016, 3536787895179],
      [2017, 3765351626105.89], [2018, 4055433215301.96], [2019, 3959894794039.21],
      [2020, 3941398957073.94], [2021, 4355251953410.78], [2022, 4201021706478.62],
      [2023, 4562207532490.28], [2024, 4685592577804.69], [2025, 5050922925047.05]
    ],
    inflation: [
      [2011, 2.07517283735874], [2012, 2.00848884782956], [2013, 1.50472330251876],
      [2014, 0.906794000434246], [2015, 0.514426137125456], [2016, 0.491747008445174],
      [2017, 1.50949485109628], [2018, 1.73216879766942], [2019, 1.44565976888253],
      [2020, 0.144877925813982], [2021, 3.06666666666673], [2022, 6.87257438551097],
      [2023, 5.94643667725823], [2024, 2.2564981433876], [2025, 2.17178770949721]
    ]
  },
  FR: {
    gdp: [
      [2011, 2870408553990.28], [2012, 2683007095787.23], [2013, 2816077607875.26],
      [2014, 2861236112552.42], [2015, 2442483452642.5], [2016, 2470407619777.13],
      [2017, 2588868323334.71], [2018, 2781576320884.39], [2019, 2722793515171.76],
      [2020, 2647926055110.05], [2021, 2966433692008.09], [2022, 2794788137066.94],
      [2023, 3056250648138.29], [2024, 3160442622465.08], [2025, 3366315927447.33]
    ],
    inflation: [
      [2011, 2.11159795175], [2012, 1.9541953161351], [2013, 0.863715497861804],
      [2014, 0.50775882293799], [2015, 0.0375143805125182], [2016, 0.183334861123765],
      [2017, 1.03228275064681], [2018, 1.85081508315493], [2019, 1.10825492288294],
      [2020, 0.476498852725065], [2021, 1.64233141038394], [2022, 5.22236748369725],
      [2023, 4.8783572650844], [2024, 1.99904942291463], [2025, 0.943770212469976]
    ]
  },
  KR: {
    gdp: [
      [2011, 1307103477219.1], [2012, 1335343586437.67], [2013, 1434669686501.84],
      [2014, 1556252422020.44], [2015, 1539212301135.55], [2016, 1579150518945.44],
      [2017, 1710196756713.17], [2018, 1824251454306.83], [2019, 1751045752054.63],
      [2020, 1744070276373.34], [2021, 1942313560965.9], [2022, 1799363116866.52],
      [2023, 1844800934391.54], [2024, 1875388209406.8], [2025, 1872374961553.15]
    ],
    inflation: [
      [2011, 4.0259650043609], [2012, 2.18707104433314], [2013, 1.30134754547413],
      [2014, 1.27477446401322], [2015, 0.70633177245575], [2016, 0.971685739912168],
      [2017, 1.94433230786366], [2018, 1.47583935002645], [2019, 0.383000303608136],
      [2020, 0.537288023411737], [2021, 2.49833333333339], [2022, 5.08951365062842],
      [2023, 3.5974562502901], [2024, 2.32174328643542], [2025, 2.12309421458659]
    ]
  },
  MX: {
    gdp: [
      [2011, 1229013703416.76], [2012, 1255110424741.85], [2013, 1327436290439.27],
      [2014, 1364507717689.36], [2015, 1213294467653.78], [2016, 1112233497452.7],
      [2017, 1190721475853.16], [2018, 1256300182983.65], [2019, 1304106204006.27],
      [2020, 1121064767168.8], [2021, 1316569466833.94], [2022, 1466934724243.38],
      [2023, 1794410347718.25], [2024, 1830489311088.89], [2025, 1832641364775.52]
    ],
    inflation: [
      [2011, 3.40737824605742], [2012, 4.11150981070289], [2013, 3.80639069747204],
      [2014, 4.01861608078679], [2015, 2.72064064964023], [2016, 2.8217078474766],
      [2017, 6.04145724018986], [2018, 4.89935015356551], [2019, 3.63596142127046],
      [2020, 3.39683415570006], [2021, 5.68920847683753], [2022, 7.8962761916855],
      [2023, 5.52796087314389], [2024, 4.72225588452932], [2025, 3.80668650726485]
    ]
  }
};

function buildSeries(country, id, values) {
  const isGdp = id === 'gdp';
  const metricId = isGdp ? 'economy.gdp_current_usd' : 'economy.inflation_cpi';
  const sourceSeries = isGdp ? 'NY.GDP.MKTP.CD' : 'FP.CPI.TOTL.ZG';
  const seriesId = `${country.entityId}/${metricId}`;
  const unit = isGdp ? 'USD' : '%';
  return {
    id: seriesId,
    entity_id: country.entityId,
    metric_id: metricId,
    unit,
    frequency: 'annual',
    source: SOURCE_REGISTRY.worldbank.name,
    source_series: sourceSeries,
    source_url: SOURCE_REGISTRY.worldbank.url,
    usage_note: SOURCE_REGISTRY.worldbank.usageNote,
    points: values.map(([year, value]) => ({
      entity_id: country.entityId,
      metric_id: metricId,
      series_id: seriesId,
      observed_at: `${year}-12-31`,
      value,
      unit,
      frequency: 'annual',
      status: 'latest_official',
      source: SOURCE_REGISTRY.worldbank.name,
      source_series: sourceSeries,
      source_url: SOURCE_REGISTRY.worldbank.url,
      fetched_at: FETCHED_AT,
      usage_note: SOURCE_REGISTRY.worldbank.usageNote
    }))
  };
}

const snapshot = JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf8'));
const replacementIds = new Set();
const additions = [];

for (const [countryId, metrics] of Object.entries(OBSERVATIONS)) {
  const country = COUNTRIES.find((entry) => entry.id === countryId);
  if (!country) throw new Error(`Country ${countryId} is not configured`);
  for (const [metricId, values] of Object.entries(metrics)) {
    if (values.length < 10 || values.some(([, value]) => !Number.isFinite(value))) {
      throw new Error(`Country ${countryId} ${metricId} has no usable official history`);
    }
    const series = buildSeries(country, metricId, values);
    replacementIds.add(series.id);
    additions.push(series);
  }
}

snapshot.generated_at = FETCHED_AT;
snapshot.countries = COUNTRIES;
snapshot.series = (snapshot.series || []).filter((series) => !replacementIds.has(series.id)).concat(additions)
  .sort((left, right) => left.id.localeCompare(right.id));
snapshot.records = latestRecords(snapshot.series);
const worldBankCount = snapshot.series.filter((series) => series.source === SOURCE_REGISTRY.worldbank.name)
  .reduce((total, series) => total + series.points.length, 0);
snapshot.source_status = Object.assign({}, snapshot.source_status, {
  worldbank: Object.assign({}, snapshot.source_status?.worldbank, {
    ok: true,
    source_name: SOURCE_REGISTRY.worldbank.name,
    count: worldBankCount,
    checked_at: FETCHED_AT,
    last_successful_fetch: FETCHED_AT
  })
});
delete snapshot.source_status.worldbank.elapsed_ms;

await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Updated ${SNAPSHOT_PATH} with ${additions.length} official World series across ${COUNTRIES.length} contexts.`);
