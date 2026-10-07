(function (global) {
  'use strict';

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function conditionPhase(value) {
    const phase = String(value || 'unknown').toLowerCase();
    return ['day', 'night', 'polartwilight'].includes(phase) ? phase : 'unknown';
  }

  function conditionIcon(condition) {
    const code = String(condition && condition.code || 'unknown');
    const phase = conditionPhase(condition && condition.phase);
    if (code === 'clear') {
      if (phase === 'day') return '☀';
      if (phase === 'night') return '☾';
      if (phase === 'polartwilight') return '◒';
      return '○';
    }
    if (code === 'mostly_clear') {
      if (phase === 'day') return '◒';
      if (phase === 'night') return '◑';
      return '◐';
    }
    if (code === 'partly_cloudy') return phase === 'night' ? '◑' : '◐';
    if (code === 'cloudy') return '☁';
    if (code === 'fog') return '≋';
    if (code.includes('rain') || code === 'sleet') return '☂';
    if (code.includes('snow')) return '❄';
    if (code === 'thunder') return 'ϟ';
    return '◇';
  }

  function semanticState(payload, loading, hasSavedData) {
    if (loading) return 'updating';
    if (!payload || !payload.current) return 'unavailable';
    const freshness = String(payload.freshness && payload.freshness.state || '');
    const check = String(payload.check && payload.check.status || '');
    if (freshness === 'stale' || check === 'failed') return 'stale';
    if (freshness === 'fresh' || freshness === 'cached') return 'up_to_date';
    return hasSavedData ? 'saved_data' : 'unavailable';
  }

  function next24Points(hourly) {
    return (Array.isArray(hourly) ? hourly : []).filter(function (point) {
      return point && Number.isFinite(Date.parse(String(point.forecast_time || '')));
    }).slice(0, 24);
  }

  function next24TemperatureRange(hourly) {
    const values = next24Points(hourly).map(function (point) { return finite(point.temperature_c); }).filter(function (value) { return value !== null; });
    if (!values.length) return null;
    return { min_c: Math.min.apply(Math, values), max_c: Math.max.apply(Math, values), point_count: values.length };
  }

  function precipitationSummary(hourly) {
    const points = next24Points(hourly);
    if (!points.length) return null;
    const known = points.filter(function (point) { return finite(point.precipitation_1h_mm) !== null; });
    const wet = known.filter(function (point) { return finite(point.precipitation_1h_mm) > 0; });
    if (wet.length) {
      return {
        kind: 'upcoming',
        first_time: wet[0].forecast_time,
        total_mm: wet.reduce(function (sum, point) { return sum + finite(point.precipitation_1h_mm); }, 0),
        known_count: known.length
      };
    }
    if (known.length === points.length && known.length >= 6) {
      return { kind: 'none', total_mm: 0, known_count: known.length };
    }
    return null;
  }

  function dateKey(value, timeZone) {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || undefined,
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date(timestamp));
      const get = function (type) { return parts.find(function (part) { return part.type === type; })?.value || ''; };
      return [get('year'), get('month'), get('day')].join('-');
    } catch (error) {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }

  global.IRGEZTNEWeatherViewModelV1 = Object.freeze({
    finite: finite,
    conditionPhase: conditionPhase,
    conditionIcon: conditionIcon,
    semanticState: semanticState,
    next24Points: next24Points,
    next24TemperatureRange: next24TemperatureRange,
    precipitationSummary: precipitationSummary,
    dateKey: dateKey
  });
})(window);
