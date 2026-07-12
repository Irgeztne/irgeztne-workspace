/* IRGEZTNE v039d small release UI cleanup
   Shortens Package Workshop label in navigation / quick actions only.
*/
(function () {
  'use strict';

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
      root.querySelectorAll('button, a, span, div, strong').forEach((node) => {
        if (!node || node.children.length) return;

        const text = (node.textContent || '').trim();

        if (text === 'Package Workshop') {
          node.textContent = 'Workshop';
        }

        if (text === 'Мастерская пакетов') {
          node.textContent = 'Мастерская';
        }
      });
    });
  }

  function schedule() {
    setTimeout(shortenWorkshopLabels, 60);
    setTimeout(shortenWorkshopLabels, 250);
    setTimeout(shortenWorkshopLabels, 900);
  }

  document.addEventListener('DOMContentLoaded', schedule);
  document.addEventListener('click', schedule, true);
  document.addEventListener('irg:language-changed', schedule);
  window.addEventListener('irg:language-changed', schedule);

  if (document.readyState !== 'loading') schedule();

  window.IRGEZTNEReleaseCleanupV039D = { run: schedule };
})();
