(function () {
  'use strict';

  const stateByRoot = new WeakMap();
  const DAY = 24 * 60 * 60 * 1000;
  const SELECTION_STATE_KEY = 'irgeztne.economy.selection.v1';
  const EURO_AREA_REGIONS = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
    'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'
  ]);
  const REGION_MARKET_CURRENCY = {
    US: 'USD', GB: 'GBP', JP: 'JPY', CH: 'CHF', TR: 'TRY',
    CA: 'CAD', AU: 'AUD', BR: 'BRL', CN: 'CNY', IN: 'INR'
  };
  const palette = {
    gdp: '#e4ad52',
    inflation: '#dc7a8b',
    policy_rate: '#a58af5',
    eur_fx: '#40bea9',
    market: '#e6a45d',
    default: '#76a8ec'
  };
  const marketPalette = ['#e6a45d', '#45bfa9', '#b28cf2', '#df7f9c', '#72b8d4', '#c4aa55'];
  const dictionary = {
    ru: {
      title: 'Экономика', world: 'Мир', markets: 'Рынки', country: 'Страна', instrument: 'Инструмент',
      open: 'Открыть полностью', refresh: 'Обновить официальные данные', noData: 'Подтверждённый ряд пока недоступен',
      source: 'Источник', observed: 'Наблюдение', updated: 'Обновлено', official: 'Официальные данные',
      cached: 'Локальный кэш', stale: 'Кэш · источник недоступен', unavailable: 'Нет данных', sourceUnavailable: 'Источник недоступен',
      delayed: 'Задержано источником', success: 'Данные обновлены', loading: 'Обновляем…', error: 'Ошибка данных',
      gdp: 'ВВП', inflation: 'Инфляция', policy_rate: 'Ключевая ставка', eur_fx: 'Валютный курс',
      notLive: 'Официальные reference rates ECB — не live-биржевые котировки.',
      localCore: 'Официальные исторические данные', latest: 'Последнее', previous: 'к предыдущему',
      max: 'MAX', pointHint: 'Проведите по графику, чтобы исследовать наблюдения', cachedPreserved: 'Предыдущий подтверждённый график сохранён',
      percentPoint: 'п.п.'
    },
    en: {
      title: 'Economy', world: 'World', markets: 'Markets', country: 'Country', instrument: 'Instrument',
      open: 'Open full view', refresh: 'Refresh official data', noData: 'No confirmed series is available yet',
      source: 'Source', observed: 'Observation', updated: 'Updated', official: 'Official data',
      cached: 'Local cache', stale: 'Cached · source unavailable', unavailable: 'Unavailable', sourceUnavailable: 'Source unavailable',
      delayed: 'Delayed by source', success: 'Data refreshed', loading: 'Refreshing…', error: 'Data error',
      gdp: 'GDP', inflation: 'Inflation', policy_rate: 'Policy rate', eur_fx: 'Currency rate',
      notLive: 'Official ECB reference rates — not live tradable quotes.',
      localCore: 'Official historical data', latest: 'Latest', previous: 'vs previous',
      max: 'MAX', pointHint: 'Move across the chart to inspect real observations', cachedPreserved: 'Previous confirmed chart is preserved',
      percentPoint: 'pp'
    }
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  function locale(options) {
    const explicit = options?.locale;
    if (explicit === 'en' || explicit === 'ru') return explicit;
    return (document.documentElement.lang || '').toLowerCase().startsWith('en') ? 'en' : 'ru';
  }

  function normalizeLocale(value) {
    return String(value || '').trim().replace(/_/g, '-').replace(/[.@].*$/, '');
  }

  function systemRegion(options) {
    const candidates = [];
    const hasExplicitLocale = options && Object.prototype.hasOwnProperty.call(options, 'systemLocale');
    if (hasExplicitLocale) {
      candidates.push(options.systemLocale);
    } else {
      const browserLocales = window.navigator?.languages;
      if (Array.isArray(browserLocales)) candidates.push.apply(candidates, browserLocales);
      if (window.navigator?.language) candidates.push(window.navigator.language);
      try { candidates.push(Intl.DateTimeFormat().resolvedOptions().locale); } catch (error) {}
    }

    for (const candidate of candidates) {
      const normalized = normalizeLocale(candidate);
      if (!normalized) continue;
      try {
        const region = new Intl.Locale(normalized).region;
        if (region) return String(region).toUpperCase();
      } catch (error) {
        const parts = normalized.split('-').slice(1);
        const region = parts.find(function (part) { return /^[A-Za-z]{2}$/.test(part) || /^\d{3}$/.test(part); });
        if (region) return region.toUpperCase();
      }
    }
    return '';
  }

  function supportedCountryIds() {
    const countries = window.IRGEZTNEEconomyDataCoreV1?.countries?.() || [];
    return countries.map(function (country) { return String(country?.id || '').toUpperCase(); }).filter(Boolean);
  }

  function canonicalCountryId(ids) {
    const supported = Array.isArray(ids) ? ids : supportedCountryIds();
    return supported.includes('US') ? 'US' : (supported[0] || 'US');
  }

  function supportedCountryId(value, ids) {
    const id = String(value || '').toUpperCase();
    return (ids || supportedCountryIds()).includes(id) ? id : '';
  }

  function localeCountryId(options, ids) {
    const supported = Array.isArray(ids) ? ids : supportedCountryIds();
    const region = systemRegion(options);
    if (supported.includes(region)) return region;
    if (EURO_AREA_REGIONS.has(region) && supported.includes('XM')) return 'XM';
    return canonicalCountryId(supported);
  }

  function readSelectionState() {
    try {
      const api = window.nsAPI;
      if (!api || typeof api.storageGetModuleStateSync !== 'function') return {};
      const value = api.storageGetModuleStateSync(SELECTION_STATE_KEY, {});
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      return {};
    }
  }

  function writeSelectionState(patch) {
    try {
      const api = window.nsAPI;
      if (!api || typeof api.storageSetModuleStateSync !== 'function') return false;
      const current = readSelectionState();
      const next = Object.assign({}, current, patch || {}, {
        schemaVersion: 1,
        updatedAt: new Date().toISOString()
      });
      api.storageSetModuleStateSync(SELECTION_STATE_KEY, next);
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveInitialCountry(options, savedSelection) {
    const supported = supportedCountryIds();
    return supportedCountryId(savedSelection?.countryId, supported)
      || supportedCountryId(options?.initialCountry, supported)
      || localeCountryId(options, supported);
  }

  function instrumentIds(payload) {
    const list = payload?.market_instruments || payload?.tabs?.markets?.instruments || [];
    return list.filter(function (instrument) {
      return instrument.available !== false && instrument.value != null && validPoints(instrument.series?.points).length >= 2;
    }).map(function (instrument) { return String(instrument.id || ''); }).filter(Boolean);
  }

  function localeInstrumentId(options, payload) {
    const currency = REGION_MARKET_CURRENCY[systemRegion(options)];
    if (!currency) return '';
    const list = payload?.market_instruments || payload?.tabs?.markets?.instruments || [];
    const instrument = list.find(function (entry) {
      const label = String(entry?.label || '').toUpperCase();
      const id = String(entry?.id || '').toUpperCase();
      return label === `EUR/${currency}` || id.includes(`EUR_${currency}/`);
    });
    return instrument?.id || '';
  }

  function resolveInitialInstrument(options, savedSelection, payload) {
    const available = instrumentIds(payload);
    const valid = function (value) { return available.includes(String(value || '')) ? String(value) : ''; };
    const preferred = payload?.tabs?.markets?.default_instrument_id;
    return valid(savedSelection?.instrumentId)
      || valid(options?.initialInstrument)
      || valid(localeInstrumentId(options, payload))
      || valid(preferred)
      || valid('fx.EUR_USD/market.reference_rate')
      || available[0]
      || null;
  }

  function metricIds(payload) {
    return (payload?.metrics || []).filter(function (metric) {
      return metric.available !== false && metric.value != null && validPoints(metric.series?.points).length >= 2;
    }).map(function (metric) { return String(metric.id || ''); }).filter(Boolean);
  }

  function resolveInitialMetric(options, savedSelection, payload) {
    const available = metricIds(payload);
    const valid = function (value) { return available.includes(String(value || '')) ? String(value) : ''; };
    return valid(options?.initialMetric)
      || valid(savedSelection?.metricId)
      || valid('gdp')
      || valid(payload?.tabs?.world?.default_metric_id)
      || available[0]
      || null;
  }

  function text(state, key) {
    return dictionary[state.locale][key] || key;
  }

  function countryName(country, lang) {
    return country?.name?.[lang] || country?.name?.ru || country?.name?.en || country?.id || '';
  }

  function numberFormatter(lang, options) {
    return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', options);
  }

  function formatValue(valueOrMetric, lang, metricId, unit) {
    const source = typeof valueOrMetric === 'object' && valueOrMetric !== null ? valueOrMetric : { value: valueOrMetric, id: metricId, unit };
    if (source.value == null || source.value === '') return '—';
    const value = Number(source.value);
    if (!Number.isFinite(value)) return '—';
    const id = source.id || metricId;
    const resolvedUnit = source.unit || unit || '';
    if (id === 'gdp' || id === 'economy.gdp_current_usd') {
      const absolute = Math.abs(value);
      if (absolute >= 1e12) {
        const trillion = value / 1e12;
        const digits = Math.abs(trillion) >= 100 ? 0 : (Math.abs(trillion) >= 10 ? 1 : 2);
        return numberFormatter(lang, { maximumFractionDigits: digits }).format(trillion) + (lang === 'en' ? ' tn USD' : ' трлн $');
      }
      const billion = value / 1e9;
      const digits = Math.abs(billion) >= 100 ? 0 : (Math.abs(billion) >= 10 ? 1 : 2);
      return numberFormatter(lang, { maximumFractionDigits: digits }).format(billion) + (lang === 'en' ? ' bn USD' : ' млрд $');
    }
    if (resolvedUnit === '%') return numberFormatter(lang, { maximumFractionDigits: 2 }).format(value) + '%';
    return numberFormatter(lang, { maximumFractionDigits: Math.abs(value) < 100 ? 4 : 2 }).format(value) + (resolvedUnit ? ` ${resolvedUnit}` : '');
  }

  function parseDate(value) {
    const date = new Date(String(value || '').length === 7 ? `${value}-01T00:00:00Z` : value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function shortDate(value, lang, frequency) {
    const date = parseDate(value);
    if (!date) return value || '—';
    let options = { day: '2-digit', month: 'short', year: 'numeric' };
    if (frequency === 'annual') options = { year: 'numeric' };
    else if (String(frequency || '').startsWith('monthly')) options = { month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', options).format(date);
  }

  function fetchedDate(value, lang) {
    const date = parseDate(value);
    if (!date) return '—';
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ru-RU', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function rangeOptions(frequency) {
    if (frequency === 'annual') return [
      { id: '5Y', amount: 5, unit: 'year' }, { id: '10Y', amount: 10, unit: 'year' }, { id: 'MAX' }
    ];
    if (String(frequency || '').startsWith('monthly')) return [
      { id: '1Y', amount: 1, unit: 'year' }, { id: '3Y', amount: 3, unit: 'year' }, { id: '5Y', amount: 5, unit: 'year' }, { id: 'MAX' }
    ];
    return [
      { id: '1M', amount: 1, unit: 'month' }, { id: '3M', amount: 3, unit: 'month' },
      { id: '1Y', amount: 1, unit: 'year' }, { id: '5Y', amount: 5, unit: 'year' }, { id: 'MAX' }
    ];
  }

  function defaultRange(frequency) {
    if (frequency === 'annual') return '10Y';
    if (String(frequency || '').startsWith('monthly')) return '3Y';
    return '1Y';
  }

  function validPoints(points) {
    return (points || []).filter(function (point) {
      return point && point.observed_at && point.value != null && Number.isFinite(Number(point.value)) && parseDate(point.observed_at);
    }).slice().sort(function (left, right) { return String(left.observed_at).localeCompare(String(right.observed_at)); });
  }

  function filterPointsByRange(points, rangeId, frequency) {
    const clean = validPoints(points);
    if (rangeId === 'MAX' || clean.length < 2) return clean;
    const option = rangeOptions(frequency).find(function (entry) { return entry.id === rangeId; });
    const latest = parseDate(clean[clean.length - 1]?.observed_at);
    if (!option || !latest) return clean;
    const cutoff = new Date(latest.getTime());
    if (option.unit === 'month') cutoff.setUTCMonth(cutoff.getUTCMonth() - option.amount);
    else cutoff.setUTCFullYear(cutoff.getUTCFullYear() - option.amount);
    return clean.filter(function (point) { return parseDate(point.observed_at).getTime() >= cutoff.getTime(); });
  }

  function segmentPoints(points, frequency) {
    const clean = validPoints(points);
    const threshold = frequency === 'annual' ? 550 * DAY : (String(frequency || '').startsWith('monthly') ? 70 * DAY : 8 * DAY);
    const segments = [];
    let current = [];
    clean.forEach(function (point) {
      const prior = current[current.length - 1];
      if (prior && parseDate(point.observed_at).getTime() - parseDate(prior.observed_at).getTime() > threshold) {
        if (current.length) segments.push(current);
        current = [];
      }
      current.push(point);
    });
    if (current.length) segments.push(current);
    return segments;
  }

  function nearestPointIndex(points, xValue) {
    if (!points?.length) return -1;
    let best = 0;
    let distance = Infinity;
    points.forEach(function (point, index) {
      const next = Math.abs(Number(point.x) - Number(xValue));
      if (next < distance) { distance = next; best = index; }
    });
    return best;
  }

  function availableMetrics(state) {
    return (state.payload?.metrics || []).filter(function (metric) {
      return metric.available !== false && metric.value != null && validPoints(metric.series?.points).length >= 2;
    });
  }

  function availableInstruments(state) {
    const list = state.payload?.market_instruments || state.payload?.tabs?.markets?.instruments || [];
    return list.filter(function (instrument) {
      return instrument.available !== false && instrument.value != null && validPoints(instrument.series?.points).length >= 2;
    });
  }

  function ensureSelection(state) {
    const metrics = availableMetrics(state);
    if (!metrics.some(function (metric) { return metric.id === state.metricId; })) {
      const preferred = state.payload?.tabs?.world?.default_metric_id;
      state.metricId = metrics.find(function (metric) { return metric.id === 'gdp'; })?.id
        || metrics.find(function (metric) { return metric.id === preferred; })?.id
        || metrics[0]?.id
        || null;
      if (state.metricId) writeSelectionState({ metricId: state.metricId });
    }
    const instruments = availableInstruments(state);
    if (!instruments.some(function (instrument) { return instrument.id === state.instrumentId; })) {
      const preferred = state.payload?.tabs?.markets?.default_instrument_id;
      state.instrumentId = instruments.find(function (instrument) { return instrument.id === preferred; })?.id || instruments[0]?.id || null;
    }
  }

  function selectedItem(state) {
    ensureSelection(state);
    return state.tab === 'markets'
      ? availableInstruments(state).find(function (instrument) { return instrument.id === state.instrumentId; }) || null
      : availableMetrics(state).find(function (metric) { return metric.id === state.metricId; }) || null;
  }

  function selectedSeries(state) {
    return selectedItem(state)?.series || null;
  }

  function itemLabel(state, item) {
    if (!item) return text(state, 'unavailable');
    if (state.tab === 'markets') return item.label || String(item.entity_id || '').replace(/^fx\./, '').replace('_', '/');
    if (item.id === 'eur_fx') return `EUR / ${state.payload?.country?.currency || item.unit || ''}`;
    return text(state, item.id);
  }

  function itemAccent(state, item) {
    if (state.tab === 'markets') {
      const index = Math.max(0, availableInstruments(state).findIndex(function (entry) { return entry.id === item?.id; }));
      return marketPalette[index % marketPalette.length];
    }
    return palette[item?.id] || palette.default;
  }

  function changeData(item) {
    if (!item || item.value == null || item.previous_value == null) return null;
    const value = Number(item.value);
    const previous = Number(item.previous_value);
    if (!Number.isFinite(value) || !Number.isFinite(previous)) return null;
    const absolute = value - previous;
    const percent = previous === 0 ? null : absolute / Math.abs(previous) * 100;
    return { absolute, percent, direction: absolute > 0 ? 'up' : (absolute < 0 ? 'down' : 'neutral') };
  }

  function changeLabel(state, item, marketMode) {
    const change = changeData(item);
    if (!change) return '';
    const arrow = change.direction === 'up' ? '↑' : (change.direction === 'down' ? '↓' : '→');
    const sign = change.absolute > 0 ? '+' : (change.absolute < 0 ? '−' : '');
    let value;
    if (item.id === 'gdp' || marketMode) {
      value = change.percent == null ? formatValue(Math.abs(change.absolute), state.locale, item.id, item.unit) : numberFormatter(state.locale, { maximumFractionDigits: 2 }).format(Math.abs(change.percent)) + '%';
    } else if (item.unit === '%') {
      value = numberFormatter(state.locale, { maximumFractionDigits: 2 }).format(Math.abs(change.absolute)) + ' ' + text(state, 'percentPoint');
    } else {
      value = numberFormatter(state.locale, { maximumFractionDigits: 4 }).format(Math.abs(change.absolute));
    }
    return `${arrow} ${sign}${value}`;
  }

  function sourceKey(series) {
    if (/World Bank/i.test(series?.source || '')) return 'worldbank';
    if (/International Settlements|BIS/i.test(series?.source || '')) return 'bis';
    if (/European Central Bank|ECB/i.test(series?.source || '')) return 'ecb';
    return '';
  }

  function effectiveStatus(state, series) {
    if (state.requestState === 'stale') return 'stale';
    if (state.requestState === 'error') return 'error';
    if (state.requestState === 'cached') return 'cached';
    const points = validPoints(series?.points);
    if (!series || !points.length) return 'unavailable';
    const source = state.payload?.source_status?.[sourceKey(series)];
    if (source && source.ok === false) return 'stale';
    const status = points[points.length - 1]?.status;
    if (status === 'cached') return 'cached';
    if (status === 'source_unavailable') return 'stale';
    if (status === 'delayed') return 'delayed';
    return 'official';
  }

  function statusLabel(state, status) {
    if (status === 'loading') return text(state, 'loading');
    if (status === 'success') return text(state, 'success');
    if (status === 'cached') return text(state, 'cached');
    if (status === 'stale') return text(state, 'stale');
    if (status === 'delayed') return text(state, 'delayed');
    if (status === 'error') return text(state, 'error');
    if (status === 'unavailable') return text(state, 'unavailable');
    return text(state, 'official');
  }

  function rangeForSeries(state, series) {
    if (!series?.id) return 'MAX';
    if (!state.rangeBySeries[series.id]) state.rangeBySeries[series.id] = defaultRange(series.frequency);
    return state.rangeBySeries[series.id];
  }

  function chartModel(state, series) {
    const width = 640;
    const height = 232;
    let left = 76;
    const right = 17;
    const top = 19;
    const bottom = 35;
    const rangeId = rangeForSeries(state, series);
    const points = filterPointsByRange(series?.points, rangeId, series?.frequency);
    if (points.length < 2) return { width, height, points: [], segments: [], rangeId, series };

    const times = points.map(function (point) { return parseDate(point.observed_at).getTime(); });
    const values = points.map(function (point) { return Number(point.value); });
    let min = Math.min.apply(null, values);
    let max = Math.max.apply(null, values);
    if (min === max) { min -= Math.max(1, Math.abs(min) * .02); max += Math.max(1, Math.abs(max) * .02); }
    const pad = (max - min) * .08;
    min -= pad;
    max += pad;
    const axisMetricId = series?.metric_id === 'economy.gdp_current_usd' ? 'gdp' : series?.metric_id;
    const axisLabels = [max, (min + max) / 2, min].map(function (value) {
      return formatValue(value, state.locale, axisMetricId, series?.unit);
    });
    const longestAxisLabel = axisLabels.reduce(function (longest, label) {
      return Math.max(longest, String(label).length);
    }, 0);
    left = Math.min(150, Math.max(left, Math.ceil(20 + longestAxisLabel * 6.8)));
    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const x = function (time) { return left + ((time - minTime) / Math.max(1, maxTime - minTime)) * (width - left - right); };
    const y = function (value) { return top + ((max - value) / (max - min)) * (height - top - bottom); };
    const mapped = points.map(function (point, index) {
      return Object.assign({}, point, { x: x(times[index]), y: y(values[index]) });
    });
    const segmentSets = segmentPoints(points, series?.frequency);
    const byDate = new Map(mapped.map(function (point) { return [point.observed_at, point]; }));
    const segments = segmentSets.map(function (segment) { return segment.map(function (point) { return byDate.get(point.observed_at); }); });
    return { width, height, left, right, top, bottom, min, max, points: mapped, segments, rangeId, series };
  }

  function chartSvg(state, series) {
    const model = chartModel(state, series);
    if (model.points.length < 2) {
      return {
        model,
        html: `<div class="ir-economy-empty"><span>∿</span><strong>${esc(text(state, 'noData'))}</strong></div>`
      };
    }
    const axisMetricId = series?.metric_id === 'economy.gdp_current_usd' ? 'gdp' : series?.metric_id;
    const yTicks = [model.max, (model.min + model.max) / 2, model.min];
    const yLabels = yTicks.map(function (value, index) {
      const yy = model.top + index * ((model.height - model.top - model.bottom) / 2);
      return `<line x1="${model.left}" y1="${yy}" x2="${model.width - model.right}" y2="${yy}" class="ir-economy-gridline"/><text x="${model.left - 9}" y="${yy + 4}" text-anchor="end" class="ir-economy-axis-text">${esc(formatValue(value, state.locale, axisMetricId, series?.unit))}</text>`;
    }).join('');
    const indexes = Array.from(new Set([0, Math.floor((model.points.length - 1) / 2), model.points.length - 1]));
    const xLabels = indexes.map(function (index) {
      const point = model.points[index];
      const anchor = index === 0 ? 'start' : (index === model.points.length - 1 ? 'end' : 'middle');
      return `<text x="${point.x}" y="${model.height - 8}" text-anchor="${anchor}" class="ir-economy-axis-text">${esc(shortDate(point.observed_at, state.locale, series.frequency))}</text>`;
    }).join('');
    const paths = model.segments.filter(function (segment) { return segment.length > 1; }).map(function (segment) {
      const path = segment.map(function (point, index) { return `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`; }).join(' ');
      return `<path d="${path}" class="ir-economy-line"/>`;
    }).join('');
    const latest = model.points[model.points.length - 1];
    return {
      model,
      html: [
        `<svg class="ir-economy-chart-svg" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="${esc(itemLabel(state, selectedItem(state)))}">`,
        yLabels,
        paths,
        `<line x1="${latest.x}" y1="${model.top}" x2="${latest.x}" y2="${model.height - model.bottom}" class="ir-economy-latest-guide"/>`,
        `<circle cx="${latest.x}" cy="${latest.y}" r="4.5" class="ir-economy-last-point"/>`,
        '<line data-economy-crosshair hidden class="ir-economy-crosshair"/>',
        '<circle data-economy-active-point hidden r="6" class="ir-economy-active-point"/>',
        xLabels,
        `<rect data-economy-hit x="${model.left}" y="${model.top}" width="${model.width - model.left - model.right}" height="${model.height - model.top - model.bottom}" class="ir-economy-hit" tabindex="0" role="slider" aria-label="${esc(text(state, 'pointHint'))}"/>`,
        '</svg>',
        '<div class="ir-economy-tooltip" data-economy-tooltip hidden></div>'
      ].join('')
    };
  }

  function renderRangeControls(state, series) {
    if (!series) return '';
    const active = rangeForSeries(state, series);
    return `<div class="ir-economy-ranges" aria-label="History range">${rangeOptions(series.frequency).map(function (option) {
      const enough = filterPointsByRange(series.points, option.id, series.frequency).length >= 2;
      return `<button type="button" data-economy-range="${option.id}" class="${active === option.id ? 'is-active' : ''}" ${enough ? '' : 'disabled'}>${esc(option.id === 'MAX' ? text(state, 'max') : option.id)}</button>`;
    }).join('')}</div>`;
  }

  function renderMetricCards(state) {
    const metrics = availableMetrics(state);
    return metrics.map(function (metric) {
      const active = metric.id === state.metricId;
      const accent = palette[metric.id] || palette.default;
      const delta = changeLabel(state, metric, false);
      return [
        `<button type="button" class="ir-economy-metric ${active ? 'is-active' : ''}" data-economy-metric="${esc(metric.id)}" style="--metric-accent:${accent}" aria-pressed="${active}">`,
        `<span>${esc(itemLabel(state, metric))}</span>`,
        `<strong>${esc(formatValue(metric, state.locale))}</strong>`,
        '<small>',
        `<span>${esc(shortDate(metric.observed_at, state.locale, metric.series?.frequency))}</span>`,
        delta ? `<em>${esc(delta)}</em>` : '',
        '</small>',
        '</button>'
      ].join('');
    }).join('');
  }

  function sourceFooter(state, series) {
    const points = validPoints(series?.points);
    const last = points[points.length - 1] || null;
    const status = effectiveStatus(state, series);
    return [
      `<div class="ir-economy-source is-${esc(status)}">`,
      `<strong>${esc(series?.source || text(state, 'unavailable'))}</strong>`,
      `<span>${esc(text(state, 'observed'))} ${esc(shortDate(last?.observed_at, state.locale, series?.frequency))}</span>`,
      `<span>${esc(text(state, 'updated'))} ${esc(fetchedDate(last?.fetched_at, state.locale))}</span>`,
      `<em>${esc(statusLabel(state, status))}</em>`,
      '</div>'
    ].join('');
  }

  function render(root) {
    const state = stateByRoot.get(root);
    if (!state) return;
    ensureSelection(state);
    const payload = state.payload;
    const countries = window.IRGEZTNEEconomyDataCoreV1?.countries?.() || payload?.countries || [];
    const item = selectedItem(state);
    const series = selectedSeries(state);
    const accent = itemAccent(state, item);
    const chart = chartSvg(state, series);
    const delta = changeLabel(state, item, state.tab === 'markets');
    const seriesStatus = effectiveStatus(state, series);
    const status = state.loading ? 'loading' : (state.requestState === 'success' && seriesStatus === 'official' ? 'success' : seriesStatus);
    const instruments = availableInstruments(state);

    state.chartModel = chart.model;
    state.lockedPoint = false;
    root.className = `ir-economy-widget ir-economy-widget--${esc(state.mode)} ${state.loading ? 'is-loading' : ''}`;
    root.style.setProperty('--eco-accent', accent);
    root.dataset.dataState = status;
    root.innerHTML = [
      '<div class="ir-economy-head">',
      `  <div><span class="ir-economy-kicker">IRGEZTNE DATA</span><h3>${esc(text(state, 'title'))}</h3></div>`,
      '  <div class="ir-economy-head-actions">',
      `    <span class="ir-economy-state is-${esc(status)}">${esc(statusLabel(state, status))}</span>`,
      `    <button type="button" class="ir-economy-refresh" data-economy-refresh title="${esc(text(state, 'refresh'))}" aria-label="${esc(text(state, 'refresh'))}" ${state.loading ? 'disabled' : ''}>↻</button>`,
      '  </div>',
      '</div>',
      `<div class="ir-economy-tabs" role="tablist"><button type="button" data-economy-tab="world" class="${state.tab === 'world' ? 'is-active' : ''}" aria-selected="${state.tab === 'world'}">${esc(text(state, 'world'))}</button><button type="button" data-economy-tab="markets" class="${state.tab === 'markets' ? 'is-active' : ''}" aria-selected="${state.tab === 'markets'}">${esc(text(state, 'markets'))}</button></div>`,
      '<div class="ir-economy-context">',
      state.tab === 'world'
        ? `<label><span>${esc(text(state, 'country'))}</span><select data-economy-country>${countries.map(function (country) { return `<option value="${esc(country.id)}" ${country.id === state.countryId ? 'selected' : ''}>${esc(countryName(country, state.locale))}</option>`; }).join('')}</select></label>`
        : `<label><span>${esc(text(state, 'instrument'))}</span><select data-economy-instrument>${instruments.map(function (instrument) { return `<option value="${esc(instrument.id)}" ${instrument.id === state.instrumentId ? 'selected' : ''}>${esc(instrument.label)}</option>`; }).join('')}</select></label>`,
      '</div>',
      '<div class="ir-economy-series-head">',
      `  <div><span>${esc(itemLabel(state, item))}</span><small>${esc(text(state, 'latest'))} · ${esc(shortDate(item?.observed_at, state.locale, series?.frequency))}</small></div>`,
      `  <div class="ir-economy-series-value"><strong>${esc(formatValue(item || {}, state.locale))}</strong>${delta ? `<em class="${state.tab === 'markets' ? 'is-market ' : ''}is-${esc(changeData(item)?.direction || 'neutral')}">${esc(delta)}</em>` : ''}</div>`,
      '</div>',
      renderRangeControls(state, series),
      `<div class="ir-economy-chart">${chart.html}</div>`,
      `<p class="ir-economy-chart-hint">${esc(text(state, 'pointHint'))}</p>`,
      state.tab === 'world' ? `<div class="ir-economy-metrics">${renderMetricCards(state)}</div>` : `<p class="ir-economy-disclaimer">${esc(text(state, 'notLive'))}</p>`,
      sourceFooter(state, series),
      state.requestState === 'stale' ? `<p class="ir-economy-preserved">${esc(text(state, 'cachedPreserved'))}</p>` : '',
      `<div class="ir-economy-foot"><span>${esc(text(state, 'localCore'))}</span>${state.mode === 'standalone' ? '' : `<button type="button" data-economy-open>${esc(text(state, 'open'))} ↗</button>`}</div>`
    ].join('');
    bind(root);
  }

  function tooltipValue(state, point, series) {
    const id = series?.metric_id === 'economy.gdp_current_usd' ? 'gdp' : series?.metric_id;
    return formatValue(point?.value, state.locale, id, series?.unit);
  }

  function updateInteraction(root, index, lock) {
    const state = stateByRoot.get(root);
    const model = state?.chartModel;
    const point = model?.points?.[index];
    const crosshair = root.querySelector('[data-economy-crosshair]');
    const marker = root.querySelector('[data-economy-active-point]');
    const tooltip = root.querySelector('[data-economy-tooltip]');
    const hit = root.querySelector('[data-economy-hit]');
    if (!point || !crosshair || !marker || !tooltip) return;
    crosshair.hidden = false;
    crosshair.setAttribute('x1', point.x);
    crosshair.setAttribute('x2', point.x);
    crosshair.setAttribute('y1', model.top);
    crosshair.setAttribute('y2', model.height - model.bottom);
    marker.hidden = false;
    marker.setAttribute('cx', point.x);
    marker.setAttribute('cy', point.y);
    tooltip.hidden = false;
    tooltip.classList.toggle('is-right', point.x > model.width * .67);
    tooltip.style.left = `${point.x / model.width * 100}%`;
    tooltip.style.top = `${point.y / model.height * 100}%`;
    tooltip.innerHTML = `<strong>${esc(tooltipValue(state, point, model.series))}</strong><span>${esc(shortDate(point.observed_at, state.locale, model.series?.frequency))}</span><small>${esc(model.series?.unit || '')} · ${esc(model.series?.source || '—')}</small>`;
    if (hit) hit.setAttribute('aria-valuetext', `${shortDate(point.observed_at, state.locale, model.series?.frequency)} ${tooltipValue(state, point, model.series)}`);
    state.activePointIndex = index;
    if (lock === true) state.lockedPoint = true;
  }

  function hideInteraction(root) {
    const state = stateByRoot.get(root);
    if (state?.lockedPoint) return;
    root.querySelector('[data-economy-crosshair]')?.setAttribute('hidden', '');
    root.querySelector('[data-economy-active-point]')?.setAttribute('hidden', '');
    const tooltip = root.querySelector('[data-economy-tooltip]');
    if (tooltip) tooltip.hidden = true;
  }

  function interactionIndex(root, event) {
    const state = stateByRoot.get(root);
    const svg = root.querySelector('.ir-economy-chart-svg');
    if (!state?.chartModel?.points?.length || !svg) return -1;
    const rect = svg.getBoundingClientRect();
    const x = (Number(event.clientX) - rect.left) / Math.max(1, rect.width) * state.chartModel.width;
    return nearestPointIndex(state.chartModel.points, x);
  }

  async function load(root, settings) {
    const state = stateByRoot.get(root);
    if (!state || state.loading) return;
    const requestId = ++state.requestId;
    state.loading = true;
    state.requestState = 'loading';
    render(root);
    const core = window.IRGEZTNEEconomyDataCoreV1;
    const result = core?.getWidgetResult
      ? await core.getWidgetResult(state.countryId, { mode: state.mode, refreshSources: settings?.refreshSources === true })
      : { payload: await core?.getWidget?.(state.countryId, { mode: state.mode }), state: 'official', error: null };
    if (!stateByRoot.has(root) || requestId !== state.requestId) return;
    if (result?.payload) state.payload = result.payload;
    state.requestState = result?.state || (result?.payload ? 'official' : 'error');
    state.lastError = result?.error || null;
    state.loading = false;
    render(root);
  }

  function bind(root) {
    const state = stateByRoot.get(root);
    root.querySelector('[data-economy-country]')?.addEventListener('change', function (event) {
      const nextCountry = supportedCountryId(event.target.value);
      if (!nextCountry) return;
      state.countryId = nextCountry;
      writeSelectionState({ countryId: nextCountry });
      load(root, { refreshSources: false });
    });
    root.querySelector('[data-economy-instrument]')?.addEventListener('change', function (event) {
      const nextInstrument = String(event.target.value || '');
      if (!instrumentIds(state.payload).includes(nextInstrument)) return;
      state.instrumentId = nextInstrument;
      writeSelectionState({ instrumentId: nextInstrument });
      render(root);
    });
    root.querySelectorAll('[data-economy-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.tab = button.dataset.economyTab;
        render(root);
      });
    });
    root.querySelectorAll('[data-economy-metric]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.metricId = button.dataset.economyMetric;
        writeSelectionState({ metricId: state.metricId });
        render(root);
      });
    });
    root.querySelectorAll('[data-economy-range]').forEach(function (button) {
      button.addEventListener('click', function () {
        const series = selectedSeries(state);
        if (series?.id) state.rangeBySeries[series.id] = button.dataset.economyRange;
        render(root);
      });
    });
    root.querySelector('[data-economy-refresh]')?.addEventListener('click', function () {
      load(root, { refreshSources: true });
    });
    root.querySelector('[data-economy-open]')?.addEventListener('click', function () {
      const detail = {
        country: state.countryId,
        tab: state.tab,
        metric: state.metricId,
        instrument: state.instrumentId,
        range: rangeForSeries(state, selectedSeries(state))
      };
      if (typeof state.onOpenFull === 'function') state.onOpenFull(state.countryId, detail);
      else window.dispatchEvent(new CustomEvent('irg:economy-open-full', { detail }));
    });

    const hit = root.querySelector('[data-economy-hit]');
    if (hit) {
      hit.addEventListener('pointermove', function (event) { updateInteraction(root, interactionIndex(root, event), false); });
      hit.addEventListener('pointerdown', function (event) {
        updateInteraction(root, interactionIndex(root, event), true);
        if (event.pointerType === 'touch') event.preventDefault();
      });
      hit.addEventListener('click', function (event) { updateInteraction(root, interactionIndex(root, event), true); });
      hit.addEventListener('pointerleave', function () { hideInteraction(root); });
      hit.addEventListener('keydown', function (event) {
        const max = state.chartModel?.points?.length - 1;
        if (max < 0) return;
        let next = Number.isInteger(state.activePointIndex) ? state.activePointIndex : max;
        if (event.key === 'ArrowLeft') next = Math.max(0, next - 1);
        else if (event.key === 'ArrowRight') next = Math.min(max, next + 1);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = max;
        else if (event.key === 'Escape') { state.lockedPoint = false; hideInteraction(root); return; }
        else return;
        event.preventDefault();
        updateInteraction(root, next, true);
      });
    }
  }

  function mount(root, options) {
    if (!root) return null;
    const settings = options || {};
    const savedSelection = readSelectionState();
    const countryId = resolveInitialCountry(settings, savedSelection);
    const payload = window.IRGEZTNEEconomyDataCoreV1?.bundled?.(countryId) || null;
    const state = {
      mode: settings.mode || 'compact',
      locale: locale(settings),
      countryId,
      tab: settings.initialTab === 'markets' ? 'markets' : 'world',
      metricId: resolveInitialMetric(settings, savedSelection, payload),
      instrumentId: resolveInitialInstrument(settings, savedSelection, payload),
      payload,
      onOpenFull: settings.onOpenFull || null,
      rangeBySeries: {},
      requestState: 'cached',
      requestId: 0,
      loading: false,
      lockedPoint: false,
      activePointIndex: null
    };
    stateByRoot.set(root, state);
    ensureSelection(state);
    const initialSeries = selectedSeries(state);
    if (settings.initialRange && initialSeries?.id) state.rangeBySeries[initialSeries.id] = settings.initialRange;
    render(root);
    load(root, { refreshSources: false });
    return {
      setLocale: function (nextLocale) { state.locale = nextLocale === 'en' ? 'en' : 'ru'; render(root); },
      setCountry: function (nextCountry) {
        const country = supportedCountryId(nextCountry);
        if (!country) return false;
        state.countryId = country;
        writeSelectionState({ countryId: country });
        load(root, { refreshSources: false });
        return true;
      },
      setMetric: function (nextMetric) {
        const metric = String(nextMetric || '');
        if (!metricIds(state.payload).includes(metric)) return false;
        state.metricId = metric;
        writeSelectionState({ metricId: metric });
        render(root);
        return true;
      },
      refresh: function () { return load(root, { refreshSources: true }); },
      destroy: function () { stateByRoot.delete(root); root.innerHTML = ''; }
    };
  }

  window.IRGEZTNEEconomyWidgetCoreV1 = {
    mount,
    __test: {
      rangeOptions, filterPointsByRange, segmentPoints, nearestPointIndex, formatValue, changeData,
      systemRegion, localeCountryId, resolveInitialCountry, localeInstrumentId, resolveInitialInstrument, resolveInitialMetric,
      metricIds, effectiveStatus, itemAccent,
      readSelectionState, writeSelectionState, selectionStateKey: SELECTION_STATE_KEY
    }
  };
})();
