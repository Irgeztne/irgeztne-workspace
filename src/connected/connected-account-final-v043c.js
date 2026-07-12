(function () {
  'use strict';

  const STATE_KEY = 'irgeztne.connected.identity.v1';
  const ACCOUNT_URL = 'https://irgeztne.com/account';
  const API_URL = 'https://api.irgeztne.com';

  let placedOnce = false;

  function lang() {
    try {
      const raw = (
        document.documentElement.getAttribute('lang') ||
        localStorage.getItem('irgeztne.lang') ||
        localStorage.getItem('irgLang') ||
        ''
      ).toLowerCase();
      return raw.startsWith('ru') ? 'ru' : 'en';
    } catch (error) {
      return 'en';
    }
  }

  function t(ru, en) {
    return lang() === 'ru' ? ru : en;
  }

  function esc(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function writeState(next) {
    const current = readState();
    const merged = Object.assign({}, current, next || {}, { updatedAt: new Date().toISOString() });
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(merged));
    } catch (error) {}
    window.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: merged }));
    document.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: merged }));
    renderMenu();
    placeAccountButton();
    return merged;
  }

  function isConnected() {
    const s = readState();
    return s.mode === 'connected' && !!s.accessToken;
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

  function signIn(mode) {
    const s = readState();
    const url = s.accountUrl || ACCOUNT_URL;
    const sep = url.includes('?') ? '&' : '?';
    openExternal(url + sep + 'mode=' + encodeURIComponent(mode || 'signin') + '&from=workspace');
  }

  function devConnect() {
    writeState({
      mode: 'connected',
      userId: 'local-dev',
      displayName: 'Tom',
      email: 'local@irgeztne.dev',
      accessToken: 'local-dev-token',
      accountUrl: ACCOUNT_URL,
      apiUrl: API_URL
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

  function normText(node) {
    return String(
      (node && node.textContent) ||
      (node && node.getAttribute && (node.getAttribute('title') || node.getAttribute('aria-label'))) ||
      ''
    ).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function buttonLike(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = node.tagName.toLowerCase();
    const role = String(node.getAttribute('role') || '').toLowerCase();
    return tag === 'button' || tag === 'a' || role === 'button' || node.onclick || node.getAttribute('data-action');
  }

  function findWorkspaceButton() {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], [class*="workspace"], [title], [aria-label]'));
    const candidates = nodes.filter((node) => {
      const value = normText(node);
      const label = String((node.getAttribute && (node.getAttribute('title') || node.getAttribute('aria-label') || node.className)) || '').toLowerCase();
      return value.includes('workspace') ||
        value.includes('пространство') ||
        label.includes('workspace') ||
        label.includes('пространство');
    });

    const exact = candidates.find((node) => buttonLike(node) && (
      normText(node) === 'workspace' ||
      normText(node) === 'пространство' ||
      normText(node).includes('workspace') ||
      normText(node).includes('пространство')
    ));

    if (exact) return exact.closest('button, a, [role="button"]') || exact;

    const first = candidates[0];
    return first ? (first.closest('button, a, [role="button"]') || first) : null;
  }

  function findHamburgerAfter(workspace) {
    if (!workspace || !workspace.parentElement) return null;
    const parent = workspace.parentElement;
    const kids = Array.from(parent.children);
    const i = kids.indexOf(workspace);
    const after = i >= 0 ? kids.slice(i + 1, i + 6) : kids;

    return after.find((node) => {
      if (!buttonLike(node)) return false;
      const value = normText(node);
      const label = String((node.getAttribute && (node.getAttribute('title') || node.getAttribute('aria-label') || node.className)) || '').toLowerCase();
      return value === '☰' ||
        value === '≡' ||
        value === '☷' ||
        value.includes('menu') ||
        value.includes('меню') ||
        label.includes('hamburger') ||
        label.includes('menu') ||
        label.includes('sidebar') ||
        label.includes('navigation');
    }) || null;
  }

  function makeAccountButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'irgeztne-connected-account';
    btn.className = 'ir-connected-account-btn ir-account-final-v043c';
    btn.setAttribute('data-ir-connected-account', 'button');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.innerHTML =
      '<span class="ir-connected-avatar" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" role="img" focusable="false">' +
          '<path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2.1c-3.95 0-7.25 2.12-7.25 4.72 0 .64.52 1.18 1.18 1.18h12.14c.66 0 1.18-.54 1.18-1.18 0-2.6-3.3-4.72-7.25-4.72Z"/>' +
        '</svg>' +
      '</span>' +
      '<span class="ir-connected-dot" aria-hidden="true"></span>';
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });
    return btn;
  }

  function getAccountButton() {
    const all = Array.from(document.querySelectorAll('#irgeztne-connected-account, [data-ir-connected-account="button"], .ir-account-final-v043c'));
    let btn = all.find((node) => node.id === 'irgeztne-connected-account') || all[0];

    if (!btn) btn = makeAccountButton();

    all.forEach((node) => {
      if (node !== btn && node.parentElement) node.remove();
    });

    btn.id = 'irgeztne-connected-account';
    btn.className = 'ir-connected-account-btn ir-account-final-v043c';
    btn.setAttribute('data-ir-connected-account', 'button');
    return btn;
  }

  function updateButton(btn) {
    if (!btn) return;
    btn.classList.toggle('is-connected', isConnected());
    btn.title = isConnected()
      ? t('IRGEZTNE ID подключён', 'IRGEZTNE ID connected')
      : t('Локальный режим. Войти для чата и live-аналитики', 'Local mode. Sign in for Chat and Live Analytics');
    btn.setAttribute('aria-label', btn.title);
  }

  function placeAccountButton() {
    const workspace = findWorkspaceButton();
    const btn = getAccountButton();

    if (!workspace || !workspace.parentElement) {
      if (!btn.parentElement) document.body.appendChild(btn);
      updateButton(btn);
      return false;
    }

    const parent = workspace.parentElement;
    const hamburger = findHamburgerAfter(workspace);

    if (hamburger && hamburger.parentElement === parent) {
      if (btn.parentElement !== parent || btn.nextElementSibling !== hamburger) {
        parent.insertBefore(btn, hamburger);
      }
    } else {
      if (btn.parentElement !== parent || btn.previousElementSibling !== workspace) {
        parent.insertBefore(btn, workspace.nextSibling);
      }
    }

    btn.classList.add('is-placed-after-workspace');
    updateButton(btn);
    placedOnce = true;
    return true;
  }

  function menuHtml() {
    const s = readState();

    if (isConnected()) {
      return '' +
        '<div class="ir-connected-menu-head"><div class="ir-connected-menu-avatar"></div><div>' +
        '<strong>' + esc(s.displayName || 'IRGEZTNE ID') + '</strong>' +
        '<span>' + esc(s.email || t('Connected mode', 'Connected mode')) + '</span>' +
        '</div></div>' +
        '<div class="ir-connected-status is-connected"><span></span>' + esc(t('Connected mode', 'Connected mode')) + '</div>' +
        '<button type="button" data-ir-action="account">' + esc(t('Открыть IRGEZTNE ID', 'Open IRGEZTNE ID')) + '</button>' +
        '<button type="button" data-ir-action="logout">' + esc(t('Выйти', 'Logout')) + '</button>';
    }

    return '' +
      '<div class="ir-connected-menu-head"><div class="ir-connected-menu-avatar"></div><div>' +
      '<strong>' + esc(t('Локальный режим', 'Local mode')) + '</strong>' +
      '<span>' + esc(t('Локальные модули работают без аккаунта.', 'Local modules work without an account.')) + '</span>' +
      '</div></div>' +
      '<div class="ir-connected-status"><span></span>' + esc(t('Не подключено', 'Not connected')) + '</div>' +
      '<button type="button" class="is-primary" data-ir-action="signin">' + esc(t('Войти', 'Sign in')) + '</button>' +
      '<button type="button" data-ir-action="signup">' + esc(t('Создать аккаунт', 'Create account')) + '</button>' +
      '<p class="ir-connected-note">' + esc(t(
        'IRGEZTNE ID нужен для чата, live-аналитики, совместной работы и будущих звонков.',
        'IRGEZTNE ID is used for chat, live analytics, collaboration, and future calls.'
      )) + '</p>' +
      '<details class="ir-connected-dev"><summary>' + esc(t('Тест', 'Test')) + '</summary>' +
        '<button type="button" data-ir-action="dev-connect">' + esc(t('Подключить dev-сессию', 'Connect dev session')) + '</button>' +
      '</details>';
  }

  function ensureMenu() {
    let menu = document.getElementById('irgeztne-connected-menu-final');
    if (menu) return menu;

    menu = document.createElement('div');
    menu.id = 'irgeztne-connected-menu-final';
    menu.className = 'ir-connected-menu';
    menu.hidden = true;
    document.body.appendChild(menu);

    menu.addEventListener('click', function (event) {
      const node = event.target.closest('[data-ir-action]');
      if (!node) return;
      const action = node.getAttribute('data-ir-action');

      if (action === 'signin') signIn('signin');
      if (action === 'signup') signIn('signup');
      if (action === 'account') signIn('account');
      if (action === 'logout') logout();
      if (action === 'dev-connect') devConnect();

      closeMenu();
    });

    return menu;
  }

  function positionMenu(menu) {
    const btn = document.getElementById('irgeztne-connected-account');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = 310;
    menu.style.width = width + 'px';
    menu.style.left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width)) + 'px';
    menu.style.top = Math.min(window.innerHeight - 20, rect.bottom + 8) + 'px';
  }

  function renderMenu() {
    const menu = ensureMenu();
    menu.innerHTML = menuHtml();
    positionMenu(menu);
  }

  function openMenu() {
    renderMenu();
    const menu = ensureMenu();
    menu.hidden = false;
  }

  function closeMenu() {
    const menu = ensureMenu();
    menu.hidden = true;
  }

  function toggleMenu() {
    const menu = ensureMenu();
    if (menu.hidden) openMenu();
    else closeMenu();
  }

  function gate(kind) {
    const analytics = kind === 'analytics';
    return '<section class="ir-connected-gate">' +
      '<div class="ir-connected-gate-icon"></div>' +
      '<h3>' + esc(analytics ? t('Live Analytics требует IRGEZTNE ID', 'Live Analytics requires IRGEZTNE ID') : t('Чат требует IRGEZTNE ID', 'Chat requires IRGEZTNE ID')) + '</h3>' +
      '<p>' + esc(analytics
        ? t('Локальная сводка работает без аккаунта. Живые события и история подключаются через IRGEZTNE ID.', 'Local overview works without an account. Live events and history use IRGEZTNE ID.')
        : t('Локальные модули работают без аккаунта. Для чата нужны участники, приглашения, лимиты и защита.', 'Local modules work without an account. Chat needs participants, invites, limits, and protection.')
      ) + '</p>' +
      '<div class="ir-connected-gate-actions">' +
        '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ir-gate-action="signin">' + esc(t('Войти', 'Sign in')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ir-gate-action="signup">' + esc(t('Создать аккаунт', 'Create account')) + '</button>' +
      '</div>' +
    '</section>';
  }

  function removeLiveRoom() {
    try {
      document.querySelectorAll('[data-live-rooms-panel], .rooms-live-v1, .rooms-live-v039d, .rooms-live-v039e')
        .forEach((node) => node.remove());

      Array.from(document.querySelectorAll('section, article, div'))
        .filter((node) => {
          const value = String(node.textContent || '');
          return value.length < 2600 && (
            value.includes('IRGEZTNE LIVE') ||
            value.includes('Live room') ||
            value.includes('Live-комната')
          );
        })
        .forEach((node) => node.remove());
    } catch (error) {}
  }

  function tick() {
    placeAccountButton();
    removeLiveRoom();
  }

  function boot() {
    tick();
    renderMenu();

    let n = 0;
    const timer = setInterval(function () {
      n += 1;
      tick();
      if (n > 120 && placedOnce) clearInterval(timer);
    }, 150);

    try {
      new MutationObserver(tick).observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {}

    document.addEventListener('click', function (event) {
      const menu = ensureMenu();
      const btn = document.getElementById('irgeztne-connected-account');
      if (menu.hidden) return;
      if (menu.contains(event.target) || (btn && btn.contains(event.target))) return;
      closeMenu();
    });

    document.addEventListener('click', function (event) {
      const gateButton = event.target.closest('[data-ir-gate-action]');
      if (!gateButton) return;
      const action = gateButton.getAttribute('data-ir-gate-action');
      if (action === 'signin') signIn('signin');
      if (action === 'signup') signIn('signup');
    });

    window.addEventListener('resize', tick);
    document.addEventListener('irg:language-changed', tick);
    window.addEventListener('irg:language-changed', tick);
    window.addEventListener('irgeztne:identity-changed', tick);
    document.addEventListener('irgeztne:identity-changed', tick);
  }

  window.IRGEZTNEConnected = Object.assign({}, window.IRGEZTNEConnected || {}, {
    getState: readState,
    saveState: writeState,
    isConnected,
    signIn,
    logout,
    openMenu,
    closeMenu,
    renderGate: gate,
    connectLocalForDev: devConnect,
    placeAccountButton
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();