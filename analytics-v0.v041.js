(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  const ANALYTICS_EVENTS_KEY = 'irgeztne.preview4.webAnalytics.events';
  const ANALYTICS_SITE_KEY = 'irgeztne.analytics.v1.site';
  const ANALYTICS_ENDPOINT_KEY = 'irgeztne.analytics.v1.endpoint';
  const STUDIO_KEY_HINTS = ['site', 'studio', 'webstudio', 'web-studio', 'editorSiteStudio', 'editor-site-studio'];

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function tr(ru, en) {
    return S.t(ru, en);
  }

  function esc(value) {
    return S.escapeHtml(String(value == null ? '' : value));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function createId(prefix) {
    return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(16).slice(2, 10);
  }

  function createToken() {
    const part = () => Math.random().toString(36).slice(2, 10);
    return 'irg_' + part() + part() + part();
  }

  function maskToken(token) {
    const raw = String(token || '');
    if (!raw) return '—';
    return '•••• ' + raw.slice(-6);
  }

  function getEndpoint() {
    return localStorage.getItem(ANALYTICS_ENDPOINT_KEY) || 'https://YOUR-LIVE-API.example/v1';
  }

  function getAnalyticsSite() {
    const site = readJson(ANALYTICS_SITE_KEY, null);
    return site && typeof site === 'object' ? site : null;
  }

  function createLocalAnalyticsSite() {
    const site = {
      id: createId('site_local'),
      token: createToken(),
      name: 'IRGEZTNE local analytics',
      origin: 'local-preview',
      endpoint: getEndpoint(),
      createdAt: new Date().toISOString()
    };

    writeJson(ANALYTICS_SITE_KEY, site);
    recordEvent('analytics_site_ready', { siteId: site.id, mode: 'local' });
    return site;
  }

  function scoreStudioState(state) {
    if (!state || typeof state !== 'object') return 0;

    let score = 0;
    if (Array.isArray(state.pages)) score += 100 + state.pages.length;
    if (Array.isArray(state.menuGroups)) score += 30 + state.menuGroups.length;
    if (state.site && typeof state.site === 'object') score += 10;
    if (state.activePageId) score += 5;

    return score;
  }

  function readStudioState() {
    let bestState = {};
    let bestScore = 0;

    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        const lowKey = String(key || '').toLowerCase();

        const looksRelevant = STUDIO_KEY_HINTS.some((hint) => lowKey.includes(hint.toLowerCase()));
        if (!looksRelevant) continue;

        const state = readJson(key, {});
        const score = scoreStudioState(state);

        if (score > bestScore) {
          bestScore = score;
          bestState = state;
        }
      }
    } catch (error) {}

    return bestState && typeof bestState === 'object' ? bestState : {};
  }

  function getRoomsCount() {
    try {
      if (window.NSRoomsV0 && typeof window.NSRoomsV0.getRoomsState === 'function') {
        return safeArray(window.NSRoomsV0.getRoomsState().rooms).length;
      }

      const state = readJson(S.STORAGE.rooms, {});
      return safeArray(state.rooms).length;
    } catch (error) {
      return 0;
    }
  }

  function getTemplatesCount() {
    return 3;
  }

  function getAnalyticsEvents() {
    return safeArray(readJson(ANALYTICS_EVENTS_KEY, []));
  }

  function recordEvent(type, detail) {
    const events = getAnalyticsEvents();

    events.unshift({
      id: 'wa_' + Date.now() + '_' + Math.random().toString(16).slice(2),
      type: String(type || 'event'),
      detail: detail || {},
      createdAt: new Date().toISOString()
    });

    writeJson(ANALYTICS_EVENTS_KEY, events.slice(0, 120));
    document.dispatchEvent(new CustomEvent('ns-analytics:changed'));
  }

  function getCounts() {
    const files = window.NSLibraryStore && typeof window.NSLibraryStore.getAllItems === 'function'
      ? safeArray(window.NSLibraryStore.getAllItems())
      : [];

    const projects = window.NSProjectStore && typeof window.NSProjectStore.getAll === 'function'
      ? safeArray(window.NSProjectStore.getAll())
      : [];

    const notes = window.NSNotesStore && typeof window.NSNotesStore.getAll === 'function'
      ? safeArray(window.NSNotesStore.getAll())
      : [];

    const documents = window.NSDocumentsV1 && typeof window.NSDocumentsV1.getAll === 'function'
      ? safeArray(window.NSDocumentsV1.getAll())
      : [];

    const codehub = window.NSCodeHubStore && typeof window.NSCodeHubStore.getAll === 'function'
      ? safeArray(window.NSCodeHubStore.getAll())
      : [];

    const studio = readStudioState();
    const pages = safeArray(studio.pages);
    const menuGroups = safeArray(studio.menuGroups);
    const events = getAnalyticsEvents();
    const now = Date.now();
    const activeNow = events.filter((event) => {
      const time = Date.parse(event.createdAt || '');
      return Number.isFinite(time) && now - time <= 5 * 60 * 1000;
    }).length;

    const pageViewEvents = events.filter((event) => event.type === 'page_view' || event.type === 'preview');
    const publishEvents = events.filter((event) => event.type === 'publish');
    const exportEvents = events.filter((event) => event.type === 'export-html');
    const visitors = Math.max(0, new Set(events.map((event) => event.detail && (event.detail.sessionId || event.detail.visitorId)).filter(Boolean)).size);

    return {
      sitePages: pages.length,
      publishedPages: pages.filter((page) => page && page.status === 'published').length,
      draftPages: pages.filter((page) => !page || page.status !== 'published').length,
      menuGroups: menuGroups.length,
      menuItems: menuGroups.reduce((sum, group) => sum + safeArray(group && group.items).length, 0),
      templates: getTemplatesCount(),
      documents: documents.length,
      projects: projects.length,
      notes: notes.length,
      files: files.length,
      rooms: getRoomsCount(),
      codehub: codehub.length,
      visitors,
      pageViews: pageViewEvents.length,
      activeNow,
      previewEvents: events.filter((event) => event.type === 'preview').length,
      exportEvents: exportEvents.length,
      publishEvents: publishEvents.length,
      totalEvents: events.length
    };
  }

  function metric(labelRu, labelEn, value) {
    return S.renderMetric(tr(labelRu, labelEn), value);
  }

  function getEventLabel(type) {
    const labels = {
      page_view: tr('Просмотр страницы', 'Page view'),
      preview: 'Preview',
      publish: 'Publish',
      'export-html': 'HTML export',
      file_upload: tr('Файл', 'File'),
      room_message: tr('Сообщение', 'Message'),
      analytics_site_ready: tr('Сайт аналитики', 'Analytics site'),
      demo_click: tr('Демо-клик', 'Demo click')
    };
    return labels[type] || String(type || 'event');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch (error) {
      return iso || '';
    }
  }

  function getBrowserName() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chromium';
    if (ua.includes('Safari')) return 'Safari';
    return 'Browser';
  }

  function getDeviceName() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') ? 'Mobile' : 'Desktop';
  }

  function recordDemoEvent() {
    const paths = ['/workspace', '/web-studio', '/docs', '/download', '/preview'];
    const types = ['page_view', 'preview', 'demo_click'];
    const type = types[Math.floor(Math.random() * types.length)];

    recordEvent(type, {
      path: paths[Math.floor(Math.random() * paths.length)],
      title: 'IRGEZTNE',
      device: getDeviceName(),
      browser: getBrowserName(),
      sessionId: 'local_' + new Date().toISOString().slice(0, 10)
    });
  }

  function resetEvents() {
    localStorage.removeItem(ANALYTICS_EVENTS_KEY);
    document.dispatchEvent(new CustomEvent('ns-analytics:changed'));
  }

  function getBars(events) {
    const days = [];
    const map = {};
    const now = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days.push(key);
      map[key] = 0;
    }

    events.forEach((event) => {
      const key = String(event.createdAt || '').slice(0, 10);
      if (Object.prototype.hasOwnProperty.call(map, key)) map[key] += 1;
    });

    const max = Math.max(1, ...days.map((day) => map[day]));
    return days.map((day) => ({ day, value: map[day], pct: Math.max(8, Math.round((map[day] / max) * 100)) }));
  }

  function renderBars() {
    const bars = getBars(getAnalyticsEvents());

    return '<div class="ir-wa-bars">' + bars.map((bar) => (
      '<div class="ir-wa-bar">' +
        '<span style="height:' + esc(bar.pct) + '%"></span>' +
        '<em>' + esc(bar.day.slice(5)) + '</em>' +
        '<strong>' + esc(bar.value) + '</strong>' +
      '</div>'
    )).join('') + '</div>';
  }

  function renderRecentEvents(limit) {
    const events = getAnalyticsEvents().slice(0, limit || 8);

    if (!events.length) {
      return '<div class="ir-wa-empty-live">' +
        '<strong>' + esc(tr('Пока нет событий', 'No events yet')) + '</strong>' +
        '<span>' + esc(tr(
          'Нажмите «Demo event», откройте Preview/Publish или подключите сайт позже через Live API.',
          'Press “Demo event”, use Preview/Publish, or connect a site later through Live API.'
        )) + '</span>' +
      '</div>';
    }

    return '<div class="ir-wa-event-list">' + events.map((event) => {
      const detail = event.detail || {};
      const path = detail.path || detail.page || detail.title || '';
      const device = detail.device || detail.browser || '';

      return '<article class="ir-wa-event">' +
        '<div>' +
          '<strong>' + esc(getEventLabel(event.type)) + '</strong>' +
          '<span>' + esc(path || formatTime(event.createdAt)) + '</span>' +
        '</div>' +
        '<em>' + esc(device || formatTime(event.createdAt)) + '</em>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderStatusPill(profile) {
    const status = profile
      ? tr('Локальный site token готов', 'Local site token ready')
      : tr('Локальный preview режим', 'Local preview mode');

    return '<div class="ir-wa-status-pill ' + (profile ? 'is-ready' : 'is-preview') + '">' +
      '<span></span><strong>' + esc(status) + '</strong>' +
    '</div>';
  }

  function renderEmbedSnippet(profile) {
    if (!profile) {
      return esc(tr('Создайте локальный Site token, чтобы увидеть embed snippet.', 'Create a local Site token to see the embed snippet.'));
    }

    const endpoint = getEndpoint().replace(/\/+$/, '') + '/analytics/events';

    return [
      '<script>',
      '(function(){',
      '  var endpoint = "' + endpoint + '";',
      '  var payload = {',
      '    siteId: "' + profile.id + '",',
      '    token: "' + profile.token + '",',
      '    type: "page_view",',
      '    path: location.pathname,',
      '    title: document.title,',
      '    referrer: document.referrer',
      '  };',
      '  try {',
      '    navigator.sendBeacon(endpoint, JSON.stringify(payload));',
      '  } catch (e) {',
      '    fetch(endpoint, { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify(payload) });',
      '  }',
      '})();',
      '</script>'
    ].join('\n');
  }

  function renderConnectCard(profile) {
    const snippet = renderEmbedSnippet(profile);

    return '<section class="ecosystem-v0-card ir-wa-connect-card">' +
      '<div class="ir-wa-card-title-row">' +
        '<h4>' + esc(tr('Подключение сайта', 'Site connection')) + '</h4>' +
        renderStatusPill(profile) +
      '</div>' +
      '<div class="ir-wa-connection-grid">' +
        '<div><span>Site ID</span><strong>' + esc(profile ? profile.id : '—') + '</strong></div>' +
        '<div><span>Token</span><strong>' + esc(profile ? maskToken(profile.token) : '—') + '</strong></div>' +
        '<div><span>Endpoint</span><strong>' + esc(getEndpoint()) + '</strong></div>' +
      '</div>' +
      '<textarea class="ir-wa-snippet" readonly data-ir-wa-snippet>' + esc(snippet) + '</textarea>' +
      '<div class="ir-wa-actions">' +
        '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="analytics-create-local-site">' + esc(profile ? tr('Обновить token', 'Refresh token') : tr('Создать Site token', 'Create Site token')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="analytics-copy-snippet">' + esc(tr('Копировать snippet', 'Copy snippet')) + '</button>' +
      '</div>' +
      '<p class="ecosystem-v0-muted">' + esc(tr(
        'Live API уже имеет endpoints для создания site, записи events и чтения summary. В этом релизе это foundation без аккаунтов.',
        'Live API already has endpoints for creating a site, tracking events, and reading summary. In this release it is a no-account foundation.'
      )) + '</p>' +
    '</section>';
  }

  function renderPrivacyCard() {
    return '<section class="ecosystem-v0-card ir-wa-privacy-card">' +
      '<h4>' + esc(tr('Приватная аналитика v1', 'Private Analytics v1')) + '</h4>' +
      '<div class="ir-wa-check-list">' +
        '<article class="ir-wa-check is-ok"><strong>' + esc(tr('Без рекламных SDK', 'No ad SDKs')) + '</strong><span>' + esc(tr('Данные не привязаны к рекламным сетям.', 'Data is not tied to ad networks.')) + '</span></article>' +
        '<article class="ir-wa-check is-ok"><strong>' + esc(tr('Без аккаунта', 'No account')) + '</strong><span>' + esc(tr('Для v1 достаточно Site ID + token.', 'For v1, Site ID + token is enough.')) + '</span></article>' +
        '<article class="ir-wa-check is-wait"><strong>' + esc('Live API') + '</strong><span>' + esc(tr('Сбор событий подключается через Worker позже/по готовности.', 'Event collection connects through the Worker later/when ready.')) + '</span></article>' +
      '</div>' +
    '</section>';
  }

  function renderWebAnalytics() {
    const counts = getCounts();
    const profile = getAnalyticsSite();
    const siteTotal = counts.sitePages + counts.menuGroups + counts.templates + counts.documents + counts.rooms;
    const activityTotal = counts.projects + counts.files + counts.notes + counts.codehub;

    return S.renderShellIntro(
      'analytics',
      tr('Аналитика', 'Analytics'),
      tr(
        'Приватная Analytics v1: локальная сводка сейчас, Live API foundation для сайтов Web Studio дальше. Без рекламных SDK, аккаунтов и лишнего трекинга.',
        'Private Analytics v1: local summary now, Live API foundation for Web Studio sites next. No ad SDKs, accounts, or extra tracking.'
      ),
      [tr('Локально', 'Local'), 'Live API ready', tr('Без SDK', 'No SDK')]
    ) +
      '<div class="ecosystem-v0-layout ecosystem-v0-layout--analytics ir-wa-layout ir-wa-v1">' +

      '<section class="ecosystem-v0-card ir-wa-hero-card">' +
        '<div class="ir-wa-hero-top">' +
          '<div>' +
            '<h4>' + esc(tr('Живая сводка', 'Live overview')) + '</h4>' +
            '<p class="ecosystem-v0-muted">' + esc(tr(
              'Пока это локальные события приложения и foundation под будущую приватную аналитику сайтов.',
              'For now this is local app activity plus a foundation for future private site analytics.'
            )) + '</p>' +
          '</div>' +
          renderStatusPill(profile) +
        '</div>' +
        '<div class="ir-wa-kpi-grid">' +
          '<article><span>' + esc(tr('Посетители', 'Visitors')) + '</span><strong>' + esc(counts.visitors || (profile ? 1 : 0)) + '</strong></article>' +
          '<article><span>' + esc(tr('Просмотры', 'Page views')) + '</span><strong>' + esc(counts.pageViews) + '</strong></article>' +
          '<article><span>' + esc(tr('Активно сейчас', 'Active now')) + '</span><strong>' + esc(counts.activeNow) + '</strong></article>' +
          '<article><span>' + esc(tr('События', 'Events')) + '</span><strong>' + esc(counts.totalEvents) + '</strong></article>' +
        '</div>' +
        '<div class="ir-wa-actions">' +
          '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="analytics-demo-event">' + esc(tr('Demo event', 'Demo event')) + '</button>' +
          '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="refresh-analytics">' + esc(tr('Обновить', 'Refresh')) + '</button>' +
          '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="analytics-reset-events">' + esc(tr('Очистить события', 'Clear events')) + '</button>' +
        '</div>' +
      '</section>' +

      '<section class="ecosystem-v0-card ir-wa-chart-card">' +
        '<h4>' + esc(tr('Активность за 7 дней', '7-day activity')) + '</h4>' +
        renderBars() +
      '</section>' +

      '<section class="ecosystem-v0-card ir-wa-stream-card">' +
        '<h4>' + esc(tr('Лента событий', 'Event stream')) + '</h4>' +
        renderRecentEvents(9) +
      '</section>' +

      renderConnectCard(profile) +

      '<section class="ecosystem-v0-card ecosystem-v0-card--metrics ir-wa-site-card">' +
        '<h4>' + esc(tr('Web Studio', 'Web Studio')) + '</h4>' +
        '<div class="ecosystem-v0-metric-grid">' +
          metric('Страницы', 'Pages', counts.sitePages) +
          metric('Опубликовано', 'Published', counts.publishedPages) +
          metric('Черновики', 'Drafts', counts.draftPages) +
          metric('Группы меню', 'Menu groups', counts.menuGroups) +
          metric('Пункты меню', 'Menu items', counts.menuItems) +
          metric('Шаблоны', 'Templates', counts.templates) +
        '</div>' +
      '</section>' +

      '<section class="ecosystem-v0-card ecosystem-v0-card--metrics ir-wa-workspace-card">' +
        '<h4>' + esc(tr('Рабочее пространство', 'Workspace')) + '</h4>' +
        '<div class="ecosystem-v0-metric-grid">' +
          metric('Документы', 'Documents', counts.documents) +
          metric('Проекты', 'Projects', counts.projects) +
          metric('Файлы', 'Files', counts.files) +
          metric('Заметки', 'Notes', counts.notes) +
          metric('Комнаты', 'Rooms', counts.rooms) +
          metric('Мастерская', 'Workshop', counts.codehub) +
        '</div>' +
      '</section>' +

      '<section class="ecosystem-v0-card ir-wa-total-card">' +
        '<h4>' + esc(tr('Локальное состояние', 'Local state')) + '</h4>' +
        '<div class="ecosystem-v0-big-number">' + esc(siteTotal + activityTotal) + '</div>' +
        '<p class="ecosystem-v0-muted">' + esc(tr(
          'Сумма сайта и рабочего пространства. Данные остаются внутри приложения.',
          'Total for the site and workspace. Data stays inside the app.'
        )) + '</p>' +
      '</section>' +

      renderPrivacyCard() +

      '</div></div>';
  }

  function copySnippet() {
    const snippet = document.querySelector('[data-ir-wa-snippet]');
    if (!snippet) return;

    const value = snippet.value || snippet.textContent || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(() => {});
    } else {
      try {
        snippet.focus();
        snippet.select();
        document.execCommand('copy');
      } catch (error) {}
    }
  }

  function handleClick(event) {
    const action = event.target.closest('[data-ecosystem-action]');
    if (!action) return;

    const name = action.getAttribute('data-ecosystem-action');

    if (name === 'refresh-analytics') {
      S.renderSection('analytics');
      return;
    }

    if (name === 'analytics-demo-event') {
      recordDemoEvent();
      S.renderSection('analytics');
      return;
    }

    if (name === 'analytics-reset-events') {
      if (window.confirm(tr('Очистить локальные события аналитики?', 'Clear local analytics events?'))) {
        resetEvents();
        S.renderSection('analytics');
      }
      return;
    }

    if (name === 'analytics-create-local-site') {
      createLocalAnalyticsSite();
      S.renderSection('analytics');
      return;
    }

    if (name === 'analytics-copy-snippet') {
      copySnippet();
    }
  }

  function boot() {
    S.registerModule('analytics', renderWebAnalytics);
    S.renderSection('analytics');

    document.addEventListener('click', handleClick);
    document.addEventListener('irg:language-changed', () => S.renderSection('analytics'));
    window.addEventListener('irg:language-changed', () => S.renderSection('analytics'));

    [
      'ns-library:changed',
      'ns-projects:changed',
      'ns-notes:changed',
      'ns-codehub:changed',
      'ns-ecosystem:changed',
      'ns-analytics:changed'
    ].forEach((eventName) => {
      document.addEventListener(eventName, () => S.renderSection('analytics'));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NSWebAnalyticsV0 = {
    getCounts,
    getAnalyticsSite,
    createLocalAnalyticsSite,
    recordEvent,
    render: () => S.renderSection('analytics')
  };

  window.NSEcosystemV0 = Object.assign(window.NSEcosystemV0 || {}, {
    getCounts,
    recordAnalyticsEvent: recordEvent
  });
})();
