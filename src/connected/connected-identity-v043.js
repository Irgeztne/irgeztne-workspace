(function () {
  'use strict';

  const STATE_KEY = 'irgeztne.connected.identity.v1';
  const DEFAULT_ACCOUNT_URL = 'https://irgeztne.com/account';
  const DEFAULT_API_URL = 'https://api.irgeztne.com';
  let mounted = false;

  function lang() {
    try {
      const raw = (document.documentElement.getAttribute('lang') || localStorage.getItem('irgeztne.lang') || '').toLowerCase();
      return raw.startsWith('ru') ? 'ru' : 'en';
    } catch (error) { return 'en'; }
  }
  function t(ru, en) { return lang() === 'ru' ? ru : en; }
  function esc(value) {
    const div = document.createElement('div');
    div.textContent = String(value == null ? '' : value);
    return div.innerHTML;
  }
  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (error) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }
  function getState() {
    const raw = readJson(STATE_KEY, {}) || {};
    return {
      mode: raw.mode === 'connected' ? 'connected' : 'local',
      userId: String(raw.userId || ''),
      displayName: String(raw.displayName || ''),
      email: String(raw.email || ''),
      accessToken: String(raw.accessToken || ''),
      accountUrl: String(raw.accountUrl || DEFAULT_ACCOUNT_URL),
      apiUrl: String(raw.apiUrl || DEFAULT_API_URL),
      updatedAt: raw.updatedAt || ''
    };
  }
  function saveState(next) {
    const state = Object.assign(getState(), next || {}, { updatedAt: new Date().toISOString() });
    writeJson(STATE_KEY, state);
    window.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: state }));
    document.dispatchEvent(new CustomEvent('irgeztne:identity-changed', { detail: state }));
    updateButton(); renderMenu(); protectChat();
    return state;
  }
  function isConnected() {
    const state = getState();
    return state.mode === 'connected' && !!state.accessToken;
  }
  function openExternal(url) {
    try {
      if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(url); return;
      }
    } catch (error) {}
    try { window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (error) { location.href = url; }
  }
  function signIn(mode) {
    const state = getState();
    const url = state.accountUrl || DEFAULT_ACCOUNT_URL;
    const sep = url.includes('?') ? '&' : '?';
    openExternal(url + sep + 'mode=' + encodeURIComponent(mode || 'signin') + '&from=workspace');
  }
  function logout() { saveState({ mode: 'local', userId: '', displayName: '', email: '', accessToken: '' }); }
  function connectLocalForDev() {
    saveState({ mode: 'connected', userId: 'local-dev', displayName: 'Tom', email: 'local@irgeztne.dev', accessToken: 'local-dev-token' });
  }

  function text(node) { return String(node && node.textContent || '').replace(/\s+/g, ' ').trim(); }
  function findWorkspaceButton() {
    return Array.from(document.querySelectorAll('button,a,[role="button"]')).find((node) => {
      const s = (text(node) + ' ' + (node.getAttribute('title') || '') + ' ' + (node.getAttribute('aria-label') || '')).toLowerCase();
      return s.includes('workspace') || s.includes('пространство');
    }) || null;
  }
  function findHamburgerButton() {
    return Array.from(document.querySelectorAll('button,a,[role="button"]')).find((node) => {
      const s = (text(node) + ' ' + (node.getAttribute('title') || '') + ' ' + (node.getAttribute('aria-label') || '') + ' ' + String(node.className || '')).toLowerCase();
      return s.includes('hamburger') || s.includes('menu') || s.includes('sidebar') || s.includes('navigation') || text(node) === '☰' || text(node) === '≡';
    }) || null;
  }
  function host() { return document.querySelector('.browser-toolbar,.topbar,.app-topbar,.workspace-topbar,.titlebar,header,.toolbar') || document.body; }

  function makeButton() {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'irgeztne-connected-account'; b.className = 'ir-connected-account-btn';
    b.setAttribute('data-ir-connected-account', 'button'); b.setAttribute('aria-haspopup', 'menu');
    b.innerHTML = '<span class="ir-connected-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 12.3a4.15 4.15 0 1 0 0-8.3 4.15 4.15 0 0 0 0 8.3Zm0 2.05c-3.8 0-7 2.05-7 4.55 0 .62.5 1.1 1.1 1.1h11.8c.6 0 1.1-.48 1.1-1.1 0-2.5-3.2-4.55-7-4.55Z"/></svg></span><span class="ir-connected-dot" aria-hidden="true"></span>';
    b.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); toggleMenu(); });
    return b;
  }
  function mountButton() {
    if (document.getElementById('irgeztne-connected-account')) return;
    const b = makeButton(); const workspace = findWorkspaceButton(); const burger = findHamburgerButton();
    if (workspace && workspace.parentElement) workspace.parentElement.insertBefore(b, workspace);
    else if (burger && burger.parentElement && burger.nextSibling) burger.parentElement.insertBefore(b, burger.nextSibling);
    else if (burger && burger.parentElement) burger.parentElement.appendChild(b);
    else host().insertBefore(b, host().firstChild || null);
    updateButton();
  }
  function updateButton() {
    const b = document.getElementById('irgeztne-connected-account'); if (!b) return;
    b.classList.toggle('is-connected', isConnected());
    b.title = isConnected() ? t('IRGEZTNE ID подключён', 'IRGEZTNE ID connected') : t('Локальный режим. Войти для Chat и Live Analytics', 'Local mode. Sign in for Chat and Live Analytics');
    b.setAttribute('aria-label', b.title);
  }

  function ensureMenu() {
    let menu = document.getElementById('irgeztne-connected-menu'); if (menu) return menu;
    menu = document.createElement('div'); menu.id = 'irgeztne-connected-menu'; menu.className = 'ir-connected-menu'; menu.hidden = true;
    document.body.appendChild(menu);
    menu.addEventListener('click', function (event) {
      const node = event.target.closest('[data-ir-connected-action]'); if (!node) return;
      event.preventDefault();
      const action = node.getAttribute('data-ir-connected-action');
      if (action === 'signin') signIn('signin');
      if (action === 'signup') signIn('signup');
      if (action === 'account') signIn('account');
      if (action === 'settings') showSettingsPanel();
      if (action === 'logout') logout();
      if (action === 'dev-connect') connectLocalForDev();
      if (action !== 'settings') closeMenu();
    });
    return menu;
  }
  function menuHtml() {
    const state = getState();
    if (isConnected()) return '' +
      '<div class="ir-connected-menu-head"><div class="ir-connected-menu-avatar"></div><div><strong>' + esc(state.displayName || 'IRGEZTNE ID') + '</strong><span>' + esc(state.email || t('Connected mode', 'Connected mode')) + '</span></div></div>' +
      '<div class="ir-connected-status is-connected"><span></span>' + esc(t('Connected mode', 'Connected mode')) + '</div>' +
      '<button type="button" data-ir-connected-action="settings">' + esc(t('Настройки подключения', 'Connection settings')) + '</button>' +
      '<button type="button" data-ir-connected-action="account">' + esc(t('Открыть IRGEZTNE ID', 'Open IRGEZTNE ID')) + '</button>' +
      '<button type="button" data-ir-connected-action="logout">' + esc(t('Выйти', 'Logout')) + '</button>';
    return '' +
      '<div class="ir-connected-menu-head"><div class="ir-connected-menu-avatar"></div><div><strong>' + esc(t('Локальный режим', 'Local mode')) + '</strong><span>' + esc(t('Web Studio и локальные модули работают без аккаунта.', 'Web Studio and local modules work without an account.')) + '</span></div></div>' +
      '<div class="ir-connected-status"><span></span>' + esc(t('Не подключено', 'Not connected')) + '</div>' +
      '<button type="button" data-ir-connected-action="signin" class="is-primary">' + esc(t('Войти', 'Sign in')) + '</button>' +
      '<button type="button" data-ir-connected-action="signup">' + esc(t('Создать аккаунт', 'Create account')) + '</button>' +
      '<p class="ir-connected-note">' + esc(t('IRGEZTNE ID нужен для чата, live-аналитики, совместной работы и будущих звонков.', 'IRGEZTNE ID is used for chat, live analytics, collaboration, and future calls.')) + '</p>' +
      '<details class="ir-connected-dev"><summary>' + esc(t('Тест', 'Test')) + '</summary><button type="button" data-ir-connected-action="dev-connect">' + esc(t('Подключить локальную dev-сессию', 'Connect local dev session')) + '</button></details>';
  }
  function positionMenu(menu) {
    const b = document.getElementById('irgeztne-connected-account'); if (!b) return;
    const r = b.getBoundingClientRect(); const width = 300;
    menu.style.left = Math.max(10, Math.min(window.innerWidth - width - 10, r.left)) + 'px';
    menu.style.top = Math.min(window.innerHeight - 20, r.bottom + 8) + 'px';
    menu.style.width = width + 'px';
  }
  function renderMenu() { const menu = ensureMenu(); menu.innerHTML = menuHtml(); positionMenu(menu); }
  function openMenu() { const menu = ensureMenu(); renderMenu(); menu.hidden = false; }
  function closeMenu() { ensureMenu().hidden = true; }
  function toggleMenu() { const menu = ensureMenu(); menu.hidden ? openMenu() : closeMenu(); }
  function showSettingsPanel() {
    const state = getState(); const menu = ensureMenu();
    menu.innerHTML = '<div class="ir-connected-menu-head"><div class="ir-connected-menu-avatar"></div><div><strong>' + esc(t('Настройки IRGEZTNE ID', 'IRGEZTNE ID settings')) + '</strong><span>' + esc(t('Минимальный connected foundation.', 'Minimal connected foundation.')) + '</span></div></div>' +
      '<label class="ir-connected-field"><span>Account URL</span><input data-ir-connected-account-url value="' + esc(state.accountUrl) + '"></label>' +
      '<label class="ir-connected-field"><span>API URL</span><input data-ir-connected-api-url value="' + esc(state.apiUrl) + '"></label>' +
      '<button type="button" data-ir-connected-save-settings class="is-primary">' + esc(t('Сохранить', 'Save')) + '</button>' +
      '<button type="button" data-ir-connected-action="account">' + esc(t('Открыть сайт аккаунта', 'Open account site')) + '</button>';
    const saveBtn = menu.querySelector('[data-ir-connected-save-settings]');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      saveState({ accountUrl: (menu.querySelector('[data-ir-connected-account-url]') || {}).value || DEFAULT_ACCOUNT_URL, apiUrl: (menu.querySelector('[data-ir-connected-api-url]') || {}).value || DEFAULT_API_URL });
    });
    menu.hidden = false; positionMenu(menu);
  }

  function renderGate(kind) {
    const isAnalytics = kind === 'analytics';
    return '<section class="ir-connected-gate" data-ir-connected-gate="' + esc(kind || 'feature') + '"><div class="ir-connected-gate-icon"></div><h3>' +
      esc(isAnalytics ? t('Live Analytics требует IRGEZTNE ID', 'Live Analytics requires IRGEZTNE ID') : t('Chat требует IRGEZTNE ID', 'Chat requires IRGEZTNE ID')) + '</h3><p>' +
      esc(isAnalytics ? t('Локальная сводка может работать без аккаунта. Живые события, сайты, лимиты и история подключаются через IRGEZTNE ID.', 'Local overview can work without an account. Live events, sites, limits, and history use IRGEZTNE ID.') : t('Локальные модули работают без аккаунта. Для чата нужны участники, приглашения, лимиты и защита — поэтому используется IRGEZTNE ID.', 'Local modules work without an account. Chat needs participants, invites, limits, and protection — so it uses IRGEZTNE ID.')) +
      '</p><div class="ir-connected-gate-actions"><button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ir-connected-gate-action="signin">' + esc(t('Войти', 'Sign in')) + '</button><button type="button" class="ecosystem-v0-btn" data-ir-connected-gate-action="signup">' + esc(t('Создать аккаунт', 'Create account')) + '</button></div></section>';
  }
  function protectChat() {
    if (isConnected()) return;
    Array.from(document.querySelectorAll('.ir-chat-v1')).forEach(function (node) {
      if (node.getAttribute('data-ir-connected-protected') === '1') return;
      node.setAttribute('data-ir-connected-protected', '1');
      node.innerHTML = renderGate('chat');
    });
  }
  function bindGateClicks() {
    document.addEventListener('click', function (event) {
      const node = event.target.closest('[data-ir-connected-gate-action]'); if (!node) return;
      const action = node.getAttribute('data-ir-connected-gate-action');
      if (action === 'signin') signIn('signin');
      if (action === 'signup') signIn('signup');
    });
  }
  function boot() {
    if (mounted) return; mounted = true;
    mountButton(); renderMenu(); bindGateClicks(); protectChat();
    try { new MutationObserver(protectChat).observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (e) {}
    document.addEventListener('click', function (event) {
      const menu = document.getElementById('irgeztne-connected-menu'); const b = document.getElementById('irgeztne-connected-account');
      if (!menu || menu.hidden) return; if (menu.contains(event.target) || (b && b.contains(event.target))) return; closeMenu();
    });
    window.addEventListener('resize', function () { const menu = document.getElementById('irgeztne-connected-menu'); if (menu && !menu.hidden) positionMenu(menu); });
    document.addEventListener('irg:language-changed', function () { updateButton(); renderMenu(); protectChat(); });
    window.addEventListener('irg:language-changed', function () { updateButton(); renderMenu(); protectChat(); });
  }
  window.IRGEZTNEConnected = { getState, saveState, isConnected, signIn, logout, renderGate, openMenu, closeMenu, connectLocalForDev };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
