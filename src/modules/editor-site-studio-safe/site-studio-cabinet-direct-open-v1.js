(function () {
  if (window.__IRGEZTNE_SITE_STUDIO_CABINET_DIRECT_OPEN_V1__) return;
  window.__IRGEZTNE_SITE_STUDIO_CABINET_DIRECT_OPEN_V1__ = true;

  function openSiteStudioV5() {
    var tries = 0;

    function attempt() {
      tries += 1;

      if (window.IRGEZTNESiteStudioSafeV5 && typeof window.IRGEZTNESiteStudioSafeV5.open === 'function') {
        window.IRGEZTNESiteStudioSafeV5.open();
        return true;
      }

      if (tries < 30) {
        setTimeout(attempt, 100);
        return false;
      }

      console.warn('[IRGEZTNE] Site Studio open function was not found.');
      return false;
    }

    return attempt();
  }

  function isSiteStudioTrigger(target) {
    return target && target.closest && target.closest(
      '[data-open-section="site-pages"], ' +
      '[data-home-open="site-pages"], ' +
      '[data-home-open-cabinet="site-pages"], ' +
      '[data-section="site-pages"]'
    );
  }

  document.addEventListener('click', function (event) {
    var trigger = isSiteStudioTrigger(event.target);
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    openSiteStudioV5();
  }, true);

  window.addEventListener('irgeztne:open-site-studio-safe-v5', function () {
    openSiteStudioV5();
  });

  document.addEventListener('irgeztne:open-site-studio-safe-v5', function () {
    openSiteStudioV5();
  });
})();
