(function () {

  function isRu() { return String(document.documentElement.lang || '').toLowerCase() === 'ru'; }
  function normalizeDefaultLabel(value) {
    const text = String(value || '');
    if (isRu()) return text;
    const map = {
      'Пакет без названия': 'Untitled package',
      'Заметка без названия': 'Untitled note',
      'Пустая заметка': 'Empty note',
      'Заметка проекта': 'Project Note',
      'Шаблон': 'Template',
      'Черновик': 'Draft',
      'Готово': 'Ready',
      'Отправлено': 'Submitted',
      'В архиве': 'Archived'
    };
    return map[text] || text;
  }
  function tr(en, ru) { return isRu() ? ru : en; }
  function normalizeDisplayText(value) {
    const raw = String(value || '');
    if (isRu()) return raw;
    return raw.replace(/Знание/g,'Knowledge').replace(/готово/g,'ready').replace(/не проиндексировано/g,'not indexed').replace(/В архиве/g,'Archived').replace(/Архив/g,'Archive').replace(/Скачать/g,'Download').replace(/Открыть во вкладке/g,'Open in Tab').replace(/Описание/g,'Description').replace(/Публикация/g,'Publish');
  }
  function trCategory(value) {
    const map = {
      all: ['All','Все'], research:['Research','Исследования'], context:['AI Context','AI-контекст'], asset:['Asset','Ассет'], assets:['Assets','Ассеты'], publishing:['Publishing','Публикация'], archive:['Archive','Архив'], other:['Other','Другое'], favorites:['Favorites','Избранное'], pinned:['Pinned','Закреплённые'], image:['image','изображение'], text:['text','текст'], file:['file','файл']
    };
    const key = String(value || '').trim().toLowerCase();
    return map[key] ? tr(map[key][0], map[key][1]) : String(value || '');
  }

  function getRoots() {
    return Array.from(document.querySelectorAll('[data-source-library-root]'));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatBytes(bytes) {
    const num = Number(bytes || 0);
    if (num < 1024) return num + ' B';
    if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB';
    if (num < 1024 * 1024 * 1024) return (num / (1024 * 1024)).toFixed(1) + ' MB';
    return (num / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }

  function getImageToolMime(format) {
    const value = safeLower(format || 'webp');
    if (value === 'jpg' || value === 'jpeg') return 'image/jpeg';
    if (value === 'png') return 'image/png';
    return 'image/webp';
  }

  function getImageToolExt(format) {
    const value = safeLower(format || 'webp');
    if (value === 'jpg' || value === 'jpeg') return 'jpg';
    if (value === 'png') return 'png';
    return 'webp';
  }

  function makeConvertedFileName(name, format) {
    const clean = String(name || 'image').replace(/\.[^.\/]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    return clean + '-irgeztne.' + getImageToolExt(format);
  }

  function loadImageFromDataUrl(dataUrl) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Image could not be loaded.')); };
      image.src = dataUrl;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== 'function') {
        resolve(null);
        return;
      }

      canvas.toBlob(function (blob) {
        resolve(blob || null);
      }, type, quality);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function calculateImageToolSize(originalWidth, originalHeight, requestedWidth, requestedHeight) {
    const sourceWidth = Math.max(1, Number(originalWidth || 1));
    const sourceHeight = Math.max(1, Number(originalHeight || 1));
    const nextWidth = Math.max(0, Number(requestedWidth || 0));
    const nextHeight = Math.max(0, Number(requestedHeight || 0));

    if (nextWidth && nextHeight) {
      return { width: Math.round(nextWidth), height: Math.round(nextHeight) };
    }

    if (nextWidth) {
      return { width: Math.round(nextWidth), height: Math.max(1, Math.round(nextWidth * sourceHeight / sourceWidth)) };
    }

    if (nextHeight) {
      return { width: Math.max(1, Math.round(nextHeight * sourceWidth / sourceHeight)), height: Math.round(nextHeight) };
    }

    return { width: Math.round(sourceWidth), height: Math.round(sourceHeight) };
  }

  function downloadDataUrl(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName || 'irgeztne-image.webp';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function setImageToolStatus(libraryRoot, id, message, isError) {
    const block = libraryRoot ? libraryRoot.querySelector('[data-image-tools="' + getCssEscape(id) + '"]') : null;
    const status = block ? block.querySelector('[data-image-tool-status]') : null;
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  async function runImageToolConversion(libraryRoot, id, mode) {
    if (!window.NSLibraryStore || typeof window.NSLibraryStore.getItemById !== 'function') return;

    const item = window.NSLibraryStore.getItemById(id);
    if (!item || !item.storage || !item.storage.dataUrl) return;

    const block = libraryRoot ? libraryRoot.querySelector('[data-image-tools="' + getCssEscape(id) + '"]') : null;
    if (!block) return;

    const formatInput = block.querySelector('[data-image-tool-format]');
    const widthInput = block.querySelector('[data-image-tool-width]');
    const heightInput = block.querySelector('[data-image-tool-height]');
    const qualityInput = block.querySelector('[data-image-tool-quality]');

    const format = formatInput ? formatInput.value : 'webp';
    const mime = getImageToolMime(format);
    const quality = qualityInput ? Math.max(0.1, Math.min(1, Number(qualityInput.value || 82) / 100)) : 0.82;
    const requestedWidth = widthInput ? parseInt(widthInput.value, 10) : 0;
    const requestedHeight = heightInput ? parseInt(heightInput.value, 10) : 0;

    setImageToolStatus(libraryRoot, id, tr('Preparing image...','Подготовка изображения...'), false);

    try {
      const image = await loadImageFromDataUrl(item.storage.dataUrl);
      const size = calculateImageToolSize(image.naturalWidth || image.width, image.naturalHeight || image.height, requestedWidth, requestedHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable.');

      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size.width, size.height);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, size.width, size.height);

      let blob = await canvasToBlob(canvas, mime, quality);
      let finalMime = mime;
      let finalFormat = format;

      if (!blob) {
        blob = await canvasToBlob(canvas, 'image/png', 0.92);
        finalMime = 'image/png';
        finalFormat = 'png';
      }

      if (!blob) throw new Error('Image export failed.');

      const dataUrl = await blobToDataUrl(blob);
      const fileName = makeConvertedFileName(item.name || item.originalName || 'image', finalFormat);

      if (mode === 'library') {
        if (typeof window.NSLibraryStore.addItem !== 'function') return;

        window.NSLibraryStore.addItem({
          name: fileName,
          originalName: fileName,
          type: finalMime,
          ext: getImageToolExt(finalFormat),
          size: blob.size || 0,
          category: 'asset',
          tags: ['image-tools', 'converted'],
          description: tr('Converted with IRGEZTNE Image Tools.','Сконвертировано через инструменты изображений IRGEZTNE.'),
          storage: { kind: 'local', dataUrl: dataUrl },
          preview: { kind: 'image', excerpt: '', textContent: '', textType: 'text' },
          usage: { inChatContext: false, inEditor: false, inPublishing: true, inSiteAssets: true },
          publishing: { ipfsReady: false, ipfsCid: null, publishName: null }
        });

        syncKnowledgeFromLibrary();
        setImageToolStatus(libraryRoot, id, tr('Converted image added to Files.','Сконвертированное изображение добавлено в Файлы.'), false);
        return;
      }

      downloadDataUrl(dataUrl, fileName);
      setImageToolStatus(libraryRoot, id, tr('Converted image downloaded.','Сконвертированное изображение скачано.'), false);
    } catch (error) {
      console.error('[ImageTools] conversion failed:', error);
      setImageToolStatus(libraryRoot, id, tr('Image conversion failed. Try PNG/JPEG/WebP source.','Конвертация не удалась. Попробуйте PNG/JPEG/WebP источник.'), true);
    }
  }

  function safeLower(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeCategory(value) {
    const v = safeLower(value).replace(/\s+/g, '-');

    if (!v || v === 'all') return 'all';
    if (v === 'asset' || v === 'assets') return 'asset';
    if (v === 'context' || v === 'ai-context') return 'context';
    if (v === 'research') return 'research';
    if (v === 'publishing') return 'publishing';
    if (v === 'archive') return 'archive';
    if (v === 'favorite' || v === 'favorites') return 'favorites';
    if (v === 'pin' || v === 'pinned') return 'pinned';
    if (v === 'other') return 'other';

    return v;
  }

  function getPreviewKind(item) {
    return safeLower(item && item.preview ? item.preview.kind : '');
  }

  function fileIcon(item) {
    const kind = getPreviewKind(item);
    if (kind === 'image') return '🖼️';
    if (kind === 'text') return '📄';
    if (kind === 'pdf' || kind === 'pdf-preview') return '📕';
    return '📎';
  }

  function isKnowledgeReady(item) {
    if (!item || !window.NSKnowledgeStore) return false;
    if (typeof window.NSKnowledgeStore.getSourceByFileId !== 'function') return false;
    return Boolean(window.NSKnowledgeStore.getSourceByFileId(item.id));
  }

  function getKnowledgeSource(item) {
    if (!item || !window.NSKnowledgeStore) return null;
    if (typeof window.NSKnowledgeStore.getSourceByFileId !== 'function') return null;
    return window.NSKnowledgeStore.getSourceByFileId(item.id);
  }

  function getCssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, '\\$&');
  }

  function syncKnowledgeFromLibrary() {
    if (
      window.NSKnowledgeStore &&
      typeof window.NSKnowledgeStore.syncFromLibraryItems === 'function' &&
      window.NSLibraryStore &&
      typeof window.NSLibraryStore.getState === 'function'
    ) {
      const state = window.NSLibraryStore.getState();
      const libraryItems = state && Array.isArray(state.items) ? state.items : [];
      window.NSKnowledgeStore.syncFromLibraryItems(libraryItems);
    }
  }

  function renderLinkedSourcesBlock(source) {
    if (!source || !window.NSKnowledgeStore) return '';

    const links = typeof window.NSKnowledgeStore.getLinkedSources === 'function'
      ? window.NSKnowledgeStore.getLinkedSources(source.id)
      : [];

    const rows = (links || [])
      .map(function (entry) {
        const targetSource = entry && entry.targetId && typeof window.NSKnowledgeStore.getSourceById === 'function'
          ? window.NSKnowledgeStore.getSourceById(entry.targetId)
          : null;

        if (!targetSource) return '';

        return `
          <button
            type="button"
            class="ns-source-link-item"
            data-open-source-id="${escapeHtml(targetSource.id)}"
          >
            <span class="ns-source-link-title">${escapeHtml(targetSource.title || targetSource.fileId || 'Без названия')}</span>
            <span class="ns-source-link-meta">${escapeHtml(entry.type || 'link')}${entry.label ? ' · ' + escapeHtml(entry.label) : ''}</span>
          </button>
        `;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="ns-source-links-block">
        <div class="ns-source-links-head">${tr('Linked Sources','Связанные источники')}</div>
        ${
          rows
            ? `<div class="ns-source-links-list">${rows}</div>`
            : `<div class="ns-source-links-empty">${tr('No linked sources yet.','Связанных источников пока нет.')}</div>`
        }
      </div>
    `;
  }

  function renderBacklinkedSourcesBlock(source) {
    if (!source || !window.NSKnowledgeStore) return '';

    const links = typeof window.NSKnowledgeStore.getBacklinkedSources === 'function'
      ? window.NSKnowledgeStore.getBacklinkedSources(source.id)
      : [];

    const rows = (links || [])
      .map(function (entry) {
        const sourceItem = entry && entry.sourceId && typeof window.NSKnowledgeStore.getSourceById === 'function'
          ? window.NSKnowledgeStore.getSourceById(entry.sourceId)
          : null;

        if (!sourceItem) return '';

        return `
          <button
            type="button"
            class="ns-source-link-item"
            data-open-source-id="${escapeHtml(sourceItem.id)}"
          >
            <span class="ns-source-link-title">${escapeHtml(sourceItem.title || sourceItem.fileId || 'Без названия')}</span>
            <span class="ns-source-link-meta">${escapeHtml(entry.type || tr('backlink','обратная ссылка'))}${entry.label ? ' · ' + escapeHtml(entry.label) : ''}</span>
          </button>
        `;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="ns-source-links-block">
        <div class="ns-source-links-head">${tr('Backlinks','Обратные ссылки')}</div>
        ${
          rows
            ? `<div class="ns-source-links-list">${rows}</div>`
            : `<div class="ns-source-links-empty">${tr('No backlinks yet.','Обратных ссылок пока нет.')}</div>`
        }
      </div>
    `;
  }

  function renderSourceGraphBlock(source) {
    if (!source || !window.NSKnowledgeStore) return '';

    const graph = typeof window.NSKnowledgeStore.getGraphForSource === 'function'
      ? window.NSKnowledgeStore.getGraphForSource(source.id)
      : null;

    const nodes = Array.isArray(graph && graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph && graph.edges) ? graph.edges : [];

    const nodeHtml = nodes
      .map(function (node) {
        const isCurrent = node.id === source.id;
        return `
          <div class="ns-source-graph-node ${isCurrent ? 'is-current' : ''}">
            <div class="ns-source-graph-node-title">${escapeHtml(node.title || node.fileId || node.id || tr('Node','Узел'))}</div>
            <div class="ns-source-graph-node-meta">${escapeHtml(node.kind || tr('source','источник'))}</div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="ns-source-graph-block">
        <div class="ns-source-graph-head">${tr('Source Graph','Граф источников')}</div>
        <div class="ns-source-graph-meta">${nodes.length} ${tr('node(s)','узл.')} · ${edges.length} ${tr('edge(s)','связ.')}</div>
        ${
          nodeHtml
            ? `<div class="ns-source-graph-list">${nodeHtml}</div>`
            : `<div class="ns-source-links-empty">${tr('Graph is empty.','Граф пока пуст.')}</div>`
        }
      </div>
    `;
  }

  function renderImageToolsBlock(item) {
    if (!item || getPreviewKind(item) !== 'image' || !item.storage || !item.storage.dataUrl) return '';

    return `
      <div class="ns-library-image-tools" data-image-tools="${escapeHtml(item.id)}">
        <div class="ns-library-image-tools__head">
          <div>
            <strong>${tr('Image Tools','Инструменты изображений')}</strong>
            <span>${tr('Convert, resize, and prepare assets for templates or publishing.','Конвертация, изменение размера и подготовка изображений для шаблонов или публикации.')}</span>
          </div>
        </div>

        <div class="ns-library-image-tools__grid">
          <label>
            <span>${tr('Format','Формат')}</span>
            <select data-image-tool-format>
              <option value="webp">WebP</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </label>

          <label>
            <span>${tr('Width','Ширина')}</span>
            <input type="number" min="1" step="1" inputmode="numeric" placeholder="${tr('auto','авто')}" data-image-tool-width>
          </label>

          <label>
            <span>${tr('Height','Высота')}</span>
            <input type="number" min="1" step="1" inputmode="numeric" placeholder="${tr('auto','авто')}" data-image-tool-height>
          </label>

          <label class="ns-library-image-tools__quality">
            <span>${tr('Quality','Качество')}: <b data-image-tool-quality-value>82%</b></span>
            <input type="range" min="40" max="100" value="82" data-image-tool-quality>
          </label>
        </div>

        <div class="ns-library-image-tools__actions">
          <button type="button" class="ns-library-image-tools__primary" data-image-convert-download="${escapeHtml(item.id)}">${tr('Download converted','Скачать результат')}</button>
          <button type="button" class="ns-library-image-tools__secondary" data-image-convert-library="${escapeHtml(item.id)}">${tr('Add to Files','Добавить в Файлы')}</button>
        </div>

        <div class="ns-library-image-tools__status" data-image-tool-status>
          ${tr('Ready. Leave width/height empty to keep original size.','Готово. Оставьте ширину/высоту пустыми, чтобы сохранить исходный размер.')}
        </div>
      </div>
    `;
  }

  function renderKnowledgePackActions(item) {
    if (!item || !window.NSKnowledgeStore || !window.NSPackStore) return '';

    const source = typeof window.NSKnowledgeStore.getSourceByFileId === 'function'
      ? window.NSKnowledgeStore.getSourceByFileId(item.id)
      : null;

    const packs = typeof window.NSPackStore.getAllPacks === 'function'
      ? window.NSPackStore.getAllPacks()
      : [];

    const options = (packs || [])
      .map(function (pack) {
        return `<option value="${escapeHtml(pack.id)}">${escapeHtml(pack.name || tr('Untitled pack','Пак без названия'))}</option>`;
      })
      .join('');

    return `
      <div class="ns-library-pack-actions">
        <div class="ns-library-pack-status">
          ${source ? tr('Knowledge: ready','Знание: готово') : tr('Knowledge: not indexed','Знание: не проиндексировано')}
        </div>

        ${
          source && packs.length
            ? `
              <div class="ns-library-pack-row">
                <select data-library-pack-select="${escapeHtml(item.id)}">
                  ${options}
                </select>
                <button type="button" data-library-add-to-pack="${escapeHtml(item.id)}">${tr('Add to Pack','Добавить в пак')}</button>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  function openKnowledgeSourceInLibrary(sourceId) {
    if (!sourceId || !window.NSKnowledgeStore || !window.NSLibraryStore) return;

    const source = typeof window.NSKnowledgeStore.getSourceById === 'function'
      ? window.NSKnowledgeStore.getSourceById(sourceId)
      : null;

    if (!source || !source.fileId) return;

    const item = typeof window.NSLibraryStore.getItemById === 'function'
      ? window.NSLibraryStore.getItemById(source.fileId)
      : null;

    if (!item) return;

    window.NSLibraryStore.setActiveItem(item.id);
  }

  function resetLibraryFilters(preferredSort) {
    if (!window.NSLibraryStore || typeof window.NSLibraryStore.getState !== 'function') return;

    const currentState = window.NSLibraryStore.getState();
    const currentFilters = currentState && currentState.filters ? currentState.filters : {};

    window.NSLibraryStore.setFilters({
      query: '',
      category: 'all',
      sort: preferredSort || currentFilters.sort || 'recent'
    });
  }

  function renderLibrary(root) {
    if (!root || !window.NSLibraryStore) return;

    const storeState = window.NSLibraryStore.getState();
    const items = typeof window.NSLibraryStore.getFilteredItems === 'function'
      ? window.NSLibraryStore.getFilteredItems()
      : [];

    let activeItem = null;

    if (storeState.activeId && typeof window.NSLibraryStore.getItemById === 'function') {
      activeItem = window.NSLibraryStore.getItemById(storeState.activeId);
    }

    const activeItemVisible = Boolean(
      activeItem &&
      items.some(function (item) {
        return item.id === activeItem.id;
      })
    );

    let previewItem = null;

    if (items.length) {
      previewItem = activeItemVisible ? activeItem : items[0];
    } else if (activeItem) {
      previewItem = activeItem;
    }

    const hiddenActiveItem = Boolean(activeItem && !activeItemVisible);
    const knowledgeReadyCount = items.filter(function (item) {
      return isKnowledgeReady(item);
    }).length;
    const totalItemsCount = Array.isArray(storeState.items) ? storeState.items.length : 0;
    const activeQuery = storeState && storeState.filters ? String(storeState.filters.query || '').trim() : '';
    const activeCategory = normalizeCategory(storeState && storeState.filters ? storeState.filters.category : 'all');
    const hasActiveFilters = Boolean(activeQuery) || activeCategory !== 'all';

    let previewHtml = '<div class="ns-library-empty">' + tr('Select a source to preview it.','Выберите источник для предпросмотра.') + '</div>';

    if (items.length && previewItem) {
      previewHtml = [
        hiddenActiveItem
          ? `
            <div class="ns-library-empty" style="margin-bottom:12px; text-align:left;">
              <div><strong>${tr('Current active file is hidden by filters.','Текущий активный файл скрыт фильтрами.')}</strong></div>
              <div style="margin-top:8px;">${tr('Showing the first visible source instead.','Вместо него показан первый видимый источник.')}</div>
              <div style="margin-top:12px;">
                <button type="button" data-library-reset-filters>${tr('Reset Filters','Сбросить фильтры')}</button>
              </div>
            </div>
          `
          : '',
        renderPreview(previewItem)
      ].join('');
    } else if (hiddenActiveItem && totalItemsCount) {
      previewHtml = `
        <div class="ns-library-empty">
          <div><strong>${tr('Current active file is hidden by filters.','Текущий активный файл скрыт фильтрами.')}</strong></div>
          <div style="margin-top:8px;">${tr('Reset filters or switch to All, Asset, AI Context, or Research.','Сбросьте фильтры или переключитесь на Все, Ассеты, AI-контекст или Исследования.')}</div>
          <div style="margin-top:12px;">
            <button type="button" data-library-reset-filters>${tr('Reset Filters','Сбросить фильтры')}</button>
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="ns-library-shell">
        <div class="ns-library-toolbar">
          <div class="ns-library-toolbar-left">
            <label class="ns-library-upload">
              <input type="file" multiple data-library-upload hidden>
              <span>${tr('Upload','Загрузить')}</span>
            </label>

            <input
              type="text"
              class="ns-library-search"
              placeholder="${tr('Search sources...','Поиск по источникам...')}"
              value="${escapeHtml(storeState.filters.query)}"
              data-library-search
            >

            <select class="ns-library-select" data-library-category>
              <option value="all" ${normalizeCategory(storeState.filters.category) === 'all' ? 'selected' : ''}>${tr('All','Все')}</option>
              <option value="research" ${normalizeCategory(storeState.filters.category) === 'research' ? 'selected' : ''}>${tr('Research','Исследования')}</option>
              <option value="context" ${normalizeCategory(storeState.filters.category) === 'context' ? 'selected' : ''}>${tr('AI Context','AI-контекст')}</option>
              <option value="asset" ${normalizeCategory(storeState.filters.category) === 'asset' ? 'selected' : ''}>${tr('Assets','Ассеты')}</option>
              <option value="publishing" ${normalizeCategory(storeState.filters.category) === 'publishing' ? 'selected' : ''}>${tr('Publishing','Публикация')}</option>
              <option value="archive" ${normalizeCategory(storeState.filters.category) === 'archive' ? 'selected' : ''}>${tr('Archive','Архив')}</option>
              <option value="other" ${normalizeCategory(storeState.filters.category) === 'other' ? 'selected' : ''}>${tr('Other','Другое')}</option>
              <option value="favorites" ${normalizeCategory(storeState.filters.category) === 'favorites' ? 'selected' : ''}>${tr('Favorites','Избранное')}</option>
              <option value="pinned" ${normalizeCategory(storeState.filters.category) === 'pinned' ? 'selected' : ''}>${tr('Pinned','Закреплённые')}</option>
            </select>

            <select class="ns-library-select" data-library-sort>
              <option value="recent" ${storeState.filters.sort === 'recent' ? 'selected' : ''}>${tr('Recent','Недавние')}</option>
              <option value="name" ${storeState.filters.sort === 'name' ? 'selected' : ''}>${tr('Name','Имя')}</option>
              <option value="size" ${storeState.filters.sort === 'size' ? 'selected' : ''}>${tr('Size','Размер')}</option>
            </select>

            <button type="button" class="ns-library-select" data-library-reset-filters>${tr('Reset Filters','Сбросить фильтры')}</button>
          </div>

          <div class="ns-library-toolbar-right">
            <span class="ns-library-count">${items.length} ${tr('shown','показано')} / ${totalItemsCount} ${tr('total','всего')} · ${knowledgeReadyCount} ${tr('knowledge-ready','готово к знанию')}</span>
            ${hasActiveFilters ? `<span class="ns-library-count">${tr('Filter','Фильтр')}: ${escapeHtml(activeCategory === 'all' ? tr('All','Все') : trCategory(activeCategory))}${activeQuery ? (isRu() ? ' · запрос' : ' · query') : ''}</span>` : ''}
          </div>
        </div>

        <div class="ns-library-dropzone" data-library-dropzone>
          ${tr('Drop files here to add them into Source Library','Перетащите файлы сюда, чтобы добавить их в библиотеку источников')}
        </div>

        <div class="ns-library-main">
          <div class="ns-library-list" data-library-list>
            ${
              items.length
                ? items.map(function (item) {
                    const knowledge = getKnowledgeSource(item);
                    const knowledgeReady = Boolean(knowledge);
                    const previewKind = getPreviewKind(item);
                    const textType = item && item.preview ? safeLower(item.preview.textType) : '';

                    return `
                      <div
                        class="ns-library-card ${previewItem && previewItem.id === item.id ? 'is-active' : ''}"
                        data-library-open="${escapeHtml(item.id)}"
                        role="button"
                        tabindex="0"
                      >
                        <div class="ns-library-card-top">
                          <span class="ns-library-icon">${fileIcon(item)}</span>
                          <span class="ns-library-name">${escapeHtml(normalizeDisplayText(item.name))}</span>
                          ${knowledgeReady ? '<span class="ns-library-knowledge">' + tr('Knowledge','Знание') + '</span>' : ''}
                        </div>

                        <div class="ns-library-meta">
                          <span>${escapeHtml(trCategory(item.category))}</span>
                          <span>${formatBytes(item.size)}</span>
                          <span>${escapeHtml(trCategory(previewKind || 'file'))}</span>
                          ${textType === 'rdf' ? '<span>rdf</span>' : ''}
                        </div>

                        <div class="ns-library-tags">
                          ${(item.tags || [])
                            .slice(0, 3)
                            .map(function (tag) {
                              return `<span class="ns-library-tag">${escapeHtml(tag)}</span>`;
                            })
                            .join('')}
                        </div>

                        <div class="ns-library-actions-inline">
                          <button
                            type="button"
                            data-library-favorite="${escapeHtml(item.id)}"
                          >
                            ${item.favorite ? '★' : '☆'}
                          </button>

                          <button
                            type="button"
                            data-library-pin="${escapeHtml(item.id)}"
                          >
                            ${item.pinned ? tr('Pin ✓','Закреплён ✓') : tr('Pin','Закрепить')}
                          </button>
                        </div>

                        ${renderKnowledgePackActions(item)}
                      </div>
                    `;
                  }).join('')
                : totalItemsCount
                  ? `
                    <div class="ns-library-empty">
                      <div>${tr('No sources match current filters.','По текущим фильтрам источники не найдены.')}</div>
                      <div style="margin-top:8px;">${tr('Try All, Asset, AI Context, or Reset Filters.','Попробуйте Все, Ассеты, AI-контекст или Сбросить фильтры.')}</div>
                      <div style="margin-top:12px;">
                        <button type="button" data-library-reset-filters>${tr('Reset Filters','Сбросить фильтры')}</button>
                      </div>
                    </div>
                  `
                  : '<div class="ns-library-empty">' + tr(tr('No sources yet. Upload files to start building the Source Library.','Источников пока нет. Загрузите файлы, чтобы начать собирать свою библиотеку источников.'),'Источников пока нет. Загрузите файлы, чтобы начать собирать свою библиотеку источников.') + '</div>'
            }
          </div>

          <div class="ns-library-preview" data-library-preview>
            ${previewHtml}
          </div>
        </div>
      </div>
    `;

    bindLibraryEvents(root);
  }

  function renderPreview(item) {
    const tagsHtml = (item.tags || [])
      .map(function (tag) {
        return `<span class="ns-library-tag">${escapeHtml(tag)}</span>`;
      })
      .join('');

    const knowledge = getKnowledgeSource(item);
    const knowledgeReady = Boolean(knowledge);
    const previewKind = getPreviewKind(item);
    const textType = item && item.preview ? safeLower(item.preview.textType) : '';

    let previewBody = '<div class="ns-library-preview-placeholder">' + tr('Preview unavailable','Предпросмотр недоступен') + '</div>';

    if (previewKind === 'image' && item.storage && item.storage.dataUrl) {
      previewBody = `<img class="ns-library-preview-image" src="${item.storage.dataUrl}" alt="${escapeHtml(normalizeDisplayText(item.name))}">`;
    } else if (previewKind === 'text') {
      previewBody = `
        <pre class="ns-library-preview-text">${escapeHtml(item.preview.textContent || item.preview.excerpt || '')}</pre>
      `;
    } else if (previewKind === 'pdf' || previewKind === 'pdf-preview') {
      previewBody = `
        <div class="ns-library-preview-placeholder">
          <div><strong>${tr('PDF added to library','PDF добавлен в библиотеку')}</strong></div>
          <div style="margin-top:8px;">${tr('Inline PDF preview is disabled in this build to avoid CSP frame errors.','Встроенное превью PDF отключено в этой сборке, чтобы избежать ошибок CSP.')}</div>
          <div style="margin-top:8px;">${tr('Use the download button below to open the PDF.','Используйте кнопку загрузки ниже, чтобы открыть PDF.')}</div>
        </div>
      `;
    }

    const linkedSourcesHtml = knowledgeReady ? renderLinkedSourcesBlock(knowledge) : '';
    const backlinksHtml = knowledgeReady ? renderBacklinkedSourcesBlock(knowledge) : '';
    const sourceGraphHtml = knowledgeReady ? renderSourceGraphBlock(knowledge) : '';

    return `
      <div class="ns-library-preview-head">
        <div class="ns-library-preview-title">${escapeHtml(normalizeDisplayText(item.name))}</div>
        <div class="ns-library-preview-subtitle">
          ${escapeHtml(item.type)} • ${escapeHtml(item.ext || 'file')} • ${escapeHtml(trCategory(previewKind || 'file'))}${textType === 'rdf' ? ' • rdf' : ''}
        </div>
      </div>

      <div class="ns-library-preview-body">
        ${previewBody}
      </div>

      ${renderImageToolsBlock(item)}

      <div class="ns-library-inspector">
        <div><strong>${tr('Category','Категория')}:</strong> ${escapeHtml(trCategory(item.category))}</div>
        <div><strong>${tr('Size','Размер')}:</strong> ${formatBytes(item.size)}</div>
        <div><strong>${tr('Created','Создан')}:</strong> ${escapeHtml(item.createdAt)}</div>
        <div><strong>${tr('Updated','Обновлён')}:</strong> ${escapeHtml(item.updatedAt)}</div>
        <div><strong>${tr('Description','Описание')}:</strong> ${escapeHtml(normalizeDefaultLabel(item.description || '—'))}</div>
        <div><strong>${tr('Tags','Теги')}:</strong> ${tagsHtml || '—'}</div>
        <div><strong>${tr('Knowledge','Знание')}:</strong> ${knowledgeReady ? tr('ready','готово') : tr('not indexed','не проиндексировано')}</div>
        <div><strong>${tr('Usage','Использование')}:</strong>
          ${tr('Chat','Чат')}: ${item.usage && item.usage.inChatContext ? tr('yes','да') : tr('no','нет')} /
          ${tr('Editor','Редактор')}: ${item.usage && item.usage.inEditor ? tr('yes','да') : tr('no','нет')} /
          ${tr('Publishing','Публикация')}: ${item.usage && item.usage.inPublishing ? tr('yes','да') : tr('no','нет')}
        </div>
      </div>

      ${renderKnowledgePackActions(item)}

      ${linkedSourcesHtml}
      ${backlinksHtml}
      ${sourceGraphHtml}

      <div class="ns-library-preview-actions">
        <button type="button" data-library-open-tab="${escapeHtml(item.id)}">${tr('Open in Tab','Открыть во вкладке')}</button>
        <button type="button" data-library-set-category="${escapeHtml(item.id)}" data-category="research">${tr('Research','Исследования')}</button>
        <button type="button" data-library-set-category="${escapeHtml(item.id)}" data-category="context">${tr('AI Context','AI-контекст')}</button>
        <button type="button" data-library-set-category="${escapeHtml(item.id)}" data-category="asset">${tr('Asset','Ассет')}</button>
        <button type="button" data-library-set-category="${escapeHtml(item.id)}" data-category="publishing">${tr('Publishing','Публикация')}</button>
        <button type="button" data-library-set-category="${escapeHtml(item.id)}" data-category="archive">${tr('Archive','Архив')}</button>
        <button type="button" data-library-set-category="${escapeHtml(item.id)}" data-category="other">${tr('Other','Другое')}</button>
        <button type="button" data-library-add-tag="${escapeHtml(item.id)}">${tr('Add Tag','Добавить тег')}</button>
        <button type="button" data-library-description="${escapeHtml(item.id)}">${tr('Description','Описание')}</button>
        <button type="button" data-library-download="${escapeHtml(item.id)}">${tr('Download','Скачать')}</button>
        <button type="button" class="ns-danger-action" data-library-remove="${escapeHtml(item.id)}" aria-label="${tr('Delete source','Удалить источник')}">${tr('Delete','Удалить')}</button>
      </div>
    `;
  }

  function emitOpenFileTab(fileId) {
    if (!fileId) return;

    document.dispatchEvent(new CustomEvent('ns-library:open-file-tab', {
      detail: {
        fileId: String(fileId)
      }
    }));
  }

  function bindLibraryEvents(root) {
    const uploadInput = root.querySelector('[data-library-upload]');
    const searchInput = root.querySelector('[data-library-search]');
    const categorySelect = root.querySelector('[data-library-category]');
    const sortSelect = root.querySelector('[data-library-sort]');
    const dropzone = root.querySelector('[data-library-dropzone]');
    const resetButtons = Array.from(root.querySelectorAll('[data-library-reset-filters]'));

    if (uploadInput && !uploadInput.dataset.bound) {
      uploadInput.dataset.bound = 'true';
      uploadInput.addEventListener('change', async function (event) {
        const files = event.target.files;
        if (!files || !files.length) return;

        await window.NSLibraryStore.importFiles(files);

        const currentState = window.NSLibraryStore.getState();
        resetLibraryFilters(currentState && currentState.filters ? currentState.filters.sort : 'recent');

        syncKnowledgeFromLibrary();
        uploadInput.value = '';
      });
    }

    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', function () {
        window.NSLibraryStore.setFilters({ query: searchInput.value });
      });
    }

    if (categorySelect && !categorySelect.dataset.bound) {
      categorySelect.dataset.bound = 'true';
      categorySelect.addEventListener('change', function () {
        window.NSLibraryStore.setFilters({ category: categorySelect.value });
      });
    }

    if (sortSelect && !sortSelect.dataset.bound) {
      sortSelect.dataset.bound = 'true';
      sortSelect.addEventListener('change', function () {
        window.NSLibraryStore.setFilters({ sort: sortSelect.value });
      });
    }

    resetButtons.forEach(function (button) {
      if (button.dataset.bound) return;
      button.dataset.bound = 'true';
      button.addEventListener('click', function () {
        resetLibraryFilters();
      });
    });

    if (!root.dataset.imageToolInputBound) {
      root.dataset.imageToolInputBound = 'true';
      root.addEventListener('input', function (event) {
        const quality = event.target.closest('[data-image-tool-quality]');
        if (!quality) return;

        const block = quality.closest('[data-image-tools]');
        const value = block ? block.querySelector('[data-image-tool-quality-value]') : null;
        if (value) value.textContent = String(quality.value || 82) + '%';
      });
    }

    if (dropzone && !dropzone.dataset.bound) {
      dropzone.dataset.bound = 'true';

      ['dragenter', 'dragover'].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.add('is-dragover');
        });
      });

      ['dragleave', 'drop'].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });

      dropzone.addEventListener('drop', async function (event) {
        const files = event.dataTransfer ? event.dataTransfer.files : null;
        if (!files || !files.length) return;

        await window.NSLibraryStore.importFiles(files);

        const currentState = window.NSLibraryStore.getState();
        resetLibraryFilters(currentState && currentState.filters ? currentState.filters.sort : 'recent');

        syncKnowledgeFromLibrary();
      });
    }

    if (!root.dataset.clickBound) {
      root.dataset.clickBound = 'true';

      root.addEventListener('click', function (event) {
        const openEl = event.target.closest('[data-library-open]');
        const favoriteEl = event.target.closest('[data-library-favorite]');
        const pinEl = event.target.closest('[data-library-pin]');
        const openTabEl = event.target.closest('[data-library-open-tab]');
        const removeEl = event.target.closest('[data-library-remove]');
        const downloadEl = event.target.closest('[data-library-download]');
        const addTagEl = event.target.closest('[data-library-add-tag]');
        const descriptionEl = event.target.closest('[data-library-description]');
        const categoryButton = event.target.closest('[data-library-set-category]');
        const addToPackEl = event.target.closest('[data-library-add-to-pack]');
        const openSourceButton = event.target.closest('[data-open-source-id]');
        const imageDownloadEl = event.target.closest('[data-image-convert-download]');
        const imageLibraryEl = event.target.closest('[data-image-convert-library]');

        if (imageDownloadEl) {
          event.preventDefault();
          event.stopPropagation();
          runImageToolConversion(root, imageDownloadEl.getAttribute('data-image-convert-download'), 'download');
          return;
        }

        if (imageLibraryEl) {
          event.preventDefault();
          event.stopPropagation();
          runImageToolConversion(root, imageLibraryEl.getAttribute('data-image-convert-library'), 'library');
          return;
        }

        if (openSourceButton) {
          event.preventDefault();
          const sourceId = openSourceButton.getAttribute('data-open-source-id');
          if (sourceId) openKnowledgeSourceInLibrary(sourceId);
          return;
        }

        if (favoriteEl) {
          event.preventDefault();
          event.stopPropagation();
          window.NSLibraryStore.toggleFavorite(favoriteEl.getAttribute('data-library-favorite'));
          return;
        }

        if (pinEl) {
          event.preventDefault();
          event.stopPropagation();
          window.NSLibraryStore.togglePinned(pinEl.getAttribute('data-library-pin'));
          return;
        }

        if (openTabEl) {
          event.preventDefault();
          event.stopPropagation();
          const fileId = openTabEl.getAttribute('data-library-open-tab');
          if (fileId) {
            window.NSLibraryStore.setActiveItem(fileId);
            emitOpenFileTab(fileId);
          }
          return;
        }

        if (removeEl) {
          event.preventDefault();
          event.stopPropagation();
          const id = removeEl.getAttribute('data-library-remove');
          if (!id) return;

          const ok = window.confirm(tr('Remove this source from Source Library?','Удалить этот источник из библиотеки источников?'));
          if (ok) {
            window.NSLibraryStore.removeItem(id);
            syncKnowledgeFromLibrary();
          }
          return;
        }

        if (downloadEl) {
          event.preventDefault();
          event.stopPropagation();
          const id = downloadEl.getAttribute('data-library-download');
          if (!id) return;

          const item = window.NSLibraryStore.getItemById(id);
          if (!item || !item.storage || !item.storage.dataUrl) return;

          const link = document.createElement('a');
          link.href = item.storage.dataUrl;
          link.download = item.originalName || item.name || 'download';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }

        if (addTagEl) {
          event.preventDefault();
          event.stopPropagation();
          const id = addTagEl.getAttribute('data-library-add-tag');
          if (!id) return;

          const tag = window.prompt(tr('Add Tag','Добавить тег'));
          if (tag) {
            window.NSLibraryStore.addTag(id, tag);
          }
          return;
        }

        if (descriptionEl) {
          event.preventDefault();
          event.stopPropagation();
          const id = descriptionEl.getAttribute('data-library-description');
          if (!id) return;

          const item = window.NSLibraryStore.getItemById(id);
          if (!item) return;

          const next = window.prompt('Описание', item.description || '');
          if (next !== null) {
            window.NSLibraryStore.updateItem(id, { description: next });
          }
          return;
        }

        if (categoryButton) {
          event.preventDefault();
          event.stopPropagation();
          const id = categoryButton.getAttribute('data-library-set-category');
          const category = categoryButton.getAttribute('data-category');
          if (!id || !category) return;

          window.NSLibraryStore.updateItem(id, { category: category });
          return;
        }

        if (addToPackEl) {
          event.preventDefault();
          event.stopPropagation();

          const fileId = addToPackEl.getAttribute('data-library-add-to-pack');
          if (!fileId || !window.NSKnowledgeStore || !window.NSPackStore) return;

          try {
            const sourceBefore = typeof window.NSKnowledgeStore.getSourceByFileId === 'function'
              ? window.NSKnowledgeStore.getSourceByFileId(fileId)
              : null;

            if (!sourceBefore) return;

            const select = root.querySelector('[data-library-pack-select="' + getCssEscape(fileId) + '"]');
            if (!select) return;

            const targetPackId = select.value;
            if (!targetPackId) return;

            const targetPack = typeof window.NSPackStore.getPackById === 'function'
              ? window.NSPackStore.getPackById(targetPackId)
              : null;

            if (!targetPack) return;

            if (typeof window.NSPackStore.addSourceToPack === 'function') {
              window.NSPackStore.addSourceToPack(targetPack.id, sourceBefore.id);
            }

            window.dispatchEvent(new CustomEvent('ns:pack-link-created', {
              detail: {
                fileId: fileId,
                sourceId: sourceBefore.id,
                packId: targetPack.id
              }
            }));

            window.dispatchEvent(new CustomEvent('ns:knowledge-store-changed', {
              detail: {
                fileId: fileId,
                sourceId: sourceBefore.id,
                packId: targetPack.id
              }
            }));

            mountAllSourceLibraries();
          } catch (error) {
            console.error('[AddToPack] failed:', error);
          }

          return;
        }

        if (openEl) {
          const id = openEl.getAttribute('data-library-open');
          if (id) {
            window.NSLibraryStore.setActiveItem(id);

            if (event.detail >= 2) {
              emitOpenFileTab(id);
            }
          }
        }
      });
    }

    if (!root.dataset.keyBound) {
      root.dataset.keyBound = 'true';

      root.addEventListener('keydown', function (event) {
        const openEl = event.target.closest('[data-library-open]');
        if (!openEl) return;

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const id = openEl.getAttribute('data-library-open');
          if (id) {
            window.NSLibraryStore.setActiveItem(id);

            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || event.shiftKey)) {
              emitOpenFileTab(id);
            }
          }
        }
      });
    }
  }

  function mountAllSourceLibraries() {
    const roots = getRoots();
    roots.forEach(function (root) {
      renderLibrary(root);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountAllSourceLibraries();

    if (window.NSLibraryStore && typeof window.NSLibraryStore.subscribe === 'function') {
      window.NSLibraryStore.subscribe(function () {
        mountAllSourceLibraries();
      });
    }

    if (window.NSKnowledgeStore && typeof window.NSKnowledgeStore.subscribe === 'function') {
      window.NSKnowledgeStore.subscribe(function () {
        mountAllSourceLibraries();
      });
    }

    if (window.NSPackStore && typeof window.NSPackStore.subscribe === 'function') {
      window.NSPackStore.subscribe(function () {
        mountAllSourceLibraries();
      });
    }

    window.addEventListener('irg:language-changed', function () {
      mountAllSourceLibraries();
    });
    document.addEventListener('irg:language-changed', function () {
      mountAllSourceLibraries();
    });
  });
})();
