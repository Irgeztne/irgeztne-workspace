(function (root) {
  const STORAGE_KEY = 'ns.browser.v8.tools.v1';

  function isRu() { return String(document.documentElement.lang || '').toLowerCase() === 'ru'; }
  function tr(en, ru) { return isRu() ? ru : en; }

  const LANGUAGES = [
    ['auto', 'Auto', 'Авто'],
    ['en', 'English', 'Английский'],
    ['ru', 'Russian', 'Русский'],
    ['az', 'Azerbaijani', 'Азербайджанский'],
    ['tr', 'Turkish', 'Турецкий'],
    ['uk', 'Украинский'],
    ['de', 'Немецкий'],
    ['fr', 'Французский'],
    ['es', 'Испанский'],
    ['it', 'Итальянский'],
    ['pt', 'Португальский'],
    ['nl', 'Нидерландский'],
    ['pl', 'Польский'],
    ['ro', 'Румынский'],
    ['cs', 'Чешский'],
    ['sk', 'Словацкий'],
    ['hu', 'Венгерский'],
    ['bg', 'Болгарский'],
    ['sr', 'Сербский'],
    ['hr', 'Хорватский'],
    ['el', 'Греческий'],
    ['hy', 'Армянский'],
    ['ka', 'Грузинский'],
    ['fa', 'Персидский'],
    ['ar', 'Арабский'],
    ['he', 'Иврит'],
    ['hi', 'Хинди'],
    ['ur', 'Урду'],
    ['bn', 'Бенгальский'],
    ['zh-CN', 'Китайский (упрощённый)'],
    ['zh-TW', 'Китайский (традиционный)'],
    ['ja', 'Японский'],
    ['ko', 'Корейский'],
    ['id', 'Индонезийский'],
    ['ms', 'Малайский'],
    ['vi', 'Вьетнамский'],
    ['th', 'Тайский']
  ];

  const PROVIDERS = [
    ['google', 'Google Translate', 'Google Переводчик'],
    ['yandex', 'Yandex Translate'],
    ['bing', 'Bing Translate'],
    ['deepl', 'DeepL']
  ];

  const EXTRACT_MODES = [
    ['links', 'Links', 'Ссылки'],
    ['emails', 'Emails', 'Почты'],
    ['hashtags', 'Hashtags', 'Хэштеги'],
    ['mentions', 'Mentions', 'Упоминания'],
    ['numbers', 'Numbers', 'Числа'],
    ['dates', 'Dates', 'Даты'],
    ['keywords', 'Keywords', 'Ключевые слова'],
    ['lines', 'Lines', 'Строки']
  ];

  const STOPWORDS = new Set([
    'the','and','for','that','with','this','from','have','your','will','into','about','there','their','they','them','then','than','when','were','what','which','would','could','should','been','also','just','only','some','such','more','most','other','over','under','into','here','very','than','after','before','each','while','where','because','through','these','those','make','made','does','did','done','using','used','user','users','text','note','file','project',
    'это','как','что','для','или','она','они','его','её','над','под','при','без','через','если','уже','ещё','только','тоже','где','когда','потом','здесь','после','перед','между','будет','были','было','есть','нет','это','этот','эта','эти','того','того','если','чтобы','пока','теперь','можно','нужно','надо','вот','там','даже','очень','просто','текст','файл','проект','заметка'
  ]);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getRoots() {
    return Array.from(document.querySelectorAll('[data-tools-root]'));
  }

  function getSavedState() {
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { provider: 'google', from: 'auto', to: 'ru', extractMode: 'links' };
      }
      const parsed = JSON.parse(raw);
      return {
        provider: parsed && parsed.provider ? String(parsed.provider) : 'google',
        from: parsed && parsed.from ? String(parsed.from) : 'auto',
        to: parsed && parsed.to ? String(parsed.to) : 'ru',
        extractMode: parsed && parsed.extractMode ? String(parsed.extractMode) : 'links'
      };
    } catch (error) {
      console.warn('[NSToolsV1] failed to read saved state:', error);
      return { provider: 'google', from: 'auto', to: 'ru', extractMode: 'links' };
    }
  }

  function saveState(next) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(next || {}));
    } catch (error) {
      console.warn('[NSToolsV1] failed to save state:', error);
    }
  }

  function optionsHtml(items, selected) {
    return items.map(function (entry) {
      const value = String(entry[0]);
      const label = String(entry[isRu() ? 2 : 1] || entry[1]);
      return '<option value="' + escapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }

  function renderRoot(surface) {
    const saved = getSavedState();
    const translateFromOptions = optionsHtml(LANGUAGES, saved.from);
    const translateToOptions = optionsHtml(LANGUAGES.filter(function (item) { return item[0] !== 'auto'; }), saved.to);
    const providerOptions = optionsHtml(PROVIDERS, saved.provider);
    const extractModeOptions = optionsHtml(EXTRACT_MODES, saved.extractMode);

    return [
      '<div class="ns-tools-v1" data-tools-surface="' + escapeHtml(surface) + '">',
      '  <div class="ns-tools-v1__stage-row">',
      '    <span class="ns-tools-v1__stage is-ready">' + tr('Tools v1','Инструменты v1') + '</span>',
      '    <span class="ns-tools-v1__meta">' + tr('Translate · Compare · Extract','Перевод · Сравнение · Извлечение') + '</span>',
      '  </div>',
      '  <nav class="ns-tools-v1__tabs" role="tablist">',
      '    <button type="button" class="ns-tools-v1__tab is-active" data-tools-tab="translate" aria-pressed="true">' + tr('Translate','Перевод') + '</button>',
      '    <button type="button" class="ns-tools-v1__tab" data-tools-tab="compare" aria-pressed="false">' + tr('Compare','Сравнить') + '</button>',
      '    <button type="button" class="ns-tools-v1__tab" data-tools-tab="extract" aria-pressed="false">' + tr('Extract','Извлечь') + '</button>',
      '  </nav>',
      '  <section class="ns-tools-v1__panel is-active" data-tools-panel="translate">',
      '    <div class="ns-tools-v1__head">',
      '      <div>',
      '        <h4>' + tr('Translator','Переводчик') + '</h4>',
      '        <p>' + tr('Translate here or open the external translator in a tab.','Переводите здесь или откройте внешний переводчик во вкладке.') + '</p>',
      '      </div>',
      '    </div>',
      '    <div class="ns-tools-v1__toolbar">',
      '      <label class="ns-tools-v1__field compact"><span>' + tr('Service','Сервис') + '</span><select data-tools-provider>' + providerOptions + '</select></label>',
      '      <label class="ns-tools-v1__field compact"><span>' + tr('From','Из') + '</span><select data-tools-from>' + translateFromOptions + '</select></label>',
      '      <label class="ns-tools-v1__field compact"><span>' + tr('To','В') + '</span><select data-tools-to>' + translateToOptions + '</select></label>',
      '    </div>',
      '    <label class="ns-tools-v1__field"><span>' + tr('Source text','Исходный текст') + '</span><textarea data-tools-translate-input rows="8" placeholder="' + tr('Select text, use the active file or note, or paste text here.','Выберите текст, используйте активный файл или заметку либо вставьте текст сюда.') + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions">',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="translate-selection">' + tr('Use Selection','Взять выделение') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="translate-active-file">' + tr('Active File','Активный файл') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="translate-active-note">' + tr('Active Note','Активная заметка') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="translate-paste">' + tr('Paste','Вставить') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="translate-copy-source">' + tr('Copy Source','Копировать исходник') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="translate-swap">' + tr('Swap','Поменять местами') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="translate-clear">' + tr('Clear','Очистить') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn primary" data-tools-action="translate-run">' + tr('Translate Here','Перевести здесь') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="translate-open">' + tr('Open Translate','Открыть переводчик') + '</button>',
      '    </div>',
      '    <label class="ns-tools-v1__field"><span>' + tr('Result','Результат') + '</span><textarea data-tools-translate-result rows="8" readonly placeholder="' + tr('Translation result will appear here.','Здесь появится результат перевода.') + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions">',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="translate-copy-result">' + tr('Copy Result','Копировать результат') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="translate-note">' + tr('Create Note','Создать заметку') + '</button>',
      '    </div>',
      '    <div class="ns-tools-v1__status" data-tools-translate-status>' + tr('Ready for inline translation or open-in-tab flow.','Готово к встроенному переводу или открытию во вкладке.') + '</div>',
      '  </section>',
      '  <section class="ns-tools-v1__panel" data-tools-panel="compare">',
      '    <div class="ns-tools-v1__head">',
      '      <div>',
      '        <h4>' + tr('Compare','Сравнение') + '</h4>',
      '        <p>' + tr('Compare two text blocks and get a simple readable report.','Сравните два текстовых блока и получите простой читаемый отчёт.') + '</p>',
      '      </div>',
      '    </div>',
      '    <div class="ns-tools-v1__compare-grid">',
      '      <div class="ns-tools-v1__compare-side">',
      '        <div class="ns-tools-v1__side-head"><strong>' + tr('Left side','Левый блок') + '</strong></div>',
      '        <label class="ns-tools-v1__field"><span>' + tr('Text A','Текст A') + '</span><textarea data-tools-compare-left rows="8" placeholder="' + tr('Paste or capture the first text here.','Вставьте или захватите сюда первый текст.') + '"></textarea></label>',
      '        <div class="ns-tools-v1__actions small">',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-left-selection">Выделение</button>',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-left-file">' + tr('Active File','Активный файл') + '</button>',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-left-note">' + tr('Active Note','Активная заметка') + '</button>',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-left-paste">' + tr('Paste','Вставить') + '</button>',
      '        </div>',
      '      </div>',
      '      <div class="ns-tools-v1__compare-side">',
      '        <div class="ns-tools-v1__side-head"><strong>' + tr('Right side','Правый блок') + '</strong></div>',
      '        <label class="ns-tools-v1__field"><span>' + tr('Text B','Текст B') + '</span><textarea data-tools-compare-right rows="8" placeholder="' + tr('Paste or capture the second text here.','Вставьте или захватите сюда второй текст.') + '"></textarea></label>',
      '        <div class="ns-tools-v1__actions small">',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-right-selection">Выделение</button>',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-right-file">' + tr('Active File','Активный файл') + '</button>',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-right-note">' + tr('Active Note','Активная заметка') + '</button>',
      '          <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-right-paste">' + tr('Paste','Вставить') + '</button>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="ns-tools-v1__actions">',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="compare-swap">' + tr('Swap sides','Поменять стороны местами') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="compare-clear">' + tr('Clear','Очистить') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn primary" data-tools-action="compare-run">' + tr('Compare','Сравнить') + '</button>',
      '    </div>',
      '    <label class="ns-tools-v1__field"><span>' + tr('Report','Отчёт') + '</span><textarea data-tools-compare-result rows="10" readonly placeholder="' + tr('Comparison report will appear here.','Здесь появится отчёт сравнения.') + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions">',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="compare-copy-result">' + tr('Copy Report','Копировать отчёт') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="compare-note">' + tr('Create Note','Создать заметку') + '</button>',
      '    </div>',
      '    <div class="ns-tools-v1__status" data-tools-compare-status>' + tr('Ready to compare two texts.','Готово к сравнению двух текстов.') + '</div>',
      '  </section>',
      '  <section class="ns-tools-v1__panel" data-tools-panel="extract">',
      '    <div class="ns-tools-v1__head">',
      '      <div>',
      '        <h4>' + tr('Extract','Извлечение') + '</h4>',
      '        <p>' + tr('Extract structured fragments from the current text: links, emails, hashtags, dates, and more.','Извлекайте структурированные фрагменты из текущего текста: ссылки, почты, хэштеги, даты и другое.') + '</p>',
      '      </div>',
      '    </div>',
      '    <div class="ns-tools-v1__toolbar">',
      '      <label class="ns-tools-v1__field compact"><span>' + tr('Mode','Режим') + '</span><select data-tools-extract-mode>' + extractModeOptions + '</select></label>',
      '    </div>',
      '    <label class="ns-tools-v1__field"><span>' + tr('Source text','Исходный текст') + '</span><textarea data-tools-extract-input rows="9" placeholder="' + tr('Paste text or capture it from the active file or note.','Вставьте текст или захватите его из активного файла или заметки.') + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions">',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="extract-selection">' + tr('Use Selection','Взять выделение') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="extract-file">' + tr('Active File','Активный файл') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="extract-note">' + tr('Active Note','Активная заметка') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="extract-paste">' + tr('Paste','Вставить') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="extract-clear">' + tr('Clear','Очистить') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn primary" data-tools-action="extract-run">' + tr('Extract','Извлечь') + '</button>',
      '    </div>',
      '    <label class="ns-tools-v1__field"><span>' + tr('Result','Результат') + '</span><textarea data-tools-extract-result rows="10" readonly placeholder="Здесь появится результат извлечения."></textarea></label>',
      '    <div class="ns-tools-v1__actions">',
      '      <button type="button" class="ns-tools-v1__btn" data-tools-action="extract-copy-result">' + tr('Copy Result','Копировать результат') + '</button>',
      '      <button type="button" class="ns-tools-v1__btn secondary" data-tools-action="extract-note">' + tr('Create Note','Создать заметку') + '</button>',
      '    </div>',
      '    <div class="ns-tools-v1__status" data-tools-extract-status>' + tr('Ready to extract structured fragments from text.','Готово к извлечению структурированных фрагментов из текста.') + '</div>',
      '  </section>',
      '</div>'
    ].join('');
  }

  function getLanguageLabel(code) {
    const match = LANGUAGES.find(function (item) { return item[0] === code; });
    return match ? match[1] : String(code || '');
  }

  function bindRoot(rootEl) {
    const tabs = Array.from(rootEl.querySelectorAll('[data-tools-tab]'));
    tabs.forEach(function (button) {
      button.addEventListener('click', function () {
        const target = String(button.getAttribute('data-tools-tab') || 'translate');
        rootEl.querySelectorAll('[data-tools-tab]').forEach(function (tabButton) {
          const active = tabButton.getAttribute('data-tools-tab') === target;
          tabButton.classList.toggle('is-active', active);
          tabButton.setAttribute('aria-pressed', String(active));
        });
        rootEl.querySelectorAll('[data-tools-panel]').forEach(function (panel) {
          panel.classList.toggle('is-active', panel.getAttribute('data-tools-panel') === target);
        });
      });
    });

    const providerSelect = rootEl.querySelector('[data-tools-provider]');
    const fromSelect = rootEl.querySelector('[data-tools-from]');
    const toSelect = rootEl.querySelector('[data-tools-to]');
    const extractMode = rootEl.querySelector('[data-tools-extract-mode]');

    [providerSelect, fromSelect, toSelect, extractMode].forEach(function (node) {
      if (!node) return;
      node.addEventListener('change', persistPreferences);
    });

    rootEl.addEventListener('click', function (event) {
      const button = event.target.closest('[data-tools-action]');
      if (!button) return;
      const action = String(button.getAttribute('data-tools-action') || '');
      handleAction(rootEl, action);
    });
  }

  function persistPreferences() {
    const firstRoot = getRoots()[0];
    if (!firstRoot) return;
    saveState({
      provider: valueOf(firstRoot, '[data-tools-provider]', 'google'),
      from: valueOf(firstRoot, '[data-tools-from]', 'auto'),
      to: valueOf(firstRoot, '[data-tools-to]', 'ru'),
      extractMode: valueOf(firstRoot, '[data-tools-extract-mode]', 'links')
    });
    syncPreferenceControls();
  }

  function syncPreferenceControls() {
    const saved = getSavedState();
    getRoots().forEach(function (rootEl) {
      const provider = rootEl.querySelector('[data-tools-provider]');
      const from = rootEl.querySelector('[data-tools-from]');
      const to = rootEl.querySelector('[data-tools-to]');
      const extractMode = rootEl.querySelector('[data-tools-extract-mode]');
      if (provider) provider.value = saved.provider;
      if (from) from.value = saved.from;
      if (to) to.value = saved.to;
      if (extractMode) extractMode.value = saved.extractMode;
    });
  }

  function valueOf(rootEl, selector, fallback) {
    const node = rootEl.querySelector(selector);
    return node ? String(node.value || fallback) : fallback;
  }

  function handleAction(rootEl, action) {
    switch (action) {
      case 'translate-selection':
        return fillTextarea(rootEl, '[data-tools-translate-input]', getSelectedText(), '[data-tools-translate-status]', 'Выделение взято для перевода.');
      case 'translate-active-file':
        return fillTextarea(rootEl, '[data-tools-translate-input]', getActiveFileText(), '[data-tools-translate-status]', 'Активный файл вставлен в переводчик.');
      case 'translate-active-note':
        return fillTextarea(rootEl, '[data-tools-translate-input]', getActiveNoteText(), '[data-tools-translate-status]', 'Активная заметка вставлена в переводчик.');
      case 'translate-paste':
        return pasteInto(rootEl, '[data-tools-translate-input]', '[data-tools-translate-status]', tr('Clipboard content inserted into translator.','Содержимое буфера вставлено в переводчик.'));
      case 'translate-copy-source':
        return copyTextarea(rootEl, '[data-tools-translate-input]', '[data-tools-translate-status]', tr('Source text copied.','Исходный текст скопирован.'));
      case 'translate-copy-result':
        return copyTextarea(rootEl, '[data-tools-translate-result]', '[data-tools-translate-status]', tr('Translation copied.','Перевод скопирован.'));
      case 'translate-swap':
        return swapLanguages(rootEl);
      case 'translate-clear':
        return clearFields(rootEl, ['[data-tools-translate-input]', '[data-tools-translate-result]'], '[data-tools-translate-status]', tr('Translator cleared.','Переводчик очищен.'));
      case 'translate-run':
        return runTranslate(rootEl);
      case 'translate-open':
        return openTranslate(rootEl);
      case 'translate-note':
        return createNoteFromTextarea(rootEl, '[data-tools-translate-result]', tr('Translation result','Результат перевода'), '[data-tools-translate-status]');

      case 'compare-left-selection':
        return fillTextarea(rootEl, '[data-tools-compare-left]', getSelectedText(), '[data-tools-compare-status]', 'Выделение вставлено в левый блок.');
      case 'compare-left-file':
        return fillTextarea(rootEl, '[data-tools-compare-left]', getActiveFileText(), '[data-tools-compare-status]', 'Активный файл вставлен в левый блок.');
      case 'compare-left-note':
        return fillTextarea(rootEl, '[data-tools-compare-left]', getActiveNoteText(), '[data-tools-compare-status]', 'Активная заметка вставлена в левый блок.');
      case 'compare-left-paste':
        return pasteInto(rootEl, '[data-tools-compare-left]', '[data-tools-compare-status]', 'Содержимое буфера вставлено в левый блок.');
      case 'compare-right-selection':
        return fillTextarea(rootEl, '[data-tools-compare-right]', getSelectedText(), '[data-tools-compare-status]', 'Выделение вставлено в правый блок.');
      case 'compare-right-file':
        return fillTextarea(rootEl, '[data-tools-compare-right]', getActiveFileText(), '[data-tools-compare-status]', 'Активный файл вставлен в правый блок.');
      case 'compare-right-note':
        return fillTextarea(rootEl, '[data-tools-compare-right]', getActiveNoteText(), '[data-tools-compare-status]', 'Активная заметка вставлена в правый блок.');
      case 'compare-right-paste':
        return pasteInto(rootEl, '[data-tools-compare-right]', '[data-tools-compare-status]', 'Содержимое буфера вставлено в правый блок.');
      case 'compare-swap':
        return swapTextareas(rootEl, '[data-tools-compare-left]', '[data-tools-compare-right]', '[data-tools-compare-status]', 'Left and right texts swapped.');
      case 'compare-clear':
        return clearFields(rootEl, ['[data-tools-compare-left]', '[data-tools-compare-right]', '[data-tools-compare-result]'], '[data-tools-compare-status]', tr('Comparison cleared.','Сравнение очищено.'));
      case 'compare-run':
        return runCompare(rootEl);
      case 'compare-copy-result':
        return copyTextarea(rootEl, '[data-tools-compare-result]', '[data-tools-compare-status]', 'Comparison report copied.');
      case 'compare-note':
        return createNoteFromTextarea(rootEl, '[data-tools-compare-result]', 'Comparison report', '[data-tools-compare-status]');

      case 'extract-selection':
        return fillTextarea(rootEl, '[data-tools-extract-input]', getSelectedText(), '[data-tools-extract-status]', 'Выделение inserted into Извлечь.');
      case 'extract-file':
        return fillTextarea(rootEl, '[data-tools-extract-input]', getActiveFileText(), '[data-tools-extract-status]', 'Активный файл вставлен в извлечение.');
      case 'extract-note':
        return fillTextarea(rootEl, '[data-tools-extract-input]', getActiveNoteText(), '[data-tools-extract-status]', 'Активная заметка вставлена в извлечение.');
      case 'extract-paste':
        return pasteInto(rootEl, '[data-tools-extract-input]', '[data-tools-extract-status]', 'Содержимое буфера вставлено в извлечение.');
      case 'extract-clear':
        return clearFields(rootEl, ['[data-tools-extract-input]', '[data-tools-extract-result]'], '[data-tools-extract-status]', tr('Extract cleared.','Извлечение очищено.'));
      case 'extract-run':
        return runИзвлечь(rootEl);
      case 'extract-copy-result':
        return copyTextarea(rootEl, '[data-tools-extract-result]', '[data-tools-extract-status]', 'Извлечь result copied.');
      case 'extract-note':
        return createNoteFromTextarea(rootEl, '[data-tools-extract-result]', 'Извлечь result', '[data-tools-extract-status]');
      default:
        return undefined;
    }
  }

  function getNode(rootEl, selector) {
    return rootEl.querySelector(selector);
  }

  function setStatus(rootEl, selector, text) {
    const node = getNode(rootEl, selector);
    if (node) node.textContent = String(text || '');
  }

  function fillTextarea(rootEl, selector, text, statusSelector, successMessage) {
    const value = String(text || '').trim();
    if (!value) {
      setStatus(rootEl, statusSelector, 'Nothing available yet. Select text, open a note, or activate a file first.');
      return;
    }
    const node = getNode(rootEl, selector);
    if (node) node.value = value;
    setStatus(rootEl, statusSelector, successMessage);
  }

  async function pasteInto(rootEl, selector, statusSelector, successMessage) {
    const text = String(await readClipboardText() || '').trim();
    if (!text) {
      setStatus(rootEl, statusSelector, 'Clipboard is empty.');
      return;
    }
    const node = getNode(rootEl, selector);
    if (node) node.value = text;
    setStatus(rootEl, statusSelector, successMessage);
  }

  async function copyTextarea(rootEl, selector, statusSelector, successMessage) {
    const node = getNode(rootEl, selector);
    const value = node ? String(node.value || '').trim() : '';
    if (!value) {
      setStatus(rootEl, statusSelector, 'Nothing to copy yet.');
      return;
    }
    const ok = await writeClipboardText(value);
    setStatus(rootEl, statusSelector, ok ? successMessage : 'Copy failed.');
  }

  function clearFields(rootEl, selectors, statusSelector, message) {
    selectors.forEach(function (selector) {
      const node = getNode(rootEl, selector);
      if (node) node.value = '';
    });
    setStatus(rootEl, statusSelector, message);
  }

  function swapLanguages(rootEl) {
    const from = getNode(rootEl, '[data-tools-from]');
    const to = getNode(rootEl, '[data-tools-to]');
    if (!from || !to) return;
    const currentFrom = String(from.value || 'auto');
    const currentTo = String(to.value || 'ru');
    from.value = currentTo;
    to.value = currentFrom === 'auto' ? 'en' : currentFrom;
    persistPreferences();
    setStatus(rootEl, '[data-tools-translate-status]', 'Languages swapped.');
  }

  function swapTextareas(rootEl, leftSelector, rightSelector, statusSelector, message) {
    const left = getNode(rootEl, leftSelector);
    const right = getNode(rootEl, rightSelector);
    if (!left || !right) return;
    const temp = left.value;
    left.value = right.value;
    right.value = temp;
    setStatus(rootEl, statusSelector, message);
  }

  async function runTranslate(rootEl) {
    const input = getNode(rootEl, '[data-tools-translate-input]');
    const result = getNode(rootEl, '[data-tools-translate-result]');
    const provider = valueOf(rootEl, '[data-tools-provider]', 'google');
    const from = valueOf(rootEl, '[data-tools-from]', 'auto');
    const to = valueOf(rootEl, '[data-tools-to]', 'ru');
    const text = input ? String(input.value || '').trim() : '';

    if (!text) {
      setStatus(rootEl, '[data-tools-translate-status]', 'Add text before translating.');
      return;
    }

    if (provider !== 'google') {
      setStatus(rootEl, '[data-tools-translate-status]', tr('Built-in translation is ready for Google. Use Open Translate for the selected provider.','Встроенный перевод сейчас готов для Google. Для выбранного сервиса используйте «Открыть переводчик».'));
      return;
    }

    if (result) result.value = 'Translating...';
    setStatus(rootEl, '[data-tools-translate-status]', 'Requesting inline translation...');

    try {
      const translated = await translateInlineGoogle(from, to, text);
      if (result) result.value = translated || '';
      setStatus(rootEl, '[data-tools-translate-status]', translated ? 'Переведено здесь на ' + getLanguageLabel(to) + '.' : 'Перевод не был получен.');
    } catch (error) {
      console.warn('[NSToolsV1] inline translation failed:', error);
      if (result) result.value = '';
      setStatus(rootEl, '[data-tools-translate-status]', tr('Built-in translation failed. Use Open Translate as a fallback.','Встроенный перевод не удался. Используйте «Открыть переводчик» как запасной вариант.'));
    }
  }

  function openTranslate(rootEl) {
    const input = getNode(rootEl, '[data-tools-translate-input]');
    const text = input ? String(input.value || '').trim() : '';
    if (!text) {
      setStatus(rootEl, '[data-tools-translate-status]', 'Add text before opening Translate.');
      return;
    }
    const provider = valueOf(rootEl, '[data-tools-provider]', 'google');
    const from = valueOf(rootEl, '[data-tools-from]', 'auto');
    const to = valueOf(rootEl, '[data-tools-to]', 'ru');
    const url = buildTranslatorUrl(provider, from, to, text);
    openUrlInTab(url, makeTranslatorTabTitle(provider, to));
    setStatus(rootEl, '[data-tools-translate-status]', tr('Translator opened in a new tab.','Переводчик открыт в новой вкладке.'));
  }

  function runCompare(rootEl) {
    const left = getNode(rootEl, '[data-tools-compare-left]');
    const right = getNode(rootEl, '[data-tools-compare-right]');
    const result = getNode(rootEl, '[data-tools-compare-result]');
    const leftText = left ? String(left.value || '').trim() : '';
    const rightText = right ? String(right.value || '').trim() : '';
    if (!leftText || !rightText) {
      setStatus(rootEl, '[data-tools-compare-status]', 'Для сравнения нужны оба текста: левый и правый.');
      return;
    }
    const report = buildCompareReport(leftText, rightText);
    if (result) result.value = report;
    setStatus(rootEl, '[data-tools-compare-status]', 'Отчёт сравнения подготовлен.');
  }

  function runИзвлечь(rootEl) {
    const input = getNode(rootEl, '[data-tools-extract-input]');
    const result = getNode(rootEl, '[data-tools-extract-result]');
    const mode = valueOf(rootEl, '[data-tools-extract-mode]', 'links');
    const text = input ? String(input.value || '').trim() : '';
    if (!text) {
      setStatus(rootEl, '[data-tools-extract-status]', 'Добавьте текст перед извлечением.');
      return;
    }
    const extracted = buildИзвлечьResult(mode, text);
    if (result) result.value = extracted;
    setStatus(rootEl, '[data-tools-extract-status]', isRu() ? 'Извлечение завершено для режима «' + getИзвлечьModeLabel(mode) + '».' : 'Extraction completed for mode ' + getИзвлечьModeLabel(mode) + '.');
  }

  function getИзвлечьModeLabel(mode) {
    const hit = EXTRACT_MODES.find(function (item) { return item[0] === mode; });
    return hit ? hit[1] : String(mode || 'extract');
  }

  function buildCompareReport(leftText, rightText) {
    const leftLines = uniqueNonEmptyLines(leftText);
    const rightLines = uniqueNonEmptyLines(rightText);
    const commonLines = intersectArrays(leftLines, rightLines);
    const leftOnly = subtractArrays(leftLines, rightLines);
    const rightOnly = subtractArrays(rightLines, leftLines);

    const leftWords = tokenizeWords(leftText);
    const rightWords = tokenizeWords(rightText);
    const commonWords = intersectArrays(leftWords, rightWords);
    const similarity = computeJaccard(leftWords, rightWords);

    return [
      'Отчёт сравнения',
      '==============',
      '',
      'Left stats',
      '---------',
      'Characters: ' + leftText.length,
      'Words: ' + leftWords.length,
      'Lines: ' + leftLines.length,
      '',
      'Right stats',
      '----------',
      'Characters: ' + rightText.length,
      'Words: ' + rightWords.length,
      'Lines: ' + rightLines.length,
      '',
      'Shared view',
      '-----------',
      'Shared lines: ' + commonLines.length,
      'Общие слова: ' + commonWords.length,
      'Word similarity: ' + similarity + '%',
      '',
      'Left only lines',
      '---------------',
      leftOnly.length ? leftOnly.join('\n') : 'None',
      '',
      'Right only lines',
      '----------------',
      rightOnly.length ? rightOnly.join('\n') : 'None',
      '',
      'Предпросмотр общих строк',
      '--------------------',
      commonLines.length ? commonLines.slice(0, 20).join('\n') : 'None'
    ].join('\n');
  }

  function buildИзвлечьResult(mode, text) {
    const value = String(text || '');
    const modeName = getИзвлечьModeLabel(mode);
    let items = [];

    if (mode === 'links') {
      items = uniqueKeepOrder(value.match(/(?:https?:\/\/|www\.)[^\s<>"]+/gi) || []);
    } else if (mode === 'emails') {
      items = uniqueKeepOrder(value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []);
    } else if (mode === 'hashtags') {
      items = uniqueKeepOrder(matchCapture(value, /(^|\s)(#[\p{L}\p{N}_-]+)/gu, 2));
    } else if (mode === 'mentions') {
      items = uniqueKeepOrder(matchCapture(value, /(^|\s)(@[\p{L}\p{N}_-]+)/gu, 2));
    } else if (mode === 'numbers') {
      items = uniqueKeepOrder(value.match(/(?:\+?\d[\d\s().-]{4,}\d|\b\d+(?:[.,]\d+)?\b)/g) || []);
    } else if (mode === 'dates') {
      items = uniqueKeepOrder(value.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g) || []);
    } else if (mode === 'keywords') {
      items = getKeywordPairs(value).map(function (entry) {
        return entry.word + ' — ' + entry.count;
      });
    } else if (mode === 'lines') {
      items = uniqueNonEmptyLines(value);
    }

    return [
      modeName + ' extraction',
      '================',
      'Count: ' + items.length,
      '',
      items.length ? items.join('\n') : 'Nothing matched the current mode.'
    ].join('\n');
  }

  function uniqueNonEmptyLines(text) {
    return uniqueKeepOrder(String(text || '').split(/\r?\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean));
  }

  function uniqueKeepOrder(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).map(function (item) {
      return String(item || '').trim();
    }).filter(function (item) {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  function intersectArrays(a, b) {
    const right = new Set(Array.isArray(b) ? b : []);
    return uniqueKeepOrder((Array.isArray(a) ? a : []).filter(function (item) {
      return right.has(item);
    }));
  }

  function subtractArrays(a, b) {
    const right = new Set(Array.isArray(b) ? b : []);
    return uniqueKeepOrder((Array.isArray(a) ? a : []).filter(function (item) {
      return !right.has(item);
    }));
  }

  function computeJaccard(a, b) {
    const left = new Set(Array.isArray(a) ? a : []);
    const right = new Set(Array.isArray(b) ? b : []);
    if (!left.size && !right.size) return 100;
    const union = new Set([].concat(Array.from(left), Array.from(right)));
    let intersection = 0;
    left.forEach(function (item) {
      if (right.has(item)) intersection += 1;
    });
    return Math.round((intersection / Math.max(1, union.size)) * 100);
  }

  function tokenizeWords(text) {
    return uniqueKeepOrder((String(text || '').toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) || []).filter(function (word) {
      return !STOPWORDS.has(word);
    }));
  }

  function getKeywordPairs(text) {
    const counts = Object.create(null);
    (String(text || '').toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) || []).forEach(function (word) {
      if (STOPWORDS.has(word)) return;
      counts[word] = (counts[word] || 0) + 1;
    });
    return Object.keys(counts).map(function (word) {
      return { word: word, count: counts[word] };
    }).sort(function (a, b) {
      return b.count - a.count || a.word.localeCompare(b.word);
    }).slice(0, 20);
  }

  function matchCapture(text, regex, groupIndex) {
    const items = [];
    let match;
    while ((match = regex.exec(String(text || '')))) {
      if (match[groupIndex]) items.push(match[groupIndex]);
    }
    return items;
  }

  function getSelectedText() {
    const fromWindow = root.getВыделение && root.getВыделение();
    const text = fromWindow ? String(fromWindow.toString() || '').trim() : '';
    if (text) return text;

    const active = document.activeElement;
    if (active && typeof active.value === 'string' && typeof active.selectionStart === 'number' && typeof active.selectionEnd === 'number') {
      const start = Math.min(active.selectionStart, active.selectionEnd);
      const end = Math.max(active.selectionStart, active.selectionEnd);
      return String(active.value.slice(start, end) || '').trim();
    }

    return '';
  }

  async function readClipboardText() {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        return await navigator.clipboard.readText();
      }
    } catch (error) {
      console.warn('[NSToolsV1] clipboard read failed:', error);
    }
    return '';
  }

  async function writeClipboardText(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(String(text || ''));
        return true;
      }
    } catch (error) {
      console.warn('[NSToolsV1] clipboard write failed:', error);
    }
    return false;
  }

  function getActiveFileText() {
    if (!root.NSLibraryStore || typeof root.NSLibraryStore.getState !== 'function' || typeof root.NSLibraryStore.getItemById !== 'function') {
      return '';
    }
    const state = root.NSLibraryStore.getState();
    const fileId = state && state.activeId ? String(state.activeId) : '';
    if (!fileId) return '';
    const item = root.NSLibraryStore.getItemById(fileId);
    if (!item) return '';
    return getLibraryItemText(item);
  }

  function getLibraryItemText(item) {
    if (!item) return '';
    if (item.preview && typeof item.preview.textContent === 'string' && item.preview.textContent.trim()) {
      return item.preview.textContent.trim();
    }
    if (item.preview && typeof item.preview.excerpt === 'string' && item.preview.excerpt.trim()) {
      return item.preview.excerpt.trim();
    }
    const dataUrl = item.storage && typeof item.storage.dataUrl === 'string' ? item.storage.dataUrl : '';
    if (dataUrl && isProbablyTextLibraryItem(item)) {
      const decoded = decodeDataUrlText(dataUrl).trim();
      if (decoded) return decoded;
    }
    return [item.name || '', item.description || '', Array.isArray(item.tags) ? item.tags.join(', ') : ''].filter(Boolean).join('\n');
  }

  function isProbablyTextLibraryItem(item) {
    const previewKind = item && item.preview && typeof item.preview.kind === 'string' ? item.preview.kind.toLowerCase() : '';
    if (previewKind === 'text') return true;
    const textType = item && item.preview && typeof item.preview.textType === 'string' ? item.preview.textType.toLowerCase() : '';
    if (textType) return true;
    const mime = item && (item.type || item.mime) ? String(item.type || item.mime).toLowerCase() : '';
    if (mime.indexOf('text/') === 0 || mime.indexOf('json') >= 0 || mime.indexOf('xml') >= 0 || mime.indexOf('javascript') >= 0) return true;
    const name = item && (item.originalName || item.name) ? String(item.originalName || item.name).toLowerCase() : '';
    return /\.(txt|md|markdown|json|js|ts|html?|css|xml|csv|rdf|yml|yaml)$/i.test(name);
  }

  function decodeDataUrlText(dataUrl) {
    try {
      const value = String(dataUrl || '');
      if (!/^data:/i.test(value)) return '';
      const commaIndex = value.indexOf(',');
      if (commaIndex === -1) return '';
      const header = value.slice(0, commaIndex);
      const payload = value.slice(commaIndex + 1);
      if (/;base64/i.test(header)) {
        return decodeURIComponent(escape(atob(payload)));
      }
      return decodeURIComponent(payload);
    } catch (error) {
      console.warn('[NSToolsV1] failed to decode data url:', error);
      return '';
    }
  }

  function getActiveNoteText() {
    if (!root.NSNotesStore || typeof root.NSNotesStore.getLastOpenedNoteId !== 'function' || typeof root.NSNotesStore.getById !== 'function') {
      return '';
    }
    const noteId = root.NSNotesStore.getLastOpenedNoteId();
    if (!noteId) return '';
    const note = root.NSNotesStore.getById(noteId);
    if (!note) return '';
    return String(note.text || note.title || '').trim();
  }

  function createNoteFromTextarea(rootEl, selector, titlePrefix, statusSelector) {
    const node = getNode(rootEl, selector);
    const text = node ? String(node.value || '').trim() : '';
    if (!text) {
      setStatus(rootEl, statusSelector, 'Nothing to send into a note yet.');
      return;
    }
    if (!root.NSNotesStore || typeof root.NSNotesStore.create !== 'function') {
      setStatus(rootEl, statusSelector, 'Notes store is not available in this build.');
      return;
    }
    const projectId = root.NSProjectStore && typeof root.NSProjectStore.getLastOpenedProjectId === 'function'
      ? String(root.NSProjectStore.getLastOpenedProjectId() || '')
      : '';
    const note = root.NSNotesStore.create({
      title: titlePrefix + ' · ' + new Date().toLocaleString(),
      text: text,
      type: 'reference',
      projectId: projectId
    });
    if (note && note.id && typeof root.NSNotesStore.setLastOpenedNoteId === 'function') {
      root.NSNotesStore.setLastOpenedNoteId(note.id);
    }
    const shellApi = root.__IRG_LEGACY_SHELL_API;
    if (shellApi && typeof shellApi.setWorkspaceEnabled === 'function' && typeof shellApi.setWorkspaceMode === 'function' && typeof shellApi.setWorkspaceSection === 'function') {
      shellApi.setWorkspaceEnabled(true);
      shellApi.setWorkspaceMode('split');
      shellApi.setWorkspaceSection('notes');
    }
    setStatus(rootEl, statusSelector, 'Created a new note from the current result.');
  }

  function makeTranslatorTabTitle(provider, to) {
    const providerLabel = provider === 'yandex' ? 'Yandex' : provider === 'bing' ? 'Bing' : provider === 'deepl' ? 'DeepL' : 'Google';
    return providerLabel + ' Translate → ' + String(to || 'ru').toUpperCase();
  }

  function buildTranslatorUrl(provider, from, to, text) {
    const source = encodeURIComponent(text || '');
    const safeFrom = from || 'auto';
    const safeTo = to || 'ru';
    if (provider === 'yandex') {
      return 'https://translate.yandex.com/?source_lang=' + encodeURIComponent(safeFrom) + '&target_lang=' + encodeURIComponent(safeTo) + '&text=' + source;
    }
    if (provider === 'bing') {
      return 'https://www.bing.com/translator?from=' + encodeURIComponent(safeFrom) + '&to=' + encodeURIComponent(safeTo) + '&text=' + source;
    }
    if (provider === 'deepl') {
      return 'https://www.deepl.com/translator#' + encodeURIComponent(safeFrom) + '/' + encodeURIComponent(safeTo) + '/' + source;
    }
    return 'https://translate.google.com/?sl=' + encodeURIComponent(safeFrom) + '&tl=' + encodeURIComponent(safeTo) + '&text=' + source + '&op=translate';
  }

  function openUrlInTab(url, title) {
    const api = root.__IRG_BROWSER_SHELL_API;
    if (api && typeof api.createTab === 'function') {
      api.createTab({ title: title || 'External Tool', url: url });
      return;
    }
    root.open(url, '_blank', 'noopener');
  }

  async function translateInlineGoogle(from, to, text) {
    const params = new URLSearchParams();
    params.set('client', 'gtx');
    params.set('sl', from || 'auto');
    params.set('tl', to || 'ru');
    params.set('dt', 't');
    params.set('q', text || '');

    const response = await fetch('https://translate.googleapis.com/translate_a/single?' + params.toString());
    if (!response.ok) {
      throw new Error('Google translate request failed: ' + response.status);
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
    return payload[0].map(function (part) {
      return Array.isArray(part) ? String(part[0] || '') : '';
    }).join('');
  }

  function init() {
    const roots = getRoots();
    if (!roots.length) return;
    roots.forEach(function (rootEl) {
      const surface = String(rootEl.getAttribute('data-tools-surface') || 'workspace');
      rootEl.innerHTML = renderRoot(surface);
      bindRoot(rootEl);
    });
    syncPreferenceControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('irg:language-changed', init);
  document.addEventListener('irg:language-changed', init);
})(window);
