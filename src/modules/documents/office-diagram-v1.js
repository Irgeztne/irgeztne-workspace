(function (root) {
  'use strict';

  var WIDTH = 1200;
  var HEIGHT = 720;
  var TYPES = ['rectangle', 'ellipse', 'text', 'line', 'arrow'];

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

  function normalizeElement(element, index) {
    element = element && typeof element === 'object' ? clone(element, {}) : {};
    var type = TYPES.indexOf(String(element.type)) !== -1 ? String(element.type) : 'rectangle';
    var isEdge = type === 'line' || type === 'arrow';
    return {
      id: String(element.id || uid('diagram')),
      type: type,
      x: clamp(element.x == null ? 80 + index * 18 : element.x, 0, WIDTH),
      y: clamp(element.y == null ? 80 + index * 18 : element.y, 0, HEIGHT),
      x2: clamp(element.x2 == null ? 360 + index * 18 : element.x2, 0, WIDTH),
      y2: clamp(element.y2 == null ? 180 + index * 18 : element.y2, 0, HEIGHT),
      width: clamp(element.width == null ? (type === 'text' ? 280 : 220) : element.width, 30, WIDTH),
      height: clamp(element.height == null ? (type === 'text' ? 70 : 130) : element.height, 24, HEIGHT),
      text: String(element.text || (type === 'text' ? 'Text' : '')),
      fill: String(element.fill || (isEdge ? 'none' : '#dcecff')),
      stroke: String(element.stroke || '#2f7be6'),
      strokeWidth: clamp(element.strokeWidth == null ? 3 : element.strokeWidth, 1, 16)
    };
  }

  function normalizePayload(payload) {
    payload = payload && typeof payload === 'object' ? clone(payload, {}) : {};
    var locale = payload.locale === 'ru' || payload.locale === 'en' ? payload.locale : '';
    var elements = Array.isArray(payload.elements) ? payload.elements.map(normalizeElement) : [];
    var selectedId = elements.some(function (element) { return element.id === payload.selectedId; }) ? String(payload.selectedId) : '';
    return { width: WIDTH, height: HEIGHT, zoom: clamp(payload.zoom == null ? 1 : payload.zoom, .25, 3), selectedId: selectedId, elements: elements, locale: locale };
  }

  function createPayload(seed) {
    seed = seed && typeof seed === 'object' ? seed : {};
    return { width: WIDTH, height: HEIGHT, zoom: 1, selectedId: '', elements: [], locale:seed.locale === 'ru' || seed.locale === 'en' ? seed.locale : '' };
  }

  function addElement(payload, type, seed) {
    if (TYPES.indexOf(type) === -1) throw new Error('Unsupported diagram element: ' + type);
    var element = normalizeElement(Object.assign({}, seed || {}, { type: type }), payload.elements.length);
    payload.elements.push(element);
    payload.selectedId = element.id;
    return element;
  }

  function getElement(payload, id) {
    return payload && Array.isArray(payload.elements)
      ? payload.elements.find(function (element) { return element.id === String(id || ''); }) || null
      : null;
  }

  function updateElement(payload, id, patch) {
    var element = getElement(payload, id);
    if (!element || !patch) return null;
    ['x', 'y', 'x2', 'y2'].forEach(function (key) {
      if (patch[key] != null) element[key] = clamp(patch[key], 0, key.charAt(0) === 'x' ? WIDTH : HEIGHT);
    });
    if (patch.width != null) element.width = clamp(patch.width, 30, WIDTH - element.x);
    if (patch.height != null) element.height = clamp(patch.height, 24, HEIGHT - element.y);
    if (patch.text != null) element.text = String(patch.text);
    ['fill', 'stroke'].forEach(function (key) { if (patch[key] != null) element[key] = String(patch[key]); });
    if (patch.strokeWidth != null) element.strokeWidth = clamp(patch.strokeWidth, 1, 16);
    return element;
  }

  function removeElement(payload, id) {
    var length = payload.elements.length;
    payload.elements = payload.elements.filter(function (element) { return element.id !== id; });
    if (payload.selectedId === id) payload.selectedId = '';
    return payload.elements.length !== length;
  }

  function moveLayer(payload, id, direction) {
    var index = payload.elements.findIndex(function (element) { return element.id === id; });
    if (index < 0) return false;
    var target = direction === 'front' ? payload.elements.length - 1
      : direction === 'back' ? 0
        : clamp(index + Number(direction || 0), 0, payload.elements.length - 1);
    if (target === index) return false;
    var element = payload.elements.splice(index, 1)[0];
    payload.elements.splice(target, 0, element);
    return true;
  }

  function setZoom(payload, zoom) {
    payload.zoom = clamp(zoom, .25, 3);
    return payload.zoom;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeColor(value, fallback) {
    return /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\)|rgba\([\d\s,.%]+\)|none)$/i.test(String(value || '')) ? String(value) : fallback;
  }

  function elementSvg(element, interactive) {
    var attributes = interactive ? ' data-diagram-element="' + escapeHtml(element.id) + '"' : '';
    var stroke = safeColor(element.stroke, '#2f7be6');
    var fill = safeColor(element.fill, '#dcecff');
    if (element.type === 'rectangle') return '<rect' + attributes + ' x="' + element.x + '" y="' + element.y + '" width="' + element.width + '" height="' + element.height + '" rx="16" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + element.strokeWidth + '"></rect>' + (element.text ? '<text x="' + (element.x + 16) + '" y="' + (element.y + 34) + '" fill="#10243d" font-size="22">' + escapeHtml(element.text) + '</text>' : '');
    if (element.type === 'ellipse') return '<ellipse' + attributes + ' cx="' + (element.x + element.width / 2) + '" cy="' + (element.y + element.height / 2) + '" rx="' + element.width / 2 + '" ry="' + element.height / 2 + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + element.strokeWidth + '"></ellipse>' + (element.text ? '<text x="' + (element.x + 20) + '" y="' + (element.y + element.height / 2 + 7) + '" fill="#10243d" font-size="22">' + escapeHtml(element.text) + '</text>' : '');
    if (element.type === 'text') return '<text' + attributes + ' x="' + element.x + '" y="' + (element.y + 28) + '" fill="' + stroke + '" font-size="26" font-family="Inter,system-ui,sans-serif">' + escapeHtml(element.text) + '</text>';
    return '<line' + attributes + ' x1="' + element.x + '" y1="' + element.y + '" x2="' + element.x2 + '" y2="' + element.y2 + '" stroke="' + stroke + '" stroke-width="' + element.strokeWidth + '" stroke-linecap="round"' + (element.type === 'arrow' ? ' marker-end="url(#arrowhead)"' : '') + '></line>';
  }

  function selectionSvg(element) {
    if (!element) return '';
    if (element.type === 'line' || element.type === 'arrow') {
      return '<circle class="ns-office-diagram__handle" data-diagram-resize="' + escapeHtml(element.id) + '" cx="' + element.x2 + '" cy="' + element.y2 + '" r="10"></circle>';
    }
    return '<rect class="ns-office-diagram__selection" x="' + (element.x - 5) + '" y="' + (element.y - 5) + '" width="' + (element.width + 10) + '" height="' + (element.height + 10) + '"></rect><rect class="ns-office-diagram__handle" data-diagram-resize="' + escapeHtml(element.id) + '" x="' + (element.x + element.width - 8) + '" y="' + (element.y + element.height - 8) + '" width="16" height="16" rx="4"></rect>';
  }

  function buildSvg(payload, options) {
    payload = normalizePayload(payload);
    options = options || {};
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT + '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" role="img" aria-label="' + escapeHtml(options.title || 'Diagram') + '"><defs><marker id="arrowhead" markerWidth="12" markerHeight="9" refX="10" refY="4.5" orient="auto"><path d="M0,0 L12,4.5 L0,9 z" fill="#2f7be6"></path></marker></defs><rect width="100%" height="100%" fill="#ffffff"></rect>' + payload.elements.map(function (element) { return elementSvg(element, false); }).join('') + '</svg>';
  }

  function exportPng(payload, title, onBlob, onError) {
    try {
      var svg = buildSvg(payload, { title: title });
      var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var image = new Image();
      image.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 960;
        var context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (result) {
          URL.revokeObjectURL(url);
          if (result && onBlob) onBlob(result);
          else if (!result && onError) onError(new Error('PNG encoding failed'));
        }, 'image/png');
      };
      image.onerror = function () { URL.revokeObjectURL(url); if (onError) onError(new Error('SVG render failed')); };
      image.src = url;
    } catch (error) { if (onError) onError(error); }
  }

  function render(object, locale) {
    var ru = locale === 'ru';
    var payload = normalizePayload(object && object.payload);
    var selected = getElement(payload, payload.selectedId);
    function t(ruText, enText) { return ru ? ruText : enText; }
    return [
      '<section class="ns-office-diagram" data-office-diagram data-office-id="' + escapeHtml(object.id) + '">',
      '<div class="ns-office-diagram__toolbar">',
      '<input class="ns-office-diagram__object-title" data-diagram-title value="' + escapeHtml(object.title || '') + '" aria-label="' + escapeHtml(t('Название диаграммы', 'Diagram title')) + '" placeholder="' + escapeHtml(t('Название диаграммы', 'Diagram title')) + '">',
      '<button type="button" data-diagram-action="rectangle">▭ ' + escapeHtml(t('Прямоугольник', 'Rectangle')) + '</button>',
      '<button type="button" data-diagram-action="ellipse">◯ ' + escapeHtml(t('Эллипс', 'Ellipse')) + '</button>',
      '<button type="button" data-diagram-action="text">T ' + escapeHtml(t('Текст', 'Text')) + '</button>',
      '<button type="button" data-diagram-action="line">╱ ' + escapeHtml(t('Линия', 'Line')) + '</button>',
      '<button type="button" data-diagram-action="arrow">→ ' + escapeHtml(t('Стрелка', 'Arrow')) + '</button>',
      '<button type="button" data-diagram-action="edit"' + (!selected || (selected.type !== 'text' && selected.type !== 'rectangle' && selected.type !== 'ellipse') ? ' disabled' : '') + '>' + escapeHtml(t('Изменить текст', 'Edit text')) + '</button>',
      '<button type="button" data-diagram-action="front"' + (!selected ? ' disabled' : '') + '>↑ ' + escapeHtml(t('На передний план', 'Bring front')) + '</button>',
      '<button type="button" data-diagram-action="back"' + (!selected ? ' disabled' : '') + '>↓ ' + escapeHtml(t('На задний план', 'Send back')) + '</button>',
      '<button type="button" data-diagram-action="delete"' + (!selected ? ' disabled' : '') + '>× ' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '<button type="button" data-diagram-action="zoom-out">−</button><span>' + Math.round(payload.zoom * 100) + '%</span><button type="button" data-diagram-action="zoom-in">+</button><button type="button" data-diagram-action="zoom-reset">100%</button>',
      '<button type="button" data-diagram-action="export-svg">' + escapeHtml(t('Экспорт SVG', 'Export SVG')) + '</button>',
      '<button type="button" data-diagram-action="export-png">' + escapeHtml(t('Экспорт PNG', 'Export PNG')) + '</button>',
      '</div>',
      '<div class="ns-office-diagram__viewport"><svg data-diagram-canvas width="' + (WIDTH * payload.zoom) + '" height="' + (HEIGHT * payload.zoom) + '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" role="application" aria-label="' + escapeHtml(t('Холст диаграммы', 'Diagram canvas')) + '"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#8db3df" stroke-opacity=".16"></path></pattern><marker id="arrowhead" markerWidth="12" markerHeight="9" refX="10" refY="4.5" orient="auto"><path d="M0,0 L12,4.5 L0,9 z" fill="#2f7be6"></path></marker></defs><rect width="100%" height="100%" fill="#f8fbff"></rect><rect width="100%" height="100%" fill="url(#grid)"></rect>' + payload.elements.map(function (element) { return elementSvg(element, true); }).join('') + selectionSvg(selected) + '</svg></div>',
      '<div class="ns-office-diagram__foot"><span>' + escapeHtml(selected ? t('Выбрано: ', 'Selected: ') + selected.type : t('Выберите объект на холсте.', 'Select an object on the canvas.')) + '</span><span>' + payload.elements.length + ' ' + escapeHtml(t('объектов', 'objects')) + '</span></div>',
      '</section>'
    ].join('');
  }

  function bind(container, object, api) {
    if (!container || !object || !api) return;
    var host = container.querySelector('[data-office-diagram]');
    if (!host || host.dataset.bound) return;
    host.dataset.bound = 'true';
    function payload() { return normalizePayload(object.payload); }
    function save(next, message) { api.save(next, message); }
    host.addEventListener('change', function (event) {
      if (event.target.matches('[data-diagram-title]')) api.updateTitle(event.target.value);
    });
    host.addEventListener('click', function (event) {
      var elementNode = event.target.closest('[data-diagram-element]');
      if (elementNode && !event.target.closest('[data-diagram-resize]')) {
        var selectedPayload = payload(); selectedPayload.selectedId = elementNode.getAttribute('data-diagram-element'); save(selectedPayload); return;
      }
      var button = event.target.closest('[data-diagram-action]');
      if (!button || button.disabled) return;
      var action = button.getAttribute('data-diagram-action');
      var next = payload();
      var selected = getElement(next, next.selectedId);
      if (TYPES.indexOf(action) !== -1) {
        var contentLocale = next.locale === 'ru' || next.locale === 'en' ? next.locale : api.locale;
        next.locale = contentLocale;
        addElement(next, action, { text: action === 'text' ? (contentLocale === 'ru' ? 'Новый текст' : 'New text') : '' });
      }
      else if (action === 'delete') removeElement(next, next.selectedId);
      else if (action === 'front') moveLayer(next, next.selectedId, 'front');
      else if (action === 'back') moveLayer(next, next.selectedId, 'back');
      else if (action === 'edit' && selected) {
        var text = api.prompt(api.t('Текст объекта', 'Object text'), selected.text || '');
        if (text == null) return;
        updateElement(next, selected.id, { text: text });
      } else if (action === 'zoom-in') setZoom(next, next.zoom + .25);
      else if (action === 'zoom-out') setZoom(next, next.zoom - .25);
      else if (action === 'zoom-reset') setZoom(next, 1);
      else if (action === 'export-svg') { api.download((object.title || 'diagram') + '.svg', 'image/svg+xml;charset=utf-8', buildSvg(next, { title: object.title })); return; }
      else if (action === 'export-png') {
        exportPng(next, object.title, function (blob) { api.downloadBlob((object.title || 'diagram') + '.png', blob); }, function () { api.notice(api.t('Не удалось создать PNG.', 'Could not create PNG.')); });
        return;
      } else return;
      save(next, api.t('Диаграмма сохранена.', 'Diagram saved.'));
    });

    var drag = null;
    host.addEventListener('pointerdown', function (event) {
      var elementNode = event.target.closest('[data-diagram-element]');
      var resizeNode = event.target.closest('[data-diagram-resize]');
      var id = resizeNode ? resizeNode.getAttribute('data-diagram-resize') : (elementNode && elementNode.getAttribute('data-diagram-element'));
      if (!id) return;
      var next = payload();
      var element = getElement(next, id);
      var canvas = host.querySelector('[data-diagram-canvas]');
      if (!element || !canvas) return;
      var rect = canvas.getBoundingClientRect();
      next.selectedId = id;
      drag = { next:next, element:element, startX:event.clientX, startY:event.clientY, scaleX:WIDTH/rect.width, scaleY:HEIGHT/rect.height, x:element.x, y:element.y, x2:element.x2, y2:element.y2, width:element.width, height:element.height, resize:Boolean(resizeNode) };
      event.preventDefault();
    });
    host.addEventListener('pointermove', function (event) {
      if (!drag) return;
      var dx = (event.clientX - drag.startX) * drag.scaleX;
      var dy = (event.clientY - drag.startY) * drag.scaleY;
      var edge = drag.element.type === 'line' || drag.element.type === 'arrow';
      if (drag.resize) {
        if (edge) updateElement(drag.next, drag.element.id, { x2:drag.x2+dx, y2:drag.y2+dy });
        else updateElement(drag.next, drag.element.id, { width:drag.width+dx, height:drag.height+dy });
      } else if (edge) updateElement(drag.next, drag.element.id, { x:drag.x+dx, y:drag.y+dy, x2:drag.x2+dx, y2:drag.y2+dy });
      else updateElement(drag.next, drag.element.id, { x:drag.x+dx, y:drag.y+dy });
    });
    host.addEventListener('pointerup', function () { if (!drag) return; var done=drag; drag=null; save(done.next, api.t('Положение сохранено.', 'Position saved.')); });
    host.addEventListener('dblclick', function (event) {
      var node = event.target.closest('[data-diagram-element]');
      if (!node) return;
      var next = payload();
      var element = getElement(next, node.getAttribute('data-diagram-element'));
      if (!element || ['text','rectangle','ellipse'].indexOf(element.type) === -1) return;
      var value = api.prompt(api.t('Текст объекта', 'Object text'), element.text || '');
      if (value == null) return;
      updateElement(next, element.id, { text:value });
      save(next);
    });
  }

  root.NSOfficeDiagramV1 = Object.freeze({
    TYPES: Object.freeze(TYPES.slice()), WIDTH:WIDTH, HEIGHT:HEIGHT,
    createPayload:createPayload, normalizePayload:normalizePayload,
    addElement:addElement, getElement:getElement, updateElement:updateElement, removeElement:removeElement,
    moveLayer:moveLayer, setZoom:setZoom, buildSvg:buildSvg, exportPng:exportPng,
    render:render, bind:bind
  });
})(window);
