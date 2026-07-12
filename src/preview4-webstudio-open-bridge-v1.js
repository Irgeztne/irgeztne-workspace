(function () {
  'use strict';

  function openWebStudio(reason) {
    var tries = 0;

    function attempt() {
      tries += 1;

      if (window.IRGEZTNESiteStudioSafeV5 && typeof window.IRGEZTNESiteStudioSafeV5.open === 'function') {
        window.IRGEZTNESiteStudioSafeV5.open();
        try { console.log('[IRGEZTNE] Web Studio opened via bridge:', reason); } catch (e) {}
        return;
      }

      if (tries < 30) {
        setTimeout(attempt, 100);
        return;
      }

      try {
        console.warn('[IRGEZTNE] Web Studio bridge: IRGEZTNESiteStudioSafeV5.open was not found');
      } catch (e) {}
    }

    attempt();
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-open-section="site-pages"]')
      : null;

    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    openWebStudio('site-pages click');
  }, true);

  window.addEventListener('irgeztne:open-site-studio-safe-v5', function () {
    openWebStudio('window event');
  });

  document.addEventListener('irgeztne:open-site-studio-safe-v5', function () {
    openWebStudio('document event');
  });
})();
