(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  const CHAT_STATE_KEY = 'irgeztne.chat.v1.state';
  const DEFAULT_ENDPOINT = 'http://127.0.0.1:8787';
  const MAX_MESSAGE_LENGTH = 1200;
  const ENCRYPTION_PREFIX = 'IRGEZTNE_E2EE_V1:';

  const messageCache = Object.create(null);
  const loadingRooms = new Set();
  let lastStatus = '';
  let autoRefreshTimer = null;

  function tr(ru, en) {
    return S.t(ru, en);
  }

  function esc(value) {
    return S.escapeHtml(String(value == null ? '' : value));
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function normalizeEndpoint(value) {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    return raw || DEFAULT_ENDPOINT;
  }

  function isDefaultTitle(value) {
    const text = String(value || '').trim();
    return !text || text === 'IRGEZTNE chat' || text === 'Чат IRGEZTNE';
  }

  function defaultTitle() {
    return tr('Чат IRGEZTNE', 'IRGEZTNE chat');
  }

  function getState() {
    const state = readJson(CHAT_STATE_KEY, {});
    return {
      endpoint: normalizeEndpoint(state.endpoint || DEFAULT_ENDPOINT),
      displayName: String(state.displayName || '').trim() || 'Tom',
      activeRoomId: String(state.activeRoomId || '').trim(),
      activeToken: String(state.activeToken || '').trim(),
      activeTitle: isDefaultTitle(state.activeTitle) ? defaultTitle() : String(state.activeTitle || '').trim(),
      rooms: safeArray(state.rooms).slice(0, 20)
    };
  }

  function saveState(next) {
    const state = Object.assign(getState(), next || {});
    state.endpoint = normalizeEndpoint(state.endpoint);
    state.rooms = safeArray(state.rooms).slice(0, 20);
    writeJson(CHAT_STATE_KEY, state);
    document.dispatchEvent(new CustomEvent('ns-analytics:changed'));
  }

  function setStatus(text) {
    lastStatus = text || '';
  }

  function friendlyError(error) {
    const text = error && error.message ? String(error.message) : String(error || '');
    if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(text)) {
      return tr(
        'Live API недоступен. Для проверки запустите локальный API или укажите адрес в «Дополнительно».',
        'Live API is not reachable. Start the local API for testing or set the endpoint in “Advanced”.'
      );
    }
    if (/Room response is missing/i.test(text)) {
      return tr('API ответил, но не вернул данные чата. Проверьте версию Live API.', 'API responded but did not return chat data. Check the Live API version.');
    }
    return text;
  }

  function createInviteLink(state) {
    if (!state.activeRoomId || !state.activeToken) return '';
    return 'irgeztne-chat://join?api=' +
      encodeURIComponent(state.endpoint || DEFAULT_ENDPOINT) +
      '&room=' + encodeURIComponent(state.activeRoomId) +
      '#key=' + encodeURIComponent(state.activeToken);
  }

  function parseInvite(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      if (raw.includes('room=') || raw.includes('#key=')) {
        const url = new URL(raw);
        const hash = String(url.hash || '').replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const roomId = url.searchParams.get('room') || url.searchParams.get('roomId') || '';
        const token = hashParams.get('key') || hashParams.get('token') || '';
        const endpoint = url.searchParams.get('api') || '';
        if (roomId && token) {
          return { roomId: roomId.trim(), token: token.trim(), endpoint: endpoint ? normalizeEndpoint(endpoint) : '' };
        }
      }
    } catch (error) {}

    const parts = raw.split(/[|\s]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) return { roomId: parts[0], token: parts[1], endpoint: parts[2] || '' };

    return null;
  }

  function apiUrl(state, path) {
    return normalizeEndpoint(state.endpoint) + path;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, Object.assign({
      headers: { 'content-type': 'application/json' }
    }, options || {}));

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || data.message || ('HTTP ' + response.status));
    }

    return data;
  }

  function encoder() {
    return new TextEncoder();
  }

  function decoder() {
    return new TextDecoder();
  }

  function toBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(secret) {
    if (!crypto || !crypto.subtle) throw new Error('Web Crypto is unavailable');
    const material = encoder().encode('IRGEZTNE Chat v1 room key: ' + String(secret || ''));
    const hash = await crypto.subtle.digest('SHA-256', material);
    return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encryptText(plainText, secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(secret);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder().encode(plainText));
    return ENCRYPTION_PREFIX + JSON.stringify({
      v: 1,
      alg: 'AES-GCM',
      iv: toBase64(iv),
      data: toBase64(cipher)
    });
  }

  async function decryptText(text, secret) {
    const raw = String(text || '');
    if (!raw.startsWith(ENCRYPTION_PREFIX)) return raw;

    const payload = JSON.parse(raw.slice(ENCRYPTION_PREFIX.length));
    const key = await deriveKey(secret);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.data)
    );
    return decoder().decode(plain);
  }

  async function normalizeMessages(roomId, token, messages) {
    const output = [];
    for (const message of safeArray(messages)) {
      let text = String(message && message.text || '');
      try {
        text = await decryptText(text, token);
      } catch (error) {
        text = tr('Зашифрованное сообщение: нужен правильный ключ приглашения.', 'Encrypted message: correct invite key is required.');
      }
      output.push(Object.assign({}, message, { text }));
    }
    messageCache[roomId] = output;
  }

  async function createChat() {
    const state = getState();
    const titleNode = document.querySelector('[data-chat-title]');
    const nameNode = document.querySelector('[data-chat-name]');
    const title = String(titleNode && titleNode.value || state.activeTitle || defaultTitle()).trim() || defaultTitle();
    const name = String(nameNode && nameNode.value || state.displayName || 'Guest').trim() || 'Guest';

    saveState({ displayName: name, activeTitle: title });
    setStatus(tr('Создаём чат...', 'Creating chat...'));
    S.renderSection('rooms');

    const data = await requestJson(apiUrl(state, '/v1/rooms'), {
      method: 'POST',
      body: JSON.stringify({ title, projectId: 'irgeztne-chat-v1' })
    });

    const room = data.room || {};
    const roomId = room.id || data.roomId || '';
    const token = data.token || data.roomSecret || '';

    if (!roomId || !token) throw new Error('Room response is missing roomId/token');

    const rooms = [{
      id: roomId,
      title,
      token,
      createdAt: new Date().toISOString()
    }].concat(state.rooms.filter((item) => item.id !== roomId)).slice(0, 20);

    messageCache[roomId] = [];

    saveState({
      activeRoomId: roomId,
      activeToken: token,
      activeTitle: title,
      rooms
    });

    setStatus(tr('Чат создан. Ссылка приглашения готова.', 'Chat created. Invite link is ready.'));
    S.renderSection('rooms');
  }

  async function joinChat() {
    const state = getState();
    const inviteNode = document.querySelector('[data-chat-invite]');
    const nameNode = document.querySelector('[data-chat-name]');
    const parsed = parseInvite(inviteNode && inviteNode.value);

    if (!parsed || !parsed.roomId || !parsed.token) {
      throw new Error(tr('Вставьте invite link и нажмите «Войти».', 'Paste an invite link and press “Join”.'));
    }

    const name = String(nameNode && nameNode.value || state.displayName || 'Guest').trim() || 'Guest';
    const endpoint = parsed.endpoint || state.endpoint;
    const title = state.activeTitle || defaultTitle();

    const rooms = [{
      id: parsed.roomId,
      title,
      token: parsed.token,
      joinedAt: new Date().toISOString()
    }].concat(state.rooms.filter((item) => item.id !== parsed.roomId)).slice(0, 20);

    saveState({
      endpoint,
      displayName: name,
      activeRoomId: parsed.roomId,
      activeToken: parsed.token,
      activeTitle: title,
      rooms
    });

    setStatus(tr('Подключаемся к чату...', 'Joining chat...'));
    S.renderSection('rooms');
    await refreshMessages(true);
    setStatus(tr('Чат подключён.', 'Chat connected.'));
    S.renderSection('rooms');
  }

  async function sendMessage() {
    const state = getState();
    const input = document.querySelector('[data-chat-message]');
    const rawText = input ? String(input.value || '').trim() : '';

    if (!state.activeRoomId || !state.activeToken) {
      throw new Error(tr('Сначала нажмите «Создать чат» или войдите по invite link.', 'Create a chat first or join with an invite link.'));
    }

    if (!rawText) return;

    if (rawText.length > MAX_MESSAGE_LENGTH) {
      throw new Error(tr('Сообщение слишком длинное.', 'Message is too long.'));
    }

    const encrypted = await encryptText(rawText, state.activeToken);

    await requestJson(apiUrl(state, '/v1/rooms/' + encodeURIComponent(state.activeRoomId) + '/messages'), {
      method: 'POST',
      body: JSON.stringify({
        token: state.activeToken,
        authorName: state.displayName || 'Guest',
        text: encrypted
      })
    });

    if (input) input.value = '';
    setStatus(tr('Сообщение отправлено.', 'Message sent.'));
    await refreshMessages(true);
  }

  async function refreshMessages(silent) {
    const state = getState();
    if (!state.activeRoomId) {
      if (!silent) setStatus(tr('Сначала создайте чат или войдите по ссылке.', 'Create a chat or join by link first.'));
      return;
    }

    if (loadingRooms.has(state.activeRoomId)) return;
    loadingRooms.add(state.activeRoomId);

    try {
      const data = await requestJson(apiUrl(state, '/v1/rooms/' + encodeURIComponent(state.activeRoomId) + '/messages?limit=80'), {
        method: 'GET'
      });
      await normalizeMessages(state.activeRoomId, state.activeToken, data.messages || []);
      if (!silent) setStatus(tr('Сообщения обновлены.', 'Messages refreshed.'));
    } finally {
      loadingRooms.delete(state.activeRoomId);
    }

    S.renderSection('rooms');
  }

  async function testConnection() {
    const state = getState();
    await requestJson(apiUrl(state, '/v1/health'), { method: 'GET' });
    setStatus(tr('Live API доступен. Можно создать чат.', 'Live API is reachable. You can create a chat.'));
    S.renderSection('rooms');
  }

  function copyInvite() {
    const state = getState();
    const link = createInviteLink(state);

    if (!link) {
      setStatus(tr('Сначала создайте чат. Ссылка появится автоматически.', 'Create a chat first. The link will appear automatically.'));
      S.renderSection('rooms');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).catch(() => {});
    }

    const field = document.querySelector('[data-chat-invite-output]');
    if (field) {
      field.value = link;
      field.focus();
      field.select();
      try { document.execCommand('copy'); } catch (error) {}
    }

    setStatus(tr('Ссылка приглашения скопирована.', 'Invite link copied.'));
    S.renderSection('rooms');
  }

  function resetChat() {
    const state = getState();
    saveState({
      activeRoomId: '',
      activeToken: '',
      activeTitle: defaultTitle(),
      rooms: state.rooms
    });
    setStatus(tr('Активный чат очищен локально.', 'Active chat cleared locally.'));
    S.renderSection('rooms');
  }

  function saveSettingsFromForm() {
    const endpointNode = document.querySelector('[data-chat-endpoint]');
    const endpoint = endpointNode && endpointNode.value || DEFAULT_ENDPOINT;
    saveState({ endpoint });
    setStatus(tr('Адрес Live API сохранён.', 'Live API endpoint saved.'));
    S.renderSection('rooms');
  }

  function renderMessageList(state) {
    const messages = safeArray(messageCache[state.activeRoomId]);

    if (!state.activeRoomId) {
      return '<div class="ir-chat-empty">' +
        '<strong>' + esc(tr('Создайте чат или войдите по ссылке', 'Create a chat or join by link')) + '</strong>' +
        '<span>' + esc(tr(
          'Нажмите «Создать чат». ID и ключ приложение создаст само.',
          'Press “Create chat”. The app will create the ID and key automatically.'
        )) + '</span>' +
      '</div>';
    }

    if (!messages.length) {
      return '<div class="ir-chat-empty">' +
        '<strong>' + esc(tr('Сообщений пока нет', 'No messages yet')) + '</strong>' +
        '<span>' + esc(tr('Напишите первое сообщение.', 'Write the first message.')) + '</span>' +
      '</div>';
    }

    return '<div class="ir-chat-messages">' + messages.map((message) => {
      const mine = String(message.authorName || '') === String(state.displayName || '');
      return '<article class="ir-chat-message ' + (mine ? 'is-mine' : 'is-other') + '">' +
        '<div class="ir-chat-message-meta">' +
          '<strong>' + esc(message.authorName || 'Guest') + '</strong>' +
          '<span>' + esc(message.createdAt ? new Date(message.createdAt).toLocaleString() : '') + '</span>' +
        '</div>' +
        '<p>' + esc(message.text || '') + '</p>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderAdvanced(state) {
    return '<details class="ir-chat-advanced">' +
      '<summary>' + esc(tr('Дополнительно', 'Advanced')) + '</summary>' +
      '<div class="ir-chat-advanced-grid">' +
        '<label><span>' + esc(tr('Адрес Live API', 'Live API endpoint')) + '</span><input type="text" data-chat-endpoint value="' + esc(state.endpoint) + '"></label>' +
      '</div>' +
      '<div class="ir-chat-actions">' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-save-settings">' + esc(tr('Сохранить', 'Save')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-test-connection">' + esc(tr('Проверить', 'Test')) + '</button>' +
      '</div>' +
      '<p class="ir-chat-advanced-note">' + esc(tr(
        'Обычному пользователю сюда заходить не нужно. Чат создаёт ID и ключ автоматически.',
        'Regular users do not need this. The chat creates the ID and key automatically.'
      )) + '</p>' +
    '</details>';
  }

  function renderQuickConnect(state, invite) {
    return '<aside class="ir-chat-panel ir-chat-side">' +
      '<h4>' + esc(tr('Подключение', 'Connection')) + '</h4>' +
      '<label><span>' + esc(tr('Ваше имя', 'Your name')) + '</span><input type="text" data-chat-name value="' + esc(state.displayName) + '"></label>' +
      '<label><span>' + esc(tr('Название чата', 'Chat title')) + '</span><input type="text" data-chat-title value="' + esc(state.activeTitle || defaultTitle()) + '"></label>' +
      '<div class="ir-chat-actions ir-chat-actions--grid">' +
        '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="chat-create">' + esc(tr('Создать чат', 'Create chat')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-join">' + esc(tr('Войти по ссылке', 'Join by link')) + '</button>' +
      '</div>' +
      '<label><span>' + esc(tr('Вставьте invite link', 'Paste invite link')) + '</span><textarea data-chat-invite placeholder="' + esc(tr('Вставьте ссылку приглашения сюда...', 'Paste invite link here...')) + '"></textarea></label>' +
      '<label class="ir-chat-invite-output"><span>' + esc(tr('Ссылка приглашения', 'Invite link')) + '</span><textarea readonly data-chat-invite-output>' + esc(invite) + '</textarea></label>' +
      renderAdvanced(state) +
      '<div class="ir-chat-status-line">' + esc(lastStatus || tr('Готово. Для начала нажмите «Создать чат».', 'Ready. Press “Create chat” to start.')) + '</div>' +
    '</aside>';
  }

  function renderChatMain(state) {
    return '<section class="ir-chat-panel ir-chat-main">' +
      '<div class="ir-chat-head">' +
        '<div>' +
          '<h4>' + esc(state.activeTitle || defaultTitle()) + '</h4>' +
          '<p>' + esc(state.activeRoomId ? tr('Чат подключён. Ссылку можно скопировать для участника.', 'Chat connected. Copy the link for a participant.') : tr('Чат ещё не создан.', 'No chat created yet.')) + '</p>' +
        '</div>' +
        '<span class="ir-chat-status ' + (state.activeRoomId ? 'is-ready' : 'is-wait') + '"><i></i>' + esc(state.activeRoomId ? tr('Готов', 'Ready') : tr('Ожидает', 'Waiting')) + '</span>' +
      '</div>' +
      renderMessageList(state) +
      '<div class="ir-chat-compose">' +
        '<textarea data-chat-message maxlength="' + esc(MAX_MESSAGE_LENGTH) + '" placeholder="' + esc(tr('Напишите сообщение...', 'Write a message...')) + '"></textarea>' +
        '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="chat-send">' + esc(tr('Отправить', 'Send')) + '</button>' +
      '</div>' +
      '<div class="ir-chat-actions ir-chat-main-actions">' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-refresh">' + esc(tr('Обновить', 'Refresh')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-copy-invite">' + esc(tr('Копировать ссылку', 'Copy link')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-reset">' + esc(tr('Очистить локально', 'Clear locally')) + '</button>' +
      '</div>' +
    '</section>';
  }

  function renderChat() {
    const state = getState();
    const invite = createInviteLink(state);

    return S.renderShellIntro(
      'rooms',
      tr('Чат', 'Chat'),
      tr(
        'Рабочий чат IRGEZTNE: нажмите «Создать чат», скопируйте ссылку и отправьте участнику. Без ручных ID и ключей.',
        'IRGEZTNE work chat: press “Create chat”, copy the link, and send it to a participant. No manual IDs or keys.'
      ),
      [tr('По ссылке', 'Invite link'), tr('Без регистрации', 'No sign-up'), tr('Приватно', 'Private')]
    ) +
    '<div class="ir-chat-v1">' +
      renderQuickConnect(state, invite) +
      renderChatMain(state) +
    '</div>';
  }

  async function runAction(action) {
    if (action === 'chat-create') return createChat();
    if (action === 'chat-join') return joinChat();
    if (action === 'chat-send') return sendMessage();
    if (action === 'chat-refresh') return refreshMessages(false);
    if (action === 'chat-copy-invite') return copyInvite();
    if (action === 'chat-reset') return resetChat();
    if (action === 'chat-save-settings') return saveSettingsFromForm();
    if (action === 'chat-test-connection') return testConnection();
  }

  function handleClick(event) {
    const button = event.target.closest('[data-ecosystem-action]');
    if (!button) return;

    const action = button.getAttribute('data-ecosystem-action') || '';
    if (!action.startsWith('chat-')) return;

    event.preventDefault();
    runAction(action).catch((error) => {
      setStatus(friendlyError(error));
      S.renderSection('rooms');
    });
  }

  function handleEnter(event) {
    const target = event.target;
    if (!target || !target.matches('[data-chat-message]')) return;
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    runAction('chat-send').catch((error) => {
      setStatus(friendlyError(error));
      S.renderSection('rooms');
    });
  }

  function removeLegacyLivePanels() {
    try {
      document.querySelectorAll('[data-live-rooms-panel], .rooms-live-v1, .rooms-live-v039d, .rooms-live-v039e')
        .forEach((node) => node.remove());
    } catch (error) {}
  }

  function boot() {
    S.registerModule('rooms', renderChat);
    S.renderSection('rooms');
    removeLegacyLivePanels();

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEnter);
    document.addEventListener('irg:language-changed', () => S.renderSection('rooms'));
    window.addEventListener('irg:language-changed', () => S.renderSection('rooms'));

    if (!autoRefreshTimer) {
      autoRefreshTimer = window.setInterval(() => {
        const state = getState();
        if (!state.activeRoomId) return;
        refreshMessages(true).catch(() => {});
      }, 6500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NSRoomsV0 = {
    getRoomsState: () => {
      const state = getState();
      return { rooms: state.rooms, activeRoomId: state.activeRoomId };
    },
    render: () => S.renderSection('rooms'),
    recordMessage: (record) => record
  };
})();
