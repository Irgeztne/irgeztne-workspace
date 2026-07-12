(function () {
  'use strict';

  const STATE_KEY = 'irgeztne.connected.identity.v1';
  const ACCOUNT_URL = 'https://irgeztne.com/account';

  function lang() {
    const raw = String(
      document.documentElement.getAttribute('lang') ||
      localStorage.getItem('irgeztne.lang') ||
      localStorage.getItem('irgLang') ||
      ''
    ).toLowerCase();

    return raw.startsWith('ru') ? 'ru' : 'en';
  }

  function t(ru, en) {
    return lang() === 'ru' ? ru : en;
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function writeState(next) {
    const state = Object.assign({}, readState(), next || {}, { updatedAt: new Date().toISOString() });
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (error) {}

    window.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: state }));
    document.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: state }));

    updateButton();
    renderMenu();
    return state;
  }

  function isConnected() {
    const state = readState();
    return state.mode === 'connected' && Boolean(state.accessToken);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  function openExternal(url) {
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(url);
        return;
      }
    } catch (error) {}

    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      location.href = url;
    }
  }

  function openAccount(mode) {
    const state = readState();
    const url = state.accountUrl || ACCOUNT_URL;
    const sep = url.includes('?') ? '&' : '?';
    openExternal(url + sep + 'mode=' + encodeURIComponent(mode || 'signin') + '&from=workspace');
  }

  function connectDev() {
    writeState({
      mode: 'connected',
      userId: 'local-dev',
      displayName: 'Tom',
      email: 'local@irgeztne.dev',
      accessToken: 'local-dev-token'
    });
  }

  function logout() {
    writeState({
      mode: 'local',
      userId: '',
      displayName: '',
      email: '',
      accessToken: ''
    });
  }

  function button() {
    return document.getElementById('accountToggle');
  }

  function updateButton() {
    const btn = button();
    if (!btn) return;

    btn.classList.toggle('is-connected', isConnected());

    const title = isConnected()
      ? t('IRGEZTNE ID подключён', 'IRGEZTNE ID connected')
      : t('Локальный режим. Войти для чата и live-аналитики', 'Local mode. Sign in for Chat and Live Analytics');

    btn.setAttribute('title', title);
    btn.setAttribute('aria-label', title);
  }

  function ensureMenu() {
    let menu = document.getElementById('accountMenuV044');
    if (menu) return menu;

    menu = document.createElement('div');
    menu.id = 'accountMenuV044';
    menu.className = 'account-menu-v044 hidden';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'IRGEZTNE ID');
    document.body.appendChild(menu);

    menu.addEventListener('click', (event) => {
      const actionNode = event.target.closest('[data-account-action]');
      if (!actionNode) return;

      const action = actionNode.getAttribute('data-account-action');
      if (action === 'signin') openAccount('signin');
      if (action === 'signup') openAccount('signup');
      if (action === 'account') openAccount('account');
      if (action === 'logout') logout();
      if (action === 'dev') connectDev();

      closeMenu();
    });

    return menu;
  }

  function menuHtml() {
    const state = readState();

    if (isConnected()) {
      return '' +
        '<div class="account-menu-v044__head">' +
          '<div class="account-menu-v044__avatar"></div>' +
          '<div><strong>' + escapeHtml(state.displayName || 'IRGEZTNE ID') + '</strong>' +
          '<span>' + escapeHtml(state.email || t('Connected mode', 'Connected mode')) + '</span></div>' +
        '</div>' +
        '<div class="account-menu-v044__status is-connected"><i></i>' + escapeHtml(t('Connected mode', 'Connected mode')) + '</div>' +
        '<button type="button" data-account-action="account">' + escapeHtml(t('Открыть IRGEZTNE ID', 'Open IRGEZTNE ID')) + '</button>' +
        '<button type="button" data-account-action="logout">' + escapeHtml(t('Выйти', 'Logout')) + '</button>';
    }

    return '' +
      '<div class="account-menu-v044__head">' +
        '<div class="account-menu-v044__avatar"></div>' +
        '<div><strong>' + escapeHtml(t('Локальный режим', 'Local mode')) + '</strong>' +
        '<span>' + escapeHtml(t('Локальные модули работают без аккаунта.', 'Local modules work without an account.')) + '</span></div>' +
      '</div>' +
      '<div class="account-menu-v044__status"><i></i>' + escapeHtml(t('Не подключено', 'Not connected')) + '</div>' +
      '<button type="button" class="is-primary" data-account-action="signin">' + escapeHtml(t('Войти', 'Sign in')) + '</button>' +
      '<button type="button" data-account-action="signup">' + escapeHtml(t('Создать аккаунт', 'Create account')) + '</button>' +
      '<p class="account-menu-v044__note">' + escapeHtml(t(
        'IRGEZTNE ID нужен для чата, live-аналитики, совместной работы и будущих звонков.',
        'IRGEZTNE ID is used for chat, live analytics, collaboration, and future calls.'
      )) + '</p>' +
      '<details><summary>' + escapeHtml(t('Тест', 'Test')) + '</summary>' +
        '<button type="button" data-account-action="dev">' + escapeHtml(t('Подключить dev-сессию', 'Connect dev session')) + '</button>' +
      '</details>';
  }

  function positionMenu() {
    const btn = button();
    const menu = ensureMenu();
    if (!btn || !menu) return;

    const rect = btn.getBoundingClientRect();
    const width = 310;
    menu.style.width = width + 'px';
    menu.style.left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width)) + 'px';
    menu.style.top = Math.min(window.innerHeight - 20, rect.bottom + 8) + 'px';
  }

  function renderMenu() {
    const menu = ensureMenu();
    menu.innerHTML = menuHtml();
    positionMenu();
  }

  function openMenu() {
    renderMenu();
    const menu = ensureMenu();
    menu.classList.remove('hidden');
    const btn = button();
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    const menu = ensureMenu();
    menu.classList.add('hidden');
    const btn = button();
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    const menu = ensureMenu();
    if (menu.classList.contains('hidden')) openMenu();
    else closeMenu();
  }

  function renderGate(kind) {
    const isAnalytics = kind === 'analytics';
    return '<section class="ir-connected-gate">' +
      '<div class="ir-connected-gate-icon"></div>' +
      '<h3>' + escapeHtml(isAnalytics ? t('Live Analytics требует IRGEZTNE ID', 'Live Analytics requires IRGEZTNE ID') : t('Чат требует IRGEZTNE ID', 'Chat requires IRGEZTNE ID')) + '</h3>' +
      '<p>' + escapeHtml(isAnalytics
        ? t('Локальная сводка работает без аккаунта. Живые события и история подключаются через IRGEZTNE ID.', 'Local overview works without an account. Live events and history use IRGEZTNE ID.')
        : t('Локальные модули работают без аккаунта. Для чата нужны участники, приглашения, лимиты и защита.', 'Local modules work without an account. Chat needs participants, invites, limits, and protection.')
      ) + '</p>' +
    '</section>';
  }

  function boot() {
    const btn = button();
    if (!btn) return;

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });

    document.addEventListener('click', (event) => {
      const menu = ensureMenu();
      const btnNow = button();
      if (menu.classList.contains('hidden')) return;
      if (menu.contains(event.target) || (btnNow && btnNow.contains(event.target))) return;
      closeMenu();
    });

    window.addEventListener('resize', positionMenu);
    document.addEventListener('irg:language-changed', () => {
      updateButton();
      renderMenu();
    });
    window.addEventListener('irg:language-changed', () => {
      updateButton();
      renderMenu();
    });

    window.IRGEZTNEConnected = Object.assign({}, window.IRGEZTNEConnected || {}, {
      getState: readState,
      saveState: writeState,
      isConnected,
      signIn: openAccount,
      logout,
      openMenu,
      closeMenu,
      renderGate,
      connectLocalForDev: connectDev
    });

    updateButton();
    renderMenu();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
