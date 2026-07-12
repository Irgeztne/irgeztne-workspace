(function () {
  'use strict';

  function removeLegacyLivePanels() {
    try {
      document.querySelectorAll('[data-live-rooms-panel], .rooms-live-v1, .rooms-live-v039d, .rooms-live-v039e')
        .forEach(function (node) { node.remove(); });
    } catch (error) {}
  }

  function boot() {
    removeLegacyLivePanels();
    try {
      new MutationObserver(removeLegacyLivePanels).observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NSRoomsLiveV1 = {
    disabled: true,
    render: function () { return ''; },
    mount: removeLegacyLivePanels,
    refresh: removeLegacyLivePanels,
    reset: removeLegacyLivePanels
  };
})();
