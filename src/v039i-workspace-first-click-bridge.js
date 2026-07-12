/* IRGEZTNE Workspace v039l — disabled first-click bridge
   v039i tried to help the top Workspace / Пространство button after startup.
   It caused an unwanted side effect: sometimes the old big Home module opened.
   This file now keeps only harmless label cleanup and does NOT intercept Workspace clicks.
*/
(function () {
  'use strict';

  function shortenWorkshopLabels() {
    const roots = document.querySelectorAll(
      '.workspace-sidebar, .workspace-start, .workspace-home, .workspace-quick-actions, aside, nav, [data-open-section], [data-home-open]'
    );

    roots.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest('script,style,textarea,input')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      nodes.forEach((node) => {
        const before = node.nodeValue || '';
        const after = before
          .replace(/\bPackage Workshop\b/g, 'Workshop')
          .replace(/Мастерская\s+пакетов/g, 'Мастерская');

        if (after !== before) node.nodeValue = after;
      });
    });
  }

  function cleanupBridgeState() {
    document.body.classList.remove('is-workspace-cabinet-open', 'workspace-cabinet-open');

    document.querySelectorAll(
      '.workspace-cabinet-open, .workspace-panel-open, .has-workspace-panel'
    ).forEach((node) => {
      node.classList.remove('workspace-cabinet-open', 'workspace-panel-open', 'has-workspace-panel');
    });
  }

  function runSoon() {
    shortenWorkshopLabels();
    cleanupBridgeState();
    setTimeout(shortenWorkshopLabels, 100);
    setTimeout(shortenWorkshopLabels, 400);
  }

  document.addEventListener('DOMContentLoaded', runSoon);
  document.addEventListener('irg:language-changed', runSoon);

  if (document.readyState !== 'loading') runSoon();

  window.IRGEZTNEV039IWorkspacePolish = {
    open: function () {
      // Disabled by v039l. Do not force-open big Home or any Workspace panel.
      return false;
    },
    labels: shortenWorkshopLabels,
    disabledBy: 'v039l'
  };

  window.IRGEZTNEV039LDisableWorkspaceBridge = {
    labels: shortenWorkshopLabels,
    cleanup: cleanupBridgeState
  };
})();
