(function () {
  'use strict';

  var MARK = 'data-irgeztne-site-studio-back-button-cleaner-v2';
  if (window[MARK]) return;
  window[MARK] = true;

  function textOf(el) {
    return String(el && el.textContent ? el.textContent : '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function looksLikeBackToEditor(el) {
    if (!el) return false;
    var text = textOf(el);
    var aria = String(el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || '') || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    var all = (text + ' ' + aria).trim();

    // Hide only the duplicate textual back button. Do not touch the red X close button.
    return (
      all.indexOf('back to editor') !== -1 ||
      all.indexOf('назад в редактор') !== -1 ||
      all.indexOf('назад к редактор') !== -1 ||
      all.indexOf('к редактору') !== -1
    );
  }

  function cleanupBackButton() {
    var nodes = document.querySelectorAll('button, a, [role="button"]');
    nodes.forEach(function (el) {
      if (!looksLikeBackToEditor(el)) return;
      el.setAttribute('hidden', 'hidden');
      el.style.display = 'none';
      el.setAttribute('data-site-studio-hidden-duplicate-back', 'true');
    });
  }

  function start() {
    cleanupBackButton();
    var observer = new MutationObserver(function () {
      cleanupBackButton();
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-label', 'title']
    });
    window.addEventListener('focus', cleanupBackButton);
    document.addEventListener('click', function () {
      setTimeout(cleanupBackButton, 0);
      setTimeout(cleanupBackButton, 60);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
