/*
  IRGEZTNE Workspace — Green Lightning Chat
  Startup Scroll Settler v0.4P13e

  Companion to accepted P13a.
  Purpose:
  - on initial Chat reveal, wait for late layout/content settling
  - re-assert "latest message" position a few times
  - stop immediately if the user starts manually reading history
  - do not interfere with normal P13a send/sticky-bottom behavior
*/
(() => {
  'use strict';

  if (window.__IRGEZTNE_CHAT_STARTUP_SCROLL_V04P13E) return;

  const PANEL_SELECTOR = '.cabinet-section-panel[data-cabinet-panel="rooms"]';
  const MESSAGE_AREA_SELECTOR = '.gl-p1-messages';

  let panel = null;
  let messageArea = null;
  let wasVisible = false;
  let settleToken = 0;
  let userInterrupted = false;
  let observer = null;

  function isVisible(node) {
    if (!node || !node.isConnected) return false;
    if (node.hidden) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function resolve() {
    const nextPanel = document.querySelector(PANEL_SELECTOR);
    if (!nextPanel) return false;

    if (nextPanel !== panel) {
      panel = nextPanel;
      messageArea = panel.querySelector(MESSAGE_AREA_SELECTOR);
      wasVisible = false;
      bindUserInterrupts();
    } else if (!messageArea || !messageArea.isConnected) {
      messageArea = panel.querySelector(MESSAGE_AREA_SELECTOR);
      bindUserInterrupts();
    }
    return true;
  }

  function existingAutoScroll() {
    const api = window.__IRGEZTNE_CHAT_AUTOSCROLL_V04P13A;
    return api && typeof api.scrollToLatest === 'function' ? api : null;
  }

  function hardBottom() {
    if (!messageArea) return;
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  function nudgeToLatest() {
    if (userInterrupted || !isVisible(panel)) return;
    const api = existingAutoScroll();
    if (api) api.scrollToLatest('auto');
    else hardBottom();
  }

  function settle() {
    const token = ++settleToken;
    userInterrupted = false;

    // Layout can keep changing after renderer history, fonts, and late CSS settle.
    // A short finite series is safer than permanent forced scrolling.
    const delays = [0, 50, 140, 300, 600, 1000, 1500];

    for (const delay of delays) {
      window.setTimeout(() => {
        if (token !== settleToken || userInterrupted) return;
        resolve();
        nudgeToLatest();
      }, delay);
    }
  }

  function interrupt() {
    userInterrupted = true;
    settleToken++;
  }

  function bindUserInterrupts() {
    if (!messageArea || messageArea.__irgeztneP13eBound) return;
    messageArea.__irgeztneP13eBound = true;

    messageArea.addEventListener('wheel', interrupt, { passive: true });
    messageArea.addEventListener('touchstart', interrupt, { passive: true });
    messageArea.addEventListener('pointerdown', (event) => {
      // Clicking/selecting inside history means the user has taken control.
      if (event.button === 0) interrupt();
    }, { passive: true });
  }

  function checkVisibility() {
    if (!resolve()) return;

    const visible = isVisible(panel);
    if (visible && !wasVisible) settle();
    wasVisible = visible;
  }

  observer = new MutationObserver(() => {
    checkVisibility();

    // During the short startup window, newly rendered/replaced message content
    // may alter scrollHeight after the first scroll.
    if (!userInterrupted && isVisible(panel)) {
      const token = settleToken;
      window.requestAnimationFrame(() => {
        if (token === settleToken && !userInterrupted) nudgeToLatest();
      });
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'aria-hidden', 'style']
    });
  }

  function boot() {
    checkVisibility();

    // Window load is a useful second anchor for font/layout completion.
    window.addEventListener('load', () => {
      resolve();
      if (isVisible(panel)) settle();
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.__IRGEZTNE_CHAT_STARTUP_SCROLL_V04P13E = Object.freeze({
    settle,
    getState: () => ({
      attached: !!panel,
      visible: isVisible(panel),
      interrupted: userInterrupted
    })
  });
})();
