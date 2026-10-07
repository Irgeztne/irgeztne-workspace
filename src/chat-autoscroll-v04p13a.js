/*
  IRGEZTNE Workspace — Green Lightning Chat Auto-scroll v0.4P13a

  UX-only runtime layer:
  - no changes to rooms-v0.js / Messenger / MLS / SQLCipher
  - discovers the live scroll owner dynamically
  - manual send always reveals the new message
  - sticky-bottom behavior while user stays near the newest messages
  - intentional history reading is not yanked back down
*/
(() => {
  'use strict';

  if (window.__IRGEZTNE_CHAT_AUTOSCROLL_V04P13A) return;

  const PANEL_SELECTOR = '.cabinet-section-panel[data-cabinet-panel="rooms"]';
  const MESSAGE_SELECTOR = '.gl-p1-message';
  const COMPOSE_SELECTOR = '[data-gl-compose]';
  const SEND_SELECTOR = '.gl-p1-send';

  let attachedPanel = null;
  let panelObserver = null;
  let boundScroller = null;
  let stickyBottom = true;
  let armedBySend = false;
  let lastSignature = '';
  let wasVisible = false;
  let scrollRaf = 0;

  function isPanelVisible(panel) {
    if (!panel) return false;
    if (panel.hidden) return false;
    if (panel.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(panel);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function messageNodes(panel = attachedPanel) {
    return panel ? Array.from(panel.querySelectorAll(MESSAGE_SELECTOR)) : [];
  }

  function messageSignature(panel = attachedPanel) {
    const list = messageNodes(panel);
    const last = list[list.length - 1];
    if (!last) return '0';
    const text = String(last.textContent || '').replace(/\s+/g, ' ').trim().slice(-260);
    return `${list.length}:${text}`;
  }

  function canScrollY(node) {
    if (!node || node.nodeType !== 1) return false;
    const style = getComputedStyle(node);
    return /^(auto|scroll|overlay)$/.test(style.overflowY || '');
  }

  function discoverScroller(panel = attachedPanel) {
    if (!panel) return null;
    const list = messageNodes(panel);
    const last = list[list.length - 1];
    if (!last) return null;

    let node = last.parentElement;
    while (node) {
      if (canScrollY(node)) return node;
      if (node === panel) break;
      node = node.parentElement;
    }

    // Conservative fallback: only use the panel itself if it is explicitly scrollable.
    return canScrollY(panel) ? panel : null;
  }

  function isNearBottom(scroller) {
    if (!scroller) return true;
    const remaining = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    return remaining <= 96;
  }

  function bindScroller() {
    const next = discoverScroller();
    if (!next) return null;
    if (next === boundScroller) return next;

    boundScroller = next;
    stickyBottom = isNearBottom(next);

    next.addEventListener('scroll', () => {
      stickyBottom = isNearBottom(next);
    }, { passive: true });

    return next;
  }

  function scrollToLatest(behavior = 'auto') {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      const scroller = bindScroller();
      if (!scroller) return;

      const top = scroller.scrollHeight;
      try {
        scroller.scrollTo({ top, behavior });
      } catch (_) {
        scroller.scrollTop = top;
      }
      stickyBottom = true;

      // One delayed correction covers layout finishing after a renderer reflow.
      window.setTimeout(() => {
        if (!boundScroller) return;
        boundScroller.scrollTop = boundScroller.scrollHeight;
        stickyBottom = true;
      }, 60);
    });
  }

  function armManualSend() {
    armedBySend = true;
    // Failed sends must not leave the session permanently armed.
    window.setTimeout(() => {
      armedBySend = false;
    }, 5000);
  }

  function composeHasFocus() {
    const active = document.activeElement;
    return !!(attachedPanel && active && active.matches && active.matches(COMPOSE_SELECTOR));
  }

  function handlePanelChange() {
    if (!attachedPanel) return;

    const visible = isPanelVisible(attachedPanel);
    if (visible && !wasVisible) {
      lastSignature = messageSignature();
      bindScroller();
      scrollToLatest('auto');
    }
    wasVisible = visible;

    if (!visible) return;

    bindScroller();
    const nextSignature = messageSignature();
    if (nextSignature === lastSignature) return;

    const hadPrevious = !!lastSignature;
    lastSignature = nextSignature;

    if (!hadPrevious) {
      scrollToLatest('auto');
      return;
    }

    const manualSend = armedBySend;
    if (manualSend || composeHasFocus() || stickyBottom) {
      armedBySend = false;
      scrollToLatest(manualSend ? 'smooth' : 'auto');
    }
  }

  function attach(panel) {
    if (!panel || panel === attachedPanel) return;

    if (panelObserver) panelObserver.disconnect();
    attachedPanel = panel;
    boundScroller = null;
    stickyBottom = true;
    armedBySend = false;
    lastSignature = messageSignature(panel);
    wasVisible = isPanelVisible(panel);

    panelObserver = new MutationObserver(handlePanelChange);
    panelObserver.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden', 'style']
    });

    bindScroller();
    if (wasVisible) scrollToLatest('auto');
  }

  function findAndAttach() {
    const panel = document.querySelector(PANEL_SELECTOR);
    if (panel) attach(panel);
  }

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (!target || !target.matches || !target.matches(COMPOSE_SELECTOR)) return;
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      armManualSend();
    }
  }, true);

  document.addEventListener('pointerdown', (event) => {
    if (!attachedPanel) return;
    const target = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!target || !attachedPanel.contains(target)) return;

    if (target.matches(SEND_SELECTOR)) {
      armManualSend();
      return;
    }

    const form = target.closest('form');
    if (form && form.querySelector(COMPOSE_SELECTOR)) armManualSend();
  }, true);

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (attachedPanel && form && attachedPanel.contains(form) && form.querySelector && form.querySelector(COMPOSE_SELECTOR)) {
      armManualSend();
    }
  }, true);

  // Chat panel is normally present from startup; this tiny observer only waits
  // for it if an older shell inserts it later, then disconnects itself.
  const bootstrapObserver = new MutationObserver(() => {
    findAndAttach();
    if (attachedPanel) bootstrapObserver.disconnect();
  });

  if (document.documentElement) {
    bootstrapObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', findAndAttach, { once: true });
  } else {
    findAndAttach();
  }

  window.__IRGEZTNE_CHAT_AUTOSCROLL_V04P13A = Object.freeze({
    scrollToLatest,
    getState: () => ({
      attached: !!attachedPanel,
      hasScroller: !!boundScroller,
      stickyBottom,
      armedBySend,
      messageCount: messageNodes().length
    })
  });
})();
