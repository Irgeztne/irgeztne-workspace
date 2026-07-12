(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  const DEFAULT_CATEGORIES = [
    'Official templates',
    'Website sections',
    'Theme packs',
    'Icon packs',
    'Cover templates',
    'Document templates',
    'Writer templates',
    'Asset packs',
    'Favicon/logo packs',
    'CodeHub packages',
    'Publishing presets',
    'Map packs',
    'Project kits',
    'AI workflow packs later'
  ];

  const DEFAULT_STORE = {
    items: [],
    categories: DEFAULT_CATEGORIES.slice()
  };

  const CATEGORY_LABELS_RU = {
    'Templates': 'Шаблоны',
    'Sections': 'Секции',
    'Themes': 'Темы',
    'Asset packs': 'Пакеты ассетов',
    'Official templates': 'Официальные шаблоны',
    'Website sections': 'Секции сайтов',
    'Theme packs': 'Пакеты тем',
    'Icon packs': 'Пакеты иконок',
    'Cover templates': 'Шаблоны обложек',
    'Document templates': 'Шаблоны документов',
    'Writer templates': 'Шаблоны Writer',
    'Favicon/logo packs': 'Пакеты favicon/logo',
    'CodeHub packages': 'CodeHub пакеты',
    'Publishing presets': 'Пресеты публикации',
    'Map packs': 'Пакеты карты',
    'Project kits': 'Проектные наборы',
    'AI workflow packs later': 'AI workflow-паки позже'
  };

  function localizeCategory(category) {
    const value = String(category || '').trim();
    return S.getLang() === 'ru' ? (CATEGORY_LABELS_RU[value] || value) : value;
  }

  function getStoreState() {
    const state = S.loadJson(S.STORAGE.store, DEFAULT_STORE);
    if (!Array.isArray(state.items)) state.items = [];
    if (!Array.isArray(state.categories) || !state.categories.length) state.categories = DEFAULT_CATEGORIES.slice();
    return state;
  }

  function saveStoreState(state) {
    S.saveJson(S.STORAGE.store, state);
  }

  function renderFiliStore() {
    const state = getStoreState();
    const items = state.items;
    const categoryRows = state.categories.map((category) => {
      const count = items.filter((item) => item.category === category).length;
      return '<div class="ecosystem-v0-category"><strong>' + S.escapeHtml(localizeCategory(category)) + '</strong><span>' + S.escapeHtml(count + ' ' + S.t('лок.', 'local')) + '</span></div>';
    }).join('');
    const itemRows = items.length
      ? items.slice(0, 8).map((item) => '<div class="ecosystem-v0-item"><strong>' + S.escapeHtml(item.title || S.t('Без названия', 'Untitled')) + '</strong><span>' + S.escapeHtml(localizeCategory(item.category || '')) + '</span><p>' + S.escapeHtml(item.note || '') + '</p></div>').join('')
      : '<div class="ecosystem-v0-empty">' + S.escapeHtml(S.t('Локальных карточек пока нет. Добавьте первую карточку, чтобы проверить структуру Fili Store.', 'No local cards yet. Add the first card to test the Fili Store structure.')) + '</div>';
    const options = state.categories.map((category) => '<option value="' + S.escapeHtml(category) + '">' + S.escapeHtml(localizeCategory(category)) + '</option>').join('');

    return S.renderShellIntro('fili-store', 'Fili Store v0', S.t('Локальная витрина полезных файлов, шаблонов и пакетов для IRGEZTNE. Без реальных оплат и продаж в v0.', 'Local showcase for useful IRGEZTNE files, templates, and packs. No real payments or sales in v0.'), [S.t('Файловая витрина', 'File showcase'), S.t('Без оплат', 'No payments'), S.t('Marketplace позже', 'Marketplace later')]) +
      '<div class="ecosystem-v0-layout ecosystem-v0-layout--store">' +
      '  <section class="ecosystem-v0-card"><h4>' + S.escapeHtml(S.t('Категории файлов', 'File categories')) + '</h4><div class="ecosystem-v0-category-grid">' + categoryRows + '</div></section>' +
      '  <section class="ecosystem-v0-card ecosystem-v0-card--form"><h4>' + S.escapeHtml(S.t('Добавить локальную карточку', 'Add local card')) + '</h4>' +
      '    <input class="ecosystem-v0-input" data-ecosystem-store-title placeholder="' + S.escapeHtml(S.t('Название пакета / файла', 'Package / file title')) + '" />' +
      '    <select class="ecosystem-v0-input" data-ecosystem-store-category>' + options + '</select>' +
      '    <textarea class="ecosystem-v0-textarea" data-ecosystem-store-note placeholder="' + S.escapeHtml(S.t('Короткое описание карточки', 'Short card description')) + '"></textarea>' +
      '    <button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="add-store-item">' + S.escapeHtml(S.t('Добавить карточку', 'Add card')) + '</button>' +
      '  </section>' +
      '  <section class="ecosystem-v0-card"><h4>' + S.escapeHtml(S.t('Локальная витрина', 'Local showcase')) + '</h4><div class="ecosystem-v0-items">' + itemRows + '</div></section>' +
      '</div></div>';
  }

  function handleClick(event) {
    const action = event.target.closest('[data-ecosystem-action="add-store-item"]');
    if (!action) return;
    const root = S.closestModuleRoot(action);
    const state = getStoreState();
    const title = (root.querySelector('[data-ecosystem-store-title]')?.value || '').trim();
    const category = (root.querySelector('[data-ecosystem-store-category]')?.value || DEFAULT_CATEGORIES[0]).trim();
    const note = (root.querySelector('[data-ecosystem-store-note]')?.value || '').trim();
    state.items.unshift({ id: S.uid('fili'), title: title || S.t('Локальный пакет', 'Local package'), category, note, createdAt: S.nowIso(), status: 'local' });
    saveStoreState(state);
    S.renderAll();
  }

  function boot() {
    S.registerModule('fili-store', renderFiliStore);
    S.renderSection('fili-store');
    document.addEventListener('click', handleClick);
    document.addEventListener('irg:language-changed', () => S.renderSection('fili-store'));
    window.addEventListener('irg:language-changed', () => S.renderSection('fili-store'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NSFiliStoreV0 = { getStoreState, saveStoreState, render: () => S.renderSection('fili-store') };
  window.NSEcosystemV0 = Object.assign(window.NSEcosystemV0 || {}, { getStoreState });
})();
