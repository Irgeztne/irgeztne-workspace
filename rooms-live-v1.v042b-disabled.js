(function () {
  'use strict';

  /*
    IRGEZTNE v042b
    Legacy rooms-live-v1 is disabled.

    The user-facing module is now Chat / Чат in rooms-v0.js.
    This compatibility shim prevents the old "Live room / Live-комната"
    panel from being injected on top of the new Chat foundation.
  */

  function removeLegacyLivePanels() {
    try {
      document.querySelectorAll(
        '[data-live-rooms-panel], .rooms-live-v1, .rooms-live-v039d, .rooms-live-v039e'
      ).forEach(function (node) {
        node.remove();
      });
    } catch (error) {}
  }

  function boot() {
    removeLegacyLivePanels();

    try {
      const observer = new MutationObserver(function () {
        removeLegacyLivePanels();
      });

      observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.NSRoomsLiveV1 = {
    disabled: true,
    render: function () { return ''; },
    mount: function () { removeLegacyLivePanels(); },
    refresh: function () { removeLegacyLivePanels(); },
    reset: function () { removeLegacyLivePanels(); }
  };
})();
