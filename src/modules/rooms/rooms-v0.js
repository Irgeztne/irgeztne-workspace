(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  let cachedConversation = { id: '', messages: [] };
  // v0.4P13: which REAL local MLS group member is currently composing.
  // local -> peer -> camel -> local. No automatic bot reply exists here.
  let activeSender = 'local';

  // IRGEZTNE_CHAT_RELEASE_SENDER_HARNESS_V1
  // Hidden in normal product UI. For local regression only, enable in DevTools:
  // localStorage.setItem('irgeztne.chat.senderHarness', '1'); location.reload();
  function localSenderHarnessEnabled() {
    try {
      return window.localStorage.getItem('irgeztne.chat.senderHarness') === '1';
    } catch (_) {
      return false;
    }
  }
  let replyDraft = null;
  let editDraft = null;
  let deleteDialog = null;
  let deleteBusy = false;
  let localHideDialog = null;
  let localViewStateLoaded = false;
  let localViewState = { v: 1, hiddenByConversation: {} };
  const LOCAL_VIEW_STATE_KEY_V04P20 = 'green-lightning-chat-local-view-v04p20';
  let messageActionMenu = null;
  let copyToastTimer = null;
  let reactionBusy = false;
  const reactionChoices = ['👍', '❤️', '😂', '😮', '😢', '🐪'];
  let cachedStatus = null;
  let cachedInvite = null;
  let chatActionBusy = false;
  let skipRefreshAfterRender = false;
  let refreshSerial = 0;
  const ui = {
    railCollapsed: false,
    infoOpen: false,
    infoWidth: 320,
    railSearchQuery: '',
    messageSearchOpen: false,
    messageSearchQuery: '',
    messageSearchIndex: 0
  };

  function currentLang() {
    const probes = [];
    try { probes.push(document.documentElement.getAttribute('lang')); } catch (_) {}
    try { probes.push(document.body && document.body.getAttribute('data-lang')); } catch (_) {}
    try { probes.push(localStorage.getItem('irgeztne.lang')); } catch (_) {}
    try { probes.push(localStorage.getItem('irgLang')); } catch (_) {}
    try { probes.push(localStorage.getItem('ns.lang')); } catch (_) {}
    try { probes.push(localStorage.getItem('language')); } catch (_) {}
    const raw = probes.filter(Boolean).map((v) => String(v).trim().toLowerCase()).find(Boolean) || 'en';
    return raw === 'ru' || raw.startsWith('ru') || raw.includes('рус') ? 'ru' : 'en';
  }

  function tr(ru, en) { return currentLang() === 'ru' ? ru : en; }
  function esc(value) { return S.escapeHtml(String(value == null ? '' : value)); }
  function bridge() { return window.irgeztneMessenger || null; }

  function uiIcon(name) {
    const paths = {
      phone: '<path d="M7.2 3.8 4.9 5.7c-.8.7-.9 1.9-.4 3 2.1 4.6 5.7 8.2 10.3 10.3 1 .5 2.2.4 3-.4l1.9-2.3c.5-.6.4-1.5-.2-2l-3.2-2.2c-.6-.4-1.4-.3-1.9.2l-1.2 1.4a15.5 15.5 0 0 1-3-3l1.4-1.2c.5-.5.6-1.3.2-1.9L9.2 4c-.5-.7-1.4-.8-2-.2Z"/>',
      video: '<rect x="3.5" y="6" width="12.5" height="12" rx="2.5"/><path d="m16 10 4.5-2.5v9L16 14"/>',
      search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.4h.01"/>',
      send: '<path d="m4 4 16 8-16 8 3-8-3-8Z"/><path d="M7 12h13"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',
      reply: '<path d="M9 8 4 12l5 4"/><path d="M5 12h8a6 6 0 0 1 6 6"/>',
      more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
      copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>'
    };
    return '<svg class="gl-p1-svg" viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  function statusText(status) {
    if (!status) return tr('Подключение…', 'Connecting…');
    if (!status.ok) return tr('Защищённое соединение недоступно', 'Secure connection unavailable');
    if (status.network === 'pending') return tr('Нет подключения', 'Not connected');
    if (status.mode === 'remote-empty') return tr('Готов к разговору', 'Ready for a conversation');
    if (status.mode === 'remote-handshake') return tr('Устанавливается защита…', 'Establishing security…');
    if (status.mode === 'remote-online') return tr('Защищено · онлайн', 'Secured · online');
    return tr('Защищено', 'Secured');
  }

  function statusClass(status) {
    return status && status.ok ? 'is-ready' : (status ? 'is-error' : 'is-loading');
  }

  function senderLabel(sender) {
    const remote = cachedStatus && String(cachedStatus.mode || '').startsWith('remote-');
    return sender === 'camel'
      ? tr('Верблюд', 'Camel')
      : (sender === 'peer' ? (remote ? tr('Собеседник', 'Contact') : tr('Зеркало', 'Mirror')) : tr('Вы', 'You'));
  }

  function remoteMode() {
    return Boolean(cachedStatus && String(cachedStatus.mode || '').startsWith('remote-'));
  }

  function layoutKey() {
    return [
      cachedStatus && cachedStatus.mode || 'loading',
      cachedStatus && cachedStatus.network || 'pending',
      cachedConversation && cachedConversation.id || '',
      cachedConversation && cachedConversation.ready === true ? 'ready' : 'waiting',
      cachedInvite && cachedInvite.token ? 'invite' : 'no-invite'
    ].join('|');
  }

  function compactReplyText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function messagePreviewText(message) {
    if (!message || typeof message !== 'object') return '';
    if (message.contentKind === 'attachment' && message.attachment) {
      const name = String(message.attachment.name || '').trim();
      return name ? tr('Вложение: ', 'Attachment: ') + name : tr('Вложение', 'Attachment');
    }
    if (message.contentKind === 'voice-note') {
      return tr('Голосовое сообщение', 'Voice note');
    }
    return String(message.text || '');
  }

  function messageCopyText(message) {
    if (!message || typeof message !== 'object') return '';
    if (message.contentKind === 'attachment' && message.attachment) {
      return String(message.attachment.name || '');
    }
    if (message.contentKind === 'voice-note') return '';
    return String(message.text || '');
  }


  // IRGEZTNE_CHAT_SEARCH_V1
  function normalizeSearchValue(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function messageSearchText(message) {
    if (!message || typeof message !== 'object') return '';
    const parts = [senderLabel(message.sender)];

    if (message.contentKind === 'attachment' && message.attachment) {
      parts.push(message.attachment.name || '');
      parts.push(message.attachment.mimeType || '');
    } else if (message.contentKind === 'voice-note') {
      parts.push(tr('Голосовое сообщение', 'Voice note'));
    } else {
      parts.push(message.text || '');
    }

    const reply = message.reply && typeof message.reply === 'object' ? message.reply : null;
    if (reply) {
      parts.push(reply.text || '');
      parts.push(senderLabel(reply.sender));
    }

    return normalizeSearchValue(parts.join(' '));
  }

  function messageSearchMatches() {
    const query = normalizeSearchValue(ui.messageSearchQuery);
    if (!query) return [];

    const messages = Array.isArray(cachedConversation && cachedConversation.messages)
      ? cachedConversation.messages
      : [];

    return messages.filter((message) =>
      message &&
      !message.deleted &&
      !isLocallyHiddenMessageId(message.id) &&
      messageSearchText(message).includes(query)
    );
  }

  // IRGEZTNE_CHAT_INFO_FINISH_V1
  function searchShortcutLabel() {
    let platform = '';
    try { platform = String(navigator.platform || navigator.userAgent || ''); } catch (_) {}
    return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘F' : 'Ctrl+F';
  }

  function conversationSharedStats() {
    const messages = Array.isArray(cachedConversation && cachedConversation.messages)
      ? cachedConversation.messages
      : [];
    let media = 0;
    let files = 0;
    let links = 0;
    const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

    messages.forEach((message) => {
      if (!message || message.deleted || isLocallyHiddenMessageId(message.id)) return;

      if (message.contentKind === 'attachment' && message.attachment) {
        const mimeType = String(message.attachment.mimeType || '').toLowerCase();
        if (/^(?:image|audio|video)\//.test(mimeType)) media += 1;
        else files += 1;
        return;
      }

      if (message.contentKind === 'voice-note') {
        media += 1;
        return;
      }

      if (message.contentKind === 'text') {
        const found = String(message.text || '').match(urlPattern);
        if (found) links += found.length;
      }
    });

    return { media, files, links };
  }

  function syncSharedInfo(root) {
    if (!root || !root.querySelectorAll) return;
    const stats = conversationSharedStats();
    root.querySelectorAll('[data-gl-shared-count]').forEach((node) => {
      const kind = String(node.getAttribute('data-gl-shared-count') || '');
      node.textContent = String(Number(stats[kind]) || 0);
    });
    const shortcut = root.querySelector('[data-gl-search-shortcut]');
    if (shortcut) shortcut.textContent = searchShortcutLabel();
  }

  function syncConversationSearch(root) {
    if (!root || !root.querySelector) return;
    const input = root.querySelector('[data-gl-conversation-search]');
    const entry = root.querySelector('[data-gl-conversation-entry]');
    const empty = root.querySelector('[data-gl-conversation-empty]');
    if (input && input.value !== ui.railSearchQuery) input.value = ui.railSearchQuery;

    const transportPending = Boolean(
      cachedStatus && cachedStatus.ok && cachedStatus.mode === 'remote-pending'
    );
    if (transportPending) {
      if (entry) entry.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = tr('Разговоров пока нет', 'No conversations yet');
      }
      return;
    }

    const query = normalizeSearchValue(ui.railSearchQuery);
    const searchable = normalizeSearchValue([
      tr('Локальная лаборатория', 'Local lab'),
      tr('Защищённый локальный тест', 'Secure local test'),
      tr('3 локальных MLS-устройства', '3 local MLS devices'),
      'IRGEZTNE Workspace',
      senderLabel('local'),
      senderLabel('peer'),
      senderLabel('camel')
    ].join(' '));
    const visible = !query || searchable.includes(query);

    if (entry) entry.hidden = !visible;
    if (empty) empty.hidden = visible;
  }

  function syncMessageSearch(root, options = null) {
    if (!root || !root.querySelector) return;
    const opts = options && typeof options === 'object' ? options : {};
    const bar = root.querySelector('[data-gl-message-searchbar]');
    const input = root.querySelector('[data-gl-message-search]');
    const count = root.querySelector('[data-gl-message-search-count]');
    const prev = root.querySelector('[data-gl-message-search-prev]');
    const next = root.querySelector('[data-gl-message-search-next]');

    if (bar) bar.hidden = !ui.messageSearchOpen;
    if (input && input.value !== ui.messageSearchQuery) input.value = ui.messageSearchQuery;

    const nodes = Array.from(root.querySelectorAll('[data-gl-message-id]'));
    nodes.forEach((node) => node.classList.remove('is-search-match', 'is-search-current'));

    const matches = messageSearchMatches();
    if (ui.messageSearchIndex < 0) ui.messageSearchIndex = 0;
    if (ui.messageSearchIndex >= matches.length) ui.messageSearchIndex = Math.max(0, matches.length - 1);

    const nodeById = new Map(nodes.map((node) => [String(node.getAttribute('data-gl-message-id') || ''), node]));
    matches.forEach((message) => {
      const node = nodeById.get(String(message.id || ''));
      if (node) node.classList.add('is-search-match');
    });

    const current = matches[ui.messageSearchIndex] || null;
    const currentNode = current ? nodeById.get(String(current.id || '')) : null;
    if (currentNode) currentNode.classList.add('is-search-current');

    if (count) {
      count.textContent = matches.length
        ? String(ui.messageSearchIndex + 1) + ' / ' + String(matches.length)
        : '0 / 0';
    }
    if (prev) prev.disabled = matches.length < 2;
    if (next) next.disabled = matches.length < 2;

    if (opts.scroll && currentNode) {
      const scroller = root.querySelector('[data-gl-messages]');
      if (scroller) {
        const scrollerRect = scroller.getBoundingClientRect();
        const targetRect = currentNode.getBoundingClientRect();
        const targetTop = scroller.scrollTop + (targetRect.top - scrollerRect.top);
        const centeredTop = Math.max(0, targetTop - Math.max(18, (scroller.clientHeight - targetRect.height) / 2));
        try {
          scroller.scrollTo({ top: centeredTop, behavior: 'smooth' });
        } catch (_) {
          scroller.scrollTop = centeredTop;
        }
      }
    }
  }

  function openMessageSearch(root) {
    ui.messageSearchOpen = true;
    syncMessageSearch(root);
    window.setTimeout(() => {
      const input = root && root.querySelector ? root.querySelector('[data-gl-message-search]') : null;
      if (input) {
        input.focus();
        input.select();
      }
    }, 0);
  }

  function closeMessageSearch(root) {
    ui.messageSearchOpen = false;
    ui.messageSearchQuery = '';
    ui.messageSearchIndex = 0;
    syncMessageSearch(root);
  }

  function stepMessageSearch(root, delta) {
    const matches = messageSearchMatches();
    if (!matches.length) {
      syncMessageSearch(root);
      return;
    }
    ui.messageSearchIndex = (ui.messageSearchIndex + delta + matches.length) % matches.length;
    syncMessageSearch(root, { scroll: true });
  }

  function replyComposerHtml() {
    if (!replyDraft) return '<div class="gl-p15-reply-compose" data-gl-reply-compose hidden></div>';
    return '<div class="gl-p15-reply-compose" data-gl-reply-compose>' +
      '<div class="gl-p15-reply-compose-copy"><strong>' + esc(tr('Ответ · ', 'Reply · ') + senderLabel(replyDraft.sender)) + '</strong><span>' + esc(compactReplyText(replyDraft.text)) + '</span></div>' +
      '<button type="button" class="gl-p1-icon-btn gl-p15-reply-cancel" data-gl-cancel-reply title="' + esc(tr('Отменить ответ', 'Cancel reply')) + '">' + uiIcon('close') + '</button>' +
    '</div>';
  }

  function syncReplyComposer(root) {
    const holder = root && root.querySelector ? root.querySelector('[data-gl-reply-compose]') : null;
    if (!holder) return;
    if (!replyDraft) {
      holder.hidden = true;
      holder.innerHTML = '';
      return;
    }
    holder.hidden = false;
    holder.innerHTML = '<div class="gl-p15-reply-compose-copy"><strong>' + esc(tr('Ответ · ', 'Reply · ') + senderLabel(replyDraft.sender)) + '</strong><span>' + esc(compactReplyText(replyDraft.text)) + '</span></div>' +
      '<button type="button" class="gl-p1-icon-btn gl-p15-reply-cancel" data-gl-cancel-reply title="' + esc(tr('Отменить ответ', 'Cancel reply')) + '">' + uiIcon('close') + '</button>';
  }

  function syncReplyComposers() {
    document.querySelectorAll('[data-gl-root]').forEach(syncReplyComposer);
  }

  // IRGEZTNE_MESSAGE_EDIT_UI_V04P18
  function editComposerHtml() {
    if (!editDraft) return '<div class="gl-p18-edit-compose" data-gl-edit-compose hidden></div>';

    return '<div class="gl-p18-edit-compose" data-gl-edit-compose>' +
      '<div class="gl-p18-edit-compose-copy"><strong>' + esc(tr('Редактирование · ', 'Editing · ') + senderLabel(editDraft.sender)) + '</strong><span>' + esc(compactReplyText(editDraft.text)) + '</span></div>' +
      '<button type="button" class="gl-p1-icon-btn" data-gl-cancel-edit title="' + esc(tr('Отменить редактирование', 'Cancel editing')) + '">' + uiIcon('close') + '</button>' +
    '</div>';
  }

  function syncEditComposer(root) {
    const holder = root && root.querySelector ? root.querySelector('[data-gl-edit-compose]') : null;
    if (!holder) return;

    const send = root.querySelector ? root.querySelector('[data-gl-send]') : null;

    const input = root.querySelector ? root.querySelector('[data-gl-compose]') : null;

    if (!editDraft) {
      holder.hidden = true;
      holder.innerHTML = '';
      if (send) {
        send.title = tr('Отправить', 'Send');
        send.setAttribute('aria-label', tr('Отправить', 'Send'));
        send.classList.remove('is-edit-save');
        send.innerHTML = uiIcon('send');
      }
      if (input) input.placeholder = tr('Сообщение', 'Message');
      return;
    }

    holder.hidden = false;
    holder.innerHTML =
      '<div class="gl-p18-edit-compose-copy"><strong>' + esc(tr('Редактирование · ', 'Editing · ') + senderLabel(editDraft.sender)) + '</strong><span>' + esc(compactReplyText(editDraft.text)) + '</span></div>' +
      '<button type="button" class="gl-p1-icon-btn" data-gl-cancel-edit title="' + esc(tr('Отменить редактирование', 'Cancel editing')) + '">' + uiIcon('close') + '</button>';

    if (send) {
      send.title = tr('Сохранить изменения', 'Save changes');
      send.setAttribute('aria-label', tr('Сохранить изменения', 'Save changes'));
      send.classList.add('is-edit-save');
      send.innerHTML = uiIcon('check');
    }
    if (input) input.placeholder = tr('Редактируйте сообщение', 'Edit message');
  }

  function syncEditComposers() {
    document.querySelectorAll('[data-gl-root]').forEach(syncEditComposer);
  }

  function cancelEdit(root, restoreDraft = true) {
    if (!editDraft) return;
    const previousComposeText = String(editDraft.previousComposeText || '');
    editDraft = null;
    syncEditComposers();

    if (restoreDraft && root && root.querySelector) {
      const input = root.querySelector('[data-gl-compose]');
      if (input) {
        input.value = previousComposeText;
        input.focus();
      }
    }
  }

  function beginEdit(messageId, root) {
    const message = messageById(messageId);
    if (!message || message.sender !== activeSender) return false;

    const input = root && root.querySelector ? root.querySelector('[data-gl-compose]') : null;
    const previousComposeText = String(input && input.value || '');

    if (replyDraft) {
      replyDraft = null;
      syncReplyComposers();
    }

    editDraft = {
      id: String(message.id || ''),
      sender: message.sender || activeSender,
      text: String(message.text || ''),
      previousComposeText
    };

    syncEditComposers();
    updateRoots();

    const refreshedRoot = document.querySelector('[data-gl-root]') || root;
    const refreshedInput = refreshedRoot && refreshedRoot.querySelector
      ? refreshedRoot.querySelector('[data-gl-compose]')
      : null;

    if (refreshedInput) {
      refreshedInput.value = String(message.text || '');
      refreshedInput.focus();
      refreshedInput.setSelectionRange(refreshedInput.value.length, refreshedInput.value.length);
    }
    return true;
  }

  // IRGEZTNE_LOCAL_CLEANUP_V04P20
  function ensureLocalViewState() {
    if (localViewStateLoaded) return localViewState;
    localViewStateLoaded = true;

    try {
      const api = window.nsAPI;
      const raw = api && typeof api.storageGetModuleStateSync === 'function'
        ? api.storageGetModuleStateSync(
            LOCAL_VIEW_STATE_KEY_V04P20,
            { v: 1, hiddenByConversation: {} }
          )
        : null;

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const hidden = raw.hiddenByConversation;
        localViewState = {
          v: 1,
          hiddenByConversation: hidden && typeof hidden === 'object' && !Array.isArray(hidden)
            ? hidden
            : {}
        };
      }
    } catch (_) {}

    return localViewState;
  }

  function currentConversationId() {
    return String(cachedConversation && cachedConversation.id || 'green-lightning-local-v04p1');
  }

  function hiddenIdsForCurrentConversation() {
    const state = ensureLocalViewState();
    const conversationId = currentConversationId();
    const list = state.hiddenByConversation[conversationId];
    return Array.isArray(list) ? list.map((value) => String(value || '')).filter(Boolean) : [];
  }

  function isLocallyHiddenMessageId(messageId) {
    const id = String(messageId || '');
    return Boolean(id && hiddenIdsForCurrentConversation().includes(id));
  }

  async function persistLocalViewState() {
    const api = window.nsAPI;
    if (!api || typeof api.storageSetModuleState !== 'function') {
      throw new Error(tr('Локальное состояние устройства недоступно', 'Device-local view state is unavailable'));
    }

    await api.storageSetModuleState(LOCAL_VIEW_STATE_KEY_V04P20, {
      v: 1,
      hiddenByConversation: localViewState.hiddenByConversation
    });
  }

  async function hideTombstoneLocally(messageId) {
    const message = messageById(messageId);
    if (!message || !message.deleted) return;

    const state = ensureLocalViewState();
    const conversationId = currentConversationId();
    const current = Array.isArray(state.hiddenByConversation[conversationId])
      ? state.hiddenByConversation[conversationId].map((value) => String(value || '')).filter(Boolean)
      : [];

    if (!current.includes(messageId)) current.push(messageId);
    state.hiddenByConversation[conversationId] = current.slice(-5000);

    try {
      await persistLocalViewState();
      closeLocalHideDialog();
      updateRoots();
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    }
  }

  function closeLocalHideDialog() {
    if (!localHideDialog) return;
    const node = localHideDialog.node;
    if (node && node.parentNode) node.parentNode.removeChild(node);
    localHideDialog = null;
  }

  function openLocalHideDialog(messageId) {
    const message = messageById(messageId);
    if (!message || !message.deleted) return;

    closeLocalHideDialog();

    const backdrop = document.createElement('div');
    backdrop.className = 'gl-p19-confirm-backdrop gl-p20-local-hide-dialog';
    backdrop.setAttribute('data-gl-local-hide-backdrop', '');
    backdrop.innerHTML =
      '<section class="gl-p19-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="glP20HideTitle">' +
        '<div class="gl-p19-confirm-head">' +
          '<strong id="glP20HideTitle">' + esc(tr('Убрать у себя?', 'Remove for you?')) + '</strong>' +
          '<button type="button" class="gl-p1-icon-btn" data-gl-local-hide-cancel title="' + esc(tr('Отмена', 'Cancel')) + '">' + uiIcon('close') + '</button>' +
        '</div>' +
        '<div class="gl-p19-confirm-body">' +
          '<p>' + esc(tr('Эта карточка исчезнет только на этом устройстве. Защищённая групповая история и состояние других участников не изменятся.', 'This tombstone will disappear only on this device. Secure group history and other participants are unchanged.')) + '</p>' +
          '<div class="gl-p19-delete-preview">' + esc(tr('Сообщение удалено', 'Message deleted')) + '</div>' +
        '</div>' +
        '<div class="gl-p19-confirm-actions">' +
          '<button type="button" data-gl-local-hide-cancel>' + esc(tr('Отмена', 'Cancel')) + '</button>' +
          '<button type="button" class="is-danger" data-gl-local-hide-confirm>' + esc(tr('Убрать у себя', 'Remove for me')) + '</button>' +
        '</div>' +
      '</section>';

    document.body.appendChild(backdrop);
    localHideDialog = { messageId: String(messageId || ''), node: backdrop };

    const confirm = backdrop.querySelector('[data-gl-local-hide-confirm]');
    if (confirm) confirm.focus({ preventScroll: true });
  }

  // IRGEZTNE_MESSAGE_LIFECYCLE_UI_V04P19
  function closeDeleteDialog() {
    if (!deleteDialog) return;
    const node = deleteDialog.node;
    if (node && node.parentNode) node.parentNode.removeChild(node);
    deleteDialog = null;
  }

  function openDeleteDialog(messageId) {
    const message = messageById(messageId);
    if (!message || message.deleted || message.sender !== activeSender) return;

    closeDeleteDialog();

    const backdrop = document.createElement('div');
    backdrop.className = 'gl-p19-confirm-backdrop';
    backdrop.setAttribute('data-gl-delete-backdrop', '');
    backdrop.innerHTML =
      '<section class="gl-p19-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="glP19DeleteTitle">' +
        '<div class="gl-p19-confirm-head">' +
          '<strong id="glP19DeleteTitle">' + esc(tr('Удалить сообщение?', 'Delete message?')) + '</strong>' +
          '<button type="button" class="gl-p1-icon-btn" data-gl-delete-cancel title="' + esc(tr('Отмена', 'Cancel')) + '">' + uiIcon('close') + '</button>' +
        '</div>' +
        '<div class="gl-p19-confirm-body">' +
          '<p>' + esc(tr('Сообщение будет удалено у всех участников этой защищённой группы. Это действие нельзя отменить.', 'The message will be deleted for every member of this secure group. This cannot be undone.')) + '</p>' +
          '<div class="gl-p19-delete-preview">' + esc(compactReplyText(messagePreviewText(message))) + '</div>' +
        '</div>' +
        '<div class="gl-p19-confirm-actions">' +
          '<button type="button" data-gl-delete-cancel>' + esc(tr('Отмена', 'Cancel')) + '</button>' +
          '<button type="button" class="is-danger" data-gl-delete-confirm>' + esc(tr('Удалить для всех', 'Delete for everyone')) + '</button>' +
        '</div>' +
      '</section>';

    document.body.appendChild(backdrop);
    deleteDialog = { messageId: String(messageId || ''), node: backdrop };

    const danger = backdrop.querySelector('[data-gl-delete-confirm]');
    if (danger) danger.focus({ preventScroll: true });
  }

  async function deleteMessageForAll(messageId) {
    if (deleteBusy) return;

    const api = bridge();
    if (!api) return;

    const method = activeSender === 'camel'
      ? api.deleteCamelForAll
      : (activeSender === 'peer' ? api.deletePeerForAll : api.deleteLocalForAll);

    if (typeof method !== 'function') {
      showReactionToast(tr('Удаление недоступно', 'Delete unavailable'), true);
      return;
    }

    deleteBusy = true;
    try {
      const result = await method(messageId);
      if (result && result.ok && result.conversation) {
        cachedConversation = result.conversation;

        if (editDraft && editDraft.id === messageId) editDraft = null;
        if (replyDraft && replyDraft.id === messageId) replyDraft = null;

        closeDeleteDialog();
        updateRoots();
      } else {
        const detail = result && result.error && result.error.message
          ? String(result.error.message)
          : tr('Не удалось удалить сообщение', 'Could not delete message');
        showReactionToast(detail, true);
      }
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    } finally {
      deleteBusy = false;
    }
  }

  // IRGEZTNE_MESSAGE_ACTIONS_V04P16
  function messageById(messageId) {
    const messages = cachedConversation && Array.isArray(cachedConversation.messages)
      ? cachedConversation.messages
      : [];
    return messages.find((item) => String(item && item.id || '') === String(messageId || '')) || null;
  }

  function beginReply(messageId, root) {
    const message = messageById(messageId);
    if (!message) return false;

    if (editDraft) cancelEdit(root, true);

    replyDraft = {
      id: String(message.id || ''),
      sender: message.sender || 'local',
      text: messagePreviewText(message)
    };

    syncReplyComposers();

    const input = root && root.querySelector ? root.querySelector('[data-gl-compose]') : null;
    if (input) input.focus();
    return true;
  }

  function closeMessageActionMenu() {
    if (!messageActionMenu) return;

    const trigger = messageActionMenu.trigger;
    const node = messageActionMenu.node;

    if (trigger && trigger.isConnected) trigger.setAttribute('aria-expanded', 'false');
    if (node && node.parentNode) node.parentNode.removeChild(node);

    messageActionMenu = null;
  }

  function positionMessageActionMenu(node, x, y) {
    const gap = 8;
    const rect = node.getBoundingClientRect();
    const left = Math.max(gap, Math.min(window.innerWidth - rect.width - gap, x));
    const top = Math.max(gap, Math.min(window.innerHeight - rect.height - gap, y));
    node.style.left = left + 'px';
    node.style.top = top + 'px';
  }

  function openMessageActionMenu(messageId, trigger, point = null) {
    const message = messageById(messageId);
    if (!message || message.deleted) return;

    closeMessageActionMenu();

    const node = document.createElement('div');
    node.className = 'gl-p16-message-menu';
    node.setAttribute('role', 'menu');
    node.setAttribute('data-gl-message-menu', '');
    node.setAttribute('data-gl-message-menu-id', String(messageId || ''));
    const onlineRemote = remoteMode();
    const ownerItems = !onlineRemote && message.sender === activeSender
      ? (message.contentKind === 'text'
          ? '<button type="button" role="menuitem" data-gl-message-menu-action="edit">' +
              uiIcon('edit') + '<span>' + esc(tr('Редактировать', 'Edit')) + '</span>' +
            '</button>'
          : '') +
        '<button type="button" role="menuitem" data-gl-message-menu-action="delete-for-all">' +
          uiIcon('trash') + '<span>' + esc(tr('Удалить для всех', 'Delete for everyone')) + '</span>' +
        '</button>'
      : '';
    const copyItem = messageCopyText(message)
      ? '<button type="button" role="menuitem" data-gl-message-menu-action="copy">' +
          uiIcon('copy') + '<span>' + esc(tr('Копировать', 'Copy')) + '</span>' +
        '</button>'
      : '';

    node.innerHTML =
      (onlineRemote ? '' : reactionPickerHtml(message) + '<div class="gl-p16-message-menu-separator" aria-hidden="true"></div>') +
      '<button type="button" role="menuitem" data-gl-message-menu-action="reply">' +
        uiIcon('reply') + '<span>' + esc(tr('Ответить', 'Reply')) + '</span>' +
      '</button>' +
      ownerItems +
      (copyItem ? '<div class="gl-p16-message-menu-separator" aria-hidden="true"></div>' + copyItem : '');

    document.body.appendChild(node);

    const anchor = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
    let x = point && Number.isFinite(point.x)
      ? point.x
      : (anchor ? anchor.right - 178 : Math.max(8, window.innerWidth / 2 - 89));
    let y = point && Number.isFinite(point.y)
      ? point.y
      : (anchor ? anchor.bottom + 6 : Math.max(8, window.innerHeight / 2));

    positionMessageActionMenu(node, x, y);

    if (trigger && trigger.isConnected) trigger.setAttribute('aria-expanded', 'true');

    messageActionMenu = {
      messageId: String(messageId || ''),
      trigger: trigger || null,
      node
    };

    const first = node.querySelector('[data-gl-message-menu-action]');
    if (first) first.focus({ preventScroll: true });
  }

  // IRGEZTNE_REACTIONS_UI_V04P17
  function reactionActors(message, emoji) {
    if (!message || !Array.isArray(message.reactions)) return [];
    const reaction = message.reactions.find((item) => item && item.emoji === emoji);
    return reaction && Array.isArray(reaction.actors) ? reaction.actors.slice() : [];
  }

  function reactionActorsLabel(actors) {
    return actors.map(senderLabel).join(', ');
  }

  function reactionPickerHtml(message) {
    const buttons = reactionChoices.map((emoji) => {
      const actors = reactionActors(message, emoji);
      const active = actors.includes(activeSender);
      const title = active
        ? tr('Снять свою реакцию', 'Remove your reaction')
        : tr('Поставить реакцию', 'Add reaction');

      return '<button type="button" class="gl-p17-reaction-choice' + (active ? ' is-active' : '') + '"' +
        ' data-gl-reaction-choice="' + esc(emoji) + '"' +
        ' title="' + esc(title) + '"' +
        ' aria-label="' + esc(title + ' ' + emoji) + '">' +
        esc(emoji) +
      '</button>';
    }).join('');

    return '<div class="gl-p17-reaction-picker" role="group" aria-label="' + esc(tr('Реакции', 'Reactions')) + '">' +
      '<div class="gl-p17-reaction-picker-label">' + esc(tr('Реакция от ', 'Reaction from ') + senderLabel(activeSender)) + '</div>' +
      buttons +
    '</div>';
  }

  function reactionsHtml(message) {
    if (message && message.deleted) return '';
    const reactions = message && Array.isArray(message.reactions) ? message.reactions : [];
    if (!reactions.length) return '';

    const chips = reactions.map((reaction) => {
      const actors = Array.isArray(reaction.actors) ? reaction.actors : [];
      const active = actors.includes(activeSender);
      const count = Number(reaction.count || actors.length || 0);
      const title = reactionActorsLabel(actors);

      return '<button type="button" class="gl-p17-reaction-chip' + (active ? ' is-active' : '') + '"' +
        ' data-gl-reaction-chip="' + esc(reaction.emoji) + '"' +
        ' data-gl-reaction-message="' + esc(message.id || '') + '"' +
        ' title="' + esc(title) + '">' +
        '<span>' + esc(reaction.emoji) + '</span>' +
        '<span class="gl-p17-reaction-count">' + esc(String(count)) + '</span>' +
      '</button>';
    }).join('');

    return '<div class="gl-p17-reactions" data-gl-reactions>' + chips + '</div>';
  }

  function syncReactionActiveState() {
    document.querySelectorAll('[data-gl-reaction-chip]').forEach((chip) => {
      const messageId = String(chip.getAttribute('data-gl-reaction-message') || '');
      const emoji = String(chip.getAttribute('data-gl-reaction-chip') || '');
      const message = messageById(messageId);
      chip.classList.toggle('is-active', reactionActors(message, emoji).includes(activeSender));
    });
  }

  function showReactionToast(text, error = false) {
    document.querySelectorAll('.gl-p17-reaction-toast').forEach((node) => node.remove());

    const toast = document.createElement('div');
    toast.className = 'gl-p16-copy-toast gl-p17-reaction-toast' + (error ? ' is-error' : '');
    toast.textContent = text;
    document.body.appendChild(toast);

    window.setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, error ? 6000 : 1800);
  }

  async function reactToMessage(messageId, emoji) {
    if (reactionBusy) return;

    const api = bridge();
    if (!api) return;

    const method = activeSender === 'camel'
      ? api.reactCamel
      : (activeSender === 'peer' ? api.reactPeer : api.reactLocal);

    if (typeof method !== 'function') {
      showReactionToast(tr('Реакции недоступны', 'Reactions unavailable'), true);
      return;
    }

    reactionBusy = true;
    try {
      const result = await method(messageId, emoji);
      if (result && result.ok && result.conversation) {
        cachedConversation = result.conversation;
        updateRoots();
      } else {
        const detail = result && result.error && result.error.message
          ? String(result.error.message)
          : tr('Не удалось сохранить реакцию', 'Could not save reaction');
        showReactionToast(detail, true);
      }
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    } finally {
      reactionBusy = false;
    }
  }

  function showCopyToast(ok) {
    if (copyToastTimer) {
      window.clearTimeout(copyToastTimer);
      copyToastTimer = null;
    }

    document.querySelectorAll('.gl-p16-copy-toast').forEach((node) => node.remove());

    const toast = document.createElement('div');
    toast.className = 'gl-p16-copy-toast' + (ok ? '' : ' is-error');
    toast.textContent = ok ? tr('Скопировано', 'Copied') : tr('Не удалось скопировать', 'Could not copy');
    document.body.appendChild(toast);

    copyToastTimer = window.setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      copyToastTimer = null;
    }, 1300);
  }

  async function copyMessageText(messageId) {
    const message = messageById(messageId);
    if (!message) {
      showCopyToast(false);
      return;
    }

    const text = messageCopyText(message);
    if (!text) {
      showCopyToast(false);
      return;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        showCopyToast(true);
        return;
      }
    } catch (_) {}

    let textarea = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const ok = document.execCommand('copy');
      showCopyToast(Boolean(ok));
    } catch (_) {
      showCopyToast(false);
    } finally {
      if (textarea && textarea.parentNode) textarea.parentNode.removeChild(textarea);
    }
  }

  function formatAttachmentSize(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) + ' MB';
  }

  function attachmentCanOpen(attachment) {
    const mimeType = String(attachment && attachment.mimeType || '').toLowerCase();
    return new Set([
      'text/plain',
      'text/markdown',
      'application/json',
      'text/csv',
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif'
    ]).has(mimeType);
  }

  function attachmentBodyHtml(message) {
    const attachment = message && message.attachment && typeof message.attachment === 'object'
      ? message.attachment
      : null;

    if (!attachment) {
      return '<div class="gl-p25-attachment is-error">' +
        '<strong>' + esc(tr('Вложение недоступно', 'Attachment unavailable')) + '</strong>' +
      '</div>';
    }

    const messageId = String(message && message.id || '');
    const openAction = attachmentCanOpen(attachment)
      ? '<button type="button" class="gl-p25-attachment-action" data-gl-attachment-open="' + esc(messageId) + '">' + esc(tr('Открыть', 'Open')) + '</button>'
      : '';

    return '<div class="gl-p25-attachment" data-gl-attachment-message="' + esc(messageId) + '">' +
      '<div class="gl-p25-attachment-icon" aria-hidden="true">📎</div>' +
      '<div class="gl-p25-attachment-copy">' +
        '<strong title="' + esc(attachment.name || '') + '">' + esc(attachment.name || tr('Файл', 'File')) + '</strong>' +
        '<span>' + esc(formatAttachmentSize(attachment.sizeBytes)) + ' · ' + esc(attachment.mimeType || 'application/octet-stream') + '</span>' +
      '</div>' +
      '<div class="gl-p25-attachment-actions">' +
        openAction +
        '<button type="button" class="gl-p25-attachment-action" data-gl-attachment-save="' + esc(messageId) + '">' + esc(tr('Сохранить', 'Save')) + '</button>' +
      '</div>' +
    '</div>';
  }

  async function openAttachmentMessage(messageId) {
    const api = bridge();
    if (!api || typeof api.openAttachment !== 'function') {
      showReactionToast(tr('Открытие вложений недоступно', 'Attachment opening is unavailable'), true);
      return;
    }

    try {
      const result = await api.openAttachment(messageId);
      if (result && result.ok) return;

      const detail = result && result.error && result.error.message
        ? String(result.error.message)
        : tr('Не удалось открыть вложение', 'Could not open attachment');
      showReactionToast(detail, true);
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    }
  }

  async function saveAttachmentMessage(messageId) {
    const api = bridge();
    if (!api || typeof api.saveAttachment !== 'function') {
      showReactionToast(tr('Сохранение вложений недоступно', 'Attachment saving is unavailable'), true);
      return;
    }

    try {
      const result = await api.saveAttachment(messageId);
      if (result && result.canceled) return;
      if (result && result.ok) {
        showReactionToast(tr('Вложение сохранено', 'Attachment saved'));
        return;
      }

      const detail = result && result.error && result.error.message
        ? String(result.error.message)
        : tr('Не удалось сохранить вложение', 'Could not save attachment');
      showReactionToast(detail, true);
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    }
  }

  async function sendAttachmentFrom(root) {
    const api = bridge();

    if (!api || typeof api.sendAttachment !== 'function') {
      showReactionToast(tr('Вложения недоступны', 'Attachments unavailable'), true);
      return;
    }

    const button = root && root.querySelector
      ? root.querySelector('[data-gl-attachment]')
      : null;

    if (button && button.disabled) return;
    if (button) button.disabled = true;

    try {
      const options = replyDraft && replyDraft.id
        ? { replyToId: replyDraft.id }
        : null;

      const result = await api.sendAttachment(
        activeSender,
        options
      );

      if (result && result.canceled) return;

      if (result && result.ok) {
        if (result.conversation) cachedConversation = result.conversation;
        replyDraft = null;
        await refreshAll();
        return;
      }

      const detail = result && result.error && result.error.message
        ? String(result.error.message)
        : tr('Не удалось отправить вложение', 'Could not send attachment');

      showReactionToast(detail, true);
    } catch (error) {
      showReactionToast(
        String(error && error.message || error),
        true
      );
    } finally {
      if (button && button.isConnected) button.disabled = false;
    }
  }

  function renderMessages(conversation) {
    const messages = conversation && Array.isArray(conversation.messages) ? conversation.messages : [];
    const visibleMessages = messages.filter((message) => !(
      message &&
      message.deleted &&
      isLocallyHiddenMessageId(message.id)
    ));
    if (!visibleMessages.length) {
      const transportPending = Boolean(
        (cachedStatus && cachedStatus.ok && cachedStatus.mode === 'remote-pending') ||
        (conversation && conversation.network === 'pending')
      );
      if (transportPending) {
        return '<div class="gl-p1-empty"><strong>' + esc(tr('Чат готов к подключению', 'Chat is ready to connect')) + '</strong>' +
          '<span>' + esc(tr('История пуста. Разговоры появятся после подключения сервиса чата.', 'History is empty. Conversations will appear after the Chat service connects.')) + '</span></div>';
      }
      return '<div class="gl-p1-empty"><strong>' + esc(tr('Локальная MLS-лаборатория готова', 'Local MLS lab is ready')) + '</strong>' +
        '<span>' + esc(tr('Три локальных MLS-участника готовы. Сеть в лабораторном режиме выключена.', 'Three local MLS members are ready. Network transport is disabled in lab mode.')) + '</span></div>';
    }

    return visibleMessages.map((message) => {
      const when = message.createdAt ? new Date(message.createdAt) : null;
      const time = when && !Number.isNaN(when.getTime()) ? when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const delivered = message.status === 'delivered' || message.status === 'read';
      const sender = message.sender || (message.direction === 'incoming' ? 'peer' : 'local');
      const mine = sender === 'local';
      const camel = sender === 'camel';
      const author = senderLabel(sender);
      const deliveryText = mine
        ? tr('доставлено группе · MLS + SQLCipher', 'delivered to group · MLS + SQLCipher')
        : tr('получено группой · MLS + SQLCipher', 'received by group · MLS + SQLCipher');
      const sideClass = mine ? 'is-mine' : (camel ? 'is-camel' : 'is-peer');

      const messageId = String(message.id || '');
      const editingClass = editDraft && editDraft.id === messageId ? ' is-editing' : '';
      const editedLabel = message.edited
        ? '<span class="gl-p18-edited">' + esc(tr('изменено', 'edited')) + '</span>'
        : '';
      const reply = message.replyTo && typeof message.replyTo === 'object' ? message.replyTo : null;
      const replyTarget = reply && reply.messageId ? messageById(reply.messageId) : null;
      const replyPreview = replyTarget && replyTarget.deleted
        ? tr('Сообщение удалено', 'Message deleted')
        : (replyTarget
            ? compactReplyText(messagePreviewText(replyTarget))
            : (reply ? compactReplyText(reply.text) : ''));
      const replyHtml = reply && reply.messageId
        ? '<button type="button" class="gl-p15-reply-quote" data-gl-jump-reply="' + esc(reply.messageId) + '" title="' + esc(tr('Перейти к исходному сообщению', 'Jump to original message')) + '">' +
            '<strong>' + esc(senderLabel(reply.sender)) + '</strong><span>' + esc(replyPreview) + '</span>' +
          '</button>'
        : '';

      const deletedClass = message.deleted ? ' is-deleted' : '';
      const textMessage = message.contentKind === 'text';
      const messageActions = message.deleted
        ? '<button type="button" class="gl-p20-hide-local-action" data-gl-hide-local="' + esc(messageId) + '" title="' + esc(tr('Убрать у себя', 'Remove for me')) + '" aria-label="' + esc(tr('Убрать у себя', 'Remove for me')) + '">' + uiIcon('trash') + '</button>'
        : (textMessage
            ? '<button type="button" class="gl-p15-reply-action" data-gl-reply-message="' + esc(messageId) + '" title="' + esc(tr('Ответить', 'Reply')) + '" aria-label="' + esc(tr('Ответить', 'Reply')) + '">' + uiIcon('reply') + '</button>'
            : '') +
          '<button type="button" class="gl-p16-more-action" data-gl-message-more="' + esc(messageId) + '" aria-haspopup="menu" aria-expanded="false" title="' + esc(tr('Действия сообщения', 'Message actions')) + '" aria-label="' + esc(tr('Действия сообщения', 'Message actions')) + '">' + uiIcon('more') + '</button>';

      const bodyHtml = message.deleted
        ? '<p class="gl-p19-deleted-copy">' + esc(tr('Сообщение удалено', 'Message deleted')) + '</p>'
        : replyHtml + (
            message.contentKind === 'attachment'
              ? attachmentBodyHtml(message)
              : '<p>' + esc(message.text || '') + '</p>'
          );

      const stateHtml = message.deleted
        ? '<div class="gl-p1-message-state gl-p19-deleted-state">' + esc(tr('удалено для всех · MLS + SQLCipher', 'deleted for everyone · MLS + SQLCipher')) + '</div>'
        : '<div class="gl-p1-message-state ' + (delivered ? 'is-delivered' : '') + '">' +
            esc(delivered ? deliveryText : String(message.status || 'pending')) +
          '</div>';

      return '<article class="gl-p1-message ' + sideClass + editingClass + deletedClass + '" data-gl-message-id="' + esc(messageId) + '">' +
        '<div class="gl-p1-message-meta"><strong>' + esc(author) + '</strong><span class="gl-p15-message-meta-tail">' +
          messageActions +
          (message.deleted ? '' : editedLabel) +
          '<span>' + esc(time) + '</span>' +
        '</span></div>' +
        bodyHtml +
        stateHtml +
        reactionsHtml(message) +
      '</article>';
    }).join('');
  }

  function securityHtml(status) {
    if (!status || !status.ok) {
      const detail = status && status.error && status.error.message ? status.error.message : tr('Ожидаем secure-local-service.', 'Waiting for secure-local-service.');
      return '<div class="gl-p1-security-error">' + esc(detail) + '</div>';
    }
    const service = status.service || {};
    const group = status.group || {};
    const security = status.security || {};
    return '<details class="gl-p1-diagnostics"><summary>' + esc(tr('Диагностика', 'Diagnostics')) + '</summary><div class="gl-p1-security-grid">' +
      '<div><span>' + esc(tr('Сеть', 'Network')) + '</span><strong>' + esc(status.network || '—') + '</strong></div>' +
      '<div><span>' + esc(tr('Протокол', 'Protocol')) + '</span><strong>' + esc(service.crypto || 'OpenMLS') + '</strong></div>' +
      '<div><span>' + esc(tr('Состояние MLS', 'MLS state')) + '</span><strong>' + esc(service.mlsStorage || 'SQLCipher') + '</strong></div>' +
      '<div><span>' + esc(tr('История', 'History')) + '</span><strong>' + esc(service.messageStorage || 'SQLCipher') + '</strong></div>' +
      '<div><span>' + esc(tr('Ключи', 'Keys')) + '</span><strong>' + esc(service.keyRoot || 'OS Keyring') + '</strong></div>' +
      '<div><span>' + esc(tr('MLS участники', 'MLS members')) + '</span><strong>' + esc(group.members == null ? '—' : group.members) + '</strong></div>' +
      '<div><span>' + esc(tr('Экспорт ключа', 'Raw key export')) + '</span><strong>' + esc(security.rawKeyExport === false ? 'OFF' : '—') + '</strong></div>' +
    '</div></details>';
  }

  function rootClasses() {
    return 'gl-p1' + (ui.railCollapsed ? ' is-rail-collapsed' : '') + (ui.infoOpen ? ' is-info-open' : '');
  }

  function remoteStartHtml() {
    if (cachedInvite && cachedInvite.token) {
      return '<div class="gl-remote-start" data-gl-remote-start>' +
        '<div class="gl-remote-start-copy"><strong>' + esc(tr('Приглашение создано', 'Invite created')) + '</strong>' +
          '<span>' + esc(tr('Передай этот код только человеку, с которым хочешь начать защищённый разговор.', 'Share this code only with the person you want to start a secure conversation with.')) + '</span></div>' +
        '<div class="gl-remote-invite-code"><code data-gl-invite-code>' + esc(cachedInvite.token) + '</code>' +
          '<button type="button" data-gl-copy-invite>' + esc(tr('Копировать', 'Copy')) + '</button></div>' +
        '<div class="gl-remote-wait"><i></i><span>' + esc(tr('Ожидаем второго участника и завершаем MLS‑защиту…', 'Waiting for the second participant and completing MLS security…')) + '</span></div>' +
      '</div>';
    }

    return '<div class="gl-remote-start" data-gl-remote-start>' +
      '<div class="gl-remote-start-copy"><strong>' + esc(tr('Начни защищённый разговор', 'Start a secure conversation')) + '</strong>' +
        '<span>' + esc(tr('Создай одноразовое приглашение или вставь код, который прислал собеседник.', 'Create a one-time invite or enter a code sent by your contact.')) + '</span></div>' +
      '<div class="gl-remote-start-actions">' +
        '<button type="button" class="is-primary" data-gl-create-invite' + (chatActionBusy ? ' disabled' : '') + '>' + esc(tr('Создать приглашение', 'Create invite')) + '</button>' +
        '<div class="gl-remote-join"><input type="text" data-gl-invite-input autocomplete="off" spellcheck="false" placeholder="' + esc(tr('Код приглашения', 'Invite code')) + '">' +
          '<button type="button" data-gl-join-invite' + (chatActionBusy ? ' disabled' : '') + '>' + esc(tr('Присоединиться', 'Join')) + '</button></div>' +
      '</div>' +
    '</div>';
  }

  function remoteHandshakeHtml() {
    return '<div class="gl-remote-start is-handshake"><div class="gl-remote-start-copy"><strong>' +
      esc(tr('Устанавливается защищённый разговор', 'Establishing the secure conversation')) + '</strong><span>' +
      esc(tr('Оба Workspace обмениваются только открытыми MLS‑данными. Ключи и текст сообщений серверу не передаются.', 'Both Workspace clients exchange only public MLS handshake data. Keys and message text are never sent to the server.')) +
      '</span></div><div class="gl-remote-wait"><i></i><span>' + esc(tr('Подключение…', 'Connecting…')) + '</span></div></div>';
  }

  function panelHtml() {
    const status = cachedStatus;
    // Before the first async status refresh, render the clean product shell rather
    // than flashing the old local-lab identity.
    const mode = String(status && status.mode || 'remote-pending');
    const localLab = mode === 'local-secure-group';
    const isRemote = !localLab;
    const hasConversation = Boolean(cachedConversation && cachedConversation.id);
    const secureReady = localLab || Boolean(status && status.ok && mode === 'remote-online' && cachedConversation && cachedConversation.ready);
    const transportPending = !secureReady;
    const productTitle = localLab ? tr('Локальная лаборатория', 'Local lab') : tr('Чат', 'Chat');
    const productAvatar = localLab ? 'LAB' : tr('Ч', 'C');
    const chatSubtitle = localLab
      ? tr('локальный защищённый контур · сеть выключена', 'local secure loop · network disabled')
      : (secureReady
          ? tr('сквозное шифрование · онлайн', 'end-to-end encryption · online')
          : (hasConversation
              ? tr('устанавливается защищённое соединение', 'establishing a secure connection')
              : tr('защищённые личные разговоры', 'secure direct conversations')));
    const networkLabel = localLab ? tr('выключена', 'disabled') : (secureReady ? tr('онлайн', 'online') : tr('подключение', 'connecting'));
    const attachmentsReady = localLab || Boolean(status && status.capabilities && status.capabilities.attachments);
    return '<div class="' + rootClasses() + '" data-gl-root>' +
      '<aside class="gl-p1-rail">' +
        '<div class="gl-p1-rail-head">' +
          '<div class="gl-p1-bolt">ϟ</div>' +
          '<div class="gl-p1-rail-title"><strong>' + esc(tr('Сообщения', 'Messages')) + '</strong><span>IRGEZTNE Workspace</span></div>' +
          '<button type="button" class="gl-p1-icon-btn" data-gl-toggle-rail title="' + esc(tr('Свернуть список', 'Collapse list')) + '">' + (ui.railCollapsed ? '›' : '‹') + '</button>' +
        '</div>' +
        '<div class="gl-p1-rail-search"><span>⌕</span><input type="search" data-gl-conversation-search autocomplete="off" placeholder="' + esc(tr('Поиск разговоров', 'Search conversations')) + '" value="' + esc(ui.railSearchQuery) + '"></div>' +
        '<div class="gl-p1-filters"><button type="button" class="is-active">' + esc(tr('Все', 'All')) + '</button><button type="button" disabled>' + esc(tr('Непрочитанные', 'Unread')) + '</button><button type="button" disabled>' + esc(tr('Проекты', 'Projects')) + '</button></div>' +
        (!hasConversation
          ? '<div class="gl-p26-conversation-empty" data-gl-conversation-empty>' + esc(tr('Разговоров пока нет', 'No conversations yet')) + '</div>'
          : '<button type="button" class="gl-p1-conversation is-active" data-gl-conversation-entry>' +
              '<div class="gl-p1-avatar">' + esc(productAvatar) + '</div><div class="gl-p1-conv-copy"><strong>' + esc(localLab ? productTitle : tr('Защищённый разговор', 'Secure conversation')) + '</strong><span>' + esc(localLab ? tr('Защищённый локальный тест', 'Secure local test') : (secureReady ? tr('MLS · онлайн', 'MLS · online') : tr('Подключение…', 'Connecting…'))) + '</span></div>' +
            '</button>' +
            '<div class="gl-p26-conversation-empty" data-gl-conversation-empty hidden>' + esc(tr('Разговоры не найдены', 'No conversations found')) + '</div>') +
        '<div class="gl-p1-rail-foot"><i class="' + statusClass(status) + '"></i><span>' + esc(statusText(status)) + '</span></div>' +
      '</aside>' +
      '<section class="gl-p1-chat">' +
        '<header class="gl-p1-chat-head">' +
          '<button type="button" class="gl-p1-icon-btn gl-p1-rail-open" data-gl-toggle-rail title="' + esc(tr('Список разговоров', 'Conversation list')) + '">☰</button>' +
          '<div class="gl-p1-avatar">' + esc(productAvatar) + '</div>' +
          '<div class="gl-p1-chat-title"><strong>' + esc(productTitle) + '</strong><span>' + esc(chatSubtitle) + '</span></div>' +
          '<div class="gl-p1-head-actions">' +
            '<div class="gl-p1-status ' + statusClass(status) + '" data-gl-status><i></i><span>' + esc(statusText(status)) + '</span></div>' +
            (localLab && localSenderHarnessEnabled()
              ? '<button type="button" class="gl-p12-sender-toggle ' + (activeSender === 'camel' ? 'is-camel' : (activeSender === 'peer' ? 'is-peer' : '')) + '" data-gl-sender-toggle aria-pressed="' + String(activeSender !== 'local') + '" title="' + esc(tr('Переключить локального MLS-участника', 'Switch local MLS member')) + '">' + esc(activeSender === 'camel' ? tr('От: Верблюд', 'From: Camel') : (activeSender === 'peer' ? tr('От: Зеркало', 'From: Mirror') : tr('От: Вы', 'From: You'))) + '</button>'
              : '') +
            '<button type="button" class="gl-p1-icon-btn" data-gl-toggle-message-search aria-pressed="' + String(ui.messageSearchOpen) + '" title="' + esc(tr('Поиск в разговоре', 'Search in conversation')) + '">' + uiIcon('search') + '</button>' +
            '<button type="button" class="gl-p1-icon-btn" data-gl-toggle-info aria-pressed="' + String(ui.infoOpen) + '" title="' + esc(tr('О разговоре и защите', 'Conversation and security info')) + '">' + uiIcon('info') + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="gl-p26-message-search" data-gl-message-searchbar' + (ui.messageSearchOpen ? '' : ' hidden') + '>' +
          '<span class="gl-p26-message-search-icon" aria-hidden="true">⌕</span>' +
          '<input type="search" data-gl-message-search autocomplete="off" placeholder="' + esc(tr('Поиск сообщений, файлов и участников', 'Search messages, files and participants')) + '" value="' + esc(ui.messageSearchQuery) + '">' +
          '<span class="gl-p26-message-search-count" data-gl-message-search-count>0 / 0</span>' +
          '<button type="button" class="gl-p26-message-search-nav" data-gl-message-search-prev title="' + esc(tr('Предыдущее совпадение', 'Previous match')) + '">↑</button>' +
          '<button type="button" class="gl-p26-message-search-nav" data-gl-message-search-next title="' + esc(tr('Следующее совпадение', 'Next match')) + '">↓</button>' +
          '<button type="button" class="gl-p1-icon-btn gl-p26-message-search-close" data-gl-message-search-close title="' + esc(tr('Закрыть поиск', 'Close search')) + '">' + uiIcon('close') + '</button>' +
        '</div>' +
        '<div class="gl-p1-messages" data-gl-messages>' +
          (isRemote && !hasConversation ? remoteStartHtml() : (isRemote && !secureReady ? remoteHandshakeHtml() : renderMessages(cachedConversation))) +
        '</div>' +
        replyComposerHtml() +
        editComposerHtml() +
        '<div class="gl-p1-compose">' +
          (attachmentsReady ? '<button type="button" class="gl-p1-icon-btn" data-gl-attachment' + (transportPending ? ' disabled aria-disabled="true"' : '') + ' title="' + esc(tr('Прикрепить файл', 'Attach file')) + '" aria-label="' + esc(tr('Прикрепить файл', 'Attach file')) + '">' + uiIcon('plus') + '</button>' : '') +
          '<textarea data-gl-compose maxlength="65536" rows="1"' + (transportPending ? ' disabled' : '') + ' placeholder="' + esc(transportPending ? (hasConversation ? tr('Устанавливается защищённое соединение…', 'Establishing a secure connection…') : tr('Выберите разговор или примите приглашение', 'Choose a conversation or accept an invitation')) : tr('Сообщение', 'Message')) + '"></textarea>' +
          '<button type="button" data-gl-send class="gl-p1-send"' + (transportPending ? ' disabled aria-disabled="true"' : '') + ' title="' + esc(tr('Отправить', 'Send')) + '">' + uiIcon('send') + '</button>' +
        '</div>' +
      '</section>' +
      '<aside class="gl-p1-info">' +
        '<div class="gl-p1-info-resize" data-gl-resize-info title="' + esc(tr('Изменить ширину', 'Resize panel')) + '"></div>' +
        '<div class="gl-p1-info-inner">' +
          '<div class="gl-p1-info-head"><strong>' + esc(tr('О разговоре', 'Conversation info')) + '</strong><button type="button" class="gl-p1-icon-btn" data-gl-toggle-info title="' + esc(tr('Свернуть', 'Collapse')) + '">' + uiIcon('close') + '</button></div>' +
          '<div class="gl-p1-profile"><div class="gl-p1-avatar is-large">' + esc(productAvatar) + '</div><strong>' + esc(productTitle) + '</strong><span>' + esc(localLab ? tr('защищённый локальный тест', 'secure local test') : (secureReady ? tr('сквозное шифрование включено', 'end-to-end encryption is active') : tr('ожидает защищённого соединения', 'waiting for secure connection'))) + '</span></div>' +
          '<section class="gl-p1-info-section"><h5>' + esc(tr('Действия', 'Actions')) + '</h5><div class="gl-p1-info-row"><span>' + esc(tr('Поиск в разговоре', 'Search conversation')) + '</span><strong data-gl-search-shortcut>' + esc(searchShortcutLabel()) + '</strong></div></section>' +
          '<section class="gl-p1-info-section"><h5>' + esc(tr('Связь', 'Shared')) + '</h5><div class="gl-p1-info-row"><span>' + esc(tr('Медиа', 'Media')) + '</span><strong data-gl-shared-count="media">0</strong></div><div class="gl-p1-info-row"><span>' + esc(tr('Файлы', 'Files')) + '</span><strong data-gl-shared-count="files">0</strong></div><div class="gl-p1-info-row"><span>' + esc(tr('Ссылки', 'Links')) + '</span><strong data-gl-shared-count="links">0</strong></div></section>' +
          '<section class="gl-p1-info-section"><div class="gl-p1-info-section-head"><h5>' + esc(tr('Безопасность', 'Security')) + '</h5><button type="button" data-gl-refresh>' + esc(tr('Проверить', 'Refresh')) + '</button></div><div data-gl-security>' + securityHtml(status) + '</div></section>' +
        '</div>' +
      '</aside>' +
    '</div>';
  }

  function renderRooms() {
    if (skipRefreshAfterRender) skipRefreshAfterRender = false;
    else Promise.resolve().then(refreshAll);
    return panelHtml();
  }

  function syncRootClasses(root) {
    root.className = rootClasses();
    root.style.setProperty('--gl-info-w', Math.max(280, Math.min(430, Number(ui.infoWidth) || 320)) + 'px');
    root.querySelectorAll('[data-gl-toggle-info]').forEach((button) => button.setAttribute('aria-pressed', String(ui.infoOpen)));
  }

  function updateRoots() {
    document.querySelectorAll('[data-gl-root]').forEach((root) => {
      syncRootClasses(root);
      const statusNode = root.querySelector('[data-gl-status]');
      if (statusNode) {
        statusNode.className = 'gl-p1-status ' + statusClass(cachedStatus);
        statusNode.innerHTML = '<i></i><span>' + esc(statusText(cachedStatus)) + '</span>';
      }
      const footer = root.querySelector('.gl-p1-rail-foot');
      if (footer) footer.innerHTML = '<i class="' + statusClass(cachedStatus) + '"></i><span>' + esc(statusText(cachedStatus)) + '</span>';
      const messages = root.querySelector('[data-gl-messages]');
      if (messages) {
        const mode = String(cachedStatus && cachedStatus.mode || '');
        const remote = mode.startsWith('remote-');
        const hasConversation = Boolean(cachedConversation && cachedConversation.id);
        const ready = Boolean(cachedStatus && cachedStatus.ok && mode === 'remote-online' && cachedConversation && cachedConversation.ready);
        messages.innerHTML = remote && !hasConversation
          ? remoteStartHtml()
          : (remote && !ready ? remoteHandshakeHtml() : renderMessages(cachedConversation));
      }
      const security = root.querySelector('[data-gl-security]');
      if (security) security.innerHTML = securityHtml(cachedStatus);
      syncReplyComposer(root);
      syncEditComposer(root);
      syncConversationSearch(root);
      syncMessageSearch(root);
      syncSharedInfo(root);
    });
  }

  async function refreshAll() {
    const api = bridge();
    const serial = ++refreshSerial;
    if (!api || typeof api.getStatus !== 'function' || typeof api.getConversation !== 'function') {
      cachedStatus = { ok: false, error: { message: tr('Messenger bridge не загружен.', 'Messenger bridge is not loaded.') } };
      updateRoots();
      return;
    }
    const beforeLayout = layoutKey();
    try {
      const [status, history] = await Promise.all([api.getStatus(), api.getConversation()]);
      if (serial !== refreshSerial) return;
      cachedStatus = status || { ok: false };
      if (history && history.ok && history.conversation) cachedConversation = history.conversation;
    } catch (error) {
      if (serial !== refreshSerial) return;
      cachedStatus = { ok: false, error: { message: String(error && error.message || error) } };
    }
    if (beforeLayout !== layoutKey()) {
      skipRefreshAfterRender = true;
      S.renderSection('rooms');
    } else {
      updateRoots();
    }
  }

  async function sendFrom(root) {
    const api = bridge();
    if (!api || typeof api.sendLocalText !== 'function') return;
    const input = root.querySelector('[data-gl-compose]');
    const button = root.querySelector('[data-gl-send]');
    const text = String(input && input.value || '');
    if (!text.trim()) return;
    if (button) button.disabled = true;
    if (input) input.disabled = true;
    try {
      const editing = editDraft && editDraft.id ? { ...editDraft } : null;
      let result;

      if (editing) {
        const editMethod = activeSender === 'camel'
          ? api.editCamel
          : (activeSender === 'peer' ? api.editPeer : api.editLocal);

        if (editing.sender !== activeSender || typeof editMethod !== 'function') {
          throw new Error(tr('Нельзя редактировать сообщение другого участника', 'Cannot edit another participant\'s message'));
        }

        result = await editMethod(editing.id, text);
      } else {
        const options = replyDraft && replyDraft.id ? { replyToId: replyDraft.id } : null;
        result = await (activeSender === 'camel' && typeof api.sendCamelText === 'function'
          ? api.sendCamelText(text, options)
          : (activeSender === 'peer' && typeof api.sendPeerText === 'function'
            ? api.sendPeerText(text, options)
            : api.sendLocalText(text, options)));
      }

      if (result && result.ok) {
        if (result.conversation) cachedConversation = result.conversation;

        if (editing) {
          const resumeText = String(editing.previousComposeText || '');
          editDraft = null;
          if (input) input.value = resumeText;
          syncEditComposers();
        } else {
          replyDraft = null;
          if (input) input.value = '';
        }

        await refreshAll();
      } else {
        cachedStatus = result || { ok: false };
        updateRoots();
      }
    } catch (error) {
      cachedStatus = { ok: false, error: { message: String(error && error.message || error) } };
      updateRoots();
    } finally {
      if (button) button.disabled = false;
      if (input) input.disabled = false;
      if (input) input.focus();
    }
  }

  function renderChatState() {
    skipRefreshAfterRender = true;
    S.renderSection('rooms');
  }

  async function createDirectInvite() {
    if (chatActionBusy) return;
    const api = bridge();
    if (!api || typeof api.createDirectInvite !== 'function') return;
    chatActionBusy = true;
    renderChatState();
    try {
      const result = await api.createDirectInvite();
      if (!result || !result.ok || !result.invite) {
        throw new Error(result && result.error && result.error.message || tr('Не удалось создать приглашение', 'Could not create invite'));
      }
      cachedInvite = result.invite;
      if (result.conversation) cachedConversation = result.conversation;
      await refreshAll();
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    } finally {
      chatActionBusy = false;
      renderChatState();
    }
  }

  async function joinDirectInvite(root) {
    if (chatActionBusy) return;
    const api = bridge();
    if (!api || typeof api.joinDirectInvite !== 'function') return;
    const input = root && root.querySelector ? root.querySelector('[data-gl-invite-input]') : null;
    const token = String(input && input.value || '').trim();
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
      showReactionToast(tr('Проверь код приглашения', 'Check the invite code'), true);
      if (input) input.focus();
      return;
    }
    chatActionBusy = true;
    renderChatState();
    try {
      const result = await api.joinDirectInvite(token);
      if (!result || !result.ok) {
        throw new Error(result && result.error && result.error.message || tr('Не удалось присоединиться', 'Could not join'));
      }
      cachedInvite = null;
      if (result.conversation) cachedConversation = result.conversation;
      await refreshAll();
    } catch (error) {
      showReactionToast(String(error && error.message || error), true);
    } finally {
      chatActionBusy = false;
      renderChatState();
    }
  }

  async function copyInviteCode() {
    const token = String(cachedInvite && cachedInvite.token || '');
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      showCopyToast(true);
    } catch (_) {
      showCopyToast(false);
    }
  }

  function onClick(event) {
    const createInvite = event.target.closest('[data-gl-create-invite]');
    if (createInvite) {
      event.preventDefault();
      void createDirectInvite();
      return;
    }

    const joinInvite = event.target.closest('[data-gl-join-invite]');
    if (joinInvite) {
      event.preventDefault();
      void joinDirectInvite(joinInvite.closest('[data-gl-root]'));
      return;
    }

    const copyInvite = event.target.closest('[data-gl-copy-invite]');
    if (copyInvite) {
      event.preventDefault();
      void copyInviteCode();
      return;
    }

    const localHideAction = event.target.closest('[data-gl-hide-local]');
    if (localHideAction) {
      event.preventDefault();
      const messageId = String(localHideAction.getAttribute('data-gl-hide-local') || '');
      if (messageId) openLocalHideDialog(messageId);
      return;
    }

    const localHideCancel = event.target.closest('[data-gl-local-hide-cancel]');
    if (localHideCancel) {
      event.preventDefault();
      closeLocalHideDialog();
      return;
    }

    const localHideConfirm = event.target.closest('[data-gl-local-hide-confirm]');
    if (localHideConfirm) {
      event.preventDefault();
      const messageId = localHideDialog ? localHideDialog.messageId : '';
      if (messageId) void hideTombstoneLocally(messageId);
      return;
    }

    if (
      localHideDialog &&
      event.target.matches &&
      event.target.matches('[data-gl-local-hide-backdrop]')
    ) {
      event.preventDefault();
      closeLocalHideDialog();
      return;
    }

    const deleteCancel = event.target.closest('[data-gl-delete-cancel]');
    if (deleteCancel) {
      event.preventDefault();
      closeDeleteDialog();
      return;
    }

    const deleteConfirm = event.target.closest('[data-gl-delete-confirm]');
    if (deleteConfirm) {
      event.preventDefault();
      const messageId = deleteDialog ? deleteDialog.messageId : '';
      if (messageId) void deleteMessageForAll(messageId);
      return;
    }

    if (deleteDialog && event.target.matches && event.target.matches('[data-gl-delete-backdrop]')) {
      event.preventDefault();
      closeDeleteDialog();
      return;
    }

    const rail = event.target.closest('[data-gl-toggle-rail]');
    if (rail) {
      event.preventDefault();
      ui.railCollapsed = !ui.railCollapsed;
      updateRoots();
      return;
    }
    const info = event.target.closest('[data-gl-toggle-info]');
    if (info) {
      event.preventDefault();
      ui.infoOpen = !ui.infoOpen;
      updateRoots();
      return;
    }
    const searchToggle = event.target.closest('[data-gl-toggle-message-search]');
    if (searchToggle) {
      event.preventDefault();
      const root = searchToggle.closest('[data-gl-root]');
      if (root) {
        if (ui.messageSearchOpen) closeMessageSearch(root);
        else openMessageSearch(root);
        searchToggle.setAttribute('aria-pressed', String(ui.messageSearchOpen));
      }
      return;
    }

    const searchClose = event.target.closest('[data-gl-message-search-close]');
    if (searchClose) {
      event.preventDefault();
      const root = searchClose.closest('[data-gl-root]');
      if (root) closeMessageSearch(root);
      return;
    }

    const searchPrev = event.target.closest('[data-gl-message-search-prev]');
    if (searchPrev) {
      event.preventDefault();
      const root = searchPrev.closest('[data-gl-root]');
      if (root) stepMessageSearch(root, -1);
      return;
    }

    const searchNext = event.target.closest('[data-gl-message-search-next]');
    if (searchNext) {
      event.preventDefault();
      const root = searchNext.closest('[data-gl-root]');
      if (root) stepMessageSearch(root, 1);
      return;
    }

    const reactionChoice = event.target.closest('[data-gl-reaction-choice]');
    if (reactionChoice) {
      event.preventDefault();
      const menu = reactionChoice.closest('[data-gl-message-menu]');
      const messageId = String(menu && menu.getAttribute('data-gl-message-menu-id') || '');
      const emoji = String(reactionChoice.getAttribute('data-gl-reaction-choice') || '');
      closeMessageActionMenu();
      if (messageId && emoji) void reactToMessage(messageId, emoji);
      return;
    }

    const reactionChip = event.target.closest('[data-gl-reaction-chip]');
    if (reactionChip) {
      event.preventDefault();
      const messageId = String(reactionChip.getAttribute('data-gl-reaction-message') || '');
      const emoji = String(reactionChip.getAttribute('data-gl-reaction-chip') || '');
      if (messageId && emoji) void reactToMessage(messageId, emoji);
      return;
    }

    const menuItem = event.target.closest('[data-gl-message-menu-action]');
    if (menuItem) {
      event.preventDefault();
      const action = String(menuItem.getAttribute('data-gl-message-menu-action') || '');
      const menu = menuItem.closest('[data-gl-message-menu]');
      const messageId = String(menu && menu.getAttribute('data-gl-message-menu-id') || '');
      const root = document.querySelector('[data-gl-root]');

      closeMessageActionMenu();

      if (action === 'reply') {
        beginReply(messageId, root);
      } else if (action === 'edit') {
        beginEdit(messageId, root);
      } else if (action === 'delete-for-all') {
        openDeleteDialog(messageId);
      } else if (action === 'copy') {
        void copyMessageText(messageId);
      }
      return;
    }

    const moreAction = event.target.closest('[data-gl-message-more]');
    if (moreAction) {
      event.preventDefault();
      event.stopPropagation();
      const messageId = String(moreAction.getAttribute('data-gl-message-more') || '');
      if (
        messageActionMenu &&
        messageActionMenu.messageId === messageId &&
        messageActionMenu.trigger === moreAction
      ) {
        closeMessageActionMenu();
      } else {
        openMessageActionMenu(messageId, moreAction);
      }
      return;
    }

    if (messageActionMenu && !event.target.closest('[data-gl-message-menu]')) {
      closeMessageActionMenu();
    }

    const replyAction = event.target.closest('[data-gl-reply-message]');
    if (replyAction) {
      event.preventDefault();
      const root = replyAction.closest('[data-gl-root]');
      const messageId = String(replyAction.getAttribute('data-gl-reply-message') || '');
      beginReply(messageId, root);
      return;
    }

    const cancelEditButton = event.target.closest('[data-gl-cancel-edit]');
    if (cancelEditButton) {
      event.preventDefault();
      const root = cancelEditButton.closest('[data-gl-root]');
      cancelEdit(root, true);
      updateRoots();
      return;
    }

    const cancelReply = event.target.closest('[data-gl-cancel-reply]');
    if (cancelReply) {
      event.preventDefault();
      replyDraft = null;
      syncReplyComposers();
      return;
    }

    const jumpReply = event.target.closest('[data-gl-jump-reply]');
    if (jumpReply) {
      event.preventDefault();
      const targetId = String(jumpReply.getAttribute('data-gl-jump-reply') || '');
      const root = jumpReply.closest('[data-gl-root]');
      const candidates = root && root.querySelectorAll ? Array.from(root.querySelectorAll('[data-gl-message-id]')) : [];
      const target = candidates.find((node) => String(node.getAttribute('data-gl-message-id') || '') === targetId);
      if (target) {
        // IRGEZTNE_REPLY_JUMP_FIX_V04P15A
        // Scroll only the Chat history owner. scrollIntoView() may also move
        // outer Workspace/Electron layout containers and land at the wrong place.
        const scroller = root && root.querySelector
          ? root.querySelector('[data-gl-messages]')
          : null;

        if (scroller) {
          const scrollerRect = scroller.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const targetTop = scroller.scrollTop + (targetRect.top - scrollerRect.top);
          const centeredTop = Math.max(
            0,
            targetTop - Math.max(18, (scroller.clientHeight - targetRect.height) / 2)
          );

          try {
            scroller.scrollTo({ top: centeredTop, behavior: 'smooth' });
          } catch (_) {
            scroller.scrollTop = centeredTop;
          }
        }

        target.classList.add('is-reply-target');
        window.setTimeout(() => target.classList.remove('is-reply-target'), 1200);
      } else if (isLocallyHiddenMessageId(targetId)) {
        showReactionToast(tr('Удалённое сообщение скрыто на этом устройстве', 'Deleted message is hidden on this device'));
      }
      return;
    }

    const attachmentOpen = event.target.closest('[data-gl-attachment-open]');
    if (attachmentOpen) {
      event.preventDefault();
      const messageId = String(attachmentOpen.getAttribute('data-gl-attachment-open') || '');
      if (messageId) void openAttachmentMessage(messageId);
      return;
    }

    const attachmentSave = event.target.closest('[data-gl-attachment-save]');
    if (attachmentSave) {
      event.preventDefault();
      const messageId = String(attachmentSave.getAttribute('data-gl-attachment-save') || '');
      if (messageId) void saveAttachmentMessage(messageId);
      return;
    }

    const attachment = event.target.closest('[data-gl-attachment]');
    if (attachment) {
      event.preventDefault();
      const root = attachment.closest('[data-gl-root]');
      if (root) void sendAttachmentFrom(root);
      return;
    }

    const send = event.target.closest('[data-gl-send]');
    if (send) {
      event.preventDefault();
      const root = send.closest('[data-gl-root]');
      if (root) void sendFrom(root);
      return;
    }
    const refresh = event.target.closest('[data-gl-refresh]');
    if (refresh) {
      event.preventDefault();
      void refreshAll();
    }
  }

  function onInput(event) {
    const conversationSearch = event.target && event.target.closest
      ? event.target.closest('[data-gl-conversation-search]')
      : null;
    if (conversationSearch) {
      ui.railSearchQuery = String(conversationSearch.value || '');
      const root = conversationSearch.closest('[data-gl-root]');
      if (root) syncConversationSearch(root);
      return;
    }

    const messageSearch = event.target && event.target.closest
      ? event.target.closest('[data-gl-message-search]')
      : null;
    if (messageSearch) {
      ui.messageSearchQuery = String(messageSearch.value || '');
      ui.messageSearchIndex = 0;
      const root = messageSearch.closest('[data-gl-root]');
      if (root) syncMessageSearch(root, { scroll: true });
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && localHideDialog) {
      event.preventDefault();
      closeLocalHideDialog();
      return;
    }

    if (event.key === 'Escape' && deleteDialog) {
      event.preventDefault();
      closeDeleteDialog();
      return;
    }

    if (event.key === 'Escape' && messageActionMenu) {
      event.preventDefault();
      closeMessageActionMenu();
      return;
    }

    const root = document.querySelector('[data-gl-root]');

    if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'f' && root) {
      event.preventDefault();
      openMessageSearch(root);
      return;
    }

    const messageSearch = event.target && event.target.closest
      ? event.target.closest('[data-gl-message-search]')
      : null;
    if (messageSearch) {
      if (event.key === 'Enter') {
        event.preventDefault();
        stepMessageSearch(messageSearch.closest('[data-gl-root]'), event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMessageSearch(messageSearch.closest('[data-gl-root]'));
        return;
      }
    }

    if (event.key === 'Escape' && ui.messageSearchOpen && root) {
      event.preventDefault();
      closeMessageSearch(root);
      return;
    }

    const inviteInput = event.target.closest('[data-gl-invite-input]');
    if (inviteInput && event.key === 'Enter') {
      event.preventDefault();
      const root = inviteInput.closest('[data-gl-root]');
      if (root) void joinDirectInvite(root);
      return;
    }

    const input = event.target.closest('[data-gl-compose]');
    if (!input) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const root = input.closest('[data-gl-root]');
      if (root) void sendFrom(root);
    }
    if (event.key === 'Escape' && editDraft) {
      event.preventDefault();
      const root = input.closest('[data-gl-root]');
      cancelEdit(root, true);
      updateRoots();
      return;
    }
    if (event.key === 'Escape' && replyDraft) {
      event.preventDefault();
      replyDraft = null;
      syncReplyComposers();
      return;
    }
    if (event.key === 'Escape' && ui.infoOpen) {
      ui.infoOpen = false;
      updateRoots();
    }
  }

  function rerender() {
    closeMessageActionMenu();
    closeLocalHideDialog();
    S.renderSection('rooms');
    Promise.resolve().then(refreshAll);
  }

  let infoResize = null;

  function onContextMenu(event) {
    const messageNode = event.target && event.target.closest
      ? event.target.closest('.cabinet-section-panel[data-cabinet-panel="rooms"] .gl-p1-message[data-gl-message-id]')
      : null;

    if (!messageNode) return;

    event.preventDefault();
    const messageId = String(messageNode.getAttribute('data-gl-message-id') || '');
    openMessageActionMenu(messageId, null, { x: event.clientX, y: event.clientY });
  }

  function onPointerDown(event) {
    const handle = event.target.closest('[data-gl-resize-info]');
    if (!handle) return;
    const root = handle.closest('[data-gl-root]');
    if (!root || root.closest('.workspace-shell')) return;
    event.preventDefault();
    infoResize = { startX: event.clientX, startWidth: Math.max(280, Math.min(430, Number(ui.infoWidth) || 320)) };
    document.body.style.userSelect = 'none';
  }

  function onPointerMove(event) {
    if (!infoResize) return;
    ui.infoWidth = Math.max(280, Math.min(430, infoResize.startWidth + (infoResize.startX - event.clientX)));
    document.querySelectorAll('[data-gl-root]').forEach((root) => root.style.setProperty('--gl-info-w', ui.infoWidth + 'px'));
  }

  function onPointerUp() {
    if (!infoResize) return;
    infoResize = null;
    document.body.style.userSelect = '';
  }

  function boot() {
    S.registerModule('rooms', renderRooms);
    S.renderSection('rooms');
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    document.addEventListener('irg:language-changed', rerender);
    window.addEventListener('irg:language-changed', rerender);
    const pollTimer = window.setInterval(() => {
      if (!document.querySelector('[data-gl-root]')) return;
      if (!cachedStatus || String(cachedStatus.mode || '').startsWith('remote-')) void refreshAll();
    }, 4000);
    window.addEventListener('beforeunload', () => window.clearInterval(pollTimer), { once: true });
  }

  boot();

  window.NSRoomsV0 = {
    getRoomsState: () => ({
      rooms: [{ id: cachedConversation.id, secure: true, network: String(cachedConversation.network || cachedStatus && cachedStatus.network || 'pending') }],
      activeRoomId: cachedConversation.id,
      connected: false,
      secure: Boolean(cachedStatus && cachedStatus.ok),
      messages: Array.isArray(cachedConversation.messages) ? cachedConversation.messages.slice() : []
    }),
    render: rerender,
    refresh: refreshAll,
    recordMessage: (record) => record
  };

  window.NSEcosystemV0 = Object.assign(window.NSEcosystemV0 || {}, {
    getRoomsState: window.NSRoomsV0.getRoomsState
  });

  // IRGEZTNE Green Lightning v0.4P13 — three local MLS senders.
  document.addEventListener('click', (event) => {
    const toggle = event.target && event.target.closest ? event.target.closest('[data-gl-sender-toggle]') : null;
    if (!toggle) return;

    if (editDraft) {
      const currentRoot = toggle.closest('[data-rooms-root]') || toggle.closest('[data-module-root]') || document;
      cancelEdit(currentRoot, true);
      updateRoots();
    }

    activeSender = activeSender === 'local'
      ? 'peer'
      : (activeSender === 'peer' ? 'camel' : 'local');

    toggle.classList.toggle('is-peer', activeSender === 'peer');
    toggle.classList.toggle('is-camel', activeSender === 'camel');

    const label = activeSender === 'camel'
      ? tr('От: Верблюд', 'From: Camel')
      : (activeSender === 'peer' ? tr('От: Зеркало', 'From: Mirror') : tr('От: Вы', 'From: You'));

    toggle.textContent = label;
    toggle.setAttribute('aria-pressed', String(activeSender !== 'local'));
    syncReactionActiveState();

    const root = toggle.closest('[data-rooms-root]') || toggle.closest('[data-module-root]') || document;
    const input = root.querySelector ? root.querySelector('[data-gl-compose]') : null;
    if (input) {
      input.placeholder = activeSender === 'camel'
        ? tr('Сообщение от Верблюда', 'Message from Camel')
        : (activeSender === 'peer'
          ? tr('Ответ от Зеркала', 'Reply from Mirror')
          : tr('Сообщение', 'Message'));
      input.focus();
    }
  });

})();
