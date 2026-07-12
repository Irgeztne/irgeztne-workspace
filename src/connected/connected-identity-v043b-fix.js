(function () {
  'use strict';

  const STATE_KEY = 'irgeztne.connected.identity.v1';
  const ACCOUNT_URL = 'https://irgeztne.com/account';

  function lang() {
    try {
      const raw = (document.documentElement.getAttribute('lang') || localStorage.getItem('irgeztne.lang') || '').toLowerCase();
      return raw.startsWith('ru') ? 'ru' : 'en';
    } catch (error) {
      return 'en';
    }
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

  function isConnected() {
    const s = readState();
    return s.mode === 'connected' && !!s.accessToken;
  }

  function text(node) {
    return String(node && (node.textContent || node.getAttribute('title') || node.getAttribute('aria-label') || '') || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function findWorkspaceButton() {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    return nodes.find((node) => {
      const value = text(node);
      const title = String(node.getAttribute('title') || node.getAttribute('aria-label') || '').toLowerCase();
      return value.includes('workspace') || value.includes('пространство') || title.includes('workspace') || title.includes('пространство');
    }) || null;
  }

  function isMenuButton(node) {
    if (!node) return false;
    const value = text(node);
    const label = String(node.getAttribute('title') || node.getAttribute('aria-label') || node.className || '').toLowerCase();
    return value === '☰' ||
      value === '≡' ||
      value === '☷' ||
      value.includes('menu') ||
      value.includes('меню') ||
      label.includes('menu') ||
      label.includes('hamburger') ||
      label.includes('sidebar') ||
      label.includes('navigation');
  }

  function findMenuNearWorkspace(workspace) {
    if (!workspace || !workspace.parentElement) return null;
    const siblings = Array.from(workspace.parentElement.children);
    const start = siblings.indexOf(workspace);
    if (start < 0) return null;

    for (let i = start + 1; i < siblings.length && i < start + 5; i += 1) {
      if (isMenuButton(siblings[i])) return siblings[i];
    }

    return siblings.find(isMenuButton) || null;
  }

  function ensureAccountButton() {
    let btn = document.getElementById('irgeztne-connected-account');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'irgeztne-connected-account';
    btn.className = 'ir-connected-account-btn';
    btn.setAttribute('data-ir-connected-account', 'button');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.innerHTML =
      '<span class="ir-connected-avatar" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" role="img" focusable="false">' +
          '<path d="M12 12.3a4.15 4.15 0 1 0 0-8.3 4.15 4.15 0 0 0 0 8.3Zm0 2.05c-3.8 0-7 2.05-7 4.55 0 .62.5 1.1 1.1 1.1h11.8c.6 0 1.1-.48 1.1-1.1 0-2.5-3.2-4.55-7-4.55Z"/>' +
        '</svg>' +
      '</span>' +
      '<span class="ir-connected-dot" aria-hidden="true"></span>';
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (window.IRGEZTNEConnected && typeof window.IRGEZTNEConnected.openMenu === 'function') {
        window.IRGEZTNEConnected.openMenu();
      } else {
        window.open(ACCOUNT_URL, '_blank', 'noopener,noreferrer');
      }
    });

    document.body.appendChild(btn);
    return btn;
  }

  function updateButtonState(btn) {
    if (!btn) return;
    btn.classList.toggle('is-connected', isConnected());
    btn.title = isConnected()
      ? t('IRGEZTNE ID подключён', 'IRGEZTNE ID connected')
      : t('Локальный режим. Войти для Chat и Live Analytics', 'Local mode. Sign in for Chat and Live Analytics');
    btn.setAttribute('aria-label', btn.title);
  }

  function placeAccountButton() {
    const btn = ensureAccountButton();
    const workspace = findWorkspaceButton();

    if (!workspace || !workspace.parentElement) {
      updateButtonState(btn);
      return false;
    }

    const menu = findMenuNearWorkspace(workspace);
    const parent = workspace.parentElement;

    if (menu && menu.parentElement === parent) {
      if (btn.parentElement !== parent || btn.nextElementSibling !== menu) {
        parent.insertBefore(btn, menu);
      }
    } else {
      const next = workspace.nextSibling;
      if (btn.parentElement !== parent || btn.previousElementSibling !== workspace) {
        parent.insertBefore(btn, next);
      }
    }

    btn.classList.add('is-v043b-placed');
    updateButtonState(btn);
    return true;
  }

  function removeLegacyLivePanels() {
    try {
      document.querySelectorAll('[data-live-rooms-panel], .rooms-live-v1, .rooms-live-v039d, .rooms-live-v039e')
        .forEach((node) => node.remove());

      const candidates = Array.from(document.querySelectorAll('section, article, div'));
      candidates
        .filter((node) => {
          const value = String(node.textContent || '');
          return value.length < 2200 && (
            value.includes('IRGEZTNE LIVE') ||
            value.includes('Live room') ||
            value.includes('Live-комната')
          );
        })
        .sort((a, b) => String(a.textContent || '').length - String(b.textContent || '').length)
        .forEach((node) => {
          if (node && node.parentElement) node.remove();
        });
    } catch (error) {}
  }

  function protectChat() {
    if (isConnected()) return;
    removeLegacyLivePanels();

    const roots = Array.from(document.querySelectorAll('.ir-chat-v1, [data-section="rooms"] .ecosystem-v0-shell-intro + div, .workspace-panel[data-panel="rooms"] .ir-chat-v1'));
    roots.forEach((node) => {
      if (!node || node.getAttribute('data-v043b-chat-gate') === '1') return;
      if (window.IRGEZTNEConnected && typeof window.IRGEZTNEConnected.renderGate === 'function') {
        node.setAttribute('data-v043b-chat-gate', '1');
        node.innerHTML = window.IRGEZTNEConnected.renderGate('chat');
      }
    });
  }

  function tick() {
    placeAccountButton();
    removeLegacyLivePanels();
    protectChat();
  }

  function boot() {
    tick();

    let count = 0;
    const interval = window.setInterval(() => {
      count += 1;
      tick();
      if (count > 80) window.clearInterval(interval);
    }, 250);

    try {
      new MutationObserver(tick).observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {}

    window.addEventListener('irgeztne:identity-changed', tick);
    document.addEventListener('irgeztne:identity-changed', tick);
    window.addEventListener('resize', placeAccountButton);
    document.addEventListener('irg:language-changed', tick);
    window.addEventListener('irg:language-changed', tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();