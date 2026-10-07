(function () {
  'use strict';

  const NOTE_KEY = 'irgeztne.workspace.quickNote.v0';
  /* IRGEZTNE_WORKSPACE_WEATHER_V041 */
  let calendarViewDate = new Date();
  let weatherRequest = null;
  let weatherRequestSequence = 0;
  let weatherLocationUnsubscribe = null;

  function getLang() {
    const workspaceToggle = document.querySelector('#workspaceToggle .workspace-toggle-text, #workspaceToggle');
    const workspaceText = (workspaceToggle && workspaceToggle.textContent || '').trim().toLowerCase();
    if (workspaceText.includes('информация')) return 'ru';
    if (workspaceText.includes('information')) return 'en';
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
    const client = window.IRGEZTNEWeatherClientV1;
    return client && typeof client.getPlace === 'function'
      ? client.getPlace()
      : null;
  }

  function weatherCityLabel(place) {
    if (!place) return t('Choose location', 'Выбрать место');
    return getLang() === 'en' ? (place.cityEn || place.cityRu || 'Weather') : (place.cityRu || place.cityEn || 'Погода');
  }

  function weatherIcon(condition) {
    const model = window.IRGEZTNEWeatherViewModelV1;
    if (model && typeof model.conditionIcon === 'function') return model.conditionIcon(condition);
    return '○';
  }

  function weatherText(code) {
    code = String(code || 'unknown');
    if (code === 'clear') return t('Clear', 'Ясно');
    if (code === 'mostly_clear') return t('Mostly clear', 'Малооблачно');
    if (code === 'partly_cloudy') return t('Partly cloudy', 'Переменная облачность');
    if (code === 'cloudy') return t('Cloudy', 'Облачно');
    if (code === 'fog') return t('Fog', 'Туман');
    if (code.includes('rain') || code === 'sleet') return t('Rain', 'Дождь');
    if (code.includes('snow')) return t('Snow', 'Снег');
    if (code === 'thunder') return t('Thunderstorm', 'Гроза');
    return t('Weather', 'Погода');
  }

  function renderWeatherView(panel, payload, stateText) {
    const scope = panel || document;
    const tempEl = scope.querySelector('[data-ir-wc-weather-temp]');
    const cityEl = scope.querySelector('[data-ir-wc-weather-city]');
    const metaEl = scope.querySelector('[data-ir-wc-weather-meta]');
    const iconEl = scope.querySelector('[data-ir-wc-weather-icon]');
    const buttonEl = scope.querySelector('[data-ir-wc-weather-refresh]');
    const place = getWeatherPlace();
    const model = window.IRGEZTNEWeatherViewModelV1;
    const semanticState = model && typeof model.semanticState === 'function'
      ? model.semanticState(payload, stateText === t('Updating…', 'Обновляем…'), Boolean(payload && payload.current))
      : 'unavailable';

    if (cityEl) cityEl.textContent = weatherCityLabel(place);
    if (buttonEl) buttonEl.dataset.weatherState = semanticState;

    if (!payload || !payload.current) {
      if (tempEl) tempEl.textContent = '--°';
      if (metaEl) metaEl.textContent = stateText || (place ? t('Weather', 'Погода') : t('Open to choose', 'Откройте для выбора'));
      if (iconEl) iconEl.textContent = '○';
      return;
    }

    const temp = Number(payload.current.temperature_c);
    const wind = Number(payload.current.wind_speed_mps);
    const condition = payload.current.condition || { code: 'unknown', phase: 'unknown' };
    if (tempEl) tempEl.textContent = Number.isFinite(temp) ? Math.round(temp) + '°' : '--°';
    if (iconEl) iconEl.textContent = weatherIcon(condition);
    if (metaEl) {
      const windText = Number.isFinite(wind) ? ' · ' + Math.round(wind * 3.6) + (getLang() === 'en' ? ' km/h' : ' км/ч') : '';
      metaEl.textContent = weatherText(condition.code) + windText;
    }
  }

  async function updateWeather(panel, force) {
    const client = window.IRGEZTNEWeatherClientV1;
    const place = getWeatherPlace();
    if (!place) {
      renderWeatherView(panel, null, t('Open to choose', 'Откройте для выбора'));
      return;
    }
    if (!client || typeof client.fetchForecast !== 'function') {
      renderWeatherView(panel, null, t('Unavailable', 'Недоступно'));
      return;
    }
    const cached = client.getCachedForecast(place);
    renderWeatherView(panel, cached, t('Updating…', 'Обновляем…'));
    if (weatherRequest && !force) return weatherRequest;
    const requestSequence = ++weatherRequestSequence;
    weatherRequest = client.fetchForecast({ place: place, force: force === true }).then(function (payload) {
      if (requestSequence === weatherRequestSequence) renderWeatherView(panel, payload, t('Unavailable', 'Недоступно'));
      return payload;
    }).finally(function () {
      if (requestSequence === weatherRequestSequence) weatherRequest = null;
    });
    return weatherRequest;
  }

  function bindWeatherLocationSync() {
    if (weatherLocationUnsubscribe || !window.nsAPI || typeof window.nsAPI.onWeatherLocationChanged !== 'function') return;
    weatherLocationUnsubscribe = window.nsAPI.onWeatherLocationChanged(function () {
      const panel = document.querySelector('.workspace-shell .workspace-panel[data-panel="workspace"]');
      if (!panel) return;
      updateWeather(panel, true).catch(function (error) {
        console.warn('[IRGEZTNE Weather] Compact location refresh failed:', error);
      });
    });
  }

  function render() {
    const panel = document.querySelector('.workspace-shell .workspace-panel[data-panel="workspace"]');
    if (!panel) return;
    const note = localStorage.getItem(NOTE_KEY) || '';

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
      '    <button type="button" class="ir-wc-weatherbox" data-ir-wc-weather-refresh title="' + esc(t('Open full weather', 'Открыть погоду полностью')) + '">',
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

      '  <section class="ir-wc-economy-slot" data-ir-economy-widget></section>',

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
    mountEconomy(panel);
  }

  function mountEconomy(panel) {
    const root = panel.querySelector('[data-ir-economy-widget]');
    const widget = window.IRGEZTNEEconomyWidgetCoreV1;
    if (!root || !widget || typeof widget.mount !== 'function') return;
    widget.mount(root, {
      mode: 'compact',
      locale: getLang(),
      onOpenFull: function (countryId, detail) {
        const params = new URLSearchParams({
          country: countryId || '',
          lang: getLang(),
          theme: document.body.classList.contains('theme-light') || document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
          tab: detail?.tab || 'world',
          metric: detail?.metric || '',
          instrument: detail?.instrument || '',
          range: detail?.range || ''
        });
        window.open('./proofs/economy-widget-standalone.html?' + params.toString(), '_blank', 'noopener');
      }
    });
  }

  function openWeatherFull() {
    const place = getWeatherPlace();
    const client = window.IRGEZTNEWeatherClientV1;
    const locationContext = client && typeof client.getLocationContext === 'function' ? client.getLocationContext() : null;
    const payload = { lang: getLang() };
    if (place) {
      payload.latitude = place.latitude;
      payload.longitude = place.longitude;
      payload.altitude = place.altitude;
      payload.cityRu = place.cityRu || '';
      payload.cityEn = place.cityEn || '';
      payload.timeZone = place.timeZone || '';
      payload.locationSource = locationContext && locationContext.source || 'workspace';
    }
    if (window.nsAPI && typeof window.nsAPI.weatherOpenFull === 'function') {
      window.nsAPI.weatherOpenFull(payload).catch(function (error) {
        console.warn('[IRGEZTNE Weather] failed to open Full Weather:', error);
      });
      return;
    }
    // Browser-only proof fallback. Packaged Workspace always uses the managed
    // main-process window above so a partially navigated child is never shown.
    const params = new URLSearchParams({ lang: payload.lang });
    if (place) {
      params.set('lat', String(payload.latitude));
      params.set('lon', String(payload.longitude));
      params.set('altitude', payload.altitude == null ? '' : String(payload.altitude));
      params.set('cityRu', payload.cityRu);
      params.set('cityEn', payload.cityEn);
      params.set('timeZone', payload.timeZone);
      params.set('locationSource', payload.locationSource);
    }
    window.open('./proofs/weather-widget-standalone.html?' + params.toString(), '_blank', 'noopener');
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
        openWeatherFull();
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
    bindWeatherLocationSync();
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
