(function (global) {
  'use strict';

  const TOOL_ID = 'workspace.image.convert';
  const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const rootState = new WeakMap();
  const rootContext = new WeakMap();

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function localeOf(context) {
    if (context && (context.locale === 'ru' || context.locale === 'en')) return context.locale;
    if (global.NSToolRegistryV1) return global.NSToolRegistryV1.resolveLocale();
    return clean(document.documentElement.getAttribute('lang')).toLowerCase().startsWith('en') ? 'en' : 'ru';
  }

  function themeOf(context) {
    if (context && (context.theme === 'light' || context.theme === 'dark')) return context.theme;
    if (global.NSToolRegistryV1) return global.NSToolRegistryV1.resolveTheme();
    return 'dark';
  }

  function t(context, ru, en) {
    return localeOf(context) === 'en' ? en : ru;
  }

  function formatBytes(bytes) {
    const size = Math.max(0, Number(bytes || 0));
    if (size < 1024) return Math.round(size) + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function normalizedMime(value, name) {
    const mime = clean(value).toLowerCase();
    if (mime === 'image/jpg') return 'image/jpeg';
    if (SUPPORTED_TYPES.includes(mime)) return mime;

    const ext = clean(name).toLowerCase().split('.').pop();
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    return mime;
  }

  function isSupportedType(value, name) {
    return SUPPORTED_TYPES.includes(normalizedMime(value, name));
  }

  function extensionFor(mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg') return 'jpg';
    return 'webp';
  }

  function makeFileName(name, mime) {
    const base = clean(name || 'image')
      .replace(/\.[^.\/]+$/, '')
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image';
    return base + '-irgeztne.' + extensionFor(mime);
  }

  function calculateSize(sourceWidth, sourceHeight, requestedWidth, requestedHeight, locked, changedAxis) {
    const sw = Math.max(1, Math.round(Number(sourceWidth || 1)));
    const sh = Math.max(1, Math.round(Number(sourceHeight || 1)));
    let width = Math.max(0, Math.round(Number(requestedWidth || 0)));
    let height = Math.max(0, Math.round(Number(requestedHeight || 0)));

    if (locked !== false) {
      if (changedAxis === 'height' && height) {
        width = Math.max(1, Math.round(height * sw / sh));
      } else if (width) {
        height = Math.max(1, Math.round(width * sh / sw));
      } else if (height) {
        width = Math.max(1, Math.round(height * sw / sh));
      } else {
        width = sw;
        height = sh;
      }
    } else {
      width = width || sw;
      height = height || sh;
    }

    return { width: width, height: height };
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve) {
      if (!canvas || typeof canvas.toBlob !== 'function') return resolve(null);
      canvas.toBlob(function (blob) { resolve(blob || null); }, mime, quality);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('Image could not be loaded.')); };
      image.src = dataUrl;
    });
  }

  function render(root, context) {
    const embedded = context.mode === 'embedded';
    root.dataset.imageToolTheme = themeOf(context);
    root.dataset.imageToolLocale = localeOf(context);
    root.innerHTML = `
      <section class="ns-image-tool-v1${embedded ? ' is-embedded' : ''}">
        <header class="ns-image-tool-v1__head">
          <div>
            <span class="ns-image-tool-v1__eyebrow">${esc(t(context, 'ЛОКАЛЬНЫЙ ИНСТРУМЕНТ', 'LOCAL TOOL'))}</span>
            <h4>${esc(t(context, 'Конвертер изображений', 'Image converter'))}</h4>
            <p>${esc(t(context, 'Один инструмент для Tools и Files. Исходник не заменяется.', 'One tool for Tools and Files. The source is never replaced.'))}</p>
          </div>
          <span class="ns-image-tool-v1__offline">${esc(t(context, 'Офлайн', 'Offline'))}</span>
        </header>

        <label class="ns-image-tool-v1__drop" data-image-tool-drop>
          <input type="file" accept="image/png,image/jpeg,image/webp" data-image-tool-file>
          <strong data-image-tool-drop-title>${esc(t(context, 'Выберите PNG, JPEG или WebP', 'Choose PNG, JPEG or WebP'))}</strong>
          <span>${esc(t(context, 'Нажмите или перетащите изображение сюда', 'Click or drop an image here'))}</span>
        </label>

        <div class="ns-image-tool-v1__workspace">
          <div class="ns-image-tool-v1__preview-grid">
            <figure>
              <figcaption>${esc(t(context, 'Исходник', 'Source'))}</figcaption>
              <div class="ns-image-tool-v1__preview" data-image-tool-source-preview>${esc(t(context, 'Изображение ещё не выбрано.', 'No image selected yet.'))}</div>
              <small data-image-tool-source-summary>—</small>
            </figure>
            <figure>
              <figcaption>${esc(t(context, 'Результат', 'Result'))}</figcaption>
              <div class="ns-image-tool-v1__preview" data-image-tool-result-preview>${esc(t(context, 'После конвертации результат появится здесь.', 'The result will appear here after conversion.'))}</div>
              <small data-image-tool-result-summary>—</small>
            </figure>
          </div>

          <div class="ns-image-tool-v1__controls">
            <label><span>${esc(t(context, 'Ширина', 'Width'))}</span><input type="number" min="1" step="1" inputmode="numeric" data-image-tool-width></label>
            <label><span>${esc(t(context, 'Высота', 'Height'))}</span><input type="number" min="1" step="1" inputmode="numeric" data-image-tool-height></label>
            <label class="ns-image-tool-v1__lock"><input type="checkbox" checked data-image-tool-lock><span>${esc(t(context, 'Сохранять пропорции', 'Lock aspect ratio'))}</span></label>
            <label><span>${esc(t(context, 'Формат', 'Format'))}</span><select data-image-tool-format><option value="image/webp">WebP</option><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option></select></label>
            <label class="ns-image-tool-v1__quality"><span>${esc(t(context, 'Качество', 'Quality'))}: <b data-image-tool-quality-value>86%</b></span><input type="range" min="40" max="100" value="86" data-image-tool-quality></label>
          </div>

          <div class="ns-image-tool-v1__actions">
            <button type="button" class="primary" data-image-tool-action="convert">${esc(t(context, 'Конвертировать', 'Convert'))}</button>
            <button type="button" data-image-tool-action="save" disabled>${esc(t(context, 'Сохранить новым файлом', 'Save as new file'))}</button>
            <button type="button" data-image-tool-action="download" disabled>${esc(t(context, 'Скачать результат', 'Download result'))}</button>
            <button type="button" class="quiet" data-image-tool-action="clear">${esc(t(context, 'Очистить', 'Clear'))}</button>
          </div>
          <div class="ns-image-tool-v1__status" data-image-tool-status role="status" aria-live="polite">${esc(t(context, 'Готово к работе.', 'Ready.'))}</div>
        </div>
      </section>`;
  }

  function setStatus(root, context, ru, en, error) {
    const node = root.querySelector('[data-image-tool-status]');
    if (!node) return;
    node.textContent = t(context, ru, en);
    node.classList.toggle('is-error', Boolean(error));
  }

  function imageHtml(dataUrl, name) {
    return '<img src="' + esc(dataUrl) + '" alt="' + esc(name || 'preview') + '">';
  }

  function syncSourceView(root, context, state) {
    const preview = root.querySelector('[data-image-tool-source-preview]');
    const summary = root.querySelector('[data-image-tool-source-summary]');
    const title = root.querySelector('[data-image-tool-drop-title]');
    const width = root.querySelector('[data-image-tool-width]');
    const height = root.querySelector('[data-image-tool-height]');
    if (preview) preview.innerHTML = imageHtml(state.sourceDataUrl, state.sourceName);
    if (summary) summary.textContent = state.sourceName + ' · ' + state.sourceMime + ' · ' + state.sourceWidth + '×' + state.sourceHeight + ' · ' + formatBytes(state.sourceSize);
    if (title) title.textContent = state.sourceName;
    if (width) width.value = String(state.sourceWidth);
    if (height) height.value = String(state.sourceHeight);
  }

  function syncResultView(root, state) {
    const preview = root.querySelector('[data-image-tool-result-preview]');
    const summary = root.querySelector('[data-image-tool-result-summary]');
    if (preview) preview.innerHTML = imageHtml(state.resultDataUrl, state.resultName);
    if (summary) summary.textContent = state.resultName + ' · ' + state.resultMime + ' · ' + state.resultWidth + '×' + state.resultHeight + ' · ' + formatBytes(state.resultSize);
    root.querySelectorAll('[data-image-tool-action="save"], [data-image-tool-action="download"]').forEach(function (button) {
      button.disabled = false;
    });
  }

  async function applySource(root, context, source) {
    if (!source || !source.dataUrl || !isSupportedType(source.mime, source.name)) {
      setStatus(root, context, 'Поддерживаются только PNG, JPEG и WebP.', 'Only PNG, JPEG and WebP are supported.', true);
      return false;
    }

    try {
      const image = await loadImage(source.dataUrl);
      const state = {
        sourceRef: source.ref || null,
        sourceDataUrl: source.dataUrl,
        sourceName: source.name || 'image',
        sourceMime: normalizedMime(source.mime, source.name),
        sourceSize: Number(source.size || 0),
        sourceWidth: Number(image.naturalWidth || image.width || 0),
        sourceHeight: Number(image.naturalHeight || image.height || 0),
        resultDataUrl: '', resultBlob: null, resultName: '', resultMime: '',
        resultSize: 0, resultWidth: 0, resultHeight: 0
      };
      rootState.set(root, state);
      syncSourceView(root, context, state);
      setStatus(root, context, 'Источник готов. Настройте результат и нажмите «Конвертировать».', 'Source ready. Set the output and press Convert.', false);
      return true;
    } catch (error) {
      setStatus(root, context, 'Не удалось прочитать изображение.', 'Could not read this image.', true);
      return false;
    }
  }

  async function loadFile(root, context, file) {
    if (!file || !isSupportedType(file.type, file.name)) {
      return setStatus(root, context, 'Выберите PNG, JPEG или WebP.', 'Choose a PNG, JPEG or WebP file.', true);
    }

    setStatus(root, context, 'Чтение изображения…', 'Reading image…', false);
    try {
      const dataUrl = await fileToDataUrl(file);
      await applySource(root, context, {
        dataUrl: dataUrl,
        name: file.name || 'image',
        mime: normalizedMime(file.type, file.name),
        size: file.size || 0,
        ref: null
      });
    } catch (error) {
      setStatus(root, context, 'Не удалось прочитать файл.', 'Could not read this file.', true);
    }
  }

  function sourceFromReference(reference) {
    if (!reference || !reference.id || !global.NSLibraryStore || typeof global.NSLibraryStore.getItemById !== 'function') return null;
    const item = global.NSLibraryStore.getItemById(reference.id);
    if (!item || !item.storage) return null;

    const workspaceFileId = item.storage.fileId
      ? String(item.storage.fileId)
      : '';
    const sourceUrl = item.storage.dataUrl || (
      workspaceFileId
        ? 'irgeztne-asset://workspace-file/' + encodeURIComponent(workspaceFileId)
        : ''
    );

    if (!sourceUrl) return null;

    return {
      dataUrl: sourceUrl,
      name: item.name || item.originalName || reference.name || 'image',
      mime: item.type || reference.mime,
      size: item.size || 0,
      ref: { owner: 'files', id: item.id, type: 'image', mime: item.type || reference.mime, name: item.name || '' }
    };
  }

  function syncLockedSize(root, axis) {
    const state = rootState.get(root);
    const lock = root.querySelector('[data-image-tool-lock]');
    if (!state || !lock || !lock.checked) return;
    const width = root.querySelector('[data-image-tool-width]');
    const height = root.querySelector('[data-image-tool-height]');
    const size = calculateSize(state.sourceWidth, state.sourceHeight, width && width.value, height && height.value, true, axis);
    if (width) width.value = String(size.width);
    if (height) height.value = String(size.height);
  }

  async function convert(root, context) {
    const state = rootState.get(root);
    if (!state || !state.sourceDataUrl) {
      return setStatus(root, context, 'Сначала выберите изображение.', 'Choose an image first.', true);
    }

    const widthInput = root.querySelector('[data-image-tool-width]');
    const heightInput = root.querySelector('[data-image-tool-height]');
    const lock = root.querySelector('[data-image-tool-lock]');
    const format = root.querySelector('[data-image-tool-format]');
    const quality = root.querySelector('[data-image-tool-quality]');
    const mime = normalizedMime(format && format.value, '');
    const size = calculateSize(state.sourceWidth, state.sourceHeight, widthInput && widthInput.value, heightInput && heightInput.value, !lock || lock.checked, 'width');
    const qualityValue = Math.max(0.4, Math.min(1, Number(quality && quality.value || 86) / 100));

    setStatus(root, context, 'Конвертация…', 'Converting…', false);
    try {
      const image = await loadImage(state.sourceDataUrl);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const drawing = canvas.getContext('2d');
      if (!drawing) throw new Error('Canvas is unavailable.');
      if (mime === 'image/jpeg') {
        drawing.fillStyle = '#ffffff';
        drawing.fillRect(0, 0, size.width, size.height);
      }
      drawing.imageSmoothingEnabled = true;
      drawing.imageSmoothingQuality = 'high';
      drawing.drawImage(image, 0, 0, size.width, size.height);
      const blob = await canvasToBlob(canvas, mime, mime === 'image/png' ? undefined : qualityValue);
      if (!blob) throw new Error('Image export failed.');
      const dataUrl = await blobToDataUrl(blob);

      Object.assign(state, {
        resultBlob: blob,
        resultDataUrl: dataUrl,
        resultMime: mime,
        resultName: makeFileName(state.sourceName, mime),
        resultSize: blob.size || 0,
        resultWidth: size.width,
        resultHeight: size.height
      });
      syncResultView(root, state);
      setStatus(root, context, 'Результат готов. Исходный файл не изменён.', 'Result ready. The source file is unchanged.', false);
    } catch (error) {
      setStatus(root, context, 'Конвертация не удалась.', 'Image conversion failed.', true);
    }
  }

  function emitResult(context, result) {
    if (context && typeof context.emitResult === 'function') return context.emitResult(result);
    if (context && typeof context.returnResult === 'function') context.returnResult(result);
    try {
      document.dispatchEvent(new CustomEvent('ns-tool:result', {
        detail: Object.assign({ toolId: TOOL_ID, host: context.host }, result)
      }));
    } catch (error) {
      // Owner callback is optional for a directly mounted Files adapter.
    }
    return result;
  }

  function save(root, context) {
    const state = rootState.get(root);
    if (!state || !state.resultDataUrl || !global.NSLibraryStore || typeof global.NSLibraryStore.addItem !== 'function') {
      return setStatus(root, context, 'Сначала подготовьте результат.', 'Prepare a result first.', true);
    }

    try {
      const saved = global.NSLibraryStore.addItem({
        name: state.resultName,
        originalName: state.resultName,
        type: state.resultMime,
        ext: extensionFor(state.resultMime),
        size: state.resultSize,
        category: 'asset',
        tags: ['image-tool', 'converted'],
        description: t(context, 'Создано Конвертером изображений IRGEZTNE.', 'Created with IRGEZTNE Image Converter.'),
        storage: { kind: 'local', dataUrl: state.resultDataUrl },
        preview: { kind: 'image', excerpt: '', textContent: '', textType: 'text' },
        usage: { inChatContext: false, inEditor: false, inPublishing: true, inSiteAssets: true },
        publishing: { ipfsReady: false, ipfsCid: null, publishName: null }
      });

      emitResult(context, {
        status: 'success',
        outputTypes: [state.resultMime],
        outputs: [{ owner: 'files', id: saved.id, type: 'image', mime: state.resultMime, name: saved.name }],
        payload: { sourcePreserved: true }
      });
      setStatus(root, context, 'Новый файл сохранён в «Файлы».', 'New file saved to Files.', false);
    } catch (error) {
      setStatus(root, context, 'Не удалось сохранить новый файл.', 'Could not save the new file.', true);
    }
  }

  function download(root, context) {
    const state = rootState.get(root);
    if (!state || !state.resultDataUrl) return setStatus(root, context, 'Сначала подготовьте результат.', 'Prepare a result first.', true);
    const link = document.createElement('a');
    link.href = state.resultDataUrl;
    link.download = state.resultName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus(root, context, 'Результат скачан.', 'Result downloaded.', false);
  }

  function clear(root, context) {
    rootState.delete(root);
    render(root, context);
    bind(root, context);
  }

  function bind(root, context) {
    rootContext.set(root, context);
    if (root.dataset.imageToolBound === '1') return;
    root.dataset.imageToolBound = '1';

    root.addEventListener('change', function (event) {
      const current = rootContext.get(root) || context;
      if (event.target.matches('[data-image-tool-file]')) {
        const file = event.target.files && event.target.files[0];
        if (file) loadFile(root, current, file);
        event.target.value = '';
        return;
      }
      if (event.target.matches('[data-image-tool-format]')) {
        const quality = root.querySelector('[data-image-tool-quality]');
        if (quality) quality.disabled = event.target.value === 'image/png';
      }
    });

    root.addEventListener('input', function (event) {
      if (event.target.matches('[data-image-tool-width]')) syncLockedSize(root, 'width');
      if (event.target.matches('[data-image-tool-height]')) syncLockedSize(root, 'height');
      if (event.target.matches('[data-image-tool-quality]')) {
        const value = root.querySelector('[data-image-tool-quality-value]');
        if (value) value.textContent = String(event.target.value) + '%';
      }
    });

    root.addEventListener('click', function (event) {
      const button = event.target.closest('[data-image-tool-action]');
      if (!button) return;
      const current = rootContext.get(root) || context;
      const action = button.getAttribute('data-image-tool-action');
      if (action === 'convert') convert(root, current);
      else if (action === 'save') save(root, current);
      else if (action === 'download') download(root, current);
      else if (action === 'clear') clear(root, current);
    });

    root.addEventListener('dragover', function (event) {
      if (!event.target.closest('[data-image-tool-drop]')) return;
      event.preventDefault();
      root.classList.add('is-dragover');
    });
    root.addEventListener('dragleave', function () { root.classList.remove('is-dragover'); });
    root.addEventListener('drop', function (event) {
      if (!event.target.closest('[data-image-tool-drop]')) return;
      event.preventDefault();
      root.classList.remove('is-dragover');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) loadFile(root, rootContext.get(root) || context, file);
    });
  }

  function inferContext(root, input) {
    const raw = Object.assign({}, input || {});
    raw.host = raw.host || root.getAttribute('data-image-tool-host') || 'tools';
    raw.surface = raw.surface || root.getAttribute('data-image-tool-surface') || 'workspace';
    raw.mode = raw.mode || root.getAttribute('data-image-tool-mode') || (raw.host === 'files' ? 'embedded' : 'full');
    const sourceId = root.getAttribute('data-image-tool-source-id');
    if (!raw.sourceRef && sourceId) raw.sourceRef = { owner: 'files', id: sourceId, type: 'image' };
    if (global.NSToolRegistryV1 && typeof global.NSToolRegistryV1.createContext === 'function') {
      const normalized = global.NSToolRegistryV1.createContext(raw);
      if (input && typeof input.emitResult === 'function') normalized.emitResult = input.emitResult;
      return normalized;
    }
    return raw;
  }

  function mount(root, inputContext) {
    if (!root) return null;
    const context = inferContext(root, inputContext);
    render(root, context);
    bind(root, context);
    const referenced = sourceFromReference(context.sourceRef);
    if (referenced) applySource(root, context, referenced);
    return root;
  }

  function mountAll(scope) {
    const base = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
    const roots = [];
    if (base.matches && base.matches('[data-image-tool-root]')) roots.push(base);
    base.querySelectorAll('[data-image-tool-root]').forEach(function (root) { roots.push(root); });
    roots.forEach(function (root) { mount(root); });
    return roots.length;
  }

  function open(context) {
    if (context.mount) {
      mount(context.mount, context);
      return;
    }
    if (context.host === 'files' && context.sourceRef) {
      const root = document.querySelector('[data-image-tool-root][data-image-tool-source-id="' + clean(context.sourceRef.id).replace(/"/g, '') + '"]');
      if (root) {
        mount(root, context);
        return;
      }
    }
    if (global.NSToolsV1 && typeof global.NSToolsV1.openTool === 'function') {
      global.NSToolsV1.openTool(TOOL_ID, context);
      return;
    }
    throw new Error('Image Tool host is not available.');
  }

  function register() {
    const registry = global.NSToolRegistryV1;
    if (!registry || registry.get(TOOL_ID)) return;
    registry.register({
      id: TOOL_ID,
      version: '1.0.0',
      title: { ru: 'Конвертер изображений', en: 'Image converter' },
      description: { ru: 'Конвертация, изменение размера и сохранение нового локального файла.', en: 'Convert, resize and save a new local image file.' },
      category: 'media',
      icon: 'image',
      inputTypes: SUPPORTED_TYPES,
      outputTypes: SUPPORTED_TYPES,
      supportedHosts: ['tools', 'files', 'projects', 'tasks', 'webstudio'],
      modes: ['full', 'embedded'],
      capabilities: { network: false, auth: false },
      implementation: { open: open }
    });
  }

  global.NSImageToolV1 = Object.freeze({
    id: TOOL_ID,
    mount: mount,
    mountAll: mountAll,
    open: open,
    calculateSize: calculateSize,
    isSupportedType: isSupportedType,
    makeFileName: makeFileName
  });

  register();
})(window);
