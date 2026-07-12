(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  const CHAT_STATE_KEY = 'irgeztne.chat.v1.state';
  const DEFAULT_ENDPOINT = 'http://127.0.0.1:8787';
  const MAX_LOCAL_MESSAGE = 700;
  const ENCRYPTION_PREFIX = 'IRGEZTNE_E2EE_V1:';
  const messageCache = Object.create(null);
  const decryptingRooms = new Set();
  let lastStatus = '';
  let autoRefreshTimer = null;

  function tr(ru, en) { return S.t(ru, en); }
  function esc(value) { return S.escapeHtml(String(value == null ? '' : value)); }
  function safeArray(value) { return Array.isArray(value) ? value : []; }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  function normalizeEndpoint(value) {
    const raw = String(value || '').trim().replace(/\/+$/, '');
    return raw || DEFAULT_ENDPOINT;
  }

  function getState() {
    const state = readJson(CHAT_STATE_KEY, {});
    return {
      endpoint: normalizeEndpoint(state.endpoint || DEFAULT_ENDPOINT),
      displayName: String(state.displayName || '').trim() || 'Tom',
      activeRoomId: String(state.activeRoomId || '').trim(),
      activeToken: String(state.activeToken || '').trim(),
      activeTitle: String(state.activeTitle || '').trim() || 'IRGEZTNE chat',
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

  function setStatus(text) { lastStatus = text || ''; }

  function createInviteLink(state) {
    if (!state.activeRoomId || !state.activeToken) return '';
    return 'irgeztne-chat://join?api=' + encodeURIComponent(state.endpoint || DEFAULT_ENDPOINT) +
      '&room=' + encodeURIComponent(state.activeRoomId) + '#key=' + encodeURIComponent(state.activeToken);
  }

  function parseInvite(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
      if (raw.includes('room=') || raw.includes('#key=')) {
        const url = new URL(raw);
        const roomId = url.searchParams.get('room') || url.searchParams.get('roomId') || '';
        const endpoint = url.searchParams.get('api') || '';
        const hashParams = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));
        const token = hashParams.get('key') || hashParams.get('token') || '';
        if (roomId && token) return { roomId: roomId.trim(), token: token.trim(), endpoint: endpoint ? normalizeEndpoint(endpoint) : '' };
      }
    } catch (error) {}
    const pipe = raw.split('|').map((part) => part.trim()).filter(Boolean);
    if (pipe.length >= 2) return { roomId: pipe[0], token: pipe[1], endpoint: pipe[2] || '' };
    const spaced = raw.split(/\s+/).map((part) => part.trim()).filter(Boolean);
    if (spaced.length >= 2) return { roomId: spaced[0], token: spaced[1], endpoint: spaced[2] || '' };
    return { roomId: raw, token: '', endpoint: '' };
  }

  function apiUrl(state, path) { return normalizeEndpoint(state.endpoint) + path; }

  async function requestJson(url, options) {
    const response = await fetch(url, Object.assign({ headers: { 'content-type': 'application/json' } }, options || {}));
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || ('HTTP ' + response.status));
    return data;
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
    const material = new TextEncoder().encode('IRGEZTNE Chat v1 room key: ' + String(secret || ''));
    const hash = await crypto.subtle.digest('SHA-256', material);
    return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function encryptText(plainText, secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(secret);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText));
    return ENCRYPTION_PREFIX + JSON.stringify({ alg: 'AES-GCM', v: 1, iv: toBase64(iv), data: toBase64(cipher) });
  }

  async function decryptText(text, secret) {
    const raw = String(text || '');
    if (!raw.startsWith(ENCRYPTION_PREFIX)) return raw;
    const payload = JSON.parse(raw.slice(ENCRYPTION_PREFIX.length));
    const key = await deriveKey(secret);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
    return new TextDecoder().decode(plain);
  }

  async function normalizeMessages(roomId, token, messages) {
    const output = [];
    for (const message of safeArray(messages)) {
      let text = String(message && message.text || '');
      try { text = await decryptText(text, token); }
      catch (error) { text = tr('Зашифрованное сообщение: нет ключа или сообщение повреждено.', 'Encrypted message: missing key or damaged message.'); }
      output.push(Object.assign({}, message, { text }));
    }
    messageCache[roomId] = output;
  }

  async function createChat() {
    const state = getState();
    const title = (document.querySelector('[data-chat-title]') || {}).value || state.activeTitle || 'IRGEZTNE chat';
    const name = (document.querySelector('[data-chat-name]') || {}).value || state.displayName;
    saveState({ displayName: name, activeTitle: title });
    const data = await requestJson(apiUrl(state, '/v1/rooms'), { method: 'POST', body: JSON.stringify({ title, projectId: 'irgeztne-chat-v1' }) });
    const room = data.room || {};
    const roomId = room.id || data.roomId || '';
    const token = data.token || data.roomSecret || '';
    if (!roomId || !token) throw new Error('Room response is missing roomId/token');
    const rooms = [{ id: roomId, title, token, createdAt: new Date().toISOString() }].concat(state.rooms.filter((item) => item.id !== roomId)).slice(0, 20);
    saveState({ activeRoomId: roomId, activeToken: token, activeTitle: title, rooms });
    messageCache[roomId] = [];
    setStatus(tr('Чат создан. Скопируйте invite link и отправьте участнику.', 'Chat created. Copy the invite link and send it to a participant.'));
    S.renderSection('rooms');
  }

  async function joinChat() {
    const state = getState();
    const invite = (document.querySelector('[data-chat-invite]') || {}).value || '';
    const roomField = (document.querySelector('[data-chat-room-id]') || {}).value || '';
    const tokenField = (document.querySelector('[data-chat-room-token]') || {}).value || '';
    const parsed = parseInvite(invite) || {};
    const roomId = String(parsed.roomId || roomField || '').trim();
    const token = String(parsed.token || tokenField || '').trim();
    const endpoint = parsed.endpoint || state.endpoint;
    const name = (document.querySelector('[data-chat-name]') || {}).value || state.displayName;
    if (!roomId || !token) throw new Error(tr('Нужны Room ID и secret/key.', 'Room ID and secret/key are required.'));
    const title = state.activeTitle || 'IRGEZTNE chat';
    const rooms = [{ id: roomId, title, token, joinedAt: new Date().toISOString() }].concat(state.rooms.filter((item) => item.id !== roomId)).slice(0, 20);
    saveState({ endpoint, displayName: name, activeRoomId: roomId, activeToken: token, activeTitle: title, rooms });
    await refreshMessages(true);
    setStatus(tr('Чат подключён.', 'Chat connected.'));
    S.renderSection('rooms');
  }

  async function sendMessage() {
    const state = getState();
    const input = document.querySelector('[data-chat-message]');
    const rawText = input ? String(input.value || '').trim() : '';
    if (!state.activeRoomId || !state.activeToken) throw new Error(tr('Сначала создайте или подключите чат.', 'Create or join a chat first.'));
    if (!rawText) return;
    if (rawText.length > MAX_LOCAL_MESSAGE) throw new Error(tr('Сообщение слишком длинное для encrypted v1. Сократите текст.', 'Message is too long for encrypted v1. Please shorten it.'));
    const encrypted = await encryptText(rawText, state.activeToken);
    await requestJson(apiUrl(state, '/v1/rooms/' + encodeURIComponent(state.activeRoomId) + '/messages'), {
      method: 'POST',
      body: JSON.stringify({ token: state.activeToken, authorName: state.displayName || 'Guest', text: encrypted })
    });
    if (input) input.value = '';
    setStatus(tr('Сообщение отправлено в зашифрованном виде.', 'Message sent encrypted.'));
    await refreshMessages(true);
  }

  async function refreshMessages(silent) {
    const state = getState();
    if (!state.activeRoomId) { if (!silent) setStatus(tr('Нет активного чата.', 'No active chat.')); return; }
    if (decryptingRooms.has(state.activeRoomId)) return;
    decryptingRooms.add(state.activeRoomId);
    try {
      const data = await requestJson(apiUrl(state, '/v1/rooms/' + encodeURIComponent(state.activeRoomId) + '/messages?limit=80'), { method: 'GET' });
      await normalizeMessages(state.activeRoomId, state.activeToken, data.messages || []);
      if (!silent) setStatus(tr('Сообщения обновлены.', 'Messages refreshed.'));
    } finally { decryptingRooms.delete(state.activeRoomId); }
    S.renderSection('rooms');
  }

  async function testConnection() {
    const state = getState();
    await requestJson(apiUrl(state, '/v1/health'), { method: 'GET' });
    setStatus(tr('Live API доступен.', 'Live API is reachable.'));
    S.renderSection('rooms');
  }

  function copyInvite() {
    const state = getState();
    const link = createInviteLink(state);
    if (!link) { setStatus(tr('Сначала создайте или подключите чат.', 'Create or join a chat first.')); S.renderSection('rooms'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).catch(() => {});
    const field = document.querySelector('[data-chat-invite-output]');
    if (field) { field.value = link; field.focus(); field.select(); try { document.execCommand('copy'); } catch (error) {} }
    setStatus(tr('Invite link скопирован.', 'Invite link copied.'));
    S.renderSection('rooms');
  }

  function saveSettingsFromForm() {
    saveState({
      endpoint: (document.querySelector('[data-chat-endpoint]') || {}).value || DEFAULT_ENDPOINT,
      displayName: (document.querySelector('[data-chat-name]') || {}).value || 'Guest',
      activeTitle: (document.querySelector('[data-chat-title]') || {}).value || 'IRGEZTNE chat',
      activeRoomId: String((document.querySelector('[data-chat-room-id]') || {}).value || '').trim(),
      activeToken: String((document.querySelector('[data-chat-room-token]') || {}).value || '').trim()
    });
    setStatus(tr('Настройки чата сохранены.', 'Chat settings saved.'));
    S.renderSection('rooms');
  }

  function renderMessageList(state) {
    const messages = safeArray(messageCache[state.activeRoomId]);
    if (!state.activeRoomId) {
      return '<div class="ir-chat-empty"><strong>' + esc(tr('Создайте или подключите чат', 'Create or join a chat')) + '</strong><span>' + esc(tr('Один invite link — и человек может подключиться без аккаунта.', 'One invite link lets a participant join without an account.')) + '</span></div>';
    }
    if (!messages.length) {
      return '<div class="ir-chat-empty"><strong>' + esc(tr('Сообщений пока нет', 'No messages yet')) + '</strong><span>' + esc(tr('Напишите первое сообщение или нажмите Refresh.', 'Write the first message or press Refresh.')) + '</span></div>';
    }
    return '<div class="ir-chat-messages">' + messages.map((message) => {
      const mine = String(message.authorName || '') === String(state.displayName || '');
      return '<article class="ir-chat-message ' + (mine ? 'is-mine' : 'is-other') + '"><div class="ir-chat-message-meta"><strong>' + esc(message.authorName || 'Guest') + '</strong><span>' + esc(message.createdAt ? new Date(message.createdAt).toLocaleString() : '') + '</span></div><p>' + esc(message.text || '') + '</p></article>';
    }).join('') + '</div>';
  }

  function renderAdvanced(state) {
    return '<details class="ir-chat-advanced"><summary>' + esc(tr('Advanced connection', 'Advanced connection')) + '</summary><div class="ir-chat-advanced-grid">' +
      '<label><span>API endpoint</span><input type="text" data-chat-endpoint value="' + esc(state.endpoint) + '"></label>' +
      '<label><span>Room ID</span><input type="text" data-chat-room-id value="' + esc(state.activeRoomId) + '"></label>' +
      '<label><span>Secret / key</span><input type="password" data-chat-room-token value="' + esc(state.activeToken) + '"></label>' +
      '</div><div class="ir-chat-actions"><button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-save-settings">' + esc(tr('Сохранить', 'Save')) + '</button><button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-test-connection">' + esc(tr('Проверить API', 'Test API')) + '</button></div></details>';
  }

  function renderChat() {
    const state = getState();
    const invite = createInviteLink(state);
    return S.renderShellIntro('rooms', tr('Чат', 'Chat'), tr('Простой рабочий чат IRGEZTNE: создать, отправить invite link, подключиться и писать. Сообщения шифруются на устройстве перед отправкой в Live API.', 'Simple IRGEZTNE work chat: create, send an invite link, join, and write. Messages are encrypted on-device before they are sent to the Live API.'), [tr('Без аккаунта', 'No account'), 'E2EE foundation', 'Live API']) +
      '<div class="ir-chat-v1"><section class="ir-chat-panel ir-chat-main"><div class="ir-chat-head"><div><h4>' + esc(state.activeTitle || tr('Проектный чат', 'Project chat')) + '</h4><p>' + esc(state.activeRoomId ? ('ID: ' + state.activeRoomId) : tr('Чат ещё не создан.', 'No chat created yet.')) + '</p></div><span class="ir-chat-status ' + (state.activeRoomId ? 'is-ready' : 'is-wait') + '"><i></i>' + esc(state.activeRoomId ? tr('Подключён', 'Connected') : tr('Ожидает', 'Waiting')) + '</span></div>' +
      renderMessageList(state) +
      '<div class="ir-chat-compose"><textarea data-chat-message maxlength="' + esc(MAX_LOCAL_MESSAGE) + '" placeholder="' + esc(tr('Напишите сообщение...', 'Write a message...')) + '"></textarea><button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="chat-send">' + esc(tr('Отправить', 'Send')) + '</button></div><div class="ir-chat-actions"><button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-refresh">' + esc(tr('Обновить', 'Refresh')) + '</button><button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-copy-invite">' + esc(tr('Копировать invite link', 'Copy invite link')) + '</button></div></section>' +
      '<aside class="ir-chat-panel ir-chat-side"><h4>' + esc(tr('Быстрое подключение', 'Quick connection')) + '</h4><label><span>' + esc(tr('Ваше имя', 'Your name')) + '</span><input type="text" data-chat-name value="' + esc(state.displayName) + '"></label><label><span>' + esc(tr('Название чата', 'Chat title')) + '</span><input type="text" data-chat-title value="' + esc(state.activeTitle) + '"></label><div class="ir-chat-actions ir-chat-actions--grid"><button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="chat-create">' + esc(tr('Создать чат', 'Create chat')) + '</button><button type="button" class="ecosystem-v0-btn" data-ecosystem-action="chat-join">' + esc(tr('Войти в чат', 'Join chat')) + '</button></div><label><span>' + esc(tr('Invite link или Room ID + key', 'Invite link or Room ID + key')) + '</span><textarea data-chat-invite placeholder="irgeztne-chat://join?...#key=..."></textarea></label><label><span>' + esc(tr('Invite link', 'Invite link')) + '</span><textarea readonly data-chat-invite-output>' + esc(invite) + '</textarea></label><div class="ir-chat-note"><strong>' + esc(tr('Приватность', 'Privacy')) + '</strong><span>' + esc(tr('Ключ находится у участников. Live API передаёт зашифрованный текст и управляет подключением/лимитами.', 'The key stays with participants. Live API relays encrypted text and manages connection/limits.')) + '</span></div>' + renderAdvanced(state) + '<div class="ir-chat-status-line">' + esc(lastStatus || tr('Готово к подключению.', 'Ready to connect.')) + '</div></aside></div></div>';
  }

  async function runAction(action) {
    if (action === 'chat-create') return createChat();
    if (action === 'chat-join') return joinChat();
    if (action === 'chat-send') return sendMessage();
    if (action === 'chat-refresh') return refreshMessages(false);
    if (action === 'chat-copy-invite') return copyInvite();
    if (action === 'chat-save-settings') return saveSettingsFromForm();
    if (action === 'chat-test-connection') return testConnection();
  }

  function handleClick(event) {
    const button = event.target.closest('[data-ecosystem-action]');
    if (!button) return;
    const action = button.getAttribute('data-ecosystem-action') || '';
    if (!action.startsWith('chat-')) return;
    event.preventDefault();
    runAction(action).catch((error) => { setStatus(error && error.message ? error.message : String(error)); S.renderSection('rooms'); });
  }

  function handleEnter(event) {
    const target = event.target;
    if (!target || !target.matches('[data-chat-message]')) return;
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    runAction('chat-send').catch((error) => { setStatus(error && error.message ? error.message : String(error)); S.renderSection('rooms'); });
  }

  function boot() {
    S.registerModule('rooms', renderChat);
    S.renderSection('rooms');
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
    render: () => S.renderSection('rooms')
  };
})();
