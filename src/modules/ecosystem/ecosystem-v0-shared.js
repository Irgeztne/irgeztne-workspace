(function () {
  'use strict';

  const STORAGE = {
    rooms: 'irgeztne.ecosystem.rooms.v0',
    store: 'irgeztne.ecosystem.filiStore.v0',
    safe: 'irgeztne.ecosystem.filiSafe.v0'
  };

  const registry = Object.create(null);

  function getLang() {
    try {
      const saved = localStorage.getItem('nsbrowser.v8.language');
      if (saved === 'ru' || saved === 'en') return saved;
    } catch (error) {}
    const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return htmlLang.startsWith('ru') ? 'ru' : 'en';
  }

  function t(ru, en) {
    return getLang() === 'ru' ? ru : en;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : clone(fallback);
    } catch (error) {
      console.warn('[IRGEZTNE Ecosystem v0] Failed to load', key, error);
      return clone(fallback);
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      document.dispatchEvent(new CustomEvent('ns-ecosystem:changed', { detail: { key } }));
    } catch (error) {
      console.warn('[IRGEZTNE Ecosystem v0] Failed to save', key, error);
    }
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
    } catch (error) {
      return String(value);
    }
  }

  function renderMetric(label, value, meta) {
    return '<div class="ecosystem-v0-metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong>' + (meta ? '<em>' + escapeHtml(meta) + '</em>' : '') + '</div>';
  }

  function renderChip(text) {
    return '<span class="ecosystem-v0-chip">' + escapeHtml(text) + '</span>';
  }

  function renderShellIntro(kind, title, subtitle, chips) {
    return [
      '<div class="ecosystem-v0-module ecosystem-v0-module--' + escapeHtml(kind) + '">',
      '  <div class="ecosystem-v0-head">',
      '    <div>',
      '      <div class="ecosystem-v0-kicker">IRGEZTNE · v0</div>',
      '      <h3>' + escapeHtml(title) + '</h3>',
      '      <p>' + escapeHtml(subtitle) + '</p>',
      '    </div>',
      '    <div class="ecosystem-v0-headchips">' + (chips || []).map(renderChip).join('') + '</div>',
      '  </div>'
    ].join('');
  }

  function closestModuleRoot(target) {
    return target.closest('.workspace-panel[data-panel], .cabinet-section-panel[data-cabinet-panel]') || document;
  }

  function registerModule(section, renderer) {
    if (!section || typeof renderer !== 'function') return;
    registry[section] = renderer;
  }

  function renderSection(section) {
    const renderer = registry[section];
    if (typeof renderer !== 'function') return;
    document.querySelectorAll('.workspace-panel[data-panel="' + section + '"], .cabinet-section-panel[data-cabinet-panel="' + section + '"]').forEach((node) => {
      node.innerHTML = renderer(section);
    });
  }

  function renderAll() {
    Object.keys(registry).forEach(renderSection);
  }

  window.NSEcosystemV0Shared = {
    STORAGE,
    getLang,
    t,
    nowIso,
    uid,
    escapeHtml,
    clone,
    loadJson,
    saveJson,
    formatDate,
    renderMetric,
    renderChip,
    renderShellIntro,
    closestModuleRoot,
    registerModule,
    renderSection,
    renderAll
  };

  window.NSEcosystemV0 = window.NSEcosystemV0 || {};
  window.NSEcosystemV0.renderAll = renderAll;
})();
