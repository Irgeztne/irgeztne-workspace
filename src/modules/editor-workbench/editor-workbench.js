(() => {
  const SOURCE_PARENT = 'irgeztne-webstudio-v084b';
  const SOURCE_CHILD = 'irgeztne-editor-workbench-v084b';

  const editor = document.getElementById('ewbEditor');
  const htmlPanel = document.getElementById('ewbHtmlPanel');
  const htmlField = document.getElementById('ewbHtml');
  const title = document.getElementById('ewbPageTitle');
  const status = document.getElementById('ewbStatus');
  const shell = document.querySelector('.ewb-shell');

  let pageId = '';
  let saveTimer = null;
  let savedRange = null;
  let dialogMode = '';

  const PALETTE = [
    '#ffffff', '#111827', '#60a5fa', '#38bdf8', '#34d399',
    '#f59e0b', '#fb7185', '#a78bfa', '#f97316', '#94a3b8',
    '#dbeafe', '#fef3c7', '#dcfce7', '#fee2e2', '#ede9fe'
  ];

  const TOOL_TITLES = {
    '[data-cmd="bold"]': 'Bold / Жирный',
    '[data-cmd="italic"]': 'Italic / Курсив',
    '[data-cmd="underline"]': 'Underline / Подчёркивание',
    '[data-cmd="strikeThrough"]': 'Strike / Зачёркивание',
    '[data-action="color"]': 'Text color / Цвет текста',
    '[data-action="highlight"]': 'Marker color / Цвет маркера',
    '[data-block="p"]': 'Paragraph / Абзац',
    '[data-block="h1"]': 'Heading 1 / Заголовок 1',
    '[data-block="h2"]': 'Heading 2 / Заголовок 2',
    '[data-block="h3"]': 'Heading 3 / Заголовок 3',
    '[data-block="blockquote"]': 'Quote / Цитата',
    '[data-cmd="insertUnorderedList"]': 'Bulleted list / Маркированный список',
    '[data-cmd="insertOrderedList"]': 'Numbered list / Нумерованный список',
    '[data-cmd="undo"]': 'Undo / Отменить',
    '[data-cmd="redo"]': 'Redo / Повторить',
    '[data-action="link"]': 'Insert link / Вставить ссылку',
    '[data-cmd="unlink"]': 'Remove link / Убрать ссылку',
    '[data-action="image"]': 'Insert image by URL / Вставить изображение по URL',
    '[data-action="video"]': 'Insert video/card / Вставить видео/карточку',
    '[data-action="emoji"]': 'Insert symbol/emoji / Вставить символ/emoji',
    '[data-action="divider"]': 'Divider / Разделитель',
    '[data-action="code"]': 'Code block / Блок кода',
    '[data-action="html"]': 'HTML source / HTML код',
    '[data-action="save"]': 'Save / Сохранить',
    '[data-action="preview"]': 'Preview / Предпросмотр'
  };

  function setStatus(text) {
    status.textContent = text || 'ready';
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeUrl(value) {
    let url = String(value || '').trim();
    if (!url || url === 'https://' || url === 'http://') return '';
    if (/^(https?:|mailto:|tel:|#|\/|data:)/i.test(url)) return url;
    return 'https://' + url;
  }

  function isDirectVideo(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || ''));
  }

  function isWebVideoService(url) {
    try {
      const u = new URL(url);
      return /youtube\.com|youtu\.be|vimeo\.com/i.test(u.hostname);
    } catch {
      return false;
    }
  }

  function videoMarkup(url, caption) {
    caption = caption || 'Video';
    if (isDirectVideo(url)) {
      return `<figure class="ewb-video"><video controls src="${esc(url)}"></video><figcaption>${esc(caption)}</figcaption></figure><p><br></p>`;
    }

    if (isWebVideoService(url)) {
      return `<figure class="ewb-video-card"><a href="${esc(url)}" target="_blank" rel="noopener">▶ ${esc(caption)}</a><figcaption>${esc(url)}</figcaption></figure><p><br></p>`;
    }

    return `<figure class="ewb-video-card"><a href="${esc(url)}" target="_blank" rel="noopener">▶ ${esc(caption)}</a><figcaption>${esc(url)}</figcaption></figure><p><br></p>`;
  }

  function send(type, extra = {}) {
    window.parent.postMessage({
      source: SOURCE_CHILD,
      type,
      pageId,
      bodyHtml: editor.innerHTML || '',
      ...extra
    }, '*');
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    setStatus('editing…');
    saveTimer = setTimeout(() => {
      send('save');
      setStatus('saved');
    }, 250);
  }

  function selectionInsideEditor() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const node = selection.anchorNode;
    return !!(node && editor.contains(node.nodeType === 1 ? node : node.parentNode));
  }

  function saveSelection() {
    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !selectionInsideEditor()) return;
      savedRange = selection.getRangeAt(0).cloneRange();
    } catch {}
  }

  function restoreSelection() {
    try {
      if (!savedRange) return false;
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return true;
    } catch {
      return false;
    }
  }

  function focusEditor() {
    editor.focus();
    restoreSelection();
    return editor;
  }

  function selectedText() {
    try {
      restoreSelection();
      const selection = window.getSelection();
      return selection ? String(selection.toString() || '') : '';
    } catch {
      return '';
    }
  }

  // IRGEZTNE_V084F_RELIABLE_UNLINK
  function closestLinkFromNodeV084F(node) {
    if (!node) return null;
    const element = node.nodeType === 1 ? node : node.parentElement;
    return element && element.closest ? element.closest('a') : null;
  }

  function unwrapLinkV084F(link) {
    if (!link || !link.parentNode) return false;
    const parent = link.parentNode;
    while (link.firstChild) {
      parent.insertBefore(link.firstChild, link);
    }
    parent.removeChild(link);
    return true;
  }

  function removeCurrentLinkV084F() {
    focusEditor();
    restoreSelection();

    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return false;

      const range = selection.getRangeAt(0);
      let link =
        closestLinkFromNodeV084F(selection.anchorNode) ||
        closestLinkFromNodeV084F(selection.focusNode) ||
        closestLinkFromNodeV084F(range.commonAncestorContainer);

      if (link && editor.contains(link)) {
        unwrapLinkV084F(link);
        savedRange = null;
        scheduleSave();
        setStatus('link removed');
        return true;
      }

      document.execCommand('unlink', false, null);
      saveSelection();
      scheduleSave();
      setStatus('link removed');
      return true;
    } catch (error) {
      console.warn('Editor unlink failed', error);
      return false;
    }
  }

  function exec(command, value = null) {
    focusEditor();
    try {
      document.execCommand(command, false, value);
      saveSelection();
      scheduleSave();
      return true;
    } catch (error) {
      console.warn('Editor command failed', command, error);
      return false;
    }
  }

  function insertHtml(html) {
    focusEditor();
    try {
      document.execCommand('insertHTML', false, html);
      saveSelection();
      scheduleSave();
      return true;
    } catch (error) {
      console.warn('Editor insert failed', error);
      return false;
    }
  }

  function block(tag) {
    tag = String(tag || 'p').toLowerCase();
    focusEditor();
    try {
      document.execCommand('formatBlock', false, tag);
      saveSelection();
      scheduleSave();
    } catch (error) {
      console.warn('Editor block failed', tag, error);
    }
  }

  function applyHtmlToVisual() {
    editor.innerHTML = htmlField.value || '<p><br></p>';
    htmlPanel.hidden = true;
    focusEditor();
    saveSelection();
    send('save');
    setStatus('saved');
  }

  function toggleHtml() {
    if (htmlPanel.hidden) {
      htmlField.value = editor.innerHTML || '';
      htmlPanel.hidden = false;
      htmlField.focus();
      setStatus('html');
    } else {
      applyHtmlToVisual();
    }
  }

  function ensureDialog() {
    let dialog = document.getElementById('ewbDialog');
    if (dialog) return dialog;

    dialog = document.createElement('section');
    dialog.id = 'ewbDialog';
    dialog.className = 'ewb-dialog';
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="ewb-dialog-card" role="dialog" aria-modal="true">
        <header class="ewb-dialog-head">
          <strong id="ewbDialogTitle">Insert</strong>
          <button type="button" class="ewb-dialog-close" data-dialog-close="1" title="Close / Закрыть">×</button>
        </header>
        <div class="ewb-dialog-body" data-dialog-body="1"></div>
        <footer class="ewb-dialog-foot">
          <button type="button" data-dialog-apply="1" class="is-primary">Insert / Вставить</button>
          <button type="button" data-dialog-close="1">Cancel / Отмена</button>
        </footer>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.addEventListener('click', (event) => {
      const close = event.target.closest('[data-dialog-close]');
      if (close) {
        closeDialog();
        return;
      }

      const emoji = event.target.closest('[data-emoji-value]');
      if (emoji) {
        insertHtml(esc(emoji.dataset.emojiValue || ''));
        closeDialog();
        return;
      }

      const swatch = event.target.closest('[data-color-value]');
      if (swatch) {
        const color = swatch.dataset.colorValue || '';
        if (dialogMode === 'color') exec('foreColor', color);
        if (dialogMode === 'highlight') exec('hiliteColor', color);
        closeDialog();
        return;
      }

      const apply = event.target.closest('[data-dialog-apply]');
      if (apply) applyDialog();
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDialog();
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) applyDialog();
    });

    return dialog;
  }

  function closeDialog() {
    const dialog = ensureDialog();
    dialog.hidden = true;
    dialogMode = '';
    focusEditor();
  }

  function dialogInput(name) {
    return ensureDialog().querySelector(`[data-field="${name}"]`);
  }

  function paletteHtml() {
    return `<div class="ewb-color-grid">${PALETTE.map(color => `<button type="button" style="--swatch:${esc(color)}" data-color-value="${esc(color)}" title="${esc(color)}"></button>`).join('')}</div>
      <label>Pick color <input data-field="nativeColor" type="color" value="#60a5fa"></label>
      <label>Custom color <input data-field="customColor" type="text" placeholder="#60a5fa"></label>`;
  }

  function openDialog(mode) {
    saveSelection();
    dialogMode = mode;
    const dialog = ensureDialog();
    const heading = dialog.querySelector('#ewbDialogTitle');
    const body = dialog.querySelector('[data-dialog-body]');
    const applyBtn = dialog.querySelector('[data-dialog-apply]');
    const selected = selectedText();

    applyBtn.hidden = false;

    if (mode === 'link') {
      heading.textContent = 'Insert link / Вставить ссылку';
      body.innerHTML = `
        <label>URL <input data-field="url" type="url" placeholder="https://example.com"></label>
        <label>Text / Текст <input data-field="text" type="text" placeholder="${esc(selected || 'Link text')}"></label>
        <p class="ewb-dialog-note">If text is empty, selected text will become the link.</p>
      `;
    }

    if (mode === 'image') {
      heading.textContent = 'Insert image / Вставить изображение';
      body.innerHTML = `
        <label>Image URL <input data-field="url" type="url" placeholder="https://example.com/image.jpg"></label>
        <label>Caption / Alt <input data-field="caption" type="text" placeholder="Image caption"></label>
      `;
    }

    if (mode === 'video') {
      heading.textContent = 'Insert video / Вставить видео';
      body.innerHTML = `
        <label>Video URL <input data-field="url" type="url" placeholder="https://youtube.com/watch?v=..."></label>
        <label>Caption <input data-field="caption" type="text" placeholder="Video"></label>
        <p class="ewb-dialog-note">YouTube/Vimeo are inserted as clean video links. Direct .mp4/.webm/.ogg are inserted as playable video.</p>
      `;
    }

    if (mode === 'emoji') {
      heading.textContent = 'Symbol / emoji';
      body.innerHTML = `
        <div class="ewb-emoji-grid">
          ${['🙂','😀','✨','🚀','✅','📌','🔥','🌿','💡','⭐','→','—','©','®','™','§','№','•','✓','✕'].map(item => `<button type="button" data-emoji-value="${esc(item)}">${esc(item)}</button>`).join('')}
        </div>
        <label>Custom <input data-field="custom" type="text" placeholder="🙂"></label>
      `;
    }

    if (mode === 'color') {
      heading.textContent = 'Text color / Цвет текста';
      body.innerHTML = paletteHtml();
    }

    if (mode === 'highlight') {
      heading.textContent = 'Marker color / Цвет маркера';
      body.innerHTML = paletteHtml();
    }

    dialog.hidden = false;
    setTimeout(() => {
      const first = dialog.querySelector('input, button[data-emoji-value], button[data-color-value]');
      if (first) first.focus();
    }, 20);
  }

  function applyDialog() {
    if (!dialogMode) return;

    if (dialogMode === 'link') {
      const url = normalizeUrl(dialogInput('url')?.value || '');
      const customText = String(dialogInput('text')?.value || '').trim();
      const selected = selectedText();

      if (!url) {
        dialogInput('url')?.focus();
        return;
      }

      if (selected && !customText) exec('createLink', url);
      else insertHtml(`<a href="${esc(url)}">${esc(customText || selected || url)}</a>`);
      closeDialog();
      return;
    }

    if (dialogMode === 'image') {
      const url = normalizeUrl(dialogInput('url')?.value || '');
      const caption = String(dialogInput('caption')?.value || '').trim();

      if (!url) {
        dialogInput('url')?.focus();
        return;
      }

      insertHtml(`<figure><img src="${esc(url)}" alt="${esc(caption)}">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure><p><br></p>`);
      closeDialog();
      return;
    }

    if (dialogMode === 'video') {
      const url = normalizeUrl(dialogInput('url')?.value || '');
      const caption = String(dialogInput('caption')?.value || '').trim() || 'Video';

      if (!url) {
        dialogInput('url')?.focus();
        return;
      }

      insertHtml(videoMarkup(url, caption));
      closeDialog();
      return;
    }

    if (dialogMode === 'emoji') {
      const custom = String(dialogInput('custom')?.value || '').trim();
      if (custom) insertHtml(esc(custom));
      closeDialog();
      return;
    }

    if (dialogMode === 'color' || dialogMode === 'highlight') {
      const nativeColor = String(dialogInput('nativeColor')?.value || '').trim();
      const customColor = String(dialogInput('customColor')?.value || '').trim();
      const color = customColor || nativeColor;
      if (!/^#[0-9a-f]{3,8}$/i.test(color)) {
        (dialogInput('customColor') || dialogInput('nativeColor'))?.focus();
        return;
      }
      exec(dialogMode === 'color' ? 'foreColor' : 'hiliteColor', color);
      closeDialog();
    }
  }

  function initToolbarTitles() {
    Object.keys(TOOL_TITLES).forEach((selector) => {
      const list = document.querySelectorAll(selector);
      list.forEach((el) => {
        el.title = TOOL_TITLES[selector];
        el.setAttribute('aria-label', TOOL_TITLES[selector]);
      });
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.closest('#ewbDialog')) return;

    event.preventDefault();

    if (button.dataset.cmd) {
      if (button.dataset.cmd === 'unlink') {
        removeCurrentLinkV084F();
        return;
      }
      exec(button.dataset.cmd);
      return;
    }

    if (button.dataset.block) {
      block(button.dataset.block);
      return;
    }

    const action = button.dataset.action || '';

    if (action === 'link') return openDialog('link');
    if (action === 'image') return openDialog('image');
    if (action === 'video') return openDialog('video');
    if (action === 'emoji') return openDialog('emoji');
    if (action === 'color') return openDialog('color');
    if (action === 'highlight') return openDialog('highlight');

    if (action === 'divider') {
      insertHtml('<hr><p><br></p>');
      return;
    }

    if (action === 'code') {
      insertHtml('<pre><code>Code</code></pre><p><br></p>');
      return;
    }

    if (action === 'html') {
      toggleHtml();
      return;
    }

    if (action === 'html-apply') {
      applyHtmlToVisual();
      return;
    }

    if (action === 'html-close') {
      htmlPanel.hidden = true;
      focusEditor();
      return;
    }

    if (action === 'save') {
      send('save');
      setStatus('saved');
      return;
    }

    if (action === 'preview') {
      send('preview');
      setStatus('preview');
    }
  });

  editor.addEventListener('input', () => {
    saveSelection();
    scheduleSave();
  });

  editor.addEventListener('keyup', saveSelection);
  editor.addEventListener('mouseup', saveSelection);
  editor.addEventListener('focus', saveSelection);
  editor.addEventListener('scroll', saveSelection);

  htmlField.addEventListener('input', () => {
    scheduleSave();
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (!data || data.source !== SOURCE_PARENT || data.type !== 'init') return;

    pageId = String(data.pageId || '');
    title.textContent = data.pageLabel || 'Page';
    shell.dataset.theme = data.theme === 'light' ? 'light' : 'dark';

    const html = String(data.bodyHtml || '').trim() || '<p><br></p>';
    editor.innerHTML = html;
    htmlField.value = html;
    setStatus('ready');

    setTimeout(() => {
      try {
        editor.focus();
        saveSelection();
      } catch {}
    }, 80);
  });

  initToolbarTitles();

  window.parent.postMessage({ source: SOURCE_CHILD, type: 'ready' }, '*');
})();
