(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  const STATE_KEY = 'irgeztne.chat.v1.state';
  const DEFAULT_ENDPOINT = 'http://127.0.0.1:8787';
  const ENCRYPTION_PREFIX = 'IRGEZTNE_E2EE_V1:';
  const MAX_MESSAGE_LENGTH = 1200;

  const cache = Object.create(null);
  const loading = new Set();
  let lastStatus = '';
  let autoTimer = null;

  function tr(ru, en) {
    return S.t(ru, en);
  }

  function esc(value) {
    return S.escapeHtml(String(value == null ? '' : value));
  }

  function list(value) {
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

  function endpoint(value) {
    return String(value || DEFAULT_ENDPOINT).trim().replace(/\/+$/, '') || DEFAULT_ENDPOINT;
  }

  function state() {
    const raw = readJson(STATE_KEY, {});
    const title = String(raw.activeTitle || '').trim();

    return {
      endpoint: endpoint(raw.endpoint || DEFAULT_ENDPOINT),
      name: String(raw.displayName || raw.name || '').trim() || 'Tom',
      roomId: String(raw.activeRoomId || raw.roomId || '').trim(),
      key: String(raw.activeToken || raw.key || '').trim(),
      title: title && title !== 'IRGEZTNE chat' ? title : tr('Чат IRGEZTNE', 'IRGEZTNE chat'),
      rooms: list(raw.rooms).slice(0, 20)
    };
  }

  function save(next) {
    const current = state();
    const merged = Object.assign({}, current, next || {});
    const out = {
      endpoint: endpoint(merged.endpoint),
      displayName: merged.name,
      activeRoomId: merged.roomId,
      activeToken: merged.key,
      activeTitle: merged.title,
      rooms: list(merged.rooms).slice(0, 20)
    };

    writeJson(STATE_KEY, out);
    document.dispatchEvent(new CustomEvent('ns-analytics:changed'));
  }

  function status(text) {
    lastStatus = text || '';
  }

  function userError(error) {
    const text = error && error.message ? String(error.message) : String(error || '');
    if (/Failed to fetch|NetworkError|fetch|Load failed/i.test(text)) {
      return tr(
        'Live API недоступен. Запустите локальный API или проверьте адрес позже.',
        'Live API is not reachable. Start the local API or check the endpoint later.'
      );
    }
    if (/missing room/i.test(text)) {
      return tr('API ответил без данных чата. Проверьте версию Live API.', 'API returned no chat data. Check the Live API version.');
    }
    return text;
  }

  function apiUrl(st, path) {
    return endpoint(st.endpoint) + path;
  }

  async function json(url, options) {
    const response = await fetch(url, Object.assign({
      headers: { 'content-type': 'application/json' }
    }, options || {}));

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || data.message || ('HTTP ' + response.status));
    }

    return data;
  }

  function enc() {
    return new TextEncoder();
  }

  function dec() {
    return new TextDecoder();
  }

  function b64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function unb64(value) {
    const s = atob(String(value || ''));
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) bytes[i] = s.charCodeAt(i);
    return bytes;
  }

  async function cryptoKey(secret) {
    if (!crypto || !crypto.subtle) throw new Error('Web Crypto is unavailable');
    const material = enc().encode('IRGEZTNE Chat v1 room key: ' + String(secret || ''));
    const hash = await crypto.subtle.digest('SHA-256', material);
    return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encryptText(text, secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await cryptoKey(secret);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc().encode(text));

    return ENCRYPTION_PREFIX + JSON.stringify({
      v: 1,
      alg: 'AES-GCM',
      iv: b64(iv),
      data: b64(cipher)
    });
  }

  async function decryptText(text, secret) {
    const raw = String(text || '');
    if (!raw.startsWith(ENCRYPTION_PREFIX)) return raw;

    const payload = JSON.parse(raw.slice(ENCRYPTION_PREFIX.length));
    const key = await cryptoKey(secret);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(payload.iv) },
      key,
      unb64(payload.data)
    );

    return dec().decode(plain);
  }

  function inviteLink(st) {
    if (!st.roomId || !st.key) return '';
    return 'irgeztne-chat://join?api=' +
      encodeURIComponent(st.endpoint) +
      '&room=' + encodeURIComponent(st.roomId) +
      '#key=' + encodeURIComponent(st.key);
  }

  function parseInvite(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    try {
      const url = new URL(raw);
      const hash = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));
      const roomId = url.searchParams.get('room') || url.searchParams.get('roomId') || '';
      const key = hash.get('key') || hash.get('token') || '';
      const ep = url.searchParams.get('api') || '';
      if (roomId && key) return { roomId, key, endpoint: ep ? endpoint(ep) : '' };
    } catch (error) {}

    const parts = raw.split(/[|\s]+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) return { roomId: parts[0], key: parts[1], endpoint: parts[2] || '' };
    return null;
  }

  async function decryptMessages(roomId, key, messages) {
    const out = [];

    for (const message of list(messages)) {
      let text = String(message && message.text || '');
      try {
        text = await decryptText(text, key);
      } catch (error) {
        text = tr('Зашифрованное сообщение: нужен правильный ключ.', 'Encrypted message: correct key is required.');
      }

      out.push(Object.assign({}, message, { text }));
    }

    cache[roomId] = out;
  }

  async function createChat() {
    const st = state();
    const nameNode = document.querySelector('[data-chat-name]');
    const titleNode = document.querySelector('[data-chat-title]');
    const name = String(nameNode && nameNode.value || st.name || 'Guest').trim() || 'Guest';
    const title = String(titleNode && titleNode.value || st.title || tr('Чат IRGEZTNE', 'IRGEZTNE chat')).trim();

    save({ name, title });
    status(tr('Создаём чат...', 'Creating chat...'));
    S.renderSection('rooms');

    const data = await json(apiUrl(st, '/v1/rooms'), {
      method: 'POST',
      body: JSON.stringify({ title, projectId: 'irgeztne-chat-v1' })
    });

    const room = data.room || {};
    const roomId = room.id || data.roomId || '';
    const key = data.token || data.roomSecret || '';

    if (!roomId || !key) throw new Error('missing room id or key');

    const rooms = [{
      id: roomId,
      title,
      token: key,
      createdAt: new Date().toISOString()
    }].concat(st.rooms.filter((roomItem) => roomItem.id !== roomId)).slice(0, 20);

    cache[roomId] = [];
    save({ roomId, key, title, name, rooms });
    status(tr('Чат создан. Ссылка готова.', 'Chat created. Link is ready.'));
    S.renderSection('rooms');
  }

  async function joinChat() {
    const st = state();
    const inviteNode = document.querySelector('[data-chat-invite]');
    const nameNode = document.querySelector('[data-chat-name]');
    const parsed = parseInvite(inviteNode && inviteNode.value);

    if (!parsed) {
      throw new Error(tr('Вставьте ссылку приглашения.', 'Paste the invite link.'));
    }

    const name = String(nameNode && nameNode.value || st.name || 'Guest').trim() || 'Guest';
    const ep = parsed.endpoint || st.endpoint;
    const rooms = [{
      id: parsed.roomId,
      title: st.title,
      token: parsed.key,
      joinedAt: new Date().toISOString()
    }].concat(st.rooms.filter((roomItem) => roomItem.id !== parsed.roomId)).slice(0, 20);

    save({ endpoint: ep, name, roomId: parsed.roomId, key: parsed.key, rooms });
    status(tr('Подключаемся...', 'Joining...'));
    S.renderSection('rooms');

    await refresh(true);
    status(tr('Чат подключён.', 'Chat connected.'));
    S.renderSection('rooms');
  }

  async function refresh(silent) {
    const st = state();
    if (!st.roomId) {
      if (!silent) status(tr('Сначала создайте чат или войдите по ссылке.', 'Create a chat or join by link first.'));
      return;
    }

    if (loading.has(st.roomId)) return;
    loading.add(st.roomId);

    try {
      const data = await json(apiUrl(st, '/v1/rooms/' + encodeURIComponent(st.roomId) + '/messages?limit=80'), {
        method: 'GET'
      });
      await decryptMessages(st.roomId, st.key, data.messages || []);
      if (!silent) status(tr('Обновлено.', 'Refreshed.'));
    } finally {
      loading.delete(st.roomId);
    }

    S.renderSection('rooms');
  }

  async function sendMessage() {
    const st = state();
    const input = document.querySelector('[data-chat-message]');
    const text = input ? String(input.value || '').trim() : '';

    if (!st.roomId || !st.key) {
      throw new Error(tr('Сначала создайте чат или войдите по ссылке.', 'Create a chat or join by link first.'));
    }

    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw new Error(tr('Сообщение слишком длинное.', 'Message is too long.'));
    }

    const encrypted = await encryptText(text, st.key);

    await json(apiUrl(st, '/v1/rooms/' + encodeURIComponent(st.roomId) + '/messages'), {
      method: 'POST',
      body: JSON.stringify({
        token: st.key,
        authorName: st.name || 'Guest',
        text: encrypted
      })
    });

    if (input) input.value = '';
    status(tr('Отправлено.', 'Sent.'));
    await refresh(true);
  }

  function copyInvite() {
    const st = state();
    const link = inviteLink(st);

    if (!link) {
      status(tr('Сначала создайте чат.', 'Create a chat first.'));
      S.renderSection('rooms');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).catch(() => {});
    }

    const out = document.querySelector('[data-chat-invite-output]');
    if (out) {
      out.value = link;
      out.focus();
      out.select();
      try { document.execCommand('copy'); } catch (error) {}
    }

    status(tr('Ссылка скопирована.', 'Link copied.'));
    S.renderSection('rooms');
  }

  function clearLocal() {
    const st = state();
    save({ roomId: '', key: '', title: tr('Чат IRGEZTNE', 'IRGEZTNE chat'), rooms: st.rooms });
    status(tr('Активный чат очищен локально.', 'Active chat cleared locally.'));
    S.renderSection('rooms');
  }

  function saveEndpoint() {
    const st = state();
    const input = document.querySelector('[data-chat-endpoint]');
    save({ endpoint: input && input.value ? input.value : st.endpoint });
    status(tr('Адрес API сохранён.', 'API endpoint saved.'));
    S.renderSection('rooms');
  }

  async function testApi() {
    const st = state();
    await json(apiUrl(st, '/v1/health'), { method: 'GET' });
    status(tr('API доступен.', 'API is reachable.'));
    S.renderSection('rooms');
  }

  function renderMessages(st) {
    const messages = list(cache[st.roomId]);

    if (!st.roomId) {
      return '<div class="ir-chat-empty">' +
        '<strong>' + esc(tr('Готово к чату', 'Ready for chat')) + '</strong>' +
        '<span>' + esc(tr('Нажмите «Создать» — ссылка появится автоматически.', 'Press “Create” — the link appears automatically.')) + '</span>' +
      '</div>';
    }

    if (!messages.length) {
      return '<div class="ir-chat-empty">' +
        '<strong>' + esc(tr('Сообщений пока нет', 'No messages yet')) + '</strong>' +
        '<span>' + esc(tr('Напишите первое сообщение.', 'Write the first message.')) + '</span>' +
      '</div>';
    }

    return '<div class="ir-chat-messages">' + messages.map((message) => {
      const mine = String(message.authorName || '') === String(st.name || '');
      return '<article class="ir-chat-message ' + (mine ? 'is-mine' : 'is-other') + '">' +
        '<div class="ir-chat-message-meta">' +
          '<strong>' + esc(message.authorName || 'Guest') + '</strong>' +
          '<span>' + esc(message.createdAt ? new Date(message.createdAt).toLocaleString() : '') + '</span>' +
        '</div>' +
        '<p>' + esc(message.text || '') + '</p>' +
      '</article>';
    }).join('') + '</div>';
  }

  function renderStart(st) {
    const link = inviteLink(st);

    return '<section class="ir-chat-panel ir-chat-start">' +
      '<div class="ir-chat-title-row">' +
        '<div>' +
          '<h4>' + esc(tr('Быстрое подключение', 'Quick start')) + '</h4>' +
          '<p>' + esc(tr('Создать чат или войти по ссылке.', 'Create a chat or join by link.')) + '</p>' +
        '</div>' +
        '<span class="ir-chat-pill ' + (st.roomId ? 'is-ready' : '') + '"><i></i>' + esc(st.roomId ? tr('Готов', 'Ready') : tr('Нет чата', 'No chat')) + '</span>' +
      '</div>' +

      '<div class="ir-chat-small-grid">' +
        '<label><span>' + esc(tr('Имя', 'Name')) + '</span><input type="text" data-chat-name value="' + esc(st.name) + '"></label>' +
        '<label><span>' + esc(tr('Название', 'Title')) + '</span><input type="text" data-chat-title value="' + esc(st.title) + '"></label>' +
      '</div>' +

      '<div class="ir-chat-actions ir-chat-actions--two">' +
        '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="chat-create">' + esc(tr('Создать', 'Create')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-join">' + esc(tr('Войти', 'Join')) + '</button>' +
      '</div>' +

      '<label class="ir-chat-join-box"><span>' + esc(tr('Ссылка приглашения', 'Invite link')) + '</span><textarea data-chat-invite placeholder="' + esc(tr('Вставьте ссылку сюда...', 'Paste a link here...')) + '"></textarea></label>' +

      '<div class="ir-chat-link-row ' + (link ? 'is-visible' : '') + '">' +
        '<textarea readonly data-chat-invite-output>' + esc(link) + '</textarea>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-copy-invite">' + esc(tr('Копировать', 'Copy')) + '</button>' +
      '</div>' +
    '</section>';
  }

  function renderChatBox(st) {
    return '<section class="ir-chat-panel ir-chat-main">' +
      '<div class="ir-chat-title-row">' +
        '<div>' +
          '<h4>' + esc(st.title || tr('Чат IRGEZTNE', 'IRGEZTNE chat')) + '</h4>' +
          '<p>' + esc(st.roomId ? tr('Чат подключён.', 'Chat connected.') : tr('Создайте чат одним нажатием.', 'Create a chat in one click.')) + '</p>' +
        '</div>' +
        '<span class="ir-chat-pill ' + (st.roomId ? 'is-ready' : '') + '"><i></i>' + esc(st.roomId ? tr('Онлайн', 'Online') : tr('Ожидает', 'Waiting')) + '</span>' +
      '</div>' +
      renderMessages(st) +
      '<div class="ir-chat-compose">' +
        '<textarea data-chat-message maxlength="' + esc(MAX_MESSAGE_LENGTH) + '" placeholder="' + esc(tr('Сообщение...', 'Message...')) + '"></textarea>' +
        '<button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="chat-send">' + esc(tr('Отправить', 'Send')) + '</button>' +
      '</div>' +
      '<div class="ir-chat-actions ir-chat-actions--three">' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-refresh">' + esc(tr('Обновить', 'Refresh')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-copy-invite">' + esc(tr('Ссылка', 'Link')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-clear-local">' + esc(tr('Очистить', 'Clear')) + '</button>' +
      '</div>' +
    '</section>';
  }

  function renderSettings(st) {
    return '<details class="ir-chat-settings">' +
      '<summary>' + esc(tr('Настройки API', 'API settings')) + '</summary>' +
      '<label><span>' + esc(tr('Адрес', 'Endpoint')) + '</span><input type="text" data-chat-endpoint value="' + esc(st.endpoint) + '"></label>' +
      '<div class="ir-chat-actions ir-chat-actions--two">' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-save-endpoint">' + esc(tr('Сохранить', 'Save')) + '</button>' +
        '<button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-test-api">' + esc(tr('Проверить', 'Test')) + '</button>' +
      '</div>' +
    '</details>';
  }

  function renderChat() {
    const st = state();

    return S.renderShellIntro(
      'rooms',
      tr('Чат', 'Chat'),
      tr(
        'Рабочий чат IRGEZTNE: создать, скопировать ссылку и общаться.',
        'IRGEZTNE work chat: create, copy the link, and talk.'
      ),
      []
    ) +
      '<div class="ir-chat-v1">' +
        renderStart(st) +
        renderChatBox(st) +
        '<div class="ir-chat-bottom">' +
          '<div class="ir-chat-status-line">' + esc(lastStatus || tr('Готово.', 'Ready.')) + '</div>' +
          renderSettings(st) +
        '</div>' +
      '</div>';
  }

  async function run(action) {
    if (action === 'chat-create') return createChat();
    if (action === 'chat-join') return joinChat();
    if (action === 'chat-send') return sendMessage();
    if (action === 'chat-refresh') return refresh(false);
    if (action === 'chat-copy-invite') return copyInvite();
    if (action === 'chat-clear-local') return clearLocal();
    if (action === 'chat-save-endpoint') return saveEndpoint();
    if (action === 'chat-test-api') return testApi();
  }

  function onClick(event) {
    const button = event.target.closest('[data-ecosystem-action]');
    if (!button) return;

    const action = button.getAttribute('data-ecosystem-action') || '';
    if (!action.startsWith('chat-')) return;

    event.preventDefault();
    run(action).catch((error) => {
      status(userError(error));
      S.renderSection('rooms');
    });
  }

  function onKey(event) {
    const target = event.target;
    if (!target || !target.matches('[data-chat-message]')) return;
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    run('chat-send').catch((error) => {
      status(userError(error));
      S.renderSection('rooms');
    });
  }

  function removeLegacy() {
    try {
      document.querySelectorAll('[data-live-rooms-panel], .rooms-live-v1, .rooms-live-v039d, .rooms-live-v039e')
        .forEach((node) => node.remove());
    } catch (error) {}
  }

  function boot() {
    S.registerModule('rooms', renderChat);
    S.renderSection('rooms');
    removeLegacy();

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('irg:language-changed', () => S.renderSection('rooms'));
    window.addEventListener('irg:language-changed', () => S.renderSection('rooms'));

    if (!autoTimer) {
      autoTimer = window.setInterval(() => {
        const st = state();
        if (!st.roomId) return;
        refresh(true).catch(() => {});
      }, 7000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NSRoomsV0 = {
    getRoomsState: () => {
      const st = state();
      return { rooms: st.rooms, activeRoomId: st.roomId };
    },
    render: () => S.renderSection('rooms'),
    recordMessage: (record) => record
  };
})();
