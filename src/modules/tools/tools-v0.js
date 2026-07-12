(function () {
  'use strict';

  const state = new WeakMap();

  function getLang() {
    const saved = localStorage.getItem('nsbrowser.v8.language');
    if (saved === 'ru' || saved === 'en') return saved;

    const workspaceToggle = document.querySelector('#workspaceToggle .workspace-toggle-text, #workspaceToggle');
    const workspaceText = (workspaceToggle && workspaceToggle.textContent || '').trim().toLowerCase();

    if (workspaceText.includes('пространство')) return 'ru';
    if (workspaceText.includes('workspace')) return 'en';

    const shellText = (document.querySelector('.workspace-rail, .left-workspace-nav, .workspace-left-nav') || document.body).textContent || '';
    const lower = shellText.toLowerCase();

    if (lower.includes('главная') || lower.includes('инструменты') || lower.includes('веб-студия')) return 'ru';
    if (lower.includes('home') || lower.includes('tools') || lower.includes('web studio')) return 'en';

    const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang.startsWith('en')) return 'en';
    return 'ru';
  }

  function isRu() {
    return getLang() === 'ru';
  }

  function tr(en, ru) {
    return isRu() ? ru : en;
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function option(value, en, ru) {
    return '<option value="' + esc(value) + '">' + esc(tr(en, ru)) + '</option>';
  }

  function renderRoot(surface) {
    return [
      '<div class="ns-tools-v1 ns-tools-v1--practical" data-tools-surface="' + esc(surface) + '">',
      '  <div class="ns-tools-v1__stage-row">',
      '    <span class="ns-tools-v1__stage is-ready">' + esc(tr('Tools', 'Инструменты')) + '</span>',
      '    <span class="ns-tools-v1__meta">' + esc(tr('Local tools for images, text and simple exports', 'Локальные инструменты для изображений, текста и простого экспорта')) + '</span>',
      '  </div>',

      '  <nav class="ns-tools-v1__tabs" role="tablist">',
      '    <button type="button" class="ns-tools-v1__tab is-active" data-tools-tab="convert" aria-pressed="true">' + esc(tr('Converter', 'Конвертер')) + '</button>',
      '    <button type="button" class="ns-tools-v1__tab" data-tools-tab="image" aria-pressed="false">' + esc(tr('Images', 'Изображения')) + '</button>',
      '    <button type="button" class="ns-tools-v1__tab" data-tools-tab="export" aria-pressed="false">' + esc(tr('Export', 'Экспорт')) + '</button>',
      '    <button type="button" class="ns-tools-v1__tab" data-tools-tab="text" aria-pressed="false">' + esc(tr('Text', 'Текст')) + '</button>',
      '  </nav>',

      '  <section class="ns-tools-v1__panel is-active" data-tools-panel="convert">',
      '    <div class="ns-tools-v1__head"><div><h4>' + esc(tr('Text / HTML / JSON converter', 'Конвертер текста / HTML / JSON')) + '</h4><p>' + esc(tr('Choose a mode, paste content, then press Convert.', 'Выберите режим, вставьте текст и нажмите «Конвертировать».')) + '</p></div></div>',
      '    <div class="ns-tools-v1__toolbar">',
      '      <label class="ns-tools-v1__field compact"><span>' + esc(tr('What to do', 'Что сделать')) + '</span><select data-tools-convert-mode>' +
              option('plain-html', 'Plain text to HTML', 'Простой текст в HTML') +
              option('html-text', 'HTML to text', 'HTML в текст') +
              option('slug', 'Title to URL slug', 'Заголовок в URL-slug') +
              option('json-pretty', 'JSON: format', 'JSON: форматировать') +
              option('json-minify', 'JSON: compress', 'JSON: сжать') +
      '      </select></label>',
      '    </div>',
      '    <label class="ns-tools-v1__field"><span>' + esc(tr('Input', 'Исходный текст')) + '</span><textarea data-tools-convert-input rows="7" placeholder="' + esc(tr('Paste text, HTML, JSON or a title here.', 'Вставьте текст, HTML, JSON или заголовок сюда.')) + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions"><button type="button" class="ns-tools-v1__btn primary" data-tools-action="convert-run">' + esc(tr('Convert', 'Конвертировать')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="convert-copy">' + esc(tr('Copy result', 'Копировать результат')) + '</button><button type="button" class="ns-tools-v1__btn secondary" data-tools-action="convert-clear">' + esc(tr('Clear', 'Очистить')) + '</button></div>',
      '    <label class="ns-tools-v1__field"><span>' + esc(tr('Result', 'Результат')) + '</span><textarea data-tools-convert-result rows="7" readonly></textarea></label>',
      '    <div class="ns-tools-v1__status" data-tools-status="convert">' + esc(tr('Ready.', 'Готово.')) + '</div>',
      '  </section>',

      '  <section class="ns-tools-v1__panel" data-tools-panel="image">',
      '    <div class="ns-tools-v1__head"><div><h4>' + esc(tr('Image converter', 'Конвертер изображений')) + '</h4><p>' + esc(tr('Drop an image here or choose a file. Then convert it to WebP, PNG or JPG.', 'Перетащите изображение сюда или выберите файл. Затем конвертируйте его в WebP, PNG или JPG.')) + '</p></div></div>',
      '    <label class="ns-tools-v1__dropzone" data-tools-image-drop>',
      '      <input class="ns-tools-v1__file-hidden" type="file" accept="image/*" data-tools-image-file>',
      '      <span class="ns-tools-v1__drop-icon">IMG</span>',
      '      <strong data-tools-image-drop-title>' + esc(tr('Choose image or drop it here', 'Выберите изображение или перетащите сюда')) + '</strong>',
      '      <small data-tools-image-drop-subtitle>' + esc(tr('PNG, JPG, WebP and other browser-readable images', 'PNG, JPG, WebP и другие изображения, которые читает браузер')) + '</small>',
      '      <span class="ns-tools-v1__choose-button">' + esc(tr('Choose file', 'Выбрать файл')) + '</span>',
      '    </label>',
      '    <div class="ns-tools-v1__toolbar">',
      '      <label class="ns-tools-v1__field compact"><span>' + esc(tr('Format', 'Формат')) + '</span><select data-tools-image-format><option value="image/webp">WebP</option><option value="image/png">PNG</option><option value="image/jpeg">JPG</option></select></label>',
      '      <label class="ns-tools-v1__field compact"><span>' + esc(tr('Width', 'Ширина')) + '</span><input data-tools-image-width inputmode="numeric" placeholder="auto"></label>',
      '      <label class="ns-tools-v1__field compact"><span>' + esc(tr('Quality', 'Качество')) + '</span><input data-tools-image-quality type="range" min="40" max="100" value="86"></label>',
      '    </div>',
      '    <div class="ns-tools-v1__actions"><button type="button" class="ns-tools-v1__btn primary" data-tools-action="image-convert">' + esc(tr('Convert image', 'Конвертировать изображение')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="image-download">' + esc(tr('Download result', 'Скачать результат')) + '</button><button type="button" class="ns-tools-v1__btn secondary" data-tools-action="image-clear">' + esc(tr('Clear image', 'Очистить изображение')) + '</button></div>',
      '    <div class="ns-tools-v1__image-preview" data-tools-image-preview>' + esc(tr('Choose an image first.', 'Сначала выберите изображение.')) + '</div>',
      '    <div class="ns-tools-v1__status" data-tools-status="image">' + esc(tr('Ready.', 'Готово.')) + '</div>',
      '  </section>',

      '  <section class="ns-tools-v1__panel" data-tools-panel="export">',
      '    <div class="ns-tools-v1__head"><div><h4>' + esc(tr('Simple document export', 'Простой экспорт документа')) + '</h4><p>' + esc(tr('Paste text and export it as TXT, MD, HTML or open print view.', 'Вставьте текст и экспортируйте его как TXT, MD, HTML или откройте печать.')) + '</p></div></div>',
      '    <label class="ns-tools-v1__field"><span>' + esc(tr('Text', 'Текст')) + '</span><textarea data-tools-document-input rows="8" placeholder="' + esc(tr('Write or paste document text here.', 'Напишите или вставьте текст документа сюда.')) + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions"><button type="button" class="ns-tools-v1__btn" data-tools-action="doc-txt">' + esc(tr('Download TXT', 'Скачать TXT')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="doc-md">' + esc(tr('Download MD', 'Скачать MD')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="doc-html">' + esc(tr('Download HTML', 'Скачать HTML')) + '</button><button type="button" class="ns-tools-v1__btn primary" data-tools-action="doc-print">' + esc(tr('Print', 'Печать')) + '</button></div>',
      '    <div class="ns-tools-v1__status" data-tools-status="document">' + esc(tr('Ready.', 'Готово.')) + '</div>',
      '  </section>',

      '  <section class="ns-tools-v1__panel" data-tools-panel="text">',
      '    <div class="ns-tools-v1__head"><div><h4>' + esc(tr('Text cleanup', 'Очистка текста')) + '</h4><p>' + esc(tr('Clean, sort, deduplicate and count text.', 'Очистка, сортировка, удаление дублей и подсчёт текста.')) + '</p></div></div>',
      '    <label class="ns-tools-v1__field"><span>' + esc(tr('Text', 'Текст')) + '</span><textarea data-tools-text-input rows="8" placeholder="' + esc(tr('Paste text here.', 'Вставьте текст сюда.')) + '"></textarea></label>',
      '    <div class="ns-tools-v1__actions"><button type="button" class="ns-tools-v1__btn primary" data-tools-action="text-clean">' + esc(tr('Clean spaces', 'Очистить пробелы')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="text-dedupe">' + esc(tr('Unique lines', 'Уникальные строки')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="text-sort">' + esc(tr('Sort lines', 'Сортировать строки')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="text-count">' + esc(tr('Count', 'Подсчёт')) + '</button><button type="button" class="ns-tools-v1__btn" data-tools-action="text-copy">' + esc(tr('Copy result', 'Копировать результат')) + '</button></div>',
      '    <label class="ns-tools-v1__field"><span>' + esc(tr('Result', 'Результат')) + '</span><textarea data-tools-text-result rows="7" readonly></textarea></label>',
      '    <div class="ns-tools-v1__status" data-tools-status="text">' + esc(tr('Ready.', 'Готово.')) + '</div>',
      '  </section>',
      '</div>'
    ].join('');
  }

  function bindRoot(rootEl) {
    if (rootEl.dataset.toolsBound === '1') return;
    rootEl.dataset.toolsBound = '1';

    rootEl.addEventListener('click', function (event) {
      const tab = event.target.closest('[data-tools-tab]');
      if (tab) {
        const target = tab.getAttribute('data-tools-tab');

        rootEl.querySelectorAll('[data-tools-tab]').forEach(function (button) {
          const active = button.getAttribute('data-tools-tab') === target;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });

        rootEl.querySelectorAll('[data-tools-panel]').forEach(function (panel) {
          panel.classList.toggle('is-active', panel.getAttribute('data-tools-panel') === target);
        });

        return;
      }

      const actionButton = event.target.closest('[data-tools-action]');
      if (!actionButton) return;
      handleAction(rootEl, actionButton.getAttribute('data-tools-action'));
    });

    rootEl.addEventListener('change', function (event) {
      const fileInput = event.target.closest('[data-tools-image-file]');
      if (!fileInput) return;

      const file = fileInput.files && fileInput.files[0];
      if (file) loadImageFile(rootEl, file);

      fileInput.value = '';
    });

    rootEl.addEventListener('dragover', function (event) {
      const drop = event.target.closest('[data-tools-image-drop]');
      if (!drop) return;

      event.preventDefault();
      drop.classList.add('is-dragover');
    });

    rootEl.addEventListener('dragleave', function (event) {
      const drop = event.target.closest('[data-tools-image-drop]');
      if (!drop) return;

      drop.classList.remove('is-dragover');
    });

    rootEl.addEventListener('drop', function (event) {
      const drop = event.target.closest('[data-tools-image-drop]');
      if (!drop) return;

      event.preventDefault();
      drop.classList.remove('is-dragover');

      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) loadImageFile(rootEl, file);
    });
  }

  function status(rootEl, key, text) {
    const node = rootEl.querySelector('[data-tools-status="' + key + '"]');
    if (node) node.textContent = text;
  }

  function value(rootEl, selector) {
    const node = rootEl.querySelector(selector);
    return node ? String(node.value || '') : '';
  }

  function setValue(rootEl, selector, text) {
    const node = rootEl.querySelector(selector);
    if (node) node.value = text || '';
  }

  async function copyText(text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return false;
    await navigator.clipboard.writeText(String(text || ''));
    return true;
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([String(text || '')], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.download = filename;
    a.href = url;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function slugify(text) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);
  }

  function plainToHtml(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .filter(function (block) {
        return block.trim();
      })
      .map(function (block) {
        return '<p>' + esc(block.trim()).replace(/\n/g, '<br>') + '</p>';
      })
      .join('\n');
  }

  function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');

    return (div.textContent || '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function handleAction(rootEl, action) {
    if (action === 'convert-run') return runConvert(rootEl);
    if (action === 'convert-copy') return copyFrom(rootEl, '[data-tools-convert-result]', 'convert');
    if (action === 'convert-clear') {
      setValue(rootEl, '[data-tools-convert-input]', '');
      setValue(rootEl, '[data-tools-convert-result]', '');
      return status(rootEl, 'convert', tr('Cleared.', 'Очищено.'));
    }

    if (action === 'image-convert') return convertImage(rootEl);
    if (action === 'image-download') return downloadImage(rootEl);
    if (action === 'image-clear') return clearImage(rootEl);

    if (action === 'doc-txt') return exportDocument(rootEl, 'txt');
    if (action === 'doc-md') return exportDocument(rootEl, 'md');
    if (action === 'doc-html') return exportDocument(rootEl, 'html');
    if (action === 'doc-print') return printDocument(rootEl);

    if (action === 'text-clean') return runText(rootEl, 'clean');
    if (action === 'text-dedupe') return runText(rootEl, 'dedupe');
    if (action === 'text-sort') return runText(rootEl, 'sort');
    if (action === 'text-count') return runText(rootEl, 'count');
    if (action === 'text-copy') return copyFrom(rootEl, '[data-tools-text-result]', 'text');
  }

  function runConvert(rootEl) {
    const mode = value(rootEl, '[data-tools-convert-mode]') || 'plain-html';
    const input = value(rootEl, '[data-tools-convert-input]');
    let result = '';

    try {
      if (mode === 'plain-html') result = plainToHtml(input);
      else if (mode === 'html-text') result = htmlToText(input);
      else if (mode === 'slug') result = slugify(input);
      else if (mode === 'json-pretty') result = JSON.stringify(JSON.parse(input), null, 2);
      else if (mode === 'json-minify') result = JSON.stringify(JSON.parse(input));

      setValue(rootEl, '[data-tools-convert-result]', result);
      status(rootEl, 'convert', tr('Converted.', 'Конвертировано.'));
    } catch (error) {
      status(rootEl, 'convert', tr('Could not convert this input.', 'Не удалось конвертировать этот текст.'));
    }
  }

  async function copyFrom(rootEl, selector, statusKey) {
    const text = value(rootEl, selector);

    if (!text.trim()) {
      return status(rootEl, statusKey, tr('Nothing to copy.', 'Пока нечего копировать.'));
    }

    try {
      await copyText(text);
      status(rootEl, statusKey, tr('Copied.', 'Скопировано.'));
    } catch (error) {
      status(rootEl, statusKey, tr('Copy failed.', 'Не удалось скопировать.'));
    }
  }

  function loadImageFile(rootEl, file) {
    if (!file || !String(file.type || '').startsWith('image/')) {
      status(rootEl, 'image', tr('Please choose an image file.', 'Выберите файл изображения.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = function () {
      const dataUrl = String(reader.result || '');
      const img = new Image();

      img.onload = function () {
        const meta = {
          fileName: file.name || 'image',
          fileType: file.type || 'image',
          fileSize: file.size || 0,
          sourceDataUrl: dataUrl,
          sourceWidth: img.naturalWidth || 0,
          sourceHeight: img.naturalHeight || 0,
          convertedDataUrl: '',
          convertedBlob: null,
          convertedFormat: ''
        };

        state.set(rootEl, meta);
        updateImageDropzone(rootEl, meta);
        showImagePreview(
          rootEl,
          dataUrl,
          meta.sourceWidth,
          meta.sourceHeight,
          meta.fileSize,
          tr('Original image', 'Исходное изображение')
        );
        status(rootEl, 'image', tr('Image selected. Press Convert image.', 'Изображение выбрано. Нажмите «Конвертировать изображение».'));
      };

      img.onerror = function () {
        status(rootEl, 'image', tr('Could not read this image.', 'Не удалось прочитать изображение.'));
      };

      img.src = dataUrl;
    };

    reader.onerror = function () {
      status(rootEl, 'image', tr('Could not read this image.', 'Не удалось прочитать изображение.'));
    };

    reader.readAsDataURL(file);
  }

  function updateImageDropzone(rootEl, meta) {
    const title = rootEl.querySelector('[data-tools-image-drop-title]');
    const subtitle = rootEl.querySelector('[data-tools-image-drop-subtitle]');
    const drop = rootEl.querySelector('[data-tools-image-drop]');

    if (drop) drop.classList.add('has-file');
    if (title) title.textContent = meta.fileName || tr('Image selected', 'Изображение выбрано');

    if (subtitle) {
      subtitle.textContent = [
        meta.sourceWidth + '×' + meta.sourceHeight,
        Math.round((meta.fileSize || 0) / 1024) + ' KB',
        tr('click to choose another', 'нажмите, чтобы выбрать другое')
      ].join(' · ');
    }
  }

  function showImagePreview(rootEl, src, width, height, size, label) {
    const preview = rootEl.querySelector('[data-tools-image-preview]');
    if (!preview) return;

    preview.innerHTML = [
      '<div class="ns-tools-v1__preview-label">' + esc(label || '') + '</div>',
      '<img alt="preview" src="' + src + '">',
      '<span>' + esc((width || 0) + '×' + (height || 0) + ' · ' + Math.round((size || 0) / 1024) + ' KB') + '</span>'
    ].join('');
  }

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    const meta = parts[0] || '';
    const b64 = parts[1] || '';
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }

  function convertImage(rootEl) {
    const meta = state.get(rootEl) || {};

    if (!meta.sourceDataUrl) {
      return status(rootEl, 'image', tr('Choose an image first.', 'Сначала выберите изображение.'));
    }

    const format = value(rootEl, '[data-tools-image-format]') || 'image/webp';
    const widthRaw = parseInt(value(rootEl, '[data-tools-image-width]'), 10);
    const quality = Math.max(0.4, Math.min(1, Number(value(rootEl, '[data-tools-image-quality]') || 86) / 100));

    const img = new Image();

    img.onload = function () {
      const targetWidth = Number.isFinite(widthRaw) && widthRaw > 0 ? widthRaw : img.naturalWidth;
      const ratio = targetWidth / Math.max(1, img.naturalWidth);
      const targetHeight = Math.max(1, Math.round(img.naturalHeight * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      let dataUrl = '';

      try {
        dataUrl = canvas.toDataURL(format, quality);
      } catch (error) {
        dataUrl = canvas.toDataURL('image/png');
      }

      const blob = dataUrlToBlob(dataUrl);
      const nextMeta = Object.assign({}, meta, {
        convertedDataUrl: dataUrl,
        convertedBlob: blob,
        convertedFormat: format,
        convertedWidth: targetWidth,
        convertedHeight: targetHeight
      });

      state.set(rootEl, nextMeta);
      showImagePreview(
        rootEl,
        dataUrl,
        targetWidth,
        targetHeight,
        blob.size,
        tr('Converted image', 'Конвертированное изображение')
      );
      status(rootEl, 'image', tr('Image converted.', 'Изображение конвертировано.'));
    };

    img.onerror = function () {
      status(rootEl, 'image', tr('Could not read this image.', 'Не удалось прочитать изображение.'));
    };

    img.src = meta.sourceDataUrl;
  }

  function downloadImage(rootEl) {
    const data = state.get(rootEl) || {};

    if (!data.convertedDataUrl) {
      return status(rootEl, 'image', tr('Convert the image first.', 'Сначала конвертируйте изображение.'));
    }

    const ext = data.convertedFormat === 'image/png' ? 'png' : data.convertedFormat === 'image/jpeg' ? 'jpg' : 'webp';
    const baseName = String(data.fileName || 'irgeztne-image')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9а-яё_-]+/gi, '-')
      .replace(/^-+|-+$/g, '') || 'irgeztne-image';

    const a = document.createElement('a');
    a.href = data.convertedDataUrl;
    a.download = baseName + '-converted.' + ext;

    document.body.appendChild(a);
    a.click();
    a.remove();

    status(rootEl, 'image', tr('Image downloaded.', 'Изображение скачано.'));
  }

  function clearImage(rootEl) {
    const input = rootEl.querySelector('[data-tools-image-file]');
    if (input) input.value = '';

    state.delete(rootEl);

    const preview = rootEl.querySelector('[data-tools-image-preview]');
    if (preview) {
      preview.textContent = tr('Choose an image first.', 'Сначала выберите изображение.');
    }

    const drop = rootEl.querySelector('[data-tools-image-drop]');
    if (drop) drop.classList.remove('has-file', 'is-dragover');

    const title = rootEl.querySelector('[data-tools-image-drop-title]');
    if (title) title.textContent = tr('Choose image or drop it here', 'Выберите изображение или перетащите сюда');

    const subtitle = rootEl.querySelector('[data-tools-image-drop-subtitle]');
    if (subtitle) subtitle.textContent = tr('PNG, JPG, WebP and other browser-readable images', 'PNG, JPG, WebP и другие изображения, которые читает браузер');

    status(rootEl, 'image', tr('Image cleared.', 'Изображение очищено.'));
  }

  function exportDocument(rootEl, kind) {
    const text = value(rootEl, '[data-tools-document-input]');

    if (!text.trim()) {
      return status(rootEl, 'document', tr('Add document text first.', 'Сначала добавьте текст документа.'));
    }

    if (kind === 'html') {
      const html = '<!doctype html><html><head><meta charset="utf-8"><title>IRGEZTNE document</title></head><body>' + plainToHtml(text) + '</body></html>';
      downloadText('irgeztne-document.html', html, 'text/html;charset=utf-8');
    } else if (kind === 'md') {
      downloadText('irgeztne-document.md', text, 'text/markdown;charset=utf-8');
    } else {
      downloadText('irgeztne-document.txt', text, 'text/plain;charset=utf-8');
    }

    status(rootEl, 'document', tr('Downloaded.', 'Скачано.'));
  }

  function printDocument(rootEl) {
    const text = value(rootEl, '[data-tools-document-input]');

    if (!text.trim()) {
      return status(rootEl, 'document', tr('Add document text first.', 'Сначала добавьте текст документа.'));
    }

    const win = window.open('', '_blank');

    if (!win) {
      return status(rootEl, 'document', tr('Popup blocked.', 'Окно печати заблокировано.'));
    }

    win.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>IRGEZTNE print</title><style>body{font:16px/1.55 system-ui;margin:40px;white-space:pre-wrap}</style></head><body>' +
        esc(text) +
      '</body></html>'
    );
    win.document.close();
    win.focus();

    setTimeout(function () {
      win.print();
    }, 120);

    status(rootEl, 'document', tr('Print view opened.', 'Открыт вид печати.'));
  }

  function runText(rootEl, mode) {
    const input = value(rootEl, '[data-tools-text-input]');
    let result = input;

    if (mode === 'clean') {
      result = input
        .replace(/[\t ]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } else if (mode === 'dedupe') {
      const seen = new Set();
      result = input
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(function (line) {
          if (!line || seen.has(line)) return false;
          seen.add(line);
          return true;
        })
        .join('\n');
    } else if (mode === 'sort') {
      result = input
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return a.localeCompare(b);
        })
        .join('\n');
    } else if (mode === 'count') {
      const words = (input.match(/[\p{L}\p{N}_-]+/gu) || []).length;
      const lines = input ? input.split(/\r?\n/).length : 0;

      result = [
        tr('Characters', 'Символы') + ': ' + input.length,
        tr('Words', 'Слова') + ': ' + words,
        tr('Lines', 'Строки') + ': ' + lines
      ].join('\n');
    }

    setValue(rootEl, '[data-tools-text-result]', result);
    status(rootEl, 'text', tr('Done.', 'Готово.'));
  }

  function renderAll() {
    document.querySelectorAll('[data-tools-root]').forEach(function (rootEl) {
      const surface = rootEl.getAttribute('data-tools-surface') || 'workspace';
      rootEl.innerHTML = renderRoot(surface);

      if (rootEl.dataset.toolsBound !== '1') {
        bindRoot(rootEl);
      }
    });
  }

  function init() {
    renderAll();

    document.addEventListener('irg:language-changed', renderAll);
    window.addEventListener('irg:language-changed', renderAll);

    document.addEventListener('click', function (event) {
      const button = event.target.closest('button');
      if (!button) return;

      const text = (button.textContent || '').trim().toUpperCase();
      if (text === 'RU' || text === 'EN') {
        setTimeout(renderAll, 80);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.NSToolsV1 = { renderAll: renderAll };
})();