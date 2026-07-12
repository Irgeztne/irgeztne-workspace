/* IRGEZTNE v039e release UI cleanup
   Shortens Workshop labels in navigation/quick actions robustly.
*/
(function () {
  'use strict';

  function replaceInTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const before = node.nodeValue;
    if (!before) return;

    let after = before
      .replace(/\bPackage Workshop\b/g, 'Workshop')
      .replace(/Мастерская\s+пакетов/g, 'Мастерская');

    if (after !== before) node.nodeValue = after;
  }

  function shortenWorkshopLabels() {
    const scopes = [
      '.workspace-sidebar',
      '.workspace-start',
      '.workspace-home',
      '.workspace-quick-actions',
      '.workspace-shell',
      'aside',
      'nav'
    ];

    const rootSet = new Set();
    scopes.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => rootSet.add(node));
    });

    rootSet.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest('script, style, textarea, input')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(replaceInTextNode);
    });
  }

  function schedule() {
    setTimeout(shortenWorkshopLabels, 20);
    setTimeout(shortenWorkshopLabels, 120);
    setTimeout(shortenWorkshopLabels, 500);
  }

  function startObserver() {
    if (!document.body || window.__irgeztneReleaseCleanupV039EObserver) return;

    window.__irgeztneReleaseCleanupV039EObserver = new MutationObserver(() => schedule());
    window.__irgeztneReleaseCleanupV039EObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    startObserver();
    schedule();
  });

  document.addEventListener('click', schedule, true);
  document.addEventListener('irg:language-changed', schedule);
  window.addEventListener('irg:language-changed', schedule);

  if (document.readyState !== 'loading') {
    startObserver();
    schedule();
  }

  window.IRGEZTNEReleaseCleanupV039E = { run: schedule };
})();
