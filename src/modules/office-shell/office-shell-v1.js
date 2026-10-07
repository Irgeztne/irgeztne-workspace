(function () {
  'use strict';

  const ROOT_SELECTOR = '[data-office-shell-root]';
  const state = { collapsed: false, active: 'document', saveState: 'saved' };
  const EDITORS = [
    { id: 'document', icon: 'D' },
    { id: 'spreadsheet', icon: 'T' },
    { id: 'presentation', icon: 'P' },
    { id: 'diagram', icon: '◇' },
    { id: 'formula', icon: 'ƒ' }
  ];

  const COPY = {
    ru: {
      eyebrow: 'IRGEZTNE OFFICE',
      title: 'Офис',
      description: 'Единое рабочее пространство для документов, таблиц, презентаций, диаграмм, формул и форм.',
      collapse: 'Свернуть навигацию',
      expand: 'Развернуть навигацию',
      saved: 'Сохранено',
      editors: { document: 'Документы', spreadsheet: 'Таблицы', presentation: 'Презентации', diagram: 'Диаграммы', formula: 'Формулы', form: 'Формы' }
    },
    en: {
      eyebrow: 'IRGEZTNE OFFICE',
      title: 'Office',
      description: 'One workspace for documents, spreadsheets, presentations, diagrams, formulas, and forms.',
      collapse: 'Collapse navigation',
      expand: 'Expand navigation',
      saved: 'Saved',
      editors: { document: 'Documents', spreadsheet: 'Spreadsheets', presentation: 'Presentations', diagram: 'Diagrams', formula: 'Formulas', form: 'Forms' }
    }
  };

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'ru';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function navMarkup(copy) {
    return EDITORS.map((editor) => {
      const label = copy.editors[editor.id];
      const active = state.active === editor.id;
      return `
        <button class="ns-office-shell-v103__nav-item${active ? ' is-active' : ''}" type="button" data-office-editor="${editor.id}" aria-current="${active ? 'page' : 'false'}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
          <span class="ns-office-shell-v103__nav-icon" aria-hidden="true">${editor.icon}</span>
          <span class="ns-office-shell-v103__nav-label">${escapeHtml(label)}</span>
        </button>`;
    }).join('');
  }

  function saveStateLabels(copy) {
    return {
      dirty: language() === 'ru' ? 'Изменено' : 'Modified',
      saving: language() === 'ru' ? 'Сохранение…' : 'Saving…',
      saved: copy.saved
    };
  }

  function renderRoot(root) {
    const copy = COPY[language()];
    const activeLabel = copy.editors[state.active];
    const toggleLabel = state.collapsed ? copy.expand : copy.collapse;
    const saveLabels = saveStateLabels(copy);
    const saveState = saveLabels[state.saveState] ? state.saveState : 'saved';
    const saveLabel = saveLabels[saveState];

    root.innerHTML = `
      <section class="ns-office-shell-v103${state.collapsed ? ' is-collapsed' : ''}" data-office-shell-state="${state.collapsed ? 'collapsed' : 'expanded'}" data-office-shell-active-type="${state.active}">
        <aside class="ns-office-shell-v103__sidebar" aria-label="${escapeHtml(copy.title)}">
          <div class="ns-office-shell-v103__brand">
            <div class="ns-office-shell-v103__brand-mark">IR<span class="ns-office-shell-v103__save-dot" data-office-shell-save-indicator="${saveState}" role="status" aria-label="${escapeHtml(saveLabel)}" title="${escapeHtml(saveLabel)}"></span></div>
            <div class="ns-office-shell-v103__brand-copy">
              <span class="ns-office-shell-v103__brand-eyebrow">${escapeHtml(copy.eyebrow)}</span>
              <div class="ns-office-shell-v103__brand-context"><strong>${escapeHtml(activeLabel)}</strong><span class="ns-office-shell-v103__sidebar-save-state" data-office-shell-save-state="${saveState}" aria-live="polite">${escapeHtml(saveLabel)}</span></div>
            </div>
          </div>
          <button class="ns-office-shell-v103__collapse" type="button" data-office-shell-toggle aria-label="${escapeHtml(toggleLabel)}" title="${escapeHtml(toggleLabel)}">
            <span aria-hidden="true">${state.collapsed ? '›' : '‹'}</span><span class="ns-office-shell-v103__collapse-label">${escapeHtml(toggleLabel)}</span>
          </button>
          <nav class="ns-office-shell-v103__nav" aria-label="${escapeHtml(copy.title)}">${navMarkup(copy)}</nav>
        </aside>

        <main class="ns-office-shell-v103__main">
          <div class="ns-office-shell-v103__workspace" role="region" aria-label="${escapeHtml(activeLabel)}">
            <div data-documents-root data-documents-surface="office-shell" data-office-type="${state.active}"></div>
          </div>
        </main>
      </section>`;

    if (window.NSOfficeV1 && typeof window.NSOfficeV1.renderAll === 'function') window.NSOfficeV1.renderAll();
  }

  function render() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(renderRoot);
  }

  function setSaveState(status) {
    const copy = COPY[language()];
    const labels = saveStateLabels(copy);
    state.saveState = labels[status] ? status : 'saved';
    const label = labels[state.saveState];
    document.querySelectorAll('[data-office-shell-save-state]').forEach((node) => {
      node.dataset.officeShellSaveState = state.saveState;
      node.textContent = label;
    });
    document.querySelectorAll('[data-office-shell-save-indicator]').forEach((node) => {
      node.dataset.officeShellSaveIndicator = state.saveState;
      node.setAttribute('aria-label', label);
      node.setAttribute('title', label);
    });
  }

  function setObjectContext(type) {
    if (String(type || '') !== state.active) return;
    // Public compatibility hook. The object title is owned by the active editor
    // and is intentionally not duplicated in the Office shell.
  }

  function handleClick(event) {
    const toggle = event.target.closest('[data-office-shell-toggle]');
    if (toggle) {
      state.collapsed = !state.collapsed;
      render();
      return;
    }
    const editorButton = event.target.closest('[data-office-editor]');
    if (!editorButton || !editorButton.closest(ROOT_SELECTOR)) return;
    const next = editorButton.dataset.officeEditor;
    if (!EDITORS.some((editor) => editor.id === next)) return;
    state.active = next;
    render();
  }

  document.addEventListener('click', handleClick);
  document.addEventListener('irg:language-changed', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();

  window.IRGEZTNEOfficeShell = Object.freeze({ render, setSaveState, setObjectContext });
})();
