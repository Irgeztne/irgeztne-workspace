(function () {
  'use strict';

  const STORAGE_KEY = 'irgeztne:map:v1:pins';
  const DEFAULT_PINS = [
    {
      id: 'pin-editor',
      title: 'Editor / Publishing',
      type: 'workflow',
      lat: 42,
      lon: 44,
      note: 'Будущая связка: страницы, документы, экспорт и публикация.',
      links: { project: 'Publishing flow', document: 'Site docs', file: '' }
    },
    {
      id: 'pin-codehub',
      title: 'CodeHub / Templates',
      type: 'package',
      lat: 51,
      lon: -0.1,
      note: 'Пакеты, шаблоны, темы и community-направление.',
      links: { project: 'CodeHub', document: '', file: 'Template pack' }
    },
    {
      id: 'pin-fili',
      title: 'FiliNet idea',
      type: 'future',
      lat: 25,
      lon: 55,
      note: 'Storage, pinning, hosting и будущая файловая экономика.',
      links: { project: 'Fili foundation', document: 'Fili Credits note', file: '' }
    }
  ];

  const PIN_TYPES = ['local', 'project', 'document', 'file', 'workflow', 'package', 'future'];

  const COUNTRY_SHAPES = [
    [[-168,72],[-145,70],[-125,60],[-118,48],[-100,50],[-82,42],[-66,45],[-58,55],[-82,68],[-110,72]],
    [[-82,12],[-70,5],[-52,-8],[-45,-24],[-56,-42],[-70,-55],[-80,-35],[-78,-12]],
    [[-10,72],[20,68],[42,58],[38,43],[22,36],[8,43],[-8,52]],
    [[-18,35],[6,36],[33,31],[46,12],[38,-10],[28,-31],[18,-35],[4,-20],[-12,4]],
    [[38,66],[82,62],[130,54],[148,43],[135,28],[98,20],[70,32],[42,40]],
    [[70,28],[96,18],[116,5],[104,-8],[78,-2],[62,15]],
    [[112,-10],[146,-12],[154,-26],[136,-40],[116,-32]],
    [[-48,62],[-28,60],[-20,72],[-42,76]]
  ];

  function isRu() {
    return document.documentElement.lang === 'ru';
  }

  function t(ru, en) {
    return isRu() ? ru : en;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeString(value) {
    return String(value == null ? '' : value).trim();
  }

  function lower(value) {
    return safeString(value).toLowerCase();
  }

  function getProjectsForMap() {
    try {
      if (window.NSProjectStore && typeof window.NSProjectStore.getAll === 'function') {
        return window.NSProjectStore.getAll().filter(Boolean);
      }
    } catch (error) {}
    return [];
  }

  function findProjectByValue(value) {
    const needle = lower(value);
    if (!needle) return null;
    return getProjectsForMap().find((project) => lower(project.id) === needle || lower(project.title) === needle) || null;
  }

  function normalizeProjectLink(value) {
    const project = findProjectByValue(value);
    return project ? project.id : safeString(value);
  }

  function renderProjectOptions(currentValue) {
    const projects = getProjectsForMap();
    const normalizedCurrent = normalizeProjectLink(currentValue);
    const hasCurrentProject = projects.some((project) => String(project.id) === normalizedCurrent);
    const options = [
      '<option value="">' + escapeHtml(t('Без проекта — не появится в Relations', 'No project — not shown in Relations')) + '</option>'
    ];
    projects.forEach((project) => {
      const selected = String(project.id) === normalizedCurrent ? ' selected' : '';
      options.push('<option value="' + escapeHtml(project.id) + '"' + selected + '>' + escapeHtml(project.title || project.id) + '</option>');
    });
    if (normalizedCurrent && !hasCurrentProject) {
      options.push('<option value="' + escapeHtml(normalizedCurrent) + '" selected>' + escapeHtml(currentValue || normalizedCurrent) + ' · ' + escapeHtml(t('ручная связь', 'manual link')) + '</option>');
    }
    return options.join('');
  }

  function getProjectTitleById(projectId) {
    const id = safeString(projectId);
    if (!id) return '';
    const project = getProjectsForMap().find((item) => String(item.id) === id);
    return project ? safeString(project.title || project.id) : id;
  }

  function getAutoProjectLink() {
    const projects = getProjectsForMap();
    return projects.length === 1 ? safeString(projects[0].id) : '';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function parseCoordinate(value, fallback, min, max) {
    const parsed = Number.parseFloat(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
  }

  function normalizePin(pin, fallbackIndex) {
    const source = pin && typeof pin === 'object' ? pin : {};
    const links = source.links && typeof source.links === 'object' ? source.links : {};
    return {
      id: String(source.id || ('custom-' + fallbackIndex + '-' + Date.now().toString(36))),
      title: String(source.title || t('Новая точка', 'New point')),
      type: PIN_TYPES.includes(String(source.type || '')) ? String(source.type) : 'local',
      lat: clamp(Number(source.lat) || 0, -85, 85),
      lon: clamp(Number(source.lon) || 0, -180, 180),
      note: String(source.note || ''),
      links: {
        project: String(links.project || source.project || ''),
        document: String(links.document || source.document || ''),
        file: String(links.file || source.file || '')
      },
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: source.updatedAt || source.createdAt || new Date().toISOString()
    };
  }

  function readPins() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(normalizePin) : [];
    } catch (error) {
      return [];
    }
  }

  function writePins(pins) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify((pins || []).map((pin) => normalizePin(pin))));
    } catch (error) {
      // local-first best effort only
    }
  }

  function isSystemPin(pin) {
    return String(pin && pin.id || '').startsWith('pin-');
  }

  function getAllPinsForRelations() {
    return DEFAULT_PINS.map(normalizePin).concat(readPins());
  }

  function notifyRelationsChanged() {
    document.dispatchEvent(new CustomEvent('irg:relations-changed'));
  }

  function createMap(root) {
    if (!root || root.__irgeztneMapV1) return;
    root.__irgeztneMapV1 = true;

    const surface = root.getAttribute('data-map-surface') || 'workspace';
    const state = {
      pins: DEFAULT_PINS.map(normalizePin).concat(readPins()),
      activePinId: 'pin-fili',
      editingId: null,
      query: '',
      typeFilter: 'all',
      zoom: surface === 'cabinet' ? 1 : 1.08,
      panX: 0,
      panY: 0,
      dragging: false,
      lastX: 0,
      lastY: 0,
      hoverLat: 0,
      hoverLon: 0
    };

    root.innerHTML = [
      '<div class="ns-map-v1 ns-map-v1--' + escapeHtml(surface) + '">',
      '  <section class="ns-map-v1__panel">',
      '    <header class="ns-map-v1__head">',
      '      <div>',
      '        <p class="ns-map-v1__kicker">IRGEZTNE Map / Canvas v1</p>',
      '        <h3 class="ns-map-v1__title">' + escapeHtml(t('Карта проектов и файлов', 'Project and file map')) + '</h3>',
      '        <p class="ns-map-v1__copy">' + escapeHtml(t('Локальная Canvas-карта без CDN. Теперь точки можно добавлять, искать, редактировать, удалять и связывать с проектами, документами и файлами.', 'A local no-CDN Canvas map. Points can now be added, searched, edited, deleted, and linked to projects, documents, and files.')) + '</p>',
      '      </div>',
      '      <div class="ns-map-v1__actions">',
      '        <button class="ns-map-v1__btn" type="button" data-map-action="zoom-out">−</button>',
      '        <button class="ns-map-v1__btn" type="button" data-map-action="zoom-in">+</button>',
      '        <button class="ns-map-v1__btn" type="button" data-map-action="reset">' + escapeHtml(t('Сброс', 'Reset')) + '</button>',
      '      </div>',
      '    </header>',
      '    <div class="ns-map-v1__layout">',
      '      <div class="ns-map-v1__stage">',
      '        <canvas class="ns-map-v1__canvas" data-map-canvas></canvas>',
      '        <div class="ns-map-v1__hud">',
      '          <span class="ns-map-v1__badge">' + escapeHtml(t('Canvas · offline/local-first', 'Canvas · offline/local-first')) + '</span>',
      '          <span class="ns-map-v1__coord" data-map-coord>0°, 0°</span>',
      '        </div>',
      '      </div>',
      '      <aside class="ns-map-v1__side">',
      '        <div class="ns-map-v1__card ns-map-v1__card--filters">',
      '          <h4>' + escapeHtml(t('Поиск и фильтр', 'Search and filter')) + '</h4>',
      '          <div class="ns-map-v1__form ns-map-v1__form--compact">',
      '            <input class="ns-map-v1__input" data-map-search placeholder="' + escapeHtml(t('Найти точку, связь, заметку...', 'Find point, link, note...')) + '">',
      '            <select class="ns-map-v1__input" data-map-filter>',
      '              <option value="all">' + escapeHtml(t('Все типы', 'All types')) + '</option>',
      '              <option value="local">local</option>',
      '              <option value="project">project</option>',
      '              <option value="document">document</option>',
      '              <option value="file">file</option>',
      '              <option value="workflow">workflow</option>',
      '              <option value="package">package</option>',
      '              <option value="future">future</option>',
      '            </select>',
      '          </div>',
      '        </div>',
      '        <div class="ns-map-v1__card">',
      '          <h4>' + escapeHtml(t('Точки', 'Points')) + '</h4>',
      '          <p>' + escapeHtml(t('Список локальных и demo-точек. Клик по точке открывает детали.', 'Local and demo points. Click a point to open details.')) + '</p>',
      '          <div class="ns-map-v1__pin-list" data-map-pins></div>',
      '        </div>',
      '        <div class="ns-map-v1__card ns-map-v1__details" data-map-details></div>',
      '        <div class="ns-map-v1__card">',
      '          <h4 data-map-form-title>' + escapeHtml(t('Добавить точку', 'Add point')) + '</h4>',
      '          <p>' + escapeHtml(t('Нажми на карту для координат. Проект теперь выбирается из списка, чтобы точка сразу появилась в Relations v0.', 'Click the map for coordinates. Pick a project from the list so the point appears in Relations v0.')) + '</p>',
      '          <div class="ns-map-v1__form">',
      '            <input class="ns-map-v1__input" data-map-title placeholder="' + escapeHtml(t('Название точки', 'Point title')) + '">',
      '            <label class="ns-map-v1__field">',
      '              <span class="ns-map-v1__label">' + escapeHtml(t('Тип точки', 'Point type')) + '</span>',
      '              <select class="ns-map-v1__input" data-map-type>',
      '                <option value="local">local</option>',
      '                <option value="project">project</option>',
      '                <option value="document">document</option>',
      '                <option value="file">file</option>',
      '                <option value="workflow">workflow</option>',
      '                <option value="package">package</option>',
      '                <option value="future">future</option>',
      '              </select>',
      '              <small>' + escapeHtml(t('Это категория точки, не связь с проектом.', 'This is the point category, not a project link.')) + '</small>',
      '            </label>',
      '            <div class="ns-map-v1__mini-grid">',
      '              <input class="ns-map-v1__input" data-map-lat placeholder="lat">',
      '              <input class="ns-map-v1__input" data-map-lon placeholder="lon">',
      '            </div>',
      '            <textarea class="ns-map-v1__input ns-map-v1__textarea" data-map-note placeholder="' + escapeHtml(t('Заметка / описание', 'Note / description')) + '"></textarea>',
      '            <div class="ns-map-v1__relation-grid">',
      '              <label class="ns-map-v1__field ns-map-v1__field--relation">',
      '                <span class="ns-map-v1__label">' + escapeHtml(t('Связать с проектом', 'Link to project')) + '</span>',
      '                <select class="ns-map-v1__input" data-map-project aria-label="Project">' + renderProjectOptions('') + '</select>',
      '                <small>' + escapeHtml(t('Только выбранный здесь проект появится в Projects → Связи v0.', 'Only the project selected here appears in Projects → Relations v0.')) + '</small>',
      '              </label>',
      '              <input class="ns-map-v1__input" data-map-document placeholder="Document">',
      '              <input class="ns-map-v1__input" data-map-file placeholder="File">',
      '            </div>',
      '            <div class="ns-map-v1__form-actions">',
      '              <button class="ns-map-v1__btn ns-map-v1__btn--primary" type="button" data-map-action="save-pin">' + escapeHtml(t('Сохранить точку', 'Save point')) + '</button>',
      '              <button class="ns-map-v1__btn" type="button" data-map-action="new-pin">' + escapeHtml(t('Новая', 'New')) + '</button>',
      '              <button class="ns-map-v1__btn ns-map-v1__btn--danger" type="button" data-map-action="delete-pin">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '            </div>',
      '            <div class="ns-map-v1__status" data-map-status></div>',
      '          </div>',
      '        </div>',
      '      </aside>',
      '    </div>',
      '  </section>',
      '</div>'
    ].join('');

    const canvas = root.querySelector('[data-map-canvas]');
    const coord = root.querySelector('[data-map-coord]');
    const pinsNode = root.querySelector('[data-map-pins]');
    const detailsNode = root.querySelector('[data-map-details]');
    const formTitleNode = root.querySelector('[data-map-form-title]');
    const searchInput = root.querySelector('[data-map-search]');
    const filterInput = root.querySelector('[data-map-filter]');
    const titleInput = root.querySelector('[data-map-title]');
    const typeInput = root.querySelector('[data-map-type]');
    const latInput = root.querySelector('[data-map-lat]');
    const lonInput = root.querySelector('[data-map-lon]');
    const noteInput = root.querySelector('[data-map-note]');
    const projectInput = root.querySelector('[data-map-project]');
    const documentInput = root.querySelector('[data-map-document]');
    const fileInput = root.querySelector('[data-map-file]');
    const statusNode = root.querySelector('[data-map-status]');

    function getActivePin() {
      return state.pins.find((pin) => pin.id === state.activePinId) || state.pins[0] || null;
    }

    function getVisiblePins() {
      const query = state.query.trim().toLowerCase();
      return state.pins.filter((pin) => {
        const links = pin.links || {};
        const typeMatch = state.typeFilter === 'all' || pin.type === state.typeFilter;
        if (!typeMatch) return false;
        if (!query) return true;
        const haystack = [pin.title, pin.type, pin.note, links.project, links.document, links.file]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    function project(lat, lon) {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 1;
      const height = rect.height || 1;
      const scale = Math.min(width / 380, height / 210) * state.zoom;
      return {
        x: width / 2 + (lon * scale) + state.panX,
        y: height / 2 - (lat * scale) + state.panY
      };
    }

    function unproject(x, y) {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 1;
      const height = rect.height || 1;
      const scale = Math.min(width / 380, height / 210) * state.zoom;
      return {
        lat: clamp((height / 2 + state.panY - y) / scale, -85, 85),
        lon: clamp((x - width / 2 - state.panX) / scale, -180, 180)
      };
    }

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(280, Math.floor(rect.height));
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 1;
      const height = rect.height || 1;
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, Math.max(width, height) * 0.74);
      gradient.addColorStop(0, 'rgba(47,116,255,0.12)');
      gradient.addColorStop(1, 'rgba(5,13,30,0.02)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      drawGraticule(ctx);
      drawLand(ctx);
      drawConnections(ctx);
      drawPins(ctx);
    }

    function drawGraticule(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(126, 181, 255, 0.085)';
      ctx.lineWidth = 1;
      for (let lon = -150; lon <= 150; lon += 30) {
        const a = project(-75, lon);
        const b = project(75, lon);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const a = project(lat, -180);
        const b = project(lat, 180);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawLand(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(47, 116, 255, 0.20)';
      ctx.strokeStyle = 'rgba(142, 196, 255, 0.34)';
      ctx.lineWidth = 1.2;
      COUNTRY_SHAPES.forEach((shape) => {
        ctx.beginPath();
        shape.forEach((point, index) => {
          const p = project(point[1], point[0]);
          if (index === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawConnections(ctx) {
      const active = getActivePin();
      if (!active) return;
      const visibleIds = new Set(getVisiblePins().map((pin) => pin.id));
      const from = project(active.lat, active.lon);
      ctx.save();
      ctx.strokeStyle = 'rgba(78, 183, 255, 0.34)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 7]);
      state.pins.filter((pin) => pin.id !== active.id && visibleIds.has(pin.id)).forEach((pin) => {
        const to = project(pin.lat, pin.lon);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawPins(ctx) {
      const visibleIds = new Set(getVisiblePins().map((pin) => pin.id));
      ctx.save();
      state.pins.forEach((pin) => {
        if (!visibleIds.has(pin.id)) return;
        const p = project(pin.lat, pin.lon);
        const active = pin.id === state.activePinId;
        ctx.beginPath();
        ctx.arc(p.x, p.y, active ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = active ? '#74b8ff' : '#2f74ff';
        ctx.shadowColor = '#2f74ff';
        ctx.shadowBlur = active ? 18 : 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.82)';
        ctx.stroke();
      });
      ctx.restore();
    }

    function renderPins() {
      const visiblePins = getVisiblePins();
      if (visiblePins.length && !visiblePins.some((pin) => pin.id === state.activePinId)) {
        state.activePinId = visiblePins[0].id;
      }
      pinsNode.innerHTML = visiblePins.length ? visiblePins.map((pin) => {
        const links = pin.links || {};
        const linkedCount = [links.project, links.document, links.file].filter(Boolean).length;
        return '<button class="ns-map-v1__pin' + (pin.id === state.activePinId ? ' is-active' : '') + '" type="button" data-map-pin="' + escapeHtml(pin.id) + '">' +
          '<strong>' + escapeHtml(pin.title) + '</strong>' +
          '<span>' + escapeHtml(pin.type + ' · ' + pin.lat.toFixed(2) + ', ' + pin.lon.toFixed(2)) + '</span>' +
          '<span>' + escapeHtml(pin.note || t('Без описания', 'No description')) + '</span>' +
          '<em>' + escapeHtml(linkedCount ? t('Связей: ', 'Links: ') + linkedCount : t('Без связей', 'No links')) + '</em>' +
        '</button>';
      }).join('') : '<div class="ns-map-v1__empty">' + escapeHtml(t('Точки не найдены.', 'No points found.')) + '</div>';
    }

    function renderDetails() {
      const active = getActivePin();
      if (!active) {
        detailsNode.innerHTML = '<h4>' + escapeHtml(t('Детали точки', 'Point details')) + '</h4><p>' + escapeHtml(t('Выбери или создай точку.', 'Select or create a point.')) + '</p>';
        return;
      }
      const links = active.links || {};
      const readonly = isSystemPin(active);
      detailsNode.innerHTML = [
        '<h4>' + escapeHtml(t('Детали точки', 'Point details')) + '</h4>',
        '<div class="ns-map-v1__detail-title">' + escapeHtml(active.title) + '</div>',
        '<div class="ns-map-v1__detail-meta">' + escapeHtml(active.type + ' · ' + active.lat.toFixed(4) + ', ' + active.lon.toFixed(4)) + '</div>',
        '<p>' + escapeHtml(active.note || t('Без описания', 'No description')) + '</p>',
        '<div class="ns-map-v1__links">',
        '  <span><b>Project</b>' + escapeHtml(links.project || '—') + '</span>',
        '  <span><b>Document</b>' + escapeHtml(links.document || '—') + '</span>',
        '  <span><b>File</b>' + escapeHtml(links.file || '—') + '</span>',
        '</div>',
        '<div class="ns-map-v1__form-actions">',
        '  <button class="ns-map-v1__btn" type="button" data-map-action="edit-pin">' + escapeHtml(readonly ? t('Копировать в форму', 'Copy to form') : t('Редактировать', 'Edit')) + '</button>',
        readonly
          ? '  <button class="ns-map-v1__btn ns-map-v1__btn--muted" type="button" disabled>' + escapeHtml(t('Demo защищена', 'Demo protected')) + '</button>'
          : '  <button class="ns-map-v1__btn ns-map-v1__btn--danger" type="button" data-map-action="delete-pin">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
        '</div>',
        readonly ? '<div class="ns-map-v1__status">' + escapeHtml(t('Demo-точки защищены. Можно скопировать их в форму и сохранить как локальную точку.', 'Demo points are protected. Copy one to the form and save it as a local point.')) + '</div>' : ''
      ].join('');
    }

    function renderAll() {
      renderPins();
      renderDetails();
      draw();
    }

    function updateCoord(x, y) {
      const geo = unproject(x, y);
      state.hoverLat = geo.lat;
      state.hoverLon = geo.lon;
      coord.textContent = geo.lat.toFixed(2) + '°, ' + geo.lon.toFixed(2) + '°';
    }

    function saveCustomPins() {
      const customPins = state.pins.filter((pin) => !isSystemPin(pin));
      writePins(customPins);
      notifyRelationsChanged();
    }

    function clearForm() {
      state.editingId = null;
      titleInput.value = '';
      typeInput.value = 'local';
      latInput.value = '';
      lonInput.value = '';
      noteInput.value = '';
      projectInput.innerHTML = renderProjectOptions('');
      projectInput.value = '';
      documentInput.value = '';
      fileInput.value = '';
      formTitleNode.textContent = t('Добавить точку', 'Add point');
      statusNode.textContent = t('Готово к новой локальной точке.', 'Ready for a new local point.');
    }

    function fillForm(pin) {
      if (!pin) return;
      const links = pin.links || {};
      state.editingId = isSystemPin(pin) ? null : pin.id;
      titleInput.value = pin.title || '';
      typeInput.value = pin.type || 'local';
      latInput.value = Number(pin.lat).toFixed(4);
      lonInput.value = Number(pin.lon).toFixed(4);
      noteInput.value = pin.note || '';
      projectInput.innerHTML = renderProjectOptions(links.project || '');
      projectInput.value = normalizeProjectLink(links.project || '');
      documentInput.value = links.document || '';
      fileInput.value = links.file || '';
      formTitleNode.textContent = state.editingId ? t('Редактировать точку', 'Edit point') : t('Новая локальная копия', 'New local copy');
      statusNode.textContent = state.editingId ? t('Точка загружена в форму.', 'Point loaded into form.') : t('Demo-точка скопирована. При сохранении будет создана локальная точка.', 'Demo point copied. Saving will create a local point.');
    }

    function buildPinFromForm(existing) {
      const now = new Date().toISOString();
      const title = String(titleInput.value || '').trim() || t('Новая точка', 'New point');
      const pointType = typeInput.value || 'local';
      const selectedProject = projectInput.value || (pointType === 'project' ? getAutoProjectLink() : '');
      return normalizePin({
        id: existing && existing.id ? existing.id : 'custom-' + Date.now().toString(36),
        title,
        type: pointType,
        lat: parseCoordinate(latInput.value, state.hoverLat, -85, 85),
        lon: parseCoordinate(lonInput.value, state.hoverLon, -180, 180),
        note: String(noteInput.value || '').trim() || t('Локальная точка карты', 'Local map point'),
        links: {
          project: normalizeProjectLink(selectedProject),
          document: String(documentInput.value || '').trim(),
          file: String(fileInput.value || '').trim()
        },
        createdAt: existing && existing.createdAt ? existing.createdAt : now,
        updatedAt: now
      });
    }

    function savePin() {
      const existing = state.editingId ? state.pins.find((pin) => pin.id === state.editingId && !isSystemPin(pin)) : null;
      const next = buildPinFromForm(existing);
      if (existing) {
        state.pins = state.pins.map((pin) => pin.id === existing.id ? next : pin);
      } else {
        state.pins.push(next);
      }
      state.activePinId = next.id;
      state.editingId = next.id;
      formTitleNode.textContent = t('Редактировать точку', 'Edit point');
      if (next.links && next.links.project) {
        projectInput.innerHTML = renderProjectOptions(next.links.project);
        projectInput.value = normalizeProjectLink(next.links.project);
        statusNode.textContent = existing
          ? t('Точка обновлена и связана с проектом: ', 'Point updated and linked to project: ') + getProjectTitleById(next.links.project)
          : t('Точка сохранена и связана с проектом: ', 'Point saved and linked to project: ') + getProjectTitleById(next.links.project);
      } else {
        statusNode.textContent = existing
          ? t('Точка обновлена без связи с проектом. Выберите проект в поле «Связать с проектом», чтобы она появилась в Relations v0.', 'Point updated without a project link. Pick a project in “Link to project” to show it in Relations v0.')
          : t('Точка сохранена без связи с проектом. Выберите проект в поле «Связать с проектом», чтобы она появилась в Relations v0.', 'Point saved without a project link. Pick a project in “Link to project” to show it in Relations v0.');
      }
      saveCustomPins();
      renderAll();
    }

    function deleteActivePin() {
      const active = getActivePin();
      if (!active) return;
      if (isSystemPin(active)) {
        statusNode.textContent = t('Demo-точку нельзя удалить. Создай локальную точку или скопируй demo-точку в форму.', 'Demo points cannot be deleted. Create a local point or copy the demo point to the form.');
        return;
      }
      state.pins = state.pins.filter((pin) => pin.id !== active.id);
      state.activePinId = state.pins[0] ? state.pins[0].id : null;
      clearForm();
      saveCustomPins();
      statusNode.textContent = t('Точка удалена.', 'Point deleted.');
      renderAll();
    }

    root.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-map-action]');
      if (actionButton) {
        const action = actionButton.getAttribute('data-map-action');
        if (action === 'zoom-in') state.zoom = clamp(state.zoom + 0.18, 0.72, 2.4);
        if (action === 'zoom-out') state.zoom = clamp(state.zoom - 0.18, 0.72, 2.4);
        if (action === 'reset') {
          state.zoom = surface === 'cabinet' ? 1 : 1.08;
          state.panX = 0;
          state.panY = 0;
        }
        if (action === 'save-pin') savePin();
        if (action === 'new-pin') clearForm();
        if (action === 'edit-pin') fillForm(getActivePin());
        if (action === 'delete-pin') deleteActivePin();
        draw();
        return;
      }

      const pinButton = event.target.closest('[data-map-pin]');
      if (pinButton) {
        state.activePinId = pinButton.getAttribute('data-map-pin');
        renderAll();
      }
    });

    searchInput.addEventListener('input', () => {
      state.query = searchInput.value || '';
      renderAll();
    });

    filterInput.addEventListener('change', () => {
      state.typeFilter = filterInput.value || 'all';
      renderAll();
    });

    typeInput.addEventListener('change', () => {
      if (typeInput.value === 'project' && !projectInput.value) {
        const autoProject = getAutoProjectLink();
        if (autoProject) {
          projectInput.innerHTML = renderProjectOptions(autoProject);
          projectInput.value = autoProject;
          statusNode.textContent = t('Тип точки — project. Единственный проект выбран как связь автоматически.', 'Point type is project. The only project was selected as the link automatically.');
        } else {
          statusNode.textContent = t('Тип точки — project. Для связи выберите проект ниже в поле «Связать с проектом».', 'Point type is project. To link it, choose a project below in “Link to project”.');
        }
      }
    });

    canvas.addEventListener('pointerdown', (event) => {
      state.dragging = true;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      canvas.classList.add('is-dragging');
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      updateCoord(event.clientX - rect.left, event.clientY - rect.top);
      if (!state.dragging) return;
      state.panX += event.clientX - state.lastX;
      state.panY += event.clientY - state.lastY;
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      draw();
    });

    canvas.addEventListener('pointerup', (event) => {
      state.dragging = false;
      canvas.classList.remove('is-dragging');
      try { canvas.releasePointerCapture(event.pointerId); } catch (error) {}
    });

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const geo = unproject(event.clientX - rect.left, event.clientY - rect.top);
      latInput.value = geo.lat.toFixed(4);
      lonInput.value = geo.lon.toFixed(4);
      statusNode.textContent = t('Координаты выбраны на карте.', 'Coordinates selected on map.');
    });

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      state.zoom = clamp(state.zoom + (event.deltaY < 0 ? 0.08 : -0.08), 0.72, 2.4);
      draw();
    }, { passive: false });

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('irg:map-open-point', (event) => {
      const pointId = event && event.detail ? String(event.detail.pointId || '') : '';
      if (!pointId || !state.pins.some((pin) => pin.id === pointId)) return;
      state.activePinId = pointId;
      fillForm(getActivePin());
      renderAll();
    });

    if (window.NSProjectStore && typeof window.NSProjectStore.subscribe === 'function') {
      window.NSProjectStore.subscribe(() => {
        const currentValue = projectInput.value || '';
        projectInput.innerHTML = renderProjectOptions(currentValue);
        projectInput.value = normalizeProjectLink(currentValue);
      });
    }

    renderAll();
    resizeCanvas();
  }

  function init() {
    document.querySelectorAll('[data-map-root]').forEach(createMap);
  }

  function refreshLanguage() {
    document.querySelectorAll('[data-map-root]').forEach((root) => {
      root.__irgeztneMapV1 = false;
      root.innerHTML = '';
      createMap(root);
    });
  }

  document.addEventListener('irg:language-changed', refreshLanguage);
  window.addEventListener('irg:language-changed', refreshLanguage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NSMapV1 = {
    getAllPins: getAllPinsForRelations,
    openPointById(pointId) {
      document.dispatchEvent(new CustomEvent('irg:map-open-point', { detail: { pointId: String(pointId || '') } }));
      return true;
    }
  };
})();
