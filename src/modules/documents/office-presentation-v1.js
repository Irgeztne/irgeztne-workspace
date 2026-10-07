(function (root) {
  'use strict';

  var LAYOUTS = ['title', 'content', 'two-column', 'blank'];

  function clone(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return fallback; }
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function clamp(value, min, max) {
    value = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
  }

  function textBlock(seed) {
    seed = seed || {};
    return {
      id: String(seed.id || uid('block')),
      type: 'text',
      text: String(seed.text || ''),
      x: clamp(seed.x == null ? 10 : seed.x, 0, 95),
      y: clamp(seed.y == null ? 12 : seed.y, 0, 95),
      width: clamp(seed.width == null ? 80 : seed.width, 8, 100),
      height: clamp(seed.height == null ? 24 : seed.height, 8, 100),
      style: String(seed.style || 'body')
    };
  }

  function imageBlock(seed) {
    seed = seed || {};
    return {
      id: String(seed.id || uid('block')),
      type: 'image',
      fileId: String(seed.fileId || ''),
      name: String(seed.name || 'Image'),
      src: String(seed.src || ''),
      alt: String(seed.alt || seed.name || 'Image'),
      x: clamp(seed.x == null ? 52 : seed.x, 0, 95),
      y: clamp(seed.y == null ? 24 : seed.y, 0, 95),
      width: clamp(seed.width == null ? 38 : seed.width, 8, 100),
      height: clamp(seed.height == null ? 54 : seed.height, 8, 100)
    };
  }

  function defaultsForLayout(layout, locale) {
    var ru = locale === 'ru';
    if (layout === 'blank') return [];
    if (layout === 'title') return [
      textBlock({ text: ru ? 'Название презентации' : 'Presentation title', x: 9, y: 28, width: 82, height: 18, style: 'title' }),
      textBlock({ text: ru ? 'Подзаголовок' : 'Subtitle', x: 18, y: 52, width: 64, height: 12, style: 'subtitle' })
    ];
    if (layout === 'two-column') return [
      textBlock({ text: ru ? 'Заголовок слайда' : 'Slide title', x: 7, y: 7, width: 86, height: 14, style: 'heading' }),
      textBlock({ text: ru ? 'Левая колонка' : 'Left column', x: 7, y: 28, width: 40, height: 58 }),
      textBlock({ text: ru ? 'Правая колонка' : 'Right column', x: 53, y: 28, width: 40, height: 58 })
    ];
    return [
      textBlock({ text: ru ? 'Заголовок слайда' : 'Slide title', x: 7, y: 7, width: 86, height: 14, style: 'heading' }),
      textBlock({ text: ru ? 'Добавьте содержимое' : 'Add your content', x: 10, y: 30, width: 80, height: 50 })
    ];
  }

  function normalizeBlock(block) {
    return block && block.type === 'image' ? imageBlock(block) : textBlock(block);
  }

  function normalizeSlide(slide, index, locale) {
    slide = slide && typeof slide === 'object' ? clone(slide, {}) : {};
    var layout = LAYOUTS.indexOf(String(slide.layout)) !== -1 ? String(slide.layout) : 'content';
    return {
      id: String(slide.id || uid('slide')),
      title: String(slide.title || (locale === 'ru' ? 'Слайд ' : 'Slide ') + (index + 1)),
      layout: layout,
      background: String(slide.background || '#f8fbff'),
      blocks: Array.isArray(slide.blocks) ? slide.blocks.map(normalizeBlock) : defaultsForLayout(layout, locale)
    };
  }

  function normalizePayload(payload) {
    payload = payload && typeof payload === 'object' ? clone(payload, {}) : {};
    var locale = payload.locale === 'ru' ? 'ru' : 'en';
    var slides = Array.isArray(payload.slides) && payload.slides.length
      ? payload.slides.map(function (slide, index) { return normalizeSlide(slide, index, locale); })
      : [normalizeSlide({ layout: 'title' }, 0, locale)];
    var activeSlideId = String(payload.activeSlideId || '');
    if (!slides.some(function (slide) { return slide.id === activeSlideId; })) activeSlideId = slides[0].id;
    return { slides: slides, activeSlideId: activeSlideId, locale: locale };
  }

  function createPayload(options) {
    options = options || {};
    var locale = options.locale === 'ru' ? 'ru' : 'en';
    var first = normalizeSlide({ layout: 'title', title: options.title || (locale === 'ru' ? 'Слайд 1' : 'Slide 1') }, 0, locale);
    if (options.title) first.blocks[0].text = String(options.title);
    return { slides: [first], activeSlideId: first.id, locale: locale };
  }

  function getSlide(payload, slideId) {
    var slides = payload && Array.isArray(payload.slides) ? payload.slides : [];
    return slides.find(function (slide) { return slide.id === String(slideId || payload.activeSlideId || ''); }) || slides[0] || null;
  }

  function addSlide(payload, layout, locale) {
    layout = LAYOUTS.indexOf(layout) !== -1 ? layout : 'content';
    locale = payload.locale === 'ru' || payload.locale === 'en'
      ? payload.locale
      : (locale === 'ru' ? 'ru' : 'en');
    payload.locale = locale;
    var slide = normalizeSlide({ layout: layout, title: (locale === 'ru' ? 'Слайд ' : 'Slide ') + (payload.slides.length + 1) }, payload.slides.length, locale);
    payload.slides.push(slide);
    payload.activeSlideId = slide.id;
    return slide;
  }

  function duplicateSlide(payload, slideId) {
    var source = getSlide(payload, slideId);
    if (!source) return null;
    var contentLocale = payload.locale === 'ru' ? 'ru' : 'en';
    var copy = normalizeSlide(Object.assign(clone(source, {}), {
      id: uid('slide'), title: source.title + (contentLocale === 'ru' ? ' · копия' : ' · copy'),
      blocks: source.blocks.map(function (block) { return Object.assign({}, block, { id: uid('block') }); })
    }), payload.slides.length);
    var index = payload.slides.indexOf(source);
    payload.slides.splice(index + 1, 0, copy);
    payload.activeSlideId = copy.id;
    return copy;
  }

  function removeSlide(payload, slideId) {
    if (!payload.slides || payload.slides.length <= 1) return false;
    var index = payload.slides.findIndex(function (slide) { return slide.id === slideId; });
    if (index < 0) return false;
    payload.slides.splice(index, 1);
    payload.activeSlideId = payload.slides[Math.min(index, payload.slides.length - 1)].id;
    return true;
  }

  function moveSlide(payload, slideId, direction) {
    var index = payload.slides.findIndex(function (slide) { return slide.id === slideId; });
    var target = clamp(index + Number(direction || 0), 0, payload.slides.length - 1);
    if (index < 0 || target === index) return false;
    var moved = payload.slides.splice(index, 1)[0];
    payload.slides.splice(target, 0, moved);
    return true;
  }

  function addTextBlock(payload, slideId, seed) {
    var slide = getSlide(payload, slideId);
    if (!slide) return null;
    var block = textBlock(seed);
    slide.blocks.push(block);
    return block;
  }

  function addImageBlock(payload, slideId, seed) {
    var slide = getSlide(payload, slideId);
    if (!slide) return null;
    var block = imageBlock(seed);
    slide.blocks.push(block);
    return block;
  }

  function updateBlock(payload, slideId, blockId, patch) {
    var slide = getSlide(payload, slideId);
    var block = slide && slide.blocks.find(function (entry) { return entry.id === blockId; });
    if (!block || !patch) return null;
    if (patch.text != null && block.type === 'text') block.text = String(patch.text);
    ['x', 'y', 'width', 'height'].forEach(function (key) {
      if (patch[key] != null) block[key] = clamp(patch[key], key === 'width' || key === 'height' ? 8 : 0, 100);
    });
    if (patch.style != null && block.type === 'text') block.style = String(patch.style);
    return block;
  }

  function removeBlock(payload, slideId, blockId) {
    var slide = getSlide(payload, slideId);
    if (!slide) return false;
    var length = slide.blocks.length;
    slide.blocks = slide.blocks.filter(function (block) { return block.id !== blockId; });
    return slide.blocks.length !== length;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeCssColor(value) {
    return /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\))$/i.test(String(value || '')) ? String(value) : '#f8fbff';
  }

  function blockStyle(block) {
    return 'left:' + block.x + '%;top:' + block.y + '%;width:' + block.width + '%;height:' + block.height + '%';
  }

  function renderBlock(block, editable) {
    var common = ' class="ns-office-presentation__block ns-office-presentation__block--' + block.type + (block.style ? ' is-' + escapeHtml(block.style) : '') + '" style="' + blockStyle(block) + '" data-presentation-block="' + escapeHtml(block.id) + '"';
    if (block.type === 'image') {
      return '<div' + common + '><img src="' + escapeHtml(block.src) + '" alt="' + escapeHtml(block.alt) + '">' + (editable ? '<button type="button" data-presentation-remove-block="' + escapeHtml(block.id) + '" aria-label="Delete">×</button><i data-presentation-resize="' + escapeHtml(block.id) + '"></i>' : '') + '</div>';
    }
    return '<div' + common + '>' + (editable
      ? '<textarea data-presentation-text="' + escapeHtml(block.id) + '" aria-label="Text block">' + escapeHtml(block.text) + '</textarea><button type="button" data-presentation-remove-block="' + escapeHtml(block.id) + '" aria-label="Delete">×</button><i data-presentation-resize="' + escapeHtml(block.id) + '"></i>'
      : '<div>' + escapeHtml(block.text).replace(/\n/g, '<br>') + '</div>') + '</div>';
  }

  function renderCanvas(slide, editable) {
    return '<div class="ns-office-presentation__canvas" data-presentation-canvas style="background:' + safeCssColor(slide.background) + '">' + slide.blocks.map(function (block) { return renderBlock(block, editable); }).join('') + '</div>';
  }

  function buildHtml(object, locale) {
    var payload = normalizePayload(object && object.payload);
    var title = escapeHtml(object && object.title || 'Presentation');
    var slides = payload.slides.map(function (slide, index) {
      return '<section class="slide" aria-label="Slide ' + (index + 1) + '" style="background:' + safeCssColor(slide.background) + '">' + slide.blocks.map(function (block) { return renderBlock(block, false); }).join('') + '</section>';
    }).join('\n');
    return '<!doctype html><html lang="' + (locale === 'ru' ? 'ru' : 'en') + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>*{box-sizing:border-box}body{margin:0;background:#07111f;color:#102033;font-family:Inter,system-ui,sans-serif}.slide{position:relative;width:min(94vw,1280px);aspect-ratio:16/9;margin:4vh auto;overflow:hidden;border-radius:18px;box-shadow:0 24px 70px #0008}.ns-office-presentation__block{position:absolute;overflow:hidden}.ns-office-presentation__block>div{width:100%;height:100%;white-space:pre-wrap;font-size:clamp(16px,2.2vw,36px)}.ns-office-presentation__block.is-title>div{font-size:clamp(34px,5vw,72px);font-weight:900}.ns-office-presentation__block.is-heading>div{font-size:clamp(26px,4vw,54px);font-weight:850}.ns-office-presentation__block.is-subtitle>div{font-size:clamp(18px,2.6vw,36px);color:#53667e}.ns-office-presentation__block img{width:100%;height:100%;object-fit:cover;border-radius:16px}@media print{body{background:#fff}.slide{width:100vw;height:56.25vw;margin:0;border-radius:0;box-shadow:none;break-after:page}}</style></head><body>' + slides + '</body></html>';
  }

  function render(object, locale, files) {
    var ru = locale === 'ru';
    var payload = normalizePayload(object && object.payload);
    var slide = getSlide(payload, payload.activeSlideId);
    files = Array.isArray(files) ? files.filter(function (file) { return file && file.id && file.storage && file.storage.dataUrl && String(file.type || file.mime || '').includes('image'); }) : [];
    function t(ruText, enText) { return ru ? ruText : enText; }
    var layoutLabels = { title: t('Титульный', 'Title'), content: t('Содержание', 'Content'), 'two-column': t('Две колонки', 'Two columns'), blank: t('Пустой', 'Blank') };
    return [
      '<section class="ns-office-presentation" data-office-presentation data-office-id="' + escapeHtml(object.id) + '">',
      '<div class="ns-office-presentation__toolbar">',
      '<input class="ns-office-presentation__object-title" data-presentation-title value="' + escapeHtml(object.title || '') + '" aria-label="' + escapeHtml(t('Название презентации', 'Presentation title')) + '" placeholder="' + escapeHtml(t('Название презентации', 'Presentation title')) + '">',
      '<select data-presentation-new-layout>' + LAYOUTS.map(function (layout) { return '<option value="' + layout + '">' + escapeHtml(layoutLabels[layout]) + '</option>'; }).join('') + '</select>',
      '<button type="button" data-presentation-action="add-slide">' + escapeHtml(t('Новый слайд', 'New slide')) + '</button>',
      '<button type="button" data-presentation-action="duplicate-slide">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button>',
      '<button type="button" data-presentation-action="remove-slide"' + (payload.slides.length <= 1 ? ' disabled' : '') + '>' + escapeHtml(t('Удалить слайд', 'Delete slide')) + '</button>',
      '<button type="button" data-presentation-action="move-left">←</button><button type="button" data-presentation-action="move-right">→</button>',
      '<button type="button" data-presentation-action="add-text">' + escapeHtml(t('Текст', 'Text')) + '</button>',
      '<select data-presentation-file><option value="">' + escapeHtml(t('Изображение из Files…', 'Image from Files…')) + '</option>' + files.map(function (file) { return '<option value="' + escapeHtml(file.id) + '">' + escapeHtml(file.name || file.originalName || file.id) + '</option>'; }).join('') + '</select>',
      '<button type="button" data-presentation-action="add-image">' + escapeHtml(t('Добавить изображение', 'Add image')) + '</button>',
      '<button type="button" data-presentation-action="preview">' + escapeHtml(t('Предпросмотр', 'Preview')) + '</button>',
      '<button type="button" data-presentation-action="export-html">' + escapeHtml(t('Экспорт HTML', 'Export HTML')) + '</button>',
      '</div>',
      '<div class="ns-office-presentation__work">',
      '<nav class="ns-office-presentation__slides" aria-label="' + escapeHtml(t('Слайды', 'Slides')) + '">' + payload.slides.map(function (entry, index) { return '<button type="button" class="' + (entry.id === slide.id ? 'is-active' : '') + '" data-presentation-open="' + escapeHtml(entry.id) + '"><span>' + (index + 1) + '</span><strong>' + escapeHtml(entry.title) + '</strong></button>'; }).join('') + '</nav>',
      '<main class="ns-office-presentation__stage"><div class="ns-office-presentation__slide-meta"><input data-presentation-slide-title value="' + escapeHtml(slide.title) + '" aria-label="' + escapeHtml(t('Название слайда', 'Slide title')) + '"><select data-presentation-layout>' + LAYOUTS.map(function (layout) { return '<option value="' + layout + '"' + (slide.layout === layout ? ' selected' : '') + '>' + escapeHtml(layoutLabels[layout]) + '</option>'; }).join('') + '</select><input type="color" data-presentation-background value="' + escapeHtml(safeCssColor(slide.background)) + '" aria-label="' + escapeHtml(t('Фон', 'Background')) + '"></div>' + renderCanvas(slide, true) + '<p>' + escapeHtml(t('Перетаскивайте блоки; маркер в углу изменяет размер.', 'Drag blocks; use the corner handle to resize.')) + '</p></main>',
      '</div>',
      '<div class="ns-office-presentation__preview" data-presentation-preview hidden><div><button type="button" data-presentation-action="preview-close">×</button>' + renderCanvas(slide, false) + '</div></div>',
      '</section>'
    ].join('');
  }

  function bind(container, object, api) {
    if (!container || !object || !api) return;
    var host = container.querySelector('[data-office-presentation]');
    if (!host || host.dataset.bound) return;
    host.dataset.bound = 'true';
    function payload() { return normalizePayload(object.payload); }
    function save(next, message) { api.save(next, message); }

    host.addEventListener('change', function (event) {
      var target = event.target;
      if (target.matches('[data-presentation-title]')) { api.updateTitle(target.value); return; }
      var next = payload();
      var slide = getSlide(next, next.activeSlideId);
      if (target.matches('[data-presentation-slide-title]')) slide.title = target.value;
      else if (target.matches('[data-presentation-layout]')) slide.layout = LAYOUTS.indexOf(target.value) !== -1 ? target.value : 'content';
      else if (target.matches('[data-presentation-background]')) slide.background = target.value;
      else if (target.matches('[data-presentation-text]')) updateBlock(next, slide.id, target.getAttribute('data-presentation-text'), { text: target.value });
      else return;
      save(next, api.t('Презентация сохранена.', 'Presentation saved.'));
    });

    host.addEventListener('click', function (event) {
      var open = event.target.closest('[data-presentation-open]');
      if (open) { var opened = payload(); opened.activeSlideId = open.getAttribute('data-presentation-open'); save(opened); return; }
      var remove = event.target.closest('[data-presentation-remove-block]');
      if (remove) { var without = payload(); removeBlock(without, without.activeSlideId, remove.getAttribute('data-presentation-remove-block')); save(without); return; }
      var button = event.target.closest('[data-presentation-action]');
      if (!button || button.disabled) return;
      var action = button.getAttribute('data-presentation-action');
      if (action === 'preview' || action === 'preview-close') {
        var preview = host.querySelector('[data-presentation-preview]');
        if (preview) preview.hidden = action === 'preview-close';
        return;
      }
      var next = payload();
      var slide = getSlide(next, next.activeSlideId);
      if (action === 'add-slide') addSlide(next, host.querySelector('[data-presentation-new-layout]').value, api.locale);
      else if (action === 'duplicate-slide') duplicateSlide(next, slide.id);
      else if (action === 'remove-slide') { if (!api.confirm(api.t('Удалить этот слайд?', 'Delete this slide?'))) return; removeSlide(next, slide.id); }
      else if (action === 'move-left') moveSlide(next, slide.id, -1);
      else if (action === 'move-right') moveSlide(next, slide.id, 1);
      else if (action === 'add-text') addTextBlock(next, slide.id, { text: next.locale === 'ru' ? 'Новый текст' : 'New text' });
      else if (action === 'add-image') {
        var select = host.querySelector('[data-presentation-file]');
        var file = api.getFiles().find(function (entry) { return entry.id === (select && select.value); });
        if (!file || !file.storage || !file.storage.dataUrl) { api.notice(api.t('Выберите изображение из Files.', 'Choose an image from Files.')); return; }
        addImageBlock(next, slide.id, { fileId: file.id, name: file.name || file.id, src: file.storage.dataUrl, alt: file.name || 'Image' });
        if (object.relations && object.relations.fileIds.indexOf(file.id) === -1) api.addFileRelation(file.id);
      } else if (action === 'export-html') { api.download((object.title || 'presentation') + '.html', 'text/html;charset=utf-8', buildHtml(Object.assign({}, object, { payload: next }), api.locale)); return; }
      else return;
      save(next, api.t('Презентация сохранена.', 'Presentation saved.'));
    });

    var drag = null;
    host.addEventListener('pointerdown', function (event) {
      var blockNode = event.target.closest('[data-presentation-block]');
      if (!blockNode || event.target.closest('textarea,button')) return;
      var canvas = blockNode.closest('[data-presentation-canvas]');
      var resize = event.target.closest('[data-presentation-resize]');
      var next = payload();
      var slide = getSlide(next, next.activeSlideId);
      var block = slide.blocks.find(function (entry) { return entry.id === blockNode.getAttribute('data-presentation-block'); });
      if (!canvas || !block) return;
      var rect = canvas.getBoundingClientRect();
      drag = { next: next, slide: slide, block: block, node: blockNode, rect: rect, startX: event.clientX, startY: event.clientY, x: block.x, y: block.y, width: block.width, height: block.height, resize: Boolean(resize) };
      event.preventDefault();
      if (blockNode.setPointerCapture) blockNode.setPointerCapture(event.pointerId);
    });
    host.addEventListener('pointermove', function (event) {
      if (!drag) return;
      var dx = (event.clientX - drag.startX) / drag.rect.width * 100;
      var dy = (event.clientY - drag.startY) / drag.rect.height * 100;
      if (drag.resize) {
        drag.block.width = clamp(drag.width + dx, 8, 100 - drag.block.x);
        drag.block.height = clamp(drag.height + dy, 8, 100 - drag.block.y);
      } else {
        drag.block.x = clamp(drag.x + dx, 0, 100 - drag.block.width);
        drag.block.y = clamp(drag.y + dy, 0, 100 - drag.block.height);
      }
      drag.node.style.cssText = blockStyle(drag.block);
    });
    host.addEventListener('pointerup', function () {
      if (!drag) return;
      var done = drag;
      drag = null;
      save(done.next, api.t('Положение блока сохранено.', 'Block position saved.'));
    });
  }

  root.NSOfficePresentationV1 = Object.freeze({
    LAYOUTS: Object.freeze(LAYOUTS.slice()),
    createPayload: createPayload,
    normalizePayload: normalizePayload,
    addSlide: addSlide,
    duplicateSlide: duplicateSlide,
    removeSlide: removeSlide,
    moveSlide: moveSlide,
    addTextBlock: addTextBlock,
    addImageBlock: addImageBlock,
    updateBlock: updateBlock,
    removeBlock: removeBlock,
    buildHtml: buildHtml,
    render: render,
    bind: bind
  });
})(window);
