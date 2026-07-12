(function () {
  'use strict';

  const S = window.NSEcosystemV0Shared;
  if (!S) return;

  const DEFAULT_SAFE = {
    authorName: '',
    publisherLabel: '',
    profileNote: '',
    signatureNote: '',
    updatedAt: ''
  };

  function getSafeState() {
    return Object.assign({}, DEFAULT_SAFE, S.loadJson(S.STORAGE.safe, DEFAULT_SAFE));
  }

  function saveSafeState(state) {
    S.saveJson(S.STORAGE.safe, Object.assign({}, state, { updatedAt: S.nowIso() }));
  }

  function renderFiliSafe() {
    const state = getSafeState();
    return S.renderShellIntro('fili-safe', 'Fili Safe v0', S.t('Локальная безопасная зона для профиля автора, заметок о проверке и будущей валидации пакетов.', 'Local safe area for author profile, validation notes, and future package checks.'), [S.t('Без крипты', 'No crypto'), S.t('Без платежей', 'No payments'), S.t('Проверка пакетов v0', 'Package checks v0')]) +
      '<div class="ecosystem-v0-layout ecosystem-v0-layout--safe">' +
      '  <section class="ecosystem-v0-card ecosystem-v0-card--form">' +
      '    <h4>' + S.escapeHtml(S.t('Локальный профиль', 'Local profile')) + '</h4>' +
      '    <label class="ecosystem-v0-field"><span>' + S.escapeHtml(S.t('Имя автора / издателя', 'Author / publisher name')) + '</span><input class="ecosystem-v0-input" data-ecosystem-safe-field="authorName" value="' + S.escapeHtml(state.authorName) + '" /></label>' +
      '    <label class="ecosystem-v0-field"><span>' + S.escapeHtml(S.t('Метка профиля', 'Profile label')) + '</span><input class="ecosystem-v0-input" data-ecosystem-safe-field="publisherLabel" value="' + S.escapeHtml(state.publisherLabel) + '" /></label>' +
      '    <label class="ecosystem-v0-field"><span>' + S.escapeHtml(S.t('Заметка профиля', 'Profile note')) + '</span><textarea class="ecosystem-v0-textarea" data-ecosystem-safe-field="profileNote">' + S.escapeHtml(state.profileNote) + '</textarea></label>' +
      '    <button type="button" class="ecosystem-v0-btn ecosystem-v0-btn--primary" data-ecosystem-action="save-safe-profile">' + S.escapeHtml(S.t('Сохранить профиль', 'Save profile')) + '</button>' +
      '  </section>' +
      '  <section class="ecosystem-v0-card"><h4>' + S.escapeHtml(S.t('Проверка пакетов позже', 'Package checks later')) + '</h4><textarea class="ecosystem-v0-textarea" data-ecosystem-safe-field="signatureNote" placeholder="' + S.escapeHtml(S.t('Заметка о будущей проверке manifest, license, типов файлов...', 'Note about future manifest, license, and file-type checks...')) + '">' + S.escapeHtml(state.signatureNote) + '</textarea><p class="ecosystem-v0-muted">' + S.escapeHtml(S.t('v0 не запускает импортированный код автоматически и не является антивирусом.', 'v0 does not auto-run imported code and is not an antivirus.')) + '</p></section>' +
      '  <section class="ecosystem-v0-card"><h4>' + S.escapeHtml(S.t('Fili Credits foundation', 'Fili Credits foundation')) + '</h4><p class="ecosystem-v0-muted">' + S.escapeHtml(S.t('Fili Credits — внутренние кредиты экосистемы. Это не деньги, не криптовалюта и не выводимый баланс в этой preview-версии.', 'Fili Credits are internal ecosystem credits. Not money. Not crypto. Not withdrawable in this preview.')) + '</p><div class="ecosystem-v0-headchips">' + S.renderChip(S.t('Нет хранения средств', 'No custody')) + S.renderChip(S.t('Нет выплат', 'No payouts')) + S.renderChip(S.t('Нет токена', 'No token')) + '</div></section>' +
      '</div></div>';
  }

  function collectAndSave(root) {
    const state = getSafeState();
    root.querySelectorAll('[data-ecosystem-safe-field]').forEach((field) => {
      state[field.getAttribute('data-ecosystem-safe-field')] = field.value || '';
    });
    saveSafeState(state);
  }

  function handleClick(event) {
    const action = event.target.closest('[data-ecosystem-action="save-safe-profile"]');
    if (!action) return;
    collectAndSave(S.closestModuleRoot(action));
    S.renderAll();
  }

  function handleInput(event) {
    const field = event.target.closest('[data-ecosystem-safe-field]');
    if (!field) return;
    collectAndSave(S.closestModuleRoot(field));
  }

  function boot() {
    S.registerModule('fili-safe', renderFiliSafe);
    S.renderSection('fili-safe');
    document.addEventListener('click', handleClick);
    document.addEventListener('input', handleInput);
    document.addEventListener('irg:language-changed', () => S.renderSection('fili-safe'));
    window.addEventListener('irg:language-changed', () => S.renderSection('fili-safe'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.NSFiliSafeV0 = { getSafeState, saveSafeState, render: () => S.renderSection('fili-safe') };
  window.NSEcosystemV0 = Object.assign(window.NSEcosystemV0 || {}, { getSafeState });
})();
