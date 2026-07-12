(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  function currentLang() {
    const probes = [];

    try { probes.push(document.documentElement.getAttribute('lang')); } catch (error) {}
    try { probes.push(document.body && document.body.getAttribute('data-lang')); } catch (error) {}
    try { probes.push(localStorage.getItem('irgeztne.lang')); } catch (error) {}
    try { probes.push(localStorage.getItem('irgLang')); } catch (error) {}
    try { probes.push(localStorage.getItem('ns.lang')); } catch (error) {}
    try { probes.push(localStorage.getItem('language')); } catch (error) {}

    try {
      const langButtons = Array.from(document.querySelectorAll('#langToggle, [data-lang-toggle], .lang-toggle, button'));
      const visible = langButtons
        .map((node) => String(node && node.textContent || '').trim().toLowerCase())
        .find((value) => value === 'ru' || value === 'en');
      probes.push(visible);
    } catch (error) {}

    const raw = probes
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
      .find(Boolean) || 'en';

    if (raw === 'ru' || raw.startsWith('ru') || raw.includes('рус')) return 'ru';
    return 'en';
  }

  function tr(ru, en) {
    return currentLang() === 'ru' ? ru : en;
  }

  function esc(value) {
    return S.escapeHtml(String(value == null ? '' : value));
  }

  function connectedApi() {
    return window.IRGEZTNEConnected || null;
  }

  function isConnected() {
    const api = connectedApi();
    try {
      return Boolean(api && typeof api.isConnected === 'function' && api.isConnected());
    } catch (error) {
      return false;
    }
  }

  function identityState() {
    const api = connectedApi();
    try {
      return api && typeof api.getState === 'function' ? (api.getState() || {}) : {};
    } catch (error) {
      return {};
    }
  }

  function accountIcon() {
    return '<div class="ir-chat-account-v045__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" focusable="false">' +
        '<path d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm0 2.1c-3.95 0-7.25 2.12-7.25 4.72 0 .64.52 1.18 1.18 1.18h12.14c.66 0 1.18-.54 1.18-1.18 0-2.6-3.3-4.72-7.25-4.72Z"/>' +
      '</svg>' +
    '</div>';
  }

  function statusPill(connected) {
    return '<div class="ir-chat-account-v045__status ' + (connected ? 'is-connected' : '') + '">' +
      '<i></i>' +
      esc(connected ? tr('IRGEZTNE ID подключён', 'IRGEZTNE ID connected') : tr('Локальный режим', 'Local mode')) +
    '</div>';
  }

  function renderLocalGate() {
    return '<div class="ir-chat-account-v045">' +
      '<section class="ir-chat-account-v045__main">' +
        accountIcon() +
        '<h3>' + esc(tr('Чат требует IRGEZTNE ID', 'Chat requires IRGEZTNE ID')) + '</h3>' +
        '<p>' + esc(tr(
          'Локальные модули работают без аккаунта. Для настоящего чата нужны участники, приглашения, лимиты, защита и будущие звонки — поэтому чат подключается через IRGEZTNE ID.',
          'Local modules work without an account. Real chat needs participants, invites, limits, protection, and future calls — so chat uses IRGEZTNE ID.'
        )) + '</p>' +
        '<div class="ir-chat-account-v045__actions">' +
          '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-chat-account-action="signin">' + esc(tr('Войти в IRGEZTNE ID', 'Sign in to IRGEZTNE ID')) + '</button>' +
          '<button type="button" class="ecosystem-v0-btn" data-chat-account-action="signup">' + esc(tr('Создать аккаунт', 'Create account')) + '</button>' +
        '</div>' +

      '</section>' +
      '<aside class="ir-chat-account-v045__side">' +
        statusPill(false) +
        '<div class="ir-chat-account-v045__card"><strong>' + esc(tr('Что изменилось', 'What changed')) + '</strong><span>' + esc(tr(
          'Старые технические поля скрыты. Пользовательский чат будет открываться через аккаунт, приглашение и список чатов.',
          'Old technical fields are hidden. User chat will open through account, invite, and chat list.'
        )) + '</span></div>' +
        '<div class="ir-chat-account-v045__card"><strong>' + esc(tr('Следующий шаг', 'Next step')) + '</strong><span>' + esc(tr(
          'Подключить серверный слой чата к IRGEZTNE ID.',
          'Connect the server chat layer to IRGEZTNE ID.'
        )) + '</span></div>' +
      '</aside>' +
    '</div>';
  }

  function renderConnectedGate() {
    const state = identityState();
    const name = state.displayName || state.email || 'IRGEZTNE ID';

    return '<div class="ir-chat-account-v045">' +
      '<section class="ir-chat-account-v045__main">' +
        accountIcon() +
        '<h3>' + esc(tr('IRGEZTNE ID подключён', 'IRGEZTNE ID connected')) + '</h3>' +
        '<p>' + esc(tr(
          'Аккаунт подключён. Теперь путь правильный: новый чат, приглашение, сообщение. Следующий шаг — серверный слой чата и список чатов.',
          'Account is connected. The path is now correct: new chat, invite, message. Next step: server chat layer and chat list.'
        )) + '</p>' +

      '</section>' +
      '<aside class="ir-chat-account-v045__side">' +
        statusPill(true) +
        '<div class="ir-chat-account-v045__card"><strong>' + esc(tr('Пользователь', 'User')) + '</strong><span>' + esc(name) + '</span></div>' +
        '<div class="ir-chat-account-v045__card"><strong>' + esc(tr('Основа готова', 'Foundation ready')) + '</strong><span>' + esc(tr(
          'В первом релизе чат показывает чистую connected-модель без ручных технических полей.',
          'For the first release, chat shows a clean connected model without manual technical fields.'
        )) + '</span></div>' +
      '</aside>' +
    '</div>';
  }

  function renderRooms() {
    const connected = isConnected();

    return S.renderShellIntro(
      'rooms',
      tr('Чат', 'Chat'),
      tr(
        'Чат IRGEZTNE работает как подключаемая функция через IRGEZTNE ID. Локальные модули остаются без аккаунта.',
        'IRGEZTNE Chat works as a connected feature through IRGEZTNE ID. Local modules remain account-free.'
      ),
      []
    ) + (connected ? renderConnectedGate() : renderLocalGate());
  }

  function runAccountAction(action) {
    const api = connectedApi();

    if (action === 'signin' && api && typeof api.signIn === 'function') api.signIn('signin');
    else if (action === 'signup' && api && typeof api.signIn === 'function') api.signIn('signup');
    else {
      const toggle = document.getElementById('accountToggle');
      if (toggle) toggle.click();
    }
  }

  function onClick(event) {
    const node = event.target.closest('[data-chat-account-action]');
    if (!node) return;
    event.preventDefault();
    runAccountAction(node.getAttribute('data-chat-account-action'));
  }

  function boot() {
    S.registerModule('rooms', renderRooms);
    S.renderSection('rooms');

    document.addEventListener('click', onClick);
    document.addEventListener('irg:language-changed', () => S.renderSection('rooms'));
    window.addEventListener('irg:language-changed', () => S.renderSection('rooms'));
    document.addEventListener('irgeztne:identity-changed', () => S.renderSection('rooms'));
    window.addEventListener('irgeztne:identity-changed', () => S.renderSection('rooms'));
  }

  boot();

  window.NSRoomsV0 = {
    getRoomsState: () => ({ rooms: [], activeRoomId: '', connected: isConnected() }),
    render: () => S.renderSection('rooms'),
    recordMessage: (record) => record
  };

  window.NSEcosystemV0 = Object.assign(window.NSEcosystemV0 || {}, {
    getRoomsState: window.NSRoomsV0.getRoomsState
  });
})();