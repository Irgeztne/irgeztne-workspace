(function () {
  'use strict';

  const HINT_PATTERNS = [
    /^esc\s+closes\s+studio$/i,
    /^esc\s+закрывает\s+studio$/i,
    /^esc\s+закрывает\s+студию$/i,
    /^esc\s+закрыть\s+studio$/i,
  ];

  function normalizedText(node) {
    return String((node && (node.innerText || node.textContent)) || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function looksLikeEscHint(node) {
    const text = normalizedText(node);
    if (!text || text.length > 40) return false;
    return HINT_PATTERNS.some((rx) => rx.test(text));
  }

  function getStudioRoot() {
    return (
      document.querySelector('.ns-site-studio-safe') ||
      document.querySelector('.site-studio-safe') ||
      document.querySelector('[class*="site-studio"]') ||
      null
    );
  }

  function cleanupEscHint() {
    const root = getStudioRoot();
    if (!root) return;

    const candidates = root.querySelectorAll('button, [role="button"], .button, .btn, span, kbd, div');
    candidates.forEach((node) => {
      if (!looksLikeEscHint(node)) return;

      // This is only a visual helper, not a real action. Hide it so the header
      // keeps only actual buttons: Back to Editor and Close / X.
      node.setAttribute('data-irgeztne-hidden-esc-hint', 'true');
      node.setAttribute('aria-hidden', 'true');
      if ('disabled' in node) node.disabled = true;
      node.style.display = 'none';
      node.style.pointerEvents = 'none';
    });
  }

  function start() {
    cleanupEscHint();
    const observer = new MutationObserver(cleanupEscHint);
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
