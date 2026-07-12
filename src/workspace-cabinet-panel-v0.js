(function () {
  'use strict';

  const NOTE_KEY = 'irgeztne.workspace.quickNote.v0';
  const WEATHER_SETTINGS_KEY = 'irgeztne.workspace.weather.v041';
  const WEATHER_CACHE_KEY = 'irgeztne.workspace.weather.cache.v041';
  const WEATHER_CACHE_MAX_AGE = 1000 * 60 * 30;
  const DEFAULT_WEATHER_PLACE = { cityRu: 'Баку', cityEn: 'Baku', latitude: 40.4093, longitude: 49.8671 };
  /* IRGEZTNE_WORKSPACE_WEATHER_V041 */
  let calendarViewDate = new Date();

  function getLang() {
    const workspaceToggle = document.querySelector('#workspaceToggle .workspace-toggle-text, #workspaceToggle');
    const workspaceText = (workspaceToggle && workspaceToggle.textContent || '').trim().toLowerCase();
    if (workspaceText.includes('пространство')) return 'ru';
    if (workspaceText.includes('workspace')) return 'en';

    const railText = (document.querySelector('.workspace-rail, .left-workspace-nav, .workspace-left-nav') || document.body).textContent || '';
    const lower = railText.toLowerCase();
    if (lower.includes('главная') || lower.includes('инструменты') || lower.includes('веб-студия')) return 'ru';
    if (lower.includes('home') || lower.includes('tools') || lower.includes('web studio')) return 'en';

    const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang.startsWith('ru')) return 'ru';
    if (htmlLang.startsWith('en')) return 'en';

    return 'ru';
  }

  function t(en, ru) {
    return getLang() === 'en' ? en : ru;
  }

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch];
    });
  }

  function monthTitle(date) {
    const lang = getLang() === 'en' ? 'en-US' : 'ru-RU';
    return date.toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  }

  function getMonthMatrix(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startOffset = (first.getDay() + 6) % 7;
    const days = [];

    for (let i = 0; i < startOffset; i += 1) days.push('');
    for (let day = 1; day <= last.getDate(); day += 1) days.push(String(day));
    while (days.length % 7 !== 0) days.push('');

    return days;
  }

  function renderCalendar(date) {
    const week = getLang() === 'en'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

    const today = new Date();

    const days = getMonthMatrix(date).map(function (day) {
      const isToday =
        day &&
        Number(day) === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      return '<span class="ir-wc-day ' + (isToday ? 'is-today' : '') + '">' + esc(day) + '</span>';
    }).join('');

    return [
      '<div class="ir-wc-week">' + week.map(function (d) { return '<span>' + esc(d) + '</span>'; }).join('') + '</div>',
      '<div class="ir-wc-days">' + days + '</div>'
    ].join('');
  }

  function getWeatherPlace() {
    try {
      const saved = JSON.parse(localStorage.getItem(WEATHER_SETTINGS_KEY) || 'null');
      if (saved && Number.isFinite(Number(saved.latitude)) && Number.isFinite(Number(saved.longitude))) {
        return {
          cityRu: saved.cityRu || saved.city || DEFAULT_WEATHER_PLACE.cityRu,
          cityEn: saved.cityEn || saved.city || DEFAULT_WEATHER_PLACE.cityEn,
          latitude: Number(saved.latitude),
          longitude: Number(saved.longitude)
        };
      }
    } catch (error) {}
    return DEFAULT_WEATHER_PLACE;
  }

  function weatherCityLabel(place) {
    return getLang() === 'en' ? (place.cityEn || place.cityRu || 'Weather') : (place.cityRu || place.cityEn || 'Погода');
  }

  function weatherIcon(code) {
    code = Number(code);
    if (code === 0) return '☀';
    if ([1, 2, 3].includes(code)) return '◐';
    if ([45, 48].includes(code)) return '≋';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '☔';
    if (code >= 71 && code <= 77) return '❄';
    if (code >= 95) return '⚡';
    return '🌡';
  }

  function weatherText(code) {
    code = Number(code);
    if (code === 0) return t('Clear', 'Ясно');
    if ([1, 2, 3].includes(code)) return t('Clouds', 'Облачно');
    if ([45, 48].includes(code)) return t('Fog', 'Туман');
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return t('Rain', 'Дождь');
    if (code >= 71 && code <= 77) return t('Snow', 'Снег');
    if (code >= 95) return t('Storm', 'Гроза');
    return t('Weather', 'Погода');
  }

  function cachedWeather() {
    try {
      const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || 'null');
      if (cached && cached.savedAt && Date.now() - Number(cached.savedAt) < WEATHER_CACHE_MAX_AGE) return cached;
    } catch (error) {}
    return null;
  }

  function renderWeatherView(panel, payload, stateText) {
    const scope = panel || document;
    const tempEl = scope.querySelector('[data-ir-wc-weather-temp]');
    const cityEl = scope.querySelector('[data-ir-wc-weather-city]');
    const metaEl = scope.querySelector('[data-ir-wc-weather-meta]');
    const iconEl = scope.querySelector('[data-ir-wc-weather-icon]');
    const place = getWeatherPlace();

    if (cityEl) cityEl.textContent = weatherCityLabel(place);

    if (!payload) {
      if (tempEl) tempEl.textContent = '--°';
      if (metaEl) metaEl.textContent = stateText || t('Weather', 'Погода');
      if (iconEl) iconEl.textContent = '🌡';
      return;
    }

    const temp = Number(payload.temperature);
    const wind = Number(payload.wind);
    if (tempEl) tempEl.textContent = Number.isFinite(temp) ? Math.round(temp) + '°' : '--°';
    if (iconEl) iconEl.textContent = weatherIcon(payload.code);
    if (metaEl) {
      const windText = Number.isFinite(wind) ? ' · ' + Math.round(wind) + (getLang() === 'en' ? ' km/h' : ' км/ч') : '';
      metaEl.textContent = weatherText(payload.code) + windText;
    }
  }

  async function updateWeather(panel, force) {
    const cached = cachedWeather();
    if (cached && !force) {
      renderWeatherView(panel, cached);
      return;
    }

    renderWeatherView(panel, cached, t('Updating...', 'Обновляем...'));

    try {
      const place = getWeatherPlace();
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(place.latitude) +
        '&longitude=' + encodeURIComponent(place.longitude) +
        '&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto';
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Weather request failed');
      const data = await response.json();
      const current = data && data.current ? data.current : {};
      const payload = {
        savedAt: Date.now(),
        temperature: Number(current.temperature_2m),
        code: Number(current.weather_code),
        wind: Number(current.wind_speed_10m)
      };
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
      renderWeatherView(panel, payload);
    } catch (error) {
      renderWeatherView(panel, cached, t('No data', 'Нет данных'));
    }
  }

  function render() {
    const panel = document.querySelector('.workspace-shell .workspace-panel[data-panel="workspace"]');
    if (!panel) return;

    const note = localStorage.getItem(NOTE_KEY) || '';
    const now = new Date();

    panel.innerHTML = [
      '<div class="ir-wc-v040d">',
      '  <section class="ir-wc-topline">',
      '    <div class="ir-wc-timebox">',
      '      <span class="ir-wc-dot"></span>',
      '      <div>',
      '        <strong data-ir-wc-time>--:--</strong>',
      '        <small data-ir-wc-date>—</small>',
      '      </div>',
      '    </div>',
      '    <button type="button" class="ir-wc-weatherbox" data-ir-wc-weather-refresh title="' + esc(t('Refresh weather', 'Обновить погоду')) + '">',
      '      <span class="ir-wc-weather-icon" data-ir-wc-weather-icon>🌡</span>',
      '      <div>',
      '        <strong data-ir-wc-weather-temp>--°</strong>',
      '        <small><span data-ir-wc-weather-city>' + esc(weatherCityLabel(getWeatherPlace())) + '</span> · <span data-ir-wc-weather-meta>' + esc(t('Weather', 'Погода')) + '</span></small>',
      '      </div>',
      '    </button>',
      '    <button type="button" class="ir-wc-calendar-toggle-v040d" data-ir-wc-calendar-toggle aria-expanded="false">',
      '      <span>' + esc(t('Calendar', 'Календарь')) + '</span>',
      '      <strong data-ir-wc-calendar-title-toggle>' + esc(monthTitle(calendarViewDate)) + '</strong>',
      '      <em>▾</em>',
      '    </button>',
      '  </section>',

      '  <section class="ir-wc-calendar-body-v040d" data-ir-wc-calendar-body hidden>',
      '    <div class="ir-wc-calendar-panel-head">',
      '      <button type="button" data-ir-wc-calendar-prev aria-label="' + esc(t('Previous month', 'Предыдущий месяц')) + '">‹</button>',
      '      <strong data-ir-wc-calendar-title>' + esc(monthTitle(calendarViewDate)) + '</strong>',
      '      <button type="button" data-ir-wc-calendar-next aria-label="' + esc(t('Next month', 'Следующий месяц')) + '">›</button>',
      '    </div>',
      '    <div class="ir-wc-calendar-grid" data-ir-wc-calendar-grid>',
      renderCalendar(calendarViewDate),
      '    </div>',
      '  </section>',

      '  <section class="ir-wc-grid">',
      '    <article class="ir-wc-card ir-wc-note">',
      '      <div class="ir-wc-card-head"><span>✎</span><strong>' + esc(t('Quick note', 'Быстрая заметка')) + '</strong></div>',
      '      <textarea data-ir-wc-note placeholder="' + esc(t('Write a quick note...', 'Напишите быструю заметку...')) + '">' + esc(note) + '</textarea>',
      '    </article>',
      '  </section>',

      '  <div class="ir-wc-status-line" data-ir-wc-status>' + esc(t('Saved locally on this computer.', 'Сохраняется локально на этом компьютере.')) + '</div>',
      '</div>'
    ].join('');

    document.body.classList.add('ir-wc-v0-ready');
    bind(panel);
    updateClock();
    updateWeather(panel, false);
  }


  function updateCalendar(panel) {
    const scope = panel || document;
    const title = scope.querySelector('[data-ir-wc-calendar-title]');
    const toggleTitle = scope.querySelector('[data-ir-wc-calendar-title-toggle]');
    const grid = scope.querySelector('[data-ir-wc-calendar-grid]');
    const label = monthTitle(calendarViewDate);

    if (title) title.textContent = label;
    if (toggleTitle) toggleTitle.textContent = label;
    if (grid) grid.innerHTML = renderCalendar(calendarViewDate);
  }

  function bind(panel) {
    const calendarToggle = panel.querySelector('[data-ir-wc-calendar-toggle]');
    const calendarBody = panel.querySelector('[data-ir-wc-calendar-body]');

    if (calendarToggle && calendarBody) {
      calendarToggle.addEventListener('click', function () {
        const isOpen = calendarToggle.getAttribute('aria-expanded') === 'true';
        calendarToggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        calendarToggle.classList.toggle('is-open', !isOpen);
        calendarBody.hidden = isOpen;
      });
    }


    const prevMonth = panel.querySelector('[data-ir-wc-calendar-prev]');
    const nextMonth = panel.querySelector('[data-ir-wc-calendar-next]');

    function moveMonth(delta) {
      calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + delta, 1);
      updateCalendar(panel);
    }

    if (prevMonth) prevMonth.addEventListener('click', function () { moveMonth(-1); });
    if (nextMonth) nextMonth.addEventListener('click', function () { moveMonth(1); });

    const weatherRefresh = panel.querySelector('[data-ir-wc-weather-refresh]');
    if (weatherRefresh) {
      weatherRefresh.addEventListener('click', function () {
        updateWeather(panel, true);
      });
    }

    const note = panel.querySelector('[data-ir-wc-note]');
    if (note) {
      note.addEventListener('input', function () {
        localStorage.setItem(NOTE_KEY, note.value || '');
        const status = panel.querySelector('[data-ir-wc-status]');
        if (status) status.textContent = t('Saved locally on this computer.', 'Сохраняется локально на этом компьютере.');
      });
    }
  }

  function updateClock() {
    const now = new Date();
    const lang = getLang() === 'en' ? 'en-US' : 'ru-RU';
    const timeEl = document.querySelector('[data-ir-wc-time]');
    const dateEl = document.querySelector('[data-ir-wc-date]');

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString(lang, {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString(lang, {
        weekday: 'long',
        day: '2-digit',
        month: 'long'
      });
    }
  }

  function bindWorkspaceToggleReturnHome() {
    const btn = document.getElementById('workspaceToggle');
    if (!btn || btn.dataset.irWcReturnBound === '1') return;
    btn.dataset.irWcReturnBound = '1';

    btn.addEventListener('click', function (event) {
      const active = document.querySelector('.workspace-shell .workspace-panel.active');
      const activePanel = active ? String(active.getAttribute('data-panel') || '') : '';

      if (activePanel && activePanel !== 'workspace') {
        event.preventDefault();
        event.stopImmediatePropagation();

        const api = window.NSWorkspaceShell || null;
        if (api && typeof api.setWorkspaceEnabled === 'function') api.setWorkspaceEnabled(true);
        if (api && typeof api.setWorkspaceMode === 'function') api.setWorkspaceMode('split');
        if (api && typeof api.setWorkspaceSection === 'function') api.setWorkspaceSection('workspace');

        setTimeout(render, 30);
        return false;
      }

      setTimeout(render, 80);
    }, true);
  }

  function init() {
    render();
    bindWorkspaceToggleReturnHome();
    setTimeout(render, 300);
    setInterval(updateClock, 1000 * 20);

    document.addEventListener('click', function (event) {
      const target = event.target && event.target.closest && event.target.closest('button');
      if (!target) return;
      const text = (target.textContent || '').trim().toUpperCase();
      if (text === 'RU' || text === 'EN') setTimeout(render, 100);
    }, true);

    document.addEventListener('irg:language-changed', render);
    window.addEventListener('irg:language-changed', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.IRGEZTNEWorkspaceCabinetV0 = { render: render };
})();