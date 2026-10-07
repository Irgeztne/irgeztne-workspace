(function () {
  'use strict';

  if (window.__IRGEZTNE_SITE_STUDIO_CABINET_DIRECT_OPEN_V3__) {
    return;
  }

  // IRGEZTNE_WEBSTUDIO_WORKSHOP_DOOR_V04P18
  // IRGEZTNE_WORKSHOP_SINGLE_DOOR_V04P20
  window.__IRGEZTNE_SITE_STUDIO_CABINET_DIRECT_OPEN_V3__ = true;
  // Keep the old marker for compatibility with diagnostics that know V2.
  window.__IRGEZTNE_SITE_STUDIO_CABINET_DIRECT_OPEN_V2__ = true;

  var SITE_SELECTOR = [
    '[data-open-section="site-pages"]',
    '[data-home-open="site-pages"]',
    '[data-home-open-cabinet="site-pages"]',
    '[data-section="site-pages"]'
  ].join(', ');

  var TEMPLATE_SELECTOR = [
    '[data-open-section="marketplace"]',
    '[data-home-open="marketplace"]',
    '[data-home-open-cabinet="marketplace"]',
    '[data-section="marketplace"]'
  ].join(', ');


  // Workshop has one user-facing door now: Web Studio -> Workshop.
  // Keep legacy codehub implementation available internally, but intercept every
  // normal navigation/button entrance so users never land on the duplicate
  // standalone surface.
  var WORKSHOP_SELECTOR = [
    '[data-workspace-deep-link="workshop"]',
    '[data-open-section="codehub"]',
    '[data-home-open="codehub"]',
    '[data-home-open-cabinet="codehub"]',
    '[data-section="codehub"]'
  ].join(', ');

  function openSiteStudio(tabId) {
    var tries = 0;

    function attempt() {
      tries += 1;

      var api = window.IRGEZTNESiteStudioSafeV5;

      if (
        tabId &&
        api &&
        typeof api.openTab === 'function'
      ) {
        api.openTab(tabId);
        return;
      }

      if (
        !tabId &&
        api &&
        typeof api.open === 'function'
      ) {
        api.open();
        return;
      }

      if (tries < 30) {
        setTimeout(attempt, 100);
        return;
      }

      console.warn(
        '[IRGEZTNE] Web Studio API was not found:',
        tabId || 'default'
      );
    }

    attempt();
  }

  document.addEventListener('click', function (event) {
    var target = event.target;

    if (!target || !target.closest) return;

    var templateTrigger = target.closest(
      TEMPLATE_SELECTOR
    );

    var workshopTrigger = target.closest(
      WORKSHOP_SELECTOR
    );

    var siteTrigger = target.closest(
      SITE_SELECTOR
    );

    if (!templateTrigger && !workshopTrigger && !siteTrigger) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }

    openSiteStudio(
      templateTrigger ? 'templates' : (workshopTrigger ? 'workshop' : '')
    );
  }, true);

  window.addEventListener(
    'irgeztne:open-site-studio-safe-v5',
    function () {
      openSiteStudio('');
    }
  );

  document.addEventListener(
    'irgeztne:open-site-studio-safe-v5',
    function () {
      openSiteStudio('');
    }
  );
})();
