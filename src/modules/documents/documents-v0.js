(function () {
  'use strict';

  const STORAGE_KEY = 'irgeztne.documents.v1';
  const FALLBACK_TITLE_RU = 'Документ без названия';
  const FALLBACK_TITLE_EN = 'Untitled document';

  const state = loadState();
  const roots = new Set();
  let booted = false;

  function isRu() {
    return document.documentElement.lang === 'ru';
  }

  function t(ru, en) {
    return isRu() ? ru : en;
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uniqueIds(value) {
    return Array.from(new Set((Array.isArray(value) ? value : []).filter(Boolean).map(String)));
  }

  function normalizeDocument(raw) {
    const createdAt = raw && raw.createdAt ? String(raw.createdAt) : nowIso();
    const updatedAt = raw && raw.updatedAt ? String(raw.updatedAt) : createdAt;
    return {
      id: raw && raw.id ? String(raw.id) : uid('doc'),
      title: raw && raw.title ? String(raw.title) : t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN),
      type: raw && raw.type ? String(raw.type) : 'article',
      status: raw && raw.status ? String(raw.status) : 'draft',
      body: raw && raw.body ? String(raw.body) : '',
      tags: Array.isArray(raw && raw.tags) ? raw.tags.slice() : ['documents', 'writer'],
      projectId: raw && raw.projectId ? String(raw.projectId) : '',
      fileIds: uniqueIds(raw && raw.fileIds),
      mapPointIds: uniqueIds(raw && raw.mapPointIds),
      createdAt,
      updatedAt
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          items: Array.isArray(parsed.items) ? parsed.items.map(normalizeDocument) : [],
          activeId: parsed.activeId || ''
        };
      }
    } catch (error) {
      console.warn('[IRGEZTNE Office] Failed to load state', error);
    }
    return { items: [], activeId: '' };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: state.items,
        activeId: state.activeId
      }));
    } catch (error) {
      console.warn('[IRGEZTNE Office] Failed to save state', error);
    }
  }

  function getActive() {
    if (!state.activeId && state.items.length) state.activeId = state.items[0].id;
    return state.items.find((item) => item.id === state.activeId) || null;
  }

  function createDocument(seed) {
    const createdAt = nowIso();
    const item = normalizeDocument(Object.assign({
      id: uid('doc'),
      title: t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN),
      type: 'article',
      status: 'draft',
      body: '',
      tags: ['documents', 'writer'],
      projectId: '',
      fileIds: [],
      mapPointIds: [],
      createdAt,
      updatedAt: createdAt
    }, seed || {}));
    state.items.unshift(item);
    state.activeId = item.id;
    persistAndRender();
    setStatus(t('Новый документ создан.', 'New document created.'));
    return item;
  }

  function updateActive(patch) {
    const item = getActive();
    if (!item) return;
    Object.assign(item, patch, { updatedAt: nowIso() });
    saveState();
    renderAll();
  }

  function deleteActive() {
    const item = getActive();
    if (!item) return;
    const ok = window.confirm(t('Удалить этот документ?', 'Delete this document?'));
    if (!ok) return;
    state.items = state.items.filter((entry) => entry.id !== item.id);
    state.activeId = state.items[0] ? state.items[0].id : '';
    persistAndRender();
    setStatus(t('Документ удалён.', 'Document deleted.'));
  }

  function duplicateActive() {
    const item = getActive();
    if (!item) return;
    createDocument({
      title: item.title + ' · copy',
      type: item.type,
      status: 'draft',
      body: item.body,
      tags: Array.isArray(item.tags) ? item.tags.slice() : ['documents'],
      projectId: item.projectId || '',
      fileIds: Array.isArray(item.fileIds) ? item.fileIds.slice() : [],
      mapPointIds: Array.isArray(item.mapPointIds) ? item.mapPointIds.slice() : [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
  }

  function persistAndRender() {
    saveState();
    renderAll();
    emitRelationsChanged();
  }

  function wordCount(text) {
    const clean = String(text || '').trim();
    if (!clean) return 0;
    return clean.split(/\s+/).filter(Boolean).length;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function slugify(value) {
    const raw = String(value || 'document').trim().toLowerCase();
    const ascii = raw
      .replace(/[а]/g, 'a').replace(/[б]/g, 'b').replace(/[в]/g, 'v')
      .replace(/[г]/g, 'g').replace(/[д]/g, 'd').replace(/[её]/g, 'e')
      .replace(/[ж]/g, 'zh').replace(/[з]/g, 'z').replace(/[и]/g, 'i')
      .replace(/[й]/g, 'y').replace(/[к]/g, 'k').replace(/[л]/g, 'l')
      .replace(/[м]/g, 'm').replace(/[н]/g, 'n').replace(/[о]/g, 'o')
      .replace(/[п]/g, 'p').replace(/[р]/g, 'r').replace(/[с]/g, 's')
      .replace(/[т]/g, 't').replace(/[у]/g, 'u').replace(/[ф]/g, 'f')
      .replace(/[х]/g, 'h').replace(/[ц]/g, 'ts').replace(/[ч]/g, 'ch')
      .replace(/[ш]/g, 'sh').replace(/[щ]/g, 'sch').replace(/[ъь]/g, '')
      .replace(/[ы]/g, 'y').replace(/[э]/g, 'e').replace(/[ю]/g, 'yu').replace(/[я]/g, 'ya');
    return ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
  }

  function downloadFile(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function buildMarkdownContent(item) {
    const title = item && item.title ? item.title : t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    const body = String(item && item.body || '');
    const meta = [
      '---',
      'type: irgeztne-document',
      'status: ' + (item.status || 'draft'),
      'documentType: ' + (item.type || 'article'),
      'updatedAt: ' + (item.updatedAt || nowIso()),
      '---',
      ''
    ].join('\n');

    return meta + '# ' + title + '\n\n' + body + '\n';
  }

  function buildHtmlContent(item) {
    const title = item && item.title ? item.title : t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    const paragraphs = String(item && item.body || '')
      .split(/\n{2,}/)
      .map((chunk) => '<p>' + escapeHtml(chunk).replace(/\n/g, '<br>') + '</p>')
      .join('\n');

    return [
      '<!doctype html>',
      '<html lang="' + (isRu() ? 'ru' : 'en') + '">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(title) + '</title>',
      '<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:860px;margin:48px auto;padding:0 24px;line-height:1.65;color:#111827}h1{line-height:1.15}</style>',
      '</head>',
      '<body>',
      '<article>',
      '<h1>' + escapeHtml(title) + '</h1>',
      paragraphs || '<p></p>',
      '</article>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  function fallbackCopy(content, successMessage) {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      setStatus(successMessage);
    } catch (error) {
      console.warn('[IRGEZTNE Office] copy failed', error);
      setStatus(t('Не удалось скопировать. Используйте экспорт файлом.', 'Could not copy. Use file export instead.'));
    }

    textarea.remove();
  }

  function copyText(content, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content)
        .then(() => setStatus(successMessage))
        .catch(() => fallbackCopy(content, successMessage));
      return;
    }

    fallbackCopy(content, successMessage);
  }

  function copyMarkdown() {
    const item = getActive();
    if (!item) return;
    copyText(buildMarkdownContent(item), t('Markdown скопирован.', 'Markdown copied.'));
  }

  function copyHtml() {
    const item = getActive();
    if (!item) return;
    copyText(buildHtmlContent(item), t('HTML скопирован.', 'HTML copied.'));
  }

  function exportMarkdown() {
    const item = getActive();
    if (!item) return;
    const title = item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    downloadFile(slugify(title) + '.md', 'text/markdown;charset=utf-8', buildMarkdownContent(item));
    setStatus(t('Markdown экспортирован.', 'Markdown exported.'));
  }

  function exportHtml() {
    const item = getActive();
    if (!item) return;
    const title = item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN);
    downloadFile(slugify(title) + '.html', 'text/html;charset=utf-8', buildHtmlContent(item));
    setStatus(t('HTML экспортирован.', 'HTML exported.'));
  }


  function formatTypeStatus(item) {
    return escapeHtml((item.type || 'article') + ' · ' + (item.status || 'draft'));
  }

  function renderCompactItem(item) {
    const active = item.id === state.activeId;
    return [
      '<button type="button" class="ns-documents-v1__compact-item' + (active ? ' is-active' : '') + '" data-documents-action="select" data-documents-id="' + escapeHtml(item.id) + '">',
      '  <strong>' + escapeHtml(item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN)) + '</strong>',
      '  <span>' + formatTypeStatus(item) + '</span>',
      '</button>'
    ].join('');
  }

  function renderWorkspaceRoot(root, active, sorted, totalWords) {
    const latest = sorted.slice(0, 4);
    const activeWords = active ? wordCount(active.body) : 0;

    root.innerHTML = [
      '<div class="ns-documents-v1 ns-documents-v1--workspace ns-documents-v1--compact">',
      '  <section class="ns-documents-v1__compact-hero">',
      '    <div>',
      '      <div class="ns-documents-v1__kicker">IRGEZTNE Office</div>',
      '      <h2 class="ns-documents-v1__compact-title">' + escapeHtml(t('Офис', 'Office')) + '</h2>',
      '      <p class="ns-documents-v1__compact-copy">' + escapeHtml(t('Быстрые документы, тексты и экспорт под рукой.', 'Quick documents, text and export under hand.')) + '</p>',
      '    </div>',
      '    <div class="ns-documents-v1__compact-actions">',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new">' + escapeHtml(t('Новый', 'New')) + '</button>',
      '      <button class="ns-documents-v1__btn" data-open-section="documents">' + escapeHtml(t('Открыть Office', 'Open Office')) + '</button>',
      '    </div>',
      '  </section>',

      '  <section class="ns-documents-v1__compact-stats">',
      '    <div><span>' + escapeHtml(t('Документы', 'Docs')) + '</span><strong>' + sorted.length + '</strong></div>',
      '    <div><span>' + escapeHtml(t('Слова', 'Words')) + '</span><strong>' + totalWords + '</strong></div>',
      '    <div><span>' + escapeHtml(t('Активный', 'Active')) + '</span><strong>' + (active ? activeWords : 0) + '</strong></div>',
      '  </section>',

      '  <section class="ns-documents-v1__compact-panel">',
      '    <div class="ns-documents-v1__compact-head">',
      '      <strong>' + escapeHtml(t('Последние документы', 'Recent documents')) + '</strong>',
      '      <span>' + sorted.length + '</span>',
      '    </div>',
      '    <div class="ns-documents-v1__compact-list">',
      latest.length ? latest.map(renderCompactItem).join('') : '<div class="ns-documents-v1__compact-empty">' + escapeHtml(t('Документов пока нет. Создайте первый материал.', 'No documents yet. Create the first draft.')) + '</div>',
      '    </div>',
      '  </section>',

      active ? [
        '  <section class="ns-documents-v1__compact-editor">',
        '    <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Название', 'Title')) + '</span><input class="ns-documents-v1__input" data-documents-field="title" value="' + escapeHtml(active.title || '') + '"></label>',
        '    <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Текст', 'Text')) + '</span><textarea class="ns-documents-v1__textarea ns-documents-v1__textarea--compact" data-documents-field="body" placeholder="' + escapeHtml(t('Быстрый текст, заметка или структура документа…', 'Quick text, note, or document outline…')) + '">' + escapeHtml(active.body || '') + '</textarea></label>',
        '    <div class="ns-documents-v1__compact-toolbar">',
        '      <button class="ns-documents-v1__btn" data-documents-action="copy-md">' + escapeHtml(t('Копировать MD', 'Copy MD')) + '</button>',
        '      <button class="ns-documents-v1__btn" data-documents-action="export-md">' + escapeHtml(t('Экспорт MD', 'Export MD')) + '</button>',
        '      <button class="ns-documents-v1__btn" data-documents-action="duplicate">' + escapeHtml(t('Дубль', 'Duplicate')) + '</button>',
        '    </div>',
        '    <p class="ns-documents-v1__compact-note">' + escapeHtml(t('Связи, файлы и полный редактор — в большом Office.', 'Relations, files and the full editor are in the big Office.')) + '</p>',
        '  </section>'
      ].join('') : '',
      '  <div class="ns-documents-v1__status" data-documents-status></div>',
      '</div>'
    ].join('');
  }

  function renderCabinetRoot(root, active, sorted, totalWords, surface) {
    root.innerHTML = [
      '<div class="ns-documents-v1 ns-documents-v1--' + escapeHtml(surface) + '">',
      '  <section class="ns-documents-v1__hero">',
      '    <div>',
      '      <div class="ns-documents-v1__kicker">IRGEZTNE Office</div>',
      '      <h2 class="ns-documents-v1__title">' + escapeHtml(t('Офис / Документы', 'Office / Documents')) + '</h2>',
      '      <p class="ns-documents-v1__copy">' + escapeHtml(t('Локальная рабочая зона для текстов, статей, описаний и документов. Markdown/HTML экспорт уже доступен.', 'A local workspace for texts, articles, descriptions, and documents. Markdown/HTML export is already available.')) + '</p>',
      '    </div>',
      '    <div class="ns-documents-v1__actions">',
      '      <button class="ns-documents-v1__btn ns-documents-v1__btn--primary" data-documents-action="new">' + escapeHtml(t('Новый документ', 'New document')) + '</button>',
      '      <button class="ns-documents-v1__btn" data-documents-action="export-md">' + escapeHtml(t('Экспорт MD', 'Export MD')) + '</button>',
      '      <button class="ns-documents-v1__btn" data-documents-action="export-html">' + escapeHtml(t('Экспорт HTML', 'Export HTML')) + '</button>',
      '      <button class="ns-documents-v1__btn" data-documents-action="copy-md">' + escapeHtml(t('Копировать MD', 'Copy MD')) + '</button>',
      '      <button class="ns-documents-v1__btn" data-documents-action="copy-html">' + escapeHtml(t('Копировать HTML', 'Copy HTML')) + '</button>',
      '    </div>',
      '  </section>',
      '  <section class="ns-documents-v1__layout">',
      '    <aside class="ns-documents-v1__side-card">',
      '      <div class="ns-documents-v1__toolbar">',
      '        <strong>' + escapeHtml(t('Библиотека документов', 'Document library')) + '</strong>',
      '        <span class="ns-documents-v1__chip">' + sorted.length + ' ' + escapeHtml(t('док.', 'docs')) + '</span>',
      '      </div>',
      '      <div class="ns-documents-v1__list">',
      sorted.length ? sorted.map(renderItem).join('') : '<div class="ns-documents-v1__empty">' + escapeHtml(t('Документов пока нет. Создайте первый материал.', 'No documents yet. Create the first draft.')) + '</div>',
      '      </div>',
      '      <div class="ns-documents-v1__meta-grid">',
      '        <div class="ns-documents-v1__meta-card"><span class="ns-documents-v1__meta-label">' + escapeHtml(t('Документы', 'Docs')) + '</span><strong>' + sorted.length + '</strong></div>',
      '        <div class="ns-documents-v1__meta-card"><span class="ns-documents-v1__meta-label">' + escapeHtml(t('Слова', 'Words')) + '</span><strong>' + totalWords + '</strong></div>',
      '        <div class="ns-documents-v1__meta-card"><span class="ns-documents-v1__meta-label">' + escapeHtml(t('Статус', 'Status')) + '</span><strong>' + escapeHtml(active ? active.status : '—') + '</strong></div>',
      '      </div>',
      '    </aside>',
      '    <main class="ns-documents-v1__editor-card">',
      active ? renderEditor(active) : renderEmptyEditor(),
      '    </main>',
      '  </section>',
      '  <section class="ns-documents-v1__future-card">',
      '    <div>',
      '      <div class="ns-documents-v1__small-label">' + escapeHtml(t('Связи', 'Relations')) + '</div>',
      '      <p class="ns-documents-v1__hint">' + escapeHtml(t('Документы можно связывать с проектами и файлами. Позже добавим больше рабочих связей.', 'Documents can be connected with projects and files. More workspace links can be added later.')) + '</p>',
      '    </div>',
      '    <div class="ns-documents-v1__chips"><span class="ns-documents-v1__chip">Notes</span><span class="ns-documents-v1__chip">Files</span><span class="ns-documents-v1__chip">Projects</span><span class="ns-documents-v1__chip">Web Studio</span><span class="ns-documents-v1__chip">Markdown/HTML</span></div>',
      '  </section>',
      '  <div class="ns-documents-v1__status" data-documents-status></div>',
      '</div>'
    ].join('');
  }


  function renderRoot(root) {
    if (!root) return;
    roots.add(root);
    const surface = String(root.getAttribute('data-documents-surface') || 'workspace');
    const active = getActive();
    const sorted = state.items.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const totalWords = state.items.reduce((sum, item) => sum + wordCount(item.body), 0);

    if (surface === 'workspace') {
      renderWorkspaceRoot(root, active, sorted, totalWords);
      return;
    }

    renderCabinetRoot(root, active, sorted, totalWords, surface);
  }


  function getProjects() {
    const store = window.NSProjectStore;
    if (!store || typeof store.getAll !== 'function') return [];
    return store.getAll();
  }

  function getProjectTitle(projectId) {
    if (!projectId) return t('Без проекта', 'No project');
    const store = window.NSProjectStore;
    if (store && typeof store.getById === 'function') {
      const project = store.getById(projectId);
      if (project && project.title) return project.title;
    }
    return projectId;
  }

  function getFiles() {
    try {
      const store = window.NSLibraryStore;
      if (store && typeof store.getAllItems === 'function') return store.getAllItems().filter(Boolean);
    } catch (error) {}
    return [];
  }

  function getFileTitle(fileId) {
    const id = String(fileId || '');
    if (!id) return '';
    try {
      const store = window.NSLibraryStore;
      if (store && typeof store.getItemById === 'function') {
        const file = store.getItemById(id);
        if (file) return file.name || file.originalName || id;
      }
    } catch (error) {}
    return id;
  }

  function getMapPoints() {
    try {
      const map = window.NSMapV1;
      if (map && typeof map.getAllPins === 'function') return map.getAllPins().filter(Boolean);
    } catch (error) {}
    return [];
  }

  function getMapPointTitle(pointId) {
    const id = String(pointId || '');
    if (!id) return '';
    const point = getMapPoints().find((item) => String(item.id) === id);
    return point ? (point.title || id) : id;
  }

  function renderFileOptions(value, selectedIds) {
    const selected = new Set(uniqueIds(selectedIds));
    const files = getFiles().filter((file) => file && file.id && !selected.has(String(file.id)));
    const options = ['<option value="">' + escapeHtml(t('Выбрать файл…', 'Choose file…')) + '</option>'];
    files.forEach((file) => {
      const id = String(file.id);
      options.push('<option value="' + escapeHtml(id) + '"' + (id === value ? ' selected' : '') + '>' + escapeHtml(file.name || file.originalName || id) + '</option>');
    });
    return options.join('');
  }

  function renderMapPointOptions(value, selectedIds) {
    const selected = new Set(uniqueIds(selectedIds));
    const points = getMapPoints().filter((point) => point && point.id && !selected.has(String(point.id)));
    const options = ['<option value="">' + escapeHtml(t('Выбрать точку карты…', 'Choose map point…')) + '</option>'];
    points.forEach((point) => {
      const id = String(point.id);
      const label = (point.title || id) + (point.type ? ' · ' + point.type : '');
      options.push('<option value="' + escapeHtml(id) + '"' + (id === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>');
    });
    return options.join('');
  }

  function renderLinkedPills(ids, titleGetter, kind) {
    const list = uniqueIds(ids);
    if (!list.length) {
      return '<span class="ns-documents-v1__link-empty">' + escapeHtml(t('Пока ничего не связано.', 'Nothing linked yet.')) + '</span>';
    }
    return list.map((id) => {
      return '<span class="ns-documents-v1__link-pill"><span>' + escapeHtml(titleGetter(id)) + '</span><button type="button" data-documents-action="remove-link" data-documents-link-kind="' + escapeHtml(kind) + '" data-documents-link-id="' + escapeHtml(id) + '" aria-label="' + escapeHtml(t('Убрать связь', 'Remove link')) + '">×</button></span>';
    }).join('');
  }

  function renderProjectOptions(value) {
    const projects = getProjects();
    return ['<option value="">' + escapeHtml(t('Без проекта', 'No project')) + '</option>'].concat(projects.map((project) => {
      return '<option value="' + escapeHtml(project.id) + '"' + (project.id === value ? ' selected' : '') + '>' + escapeHtml(project.title || project.id) + '</option>';
    })).join('');
  }

  function emitRelationsChanged() {
    document.dispatchEvent(new CustomEvent('irg:relations-changed'));
  }

  function renderItem(item) {
    const active = item.id === state.activeId;
    return [
      '<button type="button" class="ns-documents-v1__item' + (active ? ' is-active' : '') + '" data-documents-action="select" data-documents-id="' + escapeHtml(item.id) + '">',
      '  <div class="ns-documents-v1__item-title">' + escapeHtml(item.title || t(FALLBACK_TITLE_RU, FALLBACK_TITLE_EN)) + '</div>',
      '  <div class="ns-documents-v1__item-meta">' + escapeHtml((item.type || 'article') + ' · ' + (item.status || 'draft')) + '</div>',
      item.projectId ? '  <div class="ns-documents-v1__item-meta">' + escapeHtml(t('Проект: ', 'Project: ') + getProjectTitle(item.projectId)) + '</div>' : '',
      '</button>'
    ].join('');
  }

  function renderEditor(item) {
    return [
      '<div class="ns-documents-v1__form-grid">',
      '  <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Название', 'Title')) + '</span><input class="ns-documents-v1__input" data-documents-field="title" value="' + escapeHtml(item.title || '') + '"></label>',
      '  <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Тип', 'Type')) + '</span><select class="ns-documents-v1__select" data-documents-field="type">' + renderTypeOptions(item.type) + '</select></label>',
      '</div>',
      '<div class="ns-documents-v1__relation-panel">',
      '  <label class="ns-documents-v1__field"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Проект', 'Project')) + '</span><select class="ns-documents-v1__select" data-documents-field="projectId">' + renderProjectOptions(item.projectId || '') + '</select></label>',
      '  <div class="ns-documents-v1__relation-copy"><strong>' + escapeHtml(t('Связи', 'Relations')) + '</strong><span>' + escapeHtml(item.projectId ? t('Документ связан с проектом: ', 'Document linked to project: ') + getProjectTitle(item.projectId) : t('Выберите проект, чтобы документ появился в связях проекта.', 'Choose a project so this document appears in project relations.')) + '</span></div>',
      item.projectId ? '  <button class="ns-documents-v1__btn" data-documents-action="open-project">' + escapeHtml(t('Открыть проект', 'Open project')) + '</button>' : '',
      '</div>',
      '<div class="ns-documents-v1__link-panel ns-documents-v1__link-panel--files-only">',
      '  <div class="ns-documents-v1__link-block">',
      '    <div class="ns-documents-v1__link-head"><strong>' + escapeHtml(t('Файлы', 'Files')) + '</strong><span>' + uniqueIds(item.fileIds).length + '</span></div>',
      '    <div class="ns-documents-v1__link-list">' + renderLinkedPills(item.fileIds, getFileTitle, 'file') + '</div>',
      '    <div class="ns-documents-v1__link-add"><select class="ns-documents-v1__select" data-documents-link-select="file">' + renderFileOptions('', item.fileIds) + '</select><button class="ns-documents-v1__btn" data-documents-action="add-file-link">' + escapeHtml(t('Связать файл', 'Link file')) + '</button></div>',
      '  </div>',
      '  <div class="ns-documents-v1__link-block ns-documents-v1__link-block--muted">',
      '    <div class="ns-documents-v1__link-head"><strong>' + escapeHtml(t('Дополнительные связи позже', 'More links later')) + '</strong><span>' + escapeHtml(t('advanced', 'advanced')) + '</span></div>',
      '    <p class="ns-documents-v1__hint">' + escapeHtml(t('Пока документам достаточно проекта и файлов. Дополнительные связи добавим позже, когда они будут реально нужны.', 'For now documents only need project and file links. Additional relations can come later when they are truly useful.')) + '</p>',
      '  </div>',
      '</div>',
      '<label class="ns-documents-v1__field ns-documents-v1__field--body"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Текст', 'Content')) + '</span><textarea class="ns-documents-v1__textarea" data-documents-field="body" placeholder="' + escapeHtml(t('Пишите статью, заметку, отчёт или структуру документа…', 'Write an article, note, report, or document outline…')) + '">' + escapeHtml(item.body || '') + '</textarea></label>',
      '<div class="ns-documents-v1__toolbar">',
      '  <label class="ns-documents-v1__field" style="max-width:180px"><span class="ns-documents-v1__small-label">' + escapeHtml(t('Статус', 'Status')) + '</span><select class="ns-documents-v1__select" data-documents-field="status">' + renderStatusOptions(item.status) + '</select></label>',
      '  <button class="ns-documents-v1__btn" data-documents-action="duplicate">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button>',
      '  <button class="ns-documents-v1__btn ns-documents-v1__btn--quiet" data-documents-action="send-editor">' + escapeHtml(t('Web Studio позже', 'Web Studio later')) + '</button>',
      '  <button class="ns-documents-v1__btn ns-documents-v1__btn--danger" data-documents-action="delete">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '</div>',
      '<p class="ns-documents-v1__hint">' + escapeHtml(t('Сохраняется локально автоматически. Можно копировать и экспортировать Markdown/HTML.', 'Saved locally automatically. Markdown/HTML copy and export are available.')) + '</p>'
    ].join('');
  }

  function renderEmptyEditor() {
    return '<div class="ns-documents-v1__empty">' + escapeHtml(t('Выберите документ или создайте новый.', 'Select a document or create a new one.')) + '</div>';
  }

  function renderTypeOptions(value) {
    const options = [
      ['article', t('Статья', 'Article')],
      ['research', t('Исследование', 'Research')],
      ['report', t('Отчёт', 'Report')],
      ['proposal', t('Предложение', 'Proposal')],
      ['guide', t('Гайд', 'Guide')],
      ['note', t('Документ-заметка', 'Document note')]
    ];
    return options.map(([key, label]) => '<option value="' + key + '"' + (key === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>').join('');
  }

  function renderStatusOptions(value) {
    const options = [
      ['draft', t('Черновик', 'Draft')],
      ['ready', t('Готово', 'Ready')],
      ['archived', t('Архив', 'Archived')]
    ];
    return options.map(([key, label]) => '<option value="' + key + '"' + (key === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>').join('');
  }

  function addLink(kind) {
    const item = getActive();
    if (!item) return;
    const selector = document.querySelector('[data-documents-link-select="' + kind + '"]');
    const id = selector ? String(selector.value || '') : '';
    if (!id) {
      setStatus(kind === 'file' ? t('Выберите файл для связи.', 'Choose a file to link.') : t('Выберите точку карты для связи.', 'Choose a map point to link.'));
      return;
    }
    if (kind === 'file') {
      item.fileIds = uniqueIds((item.fileIds || []).concat(id));
    } else if (kind === 'map') {
      item.mapPointIds = uniqueIds((item.mapPointIds || []).concat(id));
    }
    item.updatedAt = nowIso();
    persistAndRender();
    setStatus(kind === 'file' ? t('Файл связан с документом.', 'File linked to document.') : t('Точка карты связана с документом.', 'Map point linked to document.'));
  }

  function removeLink(kind, id) {
    const item = getActive();
    if (!item || !id) return;
    if (kind === 'file') {
      item.fileIds = uniqueIds(item.fileIds).filter((entry) => entry !== id);
    } else if (kind === 'map') {
      item.mapPointIds = uniqueIds(item.mapPointIds).filter((entry) => entry !== id);
    }
    item.updatedAt = nowIso();
    persistAndRender();
    setStatus(t('Связь удалена.', 'Link removed.'));
  }

  function renderAll() {
    document.querySelectorAll('[data-documents-root]').forEach((root) => renderRoot(root));
  }

  function openDocumentById(documentId) {
    const id = String(documentId || '');
    if (!id || !state.items.some((item) => item.id === id)) return false;
    state.activeId = id;
    saveState();
    renderAll();
    return true;
  }

  function getById(documentId) {
    const id = String(documentId || '');
    return state.items.find((item) => item.id === id) || null;
  }

  function setStatus(message) {
    document.querySelectorAll('[data-documents-status]').forEach((node) => {
      node.textContent = message || '';
    });
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-documents-action]');
      if (!button) return;
      const action = button.getAttribute('data-documents-action');
      if (action === 'new') createDocument();
      if (action === 'select') {
        state.activeId = button.getAttribute('data-documents-id') || '';
        persistAndRender();
      }
      if (action === 'delete') deleteActive();
      if (action === 'duplicate') duplicateActive();
      if (action === 'add-file-link') addLink('file');
      if (action === 'add-map-link') addLink('map');
      if (action === 'remove-link') removeLink(String(button.getAttribute('data-documents-link-kind') || ''), String(button.getAttribute('data-documents-link-id') || ''));
      if (action === 'export-md') exportMarkdown();
      if (action === 'export-html') exportHtml();
      if (action === 'copy-md') copyMarkdown();
      if (action === 'copy-html') copyHtml();
      if (action === 'send-editor') setStatus(t('Связь Office → Web Studio можно добавить позже.', 'Office → Web Studio bridge can be added later.'));
      if (action === 'open-project') {
        const item = getActive();
        if (item && item.projectId) {
          document.dispatchEvent(new CustomEvent('ns-notes:open-project', { detail: { projectId: item.projectId, source: 'documents', documentId: item.id } }));
        }
      }
    });

    document.addEventListener('input', (event) => {
      const field = event.target.closest('[data-documents-field]');
      if (!field) return;
      const key = field.getAttribute('data-documents-field');
      const item = getActive();
      if (!item || !key) return;
      item[key] = field.value;
      item.updatedAt = nowIso();
      saveState();
      if (key === 'projectId') emitRelationsChanged();
      document.querySelectorAll('.ns-documents-v1__meta-card strong').forEach(() => {});
    });

    document.addEventListener('change', (event) => {
      const field = event.target.closest('[data-documents-field]');
      if (!field) return;
      const key = field.getAttribute('data-documents-field');
      if (!key) return;
      updateActive({ [key]: field.value });
      if (key === 'projectId') emitRelationsChanged();
    });
  }

  function boot() {
    if (booted) return;
    booted = true;
    bindEvents();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('irg:language-changed', renderAll);
  window.addEventListener('irg:language-changed', renderAll);
  if (document.readyState !== 'loading') boot();

  window.NSDocumentsV1 = {
    createDocument,
    getAll: () => state.items.slice(),
    getById,
    getActive,
    openDocumentById,
    renderAll
  };
})();
