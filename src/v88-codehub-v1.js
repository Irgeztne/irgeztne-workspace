(function () {
  // IRGEZTNE_WORKSHOP_PREVIEW_TOOLBAR_LAYOUT_R1W7F
  // IRGEZTNE_WORKSHOP_PREVIEW_FULLSCREEN_R1W7G
  // IRGEZTNE_WORKSHOP_SECTIONS_R1W8A
  // IRGEZTNE_WORKSHOP_ZIP_INSTALL_R1W8B
  // IRGEZTNE_WORKSHOP_UI_POLISH_R1W8C
  // IRGEZTNE_WORKSHOP_INSTALLED_LIFECYCLE_R1W8D
  // IRGEZTNE_WORKSHOP_INSTALLED_UX_CLARITY_R1W8E
  // IRGEZTNE_WORKSHOP_INSTALLED_DURABILITY_R1W8G
  // IRGEZTNE_WORKSHOP_INSTALLED_METADATA_R1W8H
  // IRGEZTNE_WORKSHOP_WEBSTUDIO_THEME_ADAPTER_R1W9E
  // IRGEZTNE_WORKSHOP_WEBSTUDIO_COMPONENT_ADAPTER_R1W9F
  // IRGEZTNE_WORKSHOP_RELEASE_FILTERS_R1W10A
  const VIEW_CATALOG = 'catalog';
  const VIEW_INSTALLED = 'installed';
  const VIEW_HOME = 'home';
  const VIEW_LIST = 'list';
  const VIEW_BUILDER = 'builder';
  const VIEW_RULES = 'rules';
  const BUILDER_TABS = ['overview', 'details', 'files', 'preview', 'compatibility', 'validation'];
  const TYPE_OPTIONS = ['template', 'theme', 'component', 'widget'];
  const uiState = {
    view: VIEW_HOME,
    builderTab: 'overview',
    filterStatus: 'all',
    filterType: 'all',
    catalogFilterType: 'all',
    installedFilterType: 'all',
    query: '',
    notice: '',
    installFeedback: '',
    installFeedbackKind: '',
    metaReports: {},
    customsReports: {},
    customLicenseItems: {},
    savedItemId: ''
  };

  let languageContextRoot = null;

  function languageForRoot(root) {
    const value = String(root && root.getAttribute && root.getAttribute('data-codehub-lang') || '').trim().toLowerCase();
    return value === 'ru' || value === 'en' ? value : '';
  }

  function withLanguageRoot(root, callback) {
    const previousRoot = languageContextRoot;
    languageContextRoot = root || null;
    try {
      return callback();
    } finally {
      languageContextRoot = previousRoot;
    }
  }

  function isRu() {
    const rootLanguage = languageForRoot(languageContextRoot);
    if (rootLanguage) return rootLanguage === 'ru';
    return String(document && document.documentElement && document.documentElement.lang || '').toLowerCase() === 'ru';
  }

  const observedRuntimeTextPairs = [];

  function rememberRuntimeTextPair(ru, en) {
    const ruText = String(ru == null ? '' : ru);
    const enText = String(en == null ? '' : en);
    if (!ruText || !enText || ruText === enText) return;
    const exists = observedRuntimeTextPairs.some(function (pair) {
      return pair[0] === ruText && pair[1] === enText;
    });
    if (!exists) observedRuntimeTextPairs.push([ruText, enText]);
  }

  function t(ru, en) {
    rememberRuntimeTextPair(ru, en);
    return isRu() ? ru : en;
  }

  const storedRuntimeTextPairs = [
    ['Требуется название пакета.', 'Package title is required.'],
    ['Тип пакета не поддерживается.', 'Package type is not supported.'],
    ['Требуется версия.', 'Version is required.'],
    ['Требуется имя автора.', 'Author name is required.'],
    ['Нужно краткое описание.', 'Short description is required.'],
    ['Требуется обложка для превью.', 'Cover preview is required.'],
    ['Добавьте в пакет хотя бы один файл.', 'Add at least one file to the package.'],
    ['Минимальная версия Workspace должна быть в формате x.y.z.', 'Minimum Workspace version must use semantic x.y.z format.'],
    ['Обложка должна ссылаться на изображение, добавленное в пакет.', 'Cover preview must reference an image included in the package.'],
    ['Изображение галереи должно быть добавлено в пакет: ', 'Gallery preview must reference an image included in the package: '],
    ['Теги пусты. Добавьте 1–3 тега для будущей фильтрации.', 'Tags are empty. Add 1–3 tags for better filtering later.'],
    ['Полное описание не заполнено.', 'Full description is empty.'],
    ['Галерея изображений пуста.', 'Gallery images are empty.'],
    ['Пакет не найден.', 'Package was not found.'],
    ['Версия должна быть в формате x.y.z.', 'Version must use semantic x.y.z format.'],
    ['Требуется лицензия пакета.', 'Package license is required.'],
    ['Небезопасный путь файла пакета: ', 'Unsafe package file path: '],
    ['Дублирующийся путь файла пакета: ', 'Duplicate package file path: '],
    ['Исполняемый файл или установщик запрещён в Мастерской v1: ', 'Executable or installer file is not allowed in Workshop v1: '],
    ['Требуется хотя бы один основной файл или файл шаблона.', 'At least one main or template file is required.'],
    ['Для файла отсутствует локальное содержимое: ', 'Local file content is missing for package file: '],
    ['Для файла пакета отсутствует или некорректен SHA-256: ', 'SHA-256 is missing or invalid for package file: '],
    ['В шаблоне отсутствует локальный ресурс: ', 'Template is missing a local resource: '],
    ['Шаблон использует внешние сетевые ресурсы: ', 'Template uses external network resources: '],
    ['Не удалось проверить локальные ссылки в файле: ', 'Could not inspect local references in file: ']
  ];

  function localizeRuntimeText(value) {
    const raw = String(value == null ? '' : value);
    if (!raw) return raw;
    const pairs = storedRuntimeTextPairs.concat(observedRuntimeTextPairs);
    for (const pair of pairs) {
      if (raw === pair[0] || raw === pair[1]) return isRu() ? pair[0] : pair[1];
    }
    const prefixPairs = pairs.slice().sort(function (a, b) {
      return Math.max(b[0].length, b[1].length) - Math.max(a[0].length, a[1].length);
    });
    for (const pair of prefixPairs) {
      if (raw.indexOf(pair[0]) === 0) return (isRu() ? pair[0] : pair[1]) + raw.slice(pair[0].length);
      if (raw.indexOf(pair[1]) === 0) return (isRu() ? pair[0] : pair[1]) + raw.slice(pair[1].length);
    }
    return raw;
  }

  function getStatusLabels() {
    return isRu()
      ? {
          draft: 'Черновик',
          validated: 'Проверено',
          ready: 'Готово к публикации',
          submitted: 'Отправлено',
          review: 'На рассмотрении',
          published: 'Опубликовано',
          rejected: 'Отклонено',
          archived: 'В архиве'
        }
      : {
          draft: 'Draft',
          validated: 'Validated',
          ready: 'Ready to publish',
          submitted: 'Submitted',
          review: 'In review',
          published: 'Published',
          rejected: 'Rejected',
          archived: 'Archived'
        };
  }

  function getTypeOptions() {
    return [
      ['template', t('Шаблон', 'Template')],
      ['theme', t('Тема', 'Theme')],
      ['component', t('Компонент / блок', 'Component / block')],
      ['widget', t('Виджет сайта', 'Site widget')]
    ];
  }

  function getTypeFilterOptions() {
    return [
      ['all', t('Все', 'All')],
      ['template', t('Шаблоны', 'Templates')],
      ['theme', t('Темы', 'Themes')],
      ['component', t('Компоненты', 'Components')],
      ['widget', t('Виджеты', 'Widgets')]
    ];
  }

  function workshopTypeCounts(items) {
    const counts = { all: 0, template: 0, theme: 0, component: 0, widget: 0 };
    (Array.isArray(items) ? items : []).forEach(function (item) {
      const type = String(item && item.type || '').trim().toLowerCase();
      if (!TYPE_OPTIONS.includes(type)) return;
      counts.all += 1;
      counts[type] += 1;
    });
    return counts;
  }

  function workshopTypeFilterLabel(type) {
    const found = getTypeFilterOptions().find(function (pair) { return pair[0] === type; });
    return found ? found[1] : t('Все', 'All');
  }

  function renderWorkshopTypeFilter(scope, counts, activeType) {
    const safeScope = ['catalog', 'installed', 'my-packages'].includes(scope) ? scope : 'my-packages';
    const normalizedCounts = counts && typeof counts === 'object' ? counts : workshopTypeCounts([]);
    const selected = getTypeFilterOptions().some(function (pair) { return pair[0] === activeType; }) ? activeType : 'all';
    return [
      '<div class="ns-codehub-v1__type-filter" data-codehub-type-filter-scope="' + escapeHtml(safeScope) + '" aria-label="' + escapeHtml(t('Фильтр по типу пакета', 'Filter by package type')) + '">',
      getTypeFilterOptions().map(function (pair) {
        const value = pair[0];
        const count = Number(normalizedCounts[value] || 0);
        return '<button type="button" class="ns-codehub-v1__type-filter-btn' + (selected === value ? ' is-active' : '') + '" data-codehub-type-filter="' + escapeHtml(safeScope) + '" data-codehub-type="' + escapeHtml(value) + '" aria-pressed="' + (selected === value ? 'true' : 'false') + '"><span>' + escapeHtml(pair[1]) + '</span><strong>' + count + '</strong></button>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function getDistributionOptions() {
    return [
      ['free', 'FREE'],
      ['freemium', 'FREEMIUM']
    ];
  }

  const LICENSE_PRESETS = ['MPL-2.0', 'MIT', 'Apache-2.0', 'GPL-3.0-or-later', 'Proprietary'];

  function getLicenseOptions() {
    return [
      ['', t('Выберите лицензию', 'Choose a license')],
      ['MPL-2.0', 'MPL-2.0'],
      ['MIT', 'MIT'],
      ['Apache-2.0', 'Apache-2.0'],
      ['GPL-3.0-or-later', 'GPL-3.0-or-later'],
      ['Proprietary', t('Проприетарная', 'Proprietary')],
      ['__other__', t('Другая…', 'Other…')]
    ];
  }

  function licenseSelectValue(item) {
    const raw = String(item && item.license || '').trim();
    if (uiState.customLicenseItems[item.id]) return '__other__';
    if (!raw) return '';
    return LICENSE_PRESETS.includes(raw) ? raw : '__other__';
  }

  function renderLicenseControl(item) {
    const selected = licenseSelectValue(item);
    return [
      '<select class="ns-codehub-v1__select" data-codehub-field="license.preset" data-codehub-id="' + escapeHtml(item.id) + '">' + renderSelectOptions(getLicenseOptions(), selected) + '</select>',
      selected === '__other__'
        ? '<input class="ns-codehub-v1__input ns-codehub-v1__license-custom" type="text" data-codehub-field="license.custom" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.license || '') + '" placeholder="' + escapeHtml(t('Введите идентификатор или название лицензии', 'Enter a license identifier or name')) + '">'
        : ''
    ].join('');
  }

  function getDistributionLabel(value) {
    if (value === 'freemium') return 'FREEMIUM';
    if (value === 'pro') return 'PRO';
    return 'FREE';
  }
  let initialized = false;
  let unsubscribe = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function normalizeUiText(value) {
    const raw = String(value || '').trim();
    if (isRu() || !raw) return raw;
    const map = [
      ['Пакет без названия','Untitled package'],
      ['Копия','Copy'],
      ['Шаблон','Template'],
      ['Тема','Theme'],
      ['Компонент / блок','Component / block'],
      ['Виджет сайта','Site widget'],
      ['Черновик','Draft'],
      ['Проверено','Validated'],
      ['Готово к публикации','Ready to publish'],
      ['Отправлено','Submitted'],
      ['На рассмотрении','In review'],
      ['Опубликовано','Published'],
      ['Отклонено','Rejected'],
      ['В архиве','Archived'],
      ['Как это работает','How it works'],
      ['Недавние пакеты','Recent Packages'],
      ['Выберите, что хотите создать.','Choose what you want to create.'],
      ['Четыре понятных шага от идеи до готового ZIP.','Four clear steps from idea to a ready ZIP.'],
      ['Создайте черновик пакета.','Create a package draft.'],
      ['Добавьте реальные файлы и выберите превью из них.','Add real files and choose previews from them.'],
      ['Проверьте пакет и экспортируйте ZIP.','Validate the package and export a ZIP.'],
      ['Открыть','Open']
    ];
    let text = raw;
    for (const [ru,en] of map) text = text.split(ru).join(en);
    return text;
  }

  function normalizePackageTitle(value) {
    const text = String(value || '').trim();
    if (!text) return t('Пакет без названия', 'Untitled package');
    if (isRu()) return text;
    const map = {
      'Пакет без названия': 'Untitled package',
      'Пакет без названия Копия': 'Untitled package Copy',
      'Шаблон': 'Template',
      'Тема': 'Theme',
      'Пак': 'Component / block',
      'Виджет': 'Site widget',
      'Виджет сайта': 'Site widget',
      'Пак ассетов': 'Component / block',
      'Стартовый набор': 'Template',
      'Черновик': 'Draft',
      'Проверено': 'Validated',
      'Готово к публикации': 'Ready to publish',
      'Отправлено': 'Submitted',
      'На рассмотрении': 'In review',
      'Опубликовано': 'Published',
      'Отклонено': 'Rejected',
      'В архиве': 'Archived',
      'Открыть': 'Open'
    };
    let next = map[text] || text;
    next = normalizeUiText(next);
    return next;
  }

  const WORKSHOP_BYTES_DB = 'irgeztne-workshop-bytes-v1';
  const WORKSHOP_BYTES_STORE = 'files';
  const WORKSHOP_MAX_FILES = 200;
  const WORKSHOP_MAX_FILE_BYTES = 64 * 1024 * 1024;
  const WORKSHOP_MAX_PACKAGE_BYTES = 128 * 1024 * 1024;
  const WORKSHOP_INSTALLED_REGISTRY_KEY = 'irgeztne-workshop-installed-v1';
  const WORKSHOP_INSTALLED_META_KEY = 'irgeztne-workshop-installed-v1-meta';
  const WORKSHOP_INSTALLED_DURABLE_KEY = 'workspace.workshop.installed.v1';
  const WORKSHOP_INSTALLED_PERSISTENCE_VERSION = 1;
  const WORKSHOP_RUNTIME_VERSION = '1.0.0';
  const WORKSHOP_MAX_ZIP_BYTES = WORKSHOP_MAX_PACKAGE_BYTES + (16 * 1024 * 1024);

  function workshopBlobKey(itemId) {
    return ['workshop', String(itemId || 'pkg'), Date.now(), Math.random().toString(36).slice(2, 10)].join(':');
  }

  function openWorkshopBytesDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const request = window.indexedDB.open(WORKSHOP_BYTES_DB, 1);
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORKSHOP_BYTES_STORE)) {
          db.createObjectStore(WORKSHOP_BYTES_STORE, { keyPath: 'blobKey' });
        }
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('IndexedDB open failed')); };
    });
  }

  async function putWorkshopBytes(record) {
    const db = await openWorkshopBytesDb();
    try {
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(WORKSHOP_BYTES_STORE, 'readwrite');
        tx.objectStore(WORKSHOP_BYTES_STORE).put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB write failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB write aborted')); };
      });
    } finally {
      db.close();
    }
  }

  async function getWorkshopBytes(blobKey) {
    const db = await openWorkshopBytesDb();
    try {
      return await new Promise(function (resolve, reject) {
        const tx = db.transaction(WORKSHOP_BYTES_STORE, 'readonly');
        const req = tx.objectStore(WORKSHOP_BYTES_STORE).get(String(blobKey || ''));
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error || new Error('IndexedDB read failed')); };
      });
    } finally {
      db.close();
    }
  }

  async function deleteWorkshopBytes(blobKey) {
    if (!blobKey) return;
    const db = await openWorkshopBytesDb();
    try {
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(WORKSHOP_BYTES_STORE, 'readwrite');
        tx.objectStore(WORKSHOP_BYTES_STORE).delete(String(blobKey));
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB delete failed')); };
      });
    } finally {
      db.close();
    }
  }

  async function deleteWorkshopBytesBatch(blobKeys) {
    const keys = Array.from(new Set((blobKeys || []).filter(Boolean).map(function (key) { return String(key); })));
    if (!keys.length) return;
    const db = await openWorkshopBytesDb();
    try {
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(WORKSHOP_BYTES_STORE, 'readwrite');
        const store = tx.objectStore(WORKSHOP_BYTES_STORE);
        keys.forEach(function (key) { store.delete(key); });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('IndexedDB batch delete failed')); };
        tx.onabort = function () { reject(tx.error || new Error('IndexedDB batch delete aborted')); };
      });
    } finally {
      db.close();
    }
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes)).map(function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async function sha256ArrayBuffer(buffer) {
    if (!window.crypto || !window.crypto.subtle) throw new Error('Web Crypto unavailable');
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    return bytesToHex(digest);
  }

  function customsFingerprint(item) {
    if (!item) return '';
    return JSON.stringify({
      id: item.id,
      type: item.type,
      title: item.title,
      version: item.version,
      license: item.license,
      author: item.author,
      description: item.description,
      preview: item.preview,
      compatibility: item.compatibility,
      files: (item.files || []).map(function (file) {
        return [file.id, file.path, file.role, file.size, file.mime, file.sha256, file.blobKey, file.byteState];
      })
    });
  }

  function getItemCustomsReport(item) {
    if (!item || !uiState.customsReports) return null;
    const report = uiState.customsReports[item.id] || null;
    return report && report.fingerprint === customsFingerprint(item) ? report : null;
  }

  function mergeUnique(list) {
    return Array.from(new Set((list || []).filter(Boolean)));
  }

  async function runWorkshopCustoms(item) {
    const store = getStore();
    const base = store ? store.validateItem(item) : { errors: ['Package store unavailable.'], warnings: [], isReady: false };
    const errors = (base.errors || []).slice();
    const warnings = (base.warnings || []).slice();
    let totalBytes = 0;

    if ((item.files || []).length > WORKSHOP_MAX_FILES) {
      errors.push(t('Слишком много файлов в пакете. Максимум: ' + WORKSHOP_MAX_FILES + '.', 'Too many files in package. Maximum: ' + WORKSHOP_MAX_FILES + '.'));
    }

    for (const file of item.files || []) {
      const path = String(file.path || '');
      if (Number(file.size || 0) > WORKSHOP_MAX_FILE_BYTES) {
        errors.push(t('Файл слишком большой для локальной проверки пакета: ', 'File is too large for local package validation: ') + path);
        continue;
      }
      totalBytes += Number(file.size || 0);
      if (!file.blobKey) continue;
      try {
        const record = await getWorkshopBytes(file.blobKey);
        if (!record || !(record.bytes instanceof ArrayBuffer)) {
          errors.push(t('Не найдено локальное содержимое файла: ', 'Local file content was not found: ') + path);
          continue;
        }
        if (record.bytes.byteLength !== Number(file.size || 0)) {
          errors.push(t('Размер реального файла не совпадает с манифестом: ', 'Real file size does not match manifest: ') + path);
          continue;
        }
        const digest = await sha256ArrayBuffer(record.bytes);
        if (digest !== String(file.sha256 || '').toLowerCase()) {
          errors.push(t('SHA-256 реального файла не совпадает: ', 'Real file SHA-256 does not match: ') + path);
        }
      } catch (error) {
        errors.push(t('Не удалось проверить содержимое файла: ', 'Could not verify file content: ') + path);
      }
    }

    if (item.type === 'template') {
      const availablePaths = new Set((item.files || []).map(function (file) { return normalizeWorkshopPath(file.path).toLowerCase(); }));
      const missingRefs = [];
      const externalRefs = [];
      for (const file of item.files || []) {
        if (file.kind !== 'document' && file.kind !== 'stylesheet') continue;
        if (!file.blobKey) continue;
        try {
          const record = await getWorkshopBytes(file.blobKey);
          if (!record || !(record.bytes instanceof ArrayBuffer)) continue;
          const text = new TextDecoder().decode(record.bytes);
          const refs = extractWorkshopLocalReferences(text, file.path, file.kind);
          refs.local.forEach(function (ref) {
            if (!availablePaths.has(String(ref.path || '').toLowerCase())) missingRefs.push(file.path + ' → ' + ref.raw);
          });
          refs.external.forEach(function (ref) { externalRefs.push(ref); });
        } catch (error) {
          warnings.push(t('Не удалось проверить локальные ссылки в файле: ', 'Could not inspect local references in file: ') + file.path);
        }
      }
      mergeUnique(missingRefs).slice(0, 20).forEach(function (ref) {
        errors.push(t('В шаблоне отсутствует локальный ресурс: ', 'Template is missing a local resource: ') + ref);
      });
      const externalUnique = mergeUnique(externalRefs);
      if (externalUnique.length) {
        warnings.push(t('Шаблон использует внешние сетевые ресурсы: ', 'Template uses external network resources: ') + externalUnique.slice(0, 5).join(', ') + (externalUnique.length > 5 ? '…' : ''));
      }
    }

    if (totalBytes > WORKSHOP_MAX_PACKAGE_BYTES) {
      errors.push(t('Пакет слишком большой для локальной проверки.', 'Package is too large for local validation.'));
    }

    return {
      item: item,
      errors: mergeUnique(errors),
      warnings: mergeUnique(warnings),
      isReady: mergeUnique(errors).length === 0,
      fingerprint: customsFingerprint(item),
      checkedAt: new Date().toISOString(),
      realBytesChecked: true,
      totalBytes: totalBytes
    };
  }

  function crc32Workshop(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zipDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31);
    const dosDate = (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
    return { dosDate: dosDate, dosTime: dosTime };
  }

  function concatWorkshopBytes(parts) {
    const total = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach(function (part) { out.set(part, offset); offset += part.length; });
    return out;
  }

  function buildWorkshopStoredZip(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    const stamp = zipDosDateTime(new Date());
    let offset = 0;

    (entries || []).forEach(function (entry) {
      const name = String(entry.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!name || name.split('/').includes('..')) throw new Error('Unsafe ZIP path');
      const fileName = encoder.encode(name);
      const content = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || new ArrayBuffer(0));
      const crc = crc32Workshop(content);
      const local = new Uint8Array(30);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, stamp.dosTime, true); lv.setUint16(12, stamp.dosDate, true); lv.setUint32(14, crc, true);
      lv.setUint32(18, content.length, true); lv.setUint32(22, content.length, true); lv.setUint16(26, fileName.length, true); lv.setUint16(28, 0, true);
      localParts.push(local, fileName, content);

      const central = new Uint8Array(46);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.dosTime, true); cv.setUint16(14, stamp.dosDate, true); cv.setUint32(16, crc, true);
      cv.setUint32(20, content.length, true); cv.setUint32(24, content.length, true); cv.setUint16(28, fileName.length, true);
      cv.setUint16(30, 0, true); cv.setUint16(32, 0, true); cv.setUint16(34, 0, true); cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
      centralParts.push(central, fileName);
      offset += local.length + fileName.length + content.length;
    });

    const centralOffset = offset;
    const centralSize = centralParts.reduce(function (sum, part) { return sum + part.length; }, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true); ev.setUint16(20, 0, true);
    return concatWorkshopBytes(localParts.concat(centralParts, [end]));
  }

  function normalizeWorkshopInstalledItems(items) {
    return Array.isArray(items) ? items.filter(function (entry) {
      return entry && entry.packageId && entry.version;
    }) : [];
  }

  function workshopInstalledStateStamp(value) {
    if (!value || typeof value !== 'object') return 0;
    return Date.parse(String(value.updatedAt || '')) || 0;
  }

  function readWorkshopInstalledLocalState() {
    if (!window.localStorage) return { present: false, modern: false, updatedAt: '', items: [] };
    try {
      const raw = window.localStorage.getItem(WORKSHOP_INSTALLED_REGISTRY_KEY);
      if (raw == null) return { present: false, modern: false, updatedAt: '', items: [] };
      const parsed = JSON.parse(raw);
      const metaRaw = window.localStorage.getItem(WORKSHOP_INSTALLED_META_KEY);
      let meta = null;
      try { meta = metaRaw ? JSON.parse(metaRaw) : null; } catch (error) { meta = null; }
      return {
        present: true,
        modern: Boolean(meta && Number(meta.persistenceVersion || 0) >= WORKSHOP_INSTALLED_PERSISTENCE_VERSION),
        updatedAt: meta && meta.updatedAt ? String(meta.updatedAt) : '',
        items: normalizeWorkshopInstalledItems(parsed)
      };
    } catch (error) {
      console.warn('[Workshop] installed local registry read failed', error);
      return { present: false, modern: false, updatedAt: '', items: [] };
    }
  }

  function readWorkshopInstalledDurableState() {
    try {
      const api = window.nsAPI;
      if (!api || typeof api.storageGetModuleStateSync !== 'function') return null;
      const raw = api.storageGetModuleStateSync(WORKSHOP_INSTALLED_DURABLE_KEY, null);
      if (!raw || typeof raw !== 'object') return null;
      return {
        present: true,
        modern: Number(raw.persistenceVersion || 0) >= WORKSHOP_INSTALLED_PERSISTENCE_VERSION,
        updatedAt: raw.updatedAt ? String(raw.updatedAt) : '',
        items: normalizeWorkshopInstalledItems(raw.items)
      };
    } catch (error) {
      console.warn('[Workshop] installed durable registry read failed', error);
      return null;
    }
  }

  function writeWorkshopInstalledRegistry(items) {
    const nextItems = normalizeWorkshopInstalledItems(items);
    const updatedAt = new Date().toISOString();
    const payload = {
      persistenceVersion: WORKSHOP_INSTALLED_PERSISTENCE_VERSION,
      updatedAt: updatedAt,
      items: nextItems
    };

    const api = window.nsAPI;
    if (api && typeof api.storageSetModuleStateSync === 'function') {
      const result = api.storageSetModuleStateSync(WORKSHOP_INSTALLED_DURABLE_KEY, payload);
      if (!result || result.ok !== true) throw new Error('Installed registry durable save failed');
    } else if (!window.localStorage) {
      throw new Error('Installed registry storage unavailable');
    }

    // localStorage is only a fast renderer mirror once Storage Core exists.
    // A localStorage quota/write failure must not turn a durable successful
    // install into a false failure or lose the authoritative registry.
    try {
      if (window.localStorage) {
        window.localStorage.setItem(WORKSHOP_INSTALLED_REGISTRY_KEY, JSON.stringify(nextItems));
        window.localStorage.setItem(WORKSHOP_INSTALLED_META_KEY, JSON.stringify({
          persistenceVersion: WORKSHOP_INSTALLED_PERSISTENCE_VERSION,
          updatedAt: updatedAt
        }));
      }
    } catch (error) {
      console.warn('[Workshop] installed local registry mirror write failed', error);
    }
    return nextItems;
  }

  function readWorkshopInstalledRegistry() {
    const local = readWorkshopInstalledLocalState();
    const durable = readWorkshopInstalledDurableState();

    if (local.present && durable) {
      if (!local.modern) {
        // First upgrade from the old localStorage-only registry: the state the
        // user can currently see is authoritative, including an intentional
        // empty registry after uninstall. Mirror it to Storage Core once.
        try { writeWorkshopInstalledRegistry(local.items); } catch (error) { console.warn('[Workshop] installed registry migration failed', error); }
        return local.items;
      }
      if (!durable.modern) {
        try { writeWorkshopInstalledRegistry(local.items); } catch (error) { console.warn('[Workshop] installed durable registry upgrade failed', error); }
        return local.items;
      }
      const localStamp = workshopInstalledStateStamp(local);
      const durableStamp = workshopInstalledStateStamp(durable);
      if (durableStamp > localStamp) {
        try {
          window.localStorage.setItem(WORKSHOP_INSTALLED_REGISTRY_KEY, JSON.stringify(durable.items));
          window.localStorage.setItem(WORKSHOP_INSTALLED_META_KEY, JSON.stringify({
            persistenceVersion: WORKSHOP_INSTALLED_PERSISTENCE_VERSION,
            updatedAt: durable.updatedAt
          }));
        } catch (error) { console.warn('[Workshop] installed local mirror restore failed', error); }
        return durable.items;
      }
      return local.items;
    }

    if (local.present) {
      if (!local.modern) {
        try { writeWorkshopInstalledRegistry(local.items); } catch (error) { console.warn('[Workshop] installed registry migration failed', error); }
      }
      return local.items;
    }

    if (durable) {
      try {
        window.localStorage.setItem(WORKSHOP_INSTALLED_REGISTRY_KEY, JSON.stringify(durable.items));
        window.localStorage.setItem(WORKSHOP_INSTALLED_META_KEY, JSON.stringify({
          persistenceVersion: WORKSHOP_INSTALLED_PERSISTENCE_VERSION,
          updatedAt: durable.updatedAt || new Date().toISOString()
        }));
      } catch (error) { console.warn('[Workshop] installed local mirror restore failed', error); }
      return durable.items;
    }

    return [];
  }

  // IRGEZTNE_WORKSHOP_WEBSTUDIO_TEMPLATE_CONTRACT_V1
  // Public, read-only adapter boundary. Web Studio may discover installed
  // template packages and request their already-sandboxed preview HTML, but
  // it does not read Workshop private storage internals directly.
  function workshopInstalledTemplateCatalogEntry(record) {
    record = record && typeof record === 'object' ? record : {};
    return {
      installId: String(record.installId || ''),
      packageId: String(record.packageId || ''),
      type: String(record.type || ''),
      title: String(record.title || ''),
      version: String(record.version || ''),
      author: normalizeWorkshopInstalledAuthor(record.author),
      authorLabel: workshopInstalledAuthorLabel(record.author),
      license: String(record.license || ''),
      distribution: String(record.distribution || 'free'),
      description: record.description && typeof record.description === 'object'
        ? { short: String(record.description.short || ''), full: String(record.description.full || '') }
        : { short: '', full: '' },
      tags: Array.isArray(record.tags) ? record.tags.slice() : [],
      preview: record.preview && typeof record.preview === 'object' ? Object.assign({}, record.preview) : {},
      compatibility: record.compatibility && typeof record.compatibility === 'object' ? Object.assign({}, record.compatibility) : {},
      fileCount: Array.isArray(record.files) ? record.files.length : 0,
      installedAt: String(record.installedAt || ''),
      integrity: String(record.integrity || ''),
      algorithm: String(record.algorithm || '')
    };
  }

  function listWorkshopInstalledTemplates() {
    return readWorkshopInstalledRegistry().filter(function (record) {
      if (!record || String(record.type || '') !== 'template') return false;
      const product = String(record.compatibility && record.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    }).map(workshopInstalledTemplateCatalogEntry);
  }

  async function buildWorkshopInstalledTemplatePreview(packageId) {
    const wanted = String(packageId || '');
    const record = readWorkshopInstalledRegistry().find(function (entry) {
      return entry && String(entry.type || '') === 'template' && String(entry.packageId || '') === wanted;
    });
    if (!record) throw new Error(t('Установленный шаблон не найден.', 'Installed template was not found.'));
    return buildWorkshopLivePreview(record);
  }

  // IRGEZTNE_WORKSHOP_WEBSTUDIO_TEMPLATE_MATERIALIZATION_R1W9D
  // This is the first write-intent handoff, but Workshop still owns only the
  // installed library. Web Studio receives a verified copy payload and must
  // persist its own site-local snapshot. No Web Studio private state crosses
  // back into Workshop.
  async function materializeWorkshopInstalledTemplateSnapshotR1W9D(packageId) {
    const wanted = String(packageId || '');
    const record = readWorkshopInstalledRegistry().find(function (entry) {
      if (!entry || String(entry.type || '') !== 'template') return false;
      if (String(entry.packageId || '') !== wanted) return false;
      const product = String(entry.compatibility && entry.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    });
    if (!record) throw new Error(t('Установленный шаблон не найден.', 'Installed template was not found.'));

    const entry = getTemplatePreviewEntry(record);
    if (!entry) throw new Error(t('В шаблоне не найден основной HTML-файл.', 'No main HTML file was found in the template.'));

    const files = [];
    for (const file of record.files || []) {
      if (!file || !file.blobKey) throw new Error(t('Не найдено локальное содержимое файла: ', 'Local file content was not found: ') + String(file && file.path || ''));
      const stored = await getWorkshopBytes(file.blobKey);
      if (!stored || !(stored.bytes instanceof ArrayBuffer)) throw new Error(t('Не найдено локальное содержимое файла: ', 'Local file content was not found: ') + String(file.path || ''));
      const bytes = stored.bytes.slice(0);
      if (bytes.byteLength !== Number(file.size || 0)) throw new Error(t('Размер реального файла не совпадает с манифестом: ', 'Real file size does not match manifest: ') + String(file.path || ''));
      const digest = await sha256ArrayBuffer(bytes);
      if (digest !== String(file.sha256 || '').toLowerCase()) throw new Error(t('SHA-256 реального файла не совпадает: ', 'Real file SHA-256 does not match: ') + String(file.path || ''));
      files.push({
        path: String(file.path || ''),
        role: String(file.role || ''),
        kind: String(file.kind || ''),
        mime: String(file.mime || 'application/octet-stream'),
        size: Number(file.size || bytes.byteLength),
        sha256: digest,
        bytes: bytes
      });
    }

    return {
      ok: true,
      format: 'irgeztne-webstudio-template-snapshot',
      formatVersion: '1.0',
      package: workshopInstalledTemplateCatalogEntry(record),
      entryPath: String(entry.path || 'index.html'),
      files: files,
      previewSrcdoc: await buildWorkshopLivePreview(record),
      materializedAt: new Date().toISOString()
    };
  }


  // IRGEZTNE_WORKSHOP_WEBSTUDIO_THEME_MATERIALIZATION_R1W9E
  function workshopInstalledThemeCatalogEntryR1W9E(record) {
    const base = workshopInstalledTemplateCatalogEntry(record);
    base.theme = record && record.theme && typeof record.theme === 'object' ? Object.assign({}, record.theme) : {};
    return base;
  }

  function listWorkshopInstalledThemesR1W9E() {
    return readWorkshopInstalledRegistry().filter(function (record) {
      if (!record || String(record.type || '') !== 'theme') return false;
      const product = String(record.compatibility && record.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    }).map(workshopInstalledThemeCatalogEntryR1W9E);
  }

  async function materializeWorkshopInstalledThemeSnapshotR1W9E(packageId) {
    const wanted = String(packageId || '');
    const record = readWorkshopInstalledRegistry().find(function (entry) {
      if (!entry || String(entry.type || '') !== 'theme') return false;
      if (String(entry.packageId || '') !== wanted) return false;
      const product = String(entry.compatibility && entry.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    });
    if (!record) throw new Error(t('Установленная тема не найдена.', 'Installed theme was not found.'));
    const themeFile = (record.files || []).find(function (file) { return file && String(file.path || '').toLowerCase() === 'theme.json'; });
    if (!themeFile || !themeFile.blobKey) throw new Error(t('В установленной теме отсутствует theme.json.', 'Installed theme is missing theme.json.'));
    const stored = await getWorkshopBytes(themeFile.blobKey);
    if (!stored || !(stored.bytes instanceof ArrayBuffer)) throw new Error(t('Не найдено локальное содержимое theme.json.', 'Local theme.json content was not found.'));
    const bytes = stored.bytes.slice(0);
    if (bytes.byteLength !== Number(themeFile.size || 0)) throw new Error(t('Размер theme.json не совпадает с манифестом.', 'theme.json size does not match the manifest.'));
    const digest = await sha256ArrayBuffer(bytes);
    if (digest !== String(themeFile.sha256 || '').toLowerCase()) throw new Error(t('SHA-256 theme.json не совпадает.', 'theme.json SHA-256 does not match.'));
    const theme = parseWorkshopThemeDocumentR1W9E(new Uint8Array(bytes));
    return {
      ok: true,
      format: 'irgeztne-webstudio-theme-snapshot',
      formatVersion: '1.0',
      package: workshopInstalledThemeCatalogEntryR1W9E(record),
      theme: theme,
      materializedAt: new Date().toISOString()
    };
  }


  // IRGEZTNE_WORKSHOP_COMPONENT_DOCUMENT_R1W9F
  const WORKSHOP_COMPONENT_FORMAT_R1W9F = 'irgeztne-webstudio-component';

  function strictWorkshopComponentCategoryR1W9F(value) {
    const raw = String(value || 'block').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(raw)) throw new Error(t('Некорректная категория компонента.', 'Invalid component category.'));
    return raw;
  }

  function strictWorkshopComponentEntryR1W9F(value) {
    const raw = strictWorkshopInstallPath(value || 'component.html');
    if (!raw || raw.toLowerCase() !== 'component.html') throw new Error(t('Component v1 использует component.html в корне пакета.', 'Component v1 uses root component.html.'));
    return raw;
  }

  function parseWorkshopComponentDocumentR1W9F(bytes) {
    let documentValue;
    try {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
      documentValue = JSON.parse(new TextDecoder('utf-8').decode(view));
    } catch (error) {
      throw new Error(t('component.json содержит некорректный JSON.', 'component.json contains invalid JSON.'));
    }
    if (!documentValue || documentValue.format !== WORKSHOP_COMPONENT_FORMAT_R1W9F || String(documentValue.formatVersion || '') !== '1.0') {
      throw new Error(t('Неподдерживаемый формат component.json.', 'Unsupported component.json format.'));
    }
    const source = documentValue.component && typeof documentValue.component === 'object' && !Array.isArray(documentValue.component) ? documentValue.component : {};
    return {
      entry: strictWorkshopComponentEntryR1W9F(source.entry || 'component.html'),
      category: strictWorkshopComponentCategoryR1W9F(source.category || 'block')
    };
  }

  function validateWorkshopComponentHtmlR1W9F(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    const html = new TextDecoder('utf-8').decode(view);
    if (!html.trim()) throw new Error(t('component.html пуст.', 'component.html is empty.'));
    if (/<\s*(?:script|style|iframe|object|embed|link|meta|form)\b/i.test(html)) {
      throw new Error(t('Component v1 не разрешает script/style/iframe/object/embed/link/meta/form.', 'Component v1 does not allow script/style/iframe/object/embed/link/meta/form.'));
    }
    if (/\son[a-z0-9_-]+\s*=/i.test(html) || /javascript\s*:/i.test(html) || /\bsrcdoc\s*=/i.test(html)) {
      throw new Error(t('Component v1 содержит исполняемый HTML-атрибут.', 'Component v1 contains an executable HTML attribute.'));
    }
    return html;
  }

  function workshopInstalledComponentCatalogEntryR1W9F(record) {
    const base = workshopInstalledTemplateCatalogEntry(record);
    base.component = record && record.component && typeof record.component === 'object' ? Object.assign({}, record.component) : {};
    return base;
  }

  function listWorkshopInstalledComponentsR1W9F() {
    return readWorkshopInstalledRegistry().filter(function (record) {
      if (!record || String(record.type || '') !== 'component') return false;
      const product = String(record.compatibility && record.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    }).map(workshopInstalledComponentCatalogEntryR1W9F);
  }

  async function materializeWorkshopInstalledComponentSnapshotR1W9F(packageId) {
    const wanted = String(packageId || '');
    const record = readWorkshopInstalledRegistry().find(function (entry) {
      if (!entry || String(entry.type || '') !== 'component') return false;
      if (String(entry.packageId || '') !== wanted) return false;
      const product = String(entry.compatibility && entry.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    });
    if (!record) throw new Error(t('Установленный компонент не найден.', 'Installed component was not found.'));
    const manifestFile = (record.files || []).find(function (file) { return file && String(file.path || '').toLowerCase() === 'component.json'; });
    if (!manifestFile || !manifestFile.blobKey) throw new Error(t('В установленном компоненте отсутствует component.json.', 'Installed component is missing component.json.'));
    const manifestStored = await getWorkshopBytes(manifestFile.blobKey);
    if (!manifestStored || !(manifestStored.bytes instanceof ArrayBuffer)) throw new Error(t('Не найдено локальное содержимое component.json.', 'Local component.json content was not found.'));
    const manifestBytes = manifestStored.bytes.slice(0);
    if (manifestBytes.byteLength !== Number(manifestFile.size || 0)) throw new Error(t('Размер component.json не совпадает с манифестом.', 'component.json size does not match manifest.'));
    const manifestDigest = await sha256ArrayBuffer(manifestBytes);
    if (manifestDigest !== String(manifestFile.sha256 || '').toLowerCase()) throw new Error(t('SHA-256 component.json не совпадает.', 'component.json SHA-256 does not match.'));
    const component = parseWorkshopComponentDocumentR1W9F(new Uint8Array(manifestBytes));
    const htmlFile = (record.files || []).find(function (file) { return file && String(file.path || '').toLowerCase() === String(component.entry || '').toLowerCase(); });
    if (!htmlFile || !htmlFile.blobKey) throw new Error(t('В установленном компоненте отсутствует component.html.', 'Installed component is missing component.html.'));
    const htmlStored = await getWorkshopBytes(htmlFile.blobKey);
    if (!htmlStored || !(htmlStored.bytes instanceof ArrayBuffer)) throw new Error(t('Не найдено локальное содержимое component.html.', 'Local component.html content was not found.'));
    const htmlBytes = htmlStored.bytes.slice(0);
    if (htmlBytes.byteLength !== Number(htmlFile.size || 0)) throw new Error(t('Размер component.html не совпадает с манифестом.', 'component.html size does not match manifest.'));
    const htmlDigest = await sha256ArrayBuffer(htmlBytes);
    if (htmlDigest !== String(htmlFile.sha256 || '').toLowerCase()) throw new Error(t('SHA-256 component.html не совпадает.', 'component.html SHA-256 does not match.'));
    const html = validateWorkshopComponentHtmlR1W9F(new Uint8Array(htmlBytes));
    return {
      ok: true,
      format: 'irgeztne-webstudio-component-snapshot',
      formatVersion: '1.0',
      package: workshopInstalledComponentCatalogEntryR1W9F(record),
      component: component,
      html: html,
      materializedAt: new Date().toISOString()
    };
  }


  // IRGEZTNE_WORKSHOP_WIDGET_CONTRACT_RECONCILIATION_R1W9H
  // Widget Contract v1: runtime, placement and management are independent.
  // Workshop validates the package; Web Studio owns configuration, Host Surface
  // geometry and creation of site-local Widget Instances.
  const WORKSHOP_WIDGET_FORMAT_R1W9G = 'irgeztne-webstudio-widget';
  const WORKSHOP_WIDGET_PLACEMENT_MODES_R1W9H = ['flow', 'region', 'bar', 'floating'];
  const WORKSHOP_WIDGET_SIZES_R1W9H = ['compact', 'medium', 'wide', 'full'];
  const WORKSHOP_WIDGET_ALIGN_R1W9H = ['left', 'center', 'right', 'stretch'];
  const WORKSHOP_WIDGET_REGIONS_R1W9H = ['page-top', 'after-header', 'main-start', 'main-end', 'before-footer', 'page-bottom'];
  const WORKSHOP_WIDGET_FLOATING_R1W9H = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  const WORKSHOP_WIDGET_SETTING_TYPES_R1W9H = ['text', 'textarea', 'number', 'boolean', 'select', 'multi-select', 'color', 'url', 'public-id'];

  function strictWorkshopWidgetCategoryR1W9G(value) {
    const raw = String(value || 'interactive').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(raw)) throw new Error(t('Некорректная категория виджета.', 'Invalid widget category.'));
    return raw;
  }

  function strictWorkshopWidgetEntryR1W9G(value) {
    const raw = strictWorkshopInstallPath(value || 'widget.html');
    if (!raw || raw.toLowerCase() !== 'widget.html') throw new Error(t('Локальный Widget v1 использует widget.html в корне пакета.', 'Local Widget v1 uses root widget.html.'));
    return raw;
  }

  function normalizeWorkshopWidgetOriginR1W9G(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      if (parsed.username || parsed.password) return '';
      return parsed.origin;
    } catch (error) {
      return '';
    }
  }

  function strictWorkshopHostedUrlR1W9H(value) {
    const raw = String(value || '').trim();
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('bad');
      return parsed.toString();
    } catch (error) {
      throw new Error(t('Hosted Widget требует корректный HTTPS URL.', 'Hosted Widget requires a valid HTTPS URL.'));
    }
  }

  function widgetTokenListR1W9H(values, allowed, fallback, label) {
    const source = Array.isArray(values) ? values : [];
    const out = [];
    source.forEach(function (value) {
      const token = String(value || '').trim().toLowerCase();
      if (!token || allowed.indexOf(token) < 0) throw new Error(t('Некорректное значение Widget: ', 'Invalid Widget value: ') + label + ' = ' + String(value || ''));
      if (out.indexOf(token) < 0) out.push(token);
    });
    if (!out.length && fallback) out.push(fallback);
    return out;
  }

  function widgetPreferredTokenR1W9H(value, allowedValues, fallback) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw && allowedValues.indexOf(raw) >= 0) return raw;
    return fallback || allowedValues[0] || '';
  }

  function normalizeWorkshopWidgetSettingsR1W9H(source) {
    const fieldsSource = source && Array.isArray(source.fields) ? source.fields : [];
    if (fieldsSource.length > 24) throw new Error(t('Widget v1 допускает не более 24 полей настроек.', 'Widget v1 allows at most 24 settings fields.'));
    const seen = new Set();
    return fieldsSource.map(function (field) {
      field = field && typeof field === 'object' && !Array.isArray(field) ? field : {};
      const key = String(field.key || '').trim();
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key)) throw new Error(t('Некорректный ключ настройки Widget.', 'Invalid Widget setting key.'));
      if (/(?:password|passwd|secret|token|private[-_.]?key|api[-_.]?key|credential)/i.test(key)) {
        throw new Error(t('Секретные поля запрещены в публичной конфигурации Widget: ', 'Secret-like fields are forbidden in public Widget configuration: ') + key);
      }
      if (seen.has(key)) throw new Error(t('Повторяющийся ключ настройки Widget: ', 'Duplicate Widget setting key: ') + key);
      seen.add(key);
      const type = String(field.type || 'text').trim().toLowerCase();
      if (WORKSHOP_WIDGET_SETTING_TYPES_R1W9H.indexOf(type) < 0) throw new Error(t('Неподдерживаемый тип настройки Widget: ', 'Unsupported Widget setting type: ') + type);
      const item = {
        key: key,
        type: type,
        label: String(field.label || key).slice(0, 120),
        description: String(field.description || '').slice(0, 360),
        required: field.required === true
      };
      if (Object.prototype.hasOwnProperty.call(field, 'default')) item.default = field.default;
      if (type === 'select' || type === 'multi-select') {
        const options = Array.isArray(field.options) ? field.options : [];
        if (!options.length || options.length > 64) throw new Error(t('Select-настройка Widget требует от 1 до 64 вариантов.', 'Widget select setting requires 1 to 64 options.'));
        item.options = options.map(function (option) {
          if (option && typeof option === 'object' && !Array.isArray(option)) {
            return { value: String(option.value == null ? '' : option.value).slice(0, 160), label: String(option.label == null ? option.value : option.label).slice(0, 160) };
          }
          return { value: String(option).slice(0, 160), label: String(option).slice(0, 160) };
        });
      }
      if (type === 'number') {
        if (Number.isFinite(Number(field.min))) item.min = Number(field.min);
        if (Number.isFinite(Number(field.max))) item.max = Number(field.max);
        if (item.min != null && item.max != null && item.min > item.max) throw new Error(t('Некорректный диапазон числовой настройки Widget.', 'Invalid numeric Widget setting range.'));
      }
      if (Object.prototype.hasOwnProperty.call(item, 'default')) {
        const value = item.default;
        if (type === 'boolean' && typeof value !== 'boolean') throw new Error(t('Default boolean-настройки Widget должен быть boolean: ', 'Widget boolean setting default must be boolean: ') + key);
        if (type === 'number') {
          const n = Number(value);
          if (!Number.isFinite(n) || (item.min != null && n < item.min) || (item.max != null && n > item.max)) throw new Error(t('Default числовой настройки Widget вне допустимого диапазона: ', 'Widget numeric setting default is outside the allowed range: ') + key);
          item.default = n;
        }
        if (type === 'select') {
          const allowed = (item.options || []).map(function (option) { return String(option.value); });
          if (allowed.indexOf(String(value)) < 0) throw new Error(t('Default select-настройки Widget отсутствует среди options: ', 'Widget select setting default is not in options: ') + key);
          item.default = String(value);
        }
        if (type === 'multi-select') {
          if (!Array.isArray(value)) throw new Error(t('Default multi-select Widget должен быть массивом: ', 'Widget multi-select default must be an array: ') + key);
          const allowed = (item.options || []).map(function (option) { return String(option.value); });
          const normalized = value.map(String);
          if (normalized.some(function (option) { return allowed.indexOf(option) < 0; })) throw new Error(t('Default multi-select Widget содержит неизвестное значение: ', 'Widget multi-select default contains an unknown value: ') + key);
          item.default = normalized;
        }
        if (type === 'color') {
          const raw = String(value || '').trim();
          if (raw && !/^#[0-9a-f]{3,8}$/i.test(raw)) throw new Error(t('Некорректный default цвета Widget: ', 'Invalid Widget color default: ') + key);
          item.default = raw;
        }
        if (type === 'url') {
          const raw = String(value || '').trim();
          if (raw) {
            try {
              const parsed = new URL(raw);
              if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.username || parsed.password) throw new Error('scheme');
              item.default = parsed.toString();
            } catch (error) { throw new Error(t('Некорректный default URL Widget: ', 'Invalid Widget URL default: ') + key); }
          } else item.default = '';
        }
        if (type === 'public-id') {
          const raw = String(value || '').trim();
          if (raw && !/^[A-Za-z0-9._:@/-]{1,200}$/.test(raw)) throw new Error(t('Некорректный default public ID Widget: ', 'Invalid Widget public ID default: ') + key);
          item.default = raw;
        }
        if ((type === 'text' || type === 'textarea') && typeof value !== 'string') throw new Error(t('Default текстовой настройки Widget должен быть строкой: ', 'Widget text setting default must be a string: ') + key);
      }
      return item;
    });
  }

  function normalizeWorkshopWidgetSizeHintsR1W9H(source, legacyHeight) {
    source = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    function bounded(value, fallback, min, max) {
      const n = Number(value == null ? fallback : value);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(min, Math.min(max, Math.round(n)));
    }
    const minWidth = bounded(source.minWidth, 180, 120, 2400);
    const maxWidth = Math.max(minWidth, bounded(source.maxWidth, 960, 120, 2400));
    const preferredWidth = Math.max(minWidth, Math.min(maxWidth, bounded(source.preferredWidth, 420, 120, 2400)));
    const minHeight = bounded(source.minHeight, 80, 60, 1600);
    const maxHeight = Math.max(minHeight, bounded(source.maxHeight, Math.max(Number(legacyHeight || 260), 1200), 80, 2400));
    const preferredHeight = Math.max(minHeight, Math.min(maxHeight, bounded(source.preferredHeight, legacyHeight || 260, 80, 1600)));
    const rawHeightMode = String(source.heightMode || 'fixed').trim().toLowerCase();
    if (rawHeightMode !== 'fixed' && rawHeightMode !== 'content') throw new Error(t('Некорректный heightMode Widget.', 'Invalid Widget heightMode.'));
    return {
      minWidth: minWidth,
      preferredWidth: preferredWidth,
      maxWidth: maxWidth,
      minHeight: minHeight,
      preferredHeight: preferredHeight,
      maxHeight: maxHeight,
      heightMode: rawHeightMode
    };
  }

  function parseWorkshopWidgetDocumentR1W9G(bytes) {
    let documentValue;
    try {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
      documentValue = JSON.parse(new TextDecoder('utf-8').decode(view));
    } catch (error) {
      throw new Error(t('widget.json содержит некорректный JSON.', 'widget.json contains invalid JSON.'));
    }
    if (!documentValue || documentValue.format !== WORKSHOP_WIDGET_FORMAT_R1W9G || String(documentValue.formatVersion || '') !== '1.0') {
      throw new Error(t('Неподдерживаемый формат widget.json.', 'Unsupported widget.json format.'));
    }
    const source = documentValue.widget && typeof documentValue.widget === 'object' && !Array.isArray(documentValue.widget) ? documentValue.widget : {};
    const capsSource = source.capabilities && typeof source.capabilities === 'object' && !Array.isArray(source.capabilities) ? source.capabilities : {};
    const origins = Array.isArray(capsSource.externalOrigins) ? capsSource.externalOrigins : [];
    const normalizedOrigins = [];
    origins.forEach(function (origin) {
      const safe = normalizeWorkshopWidgetOriginR1W9G(origin);
      if (!safe) throw new Error(t('Некорректный внешний origin виджета: ', 'Invalid widget external origin: ') + String(origin || ''));
      if (normalizedOrigins.indexOf(safe) < 0) normalizedOrigins.push(safe);
    });
    if (normalizedOrigins.length > 16) throw new Error(t('Слишком много внешних origins у виджета.', 'Too many external origins for widget.'));

    const legacy = !source.runtime;
    const runtimeSource = source.runtime && typeof source.runtime === 'object' && !Array.isArray(source.runtime) ? source.runtime : {};
    const runtimeMode = String(runtimeSource.mode || 'local').trim().toLowerCase();
    if (runtimeMode !== 'local' && runtimeMode !== 'hosted') throw new Error(t('Widget v1 поддерживает runtime local или hosted.', 'Widget v1 supports local or hosted runtime.'));

    const managementSource = source.management && typeof source.management === 'object' && !Array.isArray(source.management) ? source.management : {};
    const managementMode = String(managementSource.mode || 'local').trim().toLowerCase();
    if (['local', 'external', 'hybrid'].indexOf(managementMode) < 0) throw new Error(t('Некорректный management mode Widget.', 'Invalid Widget management mode.'));

    const placementSource = source.placement && typeof source.placement === 'object' && !Array.isArray(source.placement) ? source.placement : {};
    const modes = widgetTokenListR1W9H(placementSource.modes, WORKSHOP_WIDGET_PLACEMENT_MODES_R1W9H, 'flow', 'placement.modes');
    const sizes = widgetTokenListR1W9H(placementSource.sizes, WORKSHOP_WIDGET_SIZES_R1W9H, legacy ? 'medium' : 'compact', 'placement.sizes');
    const aligns = widgetTokenListR1W9H(placementSource.align, WORKSHOP_WIDGET_ALIGN_R1W9H, 'center', 'placement.align');
    const regions = widgetTokenListR1W9H(placementSource.regions, WORKSHOP_WIDGET_REGIONS_R1W9H, 'main-end', 'placement.regions');
    const floatingPositions = widgetTokenListR1W9H(placementSource.floatingPositions, WORKSHOP_WIDGET_FLOATING_R1W9H, 'bottom-right', 'placement.floatingPositions');

    const settingsSource = source.settings && typeof source.settings === 'object' && !Array.isArray(source.settings) ? source.settings : {};
    const normalizedSettings = normalizeWorkshopWidgetSettingsR1W9H(settingsSource);
    const settingKeys = new Set(normalizedSettings.map(function (field) { return String(field.key || ''); }));
    const themeSource = source.theme && typeof source.theme === 'object' && !Array.isArray(source.theme) ? source.theme : {};
    const themeMode = String(themeSource.mode || (legacy ? 'self-contained' : 'inherit')).trim().toLowerCase();
    if (['inherit', 'variants', 'self-contained'].indexOf(themeMode) < 0) throw new Error(t('Некорректный theme mode Widget.', 'Invalid Widget theme mode.'));

    const allowedCapabilityKeys = new Set(['javascript', 'network', 'externalOrigins', 'localStorage', 'externalLinks']);
    Object.keys(capsSource).forEach(function (key) {
      if (!allowedCapabilityKeys.has(key)) throw new Error(t('Неподдерживаемая capability Widget: ', 'Unsupported Widget capability: ') + key);
    });
    if (capsSource.localStorage === true) throw new Error(t('Local instance storage зарезервирован и пока не включён в Widget v1.', 'Local instance storage is reserved and not enabled in Widget v1 yet.'));
    if (capsSource.externalLinks === true) throw new Error(t('External links capability зарезервирована и пока не включена в Widget v1.', 'External links capability is reserved and not enabled in Widget v1 yet.'));

    const javascript = capsSource.javascript === true;
    let network = capsSource.network === true;
    let runtime = { mode: runtimeMode };
    if (runtimeMode === 'local') {
      runtime.entry = strictWorkshopWidgetEntryR1W9G(runtimeSource.entry || source.entry || 'widget.html');
    } else {
      runtime.url = strictWorkshopHostedUrlR1W9H(runtimeSource.url || '');
      runtime.query = {};
      const querySource = runtimeSource.query && typeof runtimeSource.query === 'object' && !Array.isArray(runtimeSource.query) ? runtimeSource.query : {};
      Object.keys(querySource).forEach(function (param) {
        const safeParam = String(param || '').trim();
        const settingKey = String(querySource[param] || '').trim();
        if (!/^[A-Za-z0-9_.-]{1,64}$/.test(safeParam) || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(settingKey)) throw new Error(t('Некорректная hosted query mapping.', 'Invalid hosted query mapping.'));
        if (!settingKeys.has(settingKey)) throw new Error(t('Hosted query ссылается на неизвестную настройку Widget: ', 'Hosted query references an unknown Widget setting: ') + settingKey);
        runtime.query[safeParam] = settingKey;
      });
      const hostedOrigin = normalizeWorkshopWidgetOriginR1W9G(runtime.url);
      if (hostedOrigin && normalizedOrigins.indexOf(hostedOrigin) < 0) normalizedOrigins.push(hostedOrigin);
      network = true;
    }
    if (!network && normalizedOrigins.length) throw new Error(t('Внешние origins требуют capability Network: yes.', 'External origins require Network: yes.'));

    const legacyHeight = Number(source.height == null ? 260 : source.height);
    if (legacy && (!Number.isInteger(legacyHeight) || legacyHeight < 120 || legacyHeight > 1200)) throw new Error(t('Высота legacy Widget должна быть от 120 до 1200 px.', 'Legacy Widget height must be between 120 and 1200 px.'));
    const size = normalizeWorkshopWidgetSizeHintsR1W9H(source.size, legacyHeight);

    return {
      contract: '1.0',
      legacyProfile: legacy === true,
      entry: runtime.mode === 'local' ? runtime.entry : '',
      category: strictWorkshopWidgetCategoryR1W9G(source.category || 'interactive'),
      height: size.preferredHeight,
      runtime: runtime,
      management: {
        mode: managementMode,
        dashboardUrl: managementSource.dashboardUrl ? strictWorkshopHostedUrlR1W9H(managementSource.dashboardUrl) : ''
      },
      placement: {
        modes: modes,
        preferredMode: widgetPreferredTokenR1W9H(placementSource.preferredMode, modes, modes[0]),
        sizes: sizes,
        preferredSize: widgetPreferredTokenR1W9H(placementSource.preferredSize, sizes, sizes[0]),
        align: aligns,
        preferredAlign: widgetPreferredTokenR1W9H(placementSource.preferredAlign, aligns, aligns[0]),
        regions: regions,
        preferredRegion: widgetPreferredTokenR1W9H(placementSource.preferredRegion, regions, regions[0]),
        floatingPositions: floatingPositions,
        preferredFloatingPosition: widgetPreferredTokenR1W9H(placementSource.preferredFloatingPosition, floatingPositions, floatingPositions[0])
      },
      settings: { fields: normalizedSettings },
      theme: {
        mode: themeMode,
        variants: widgetTokenListR1W9H(themeSource.variants, ['light', 'dark'], themeMode === 'variants' ? 'light' : '', 'theme.variants')
      },
      size: size,
      capabilities: {
        javascript: javascript,
        network: network,
        externalOrigins: normalizedOrigins,
        localStorage: capsSource.localStorage === true,
        externalLinks: capsSource.externalLinks === true
      }
    };
  }

  function extractWorkshopWidgetExternalOriginsR1W9G(html) {
    const found = [];
    String(html || '').replace(/https?:\/\/[^\s"'<>`)]+/gi, function (raw) {
      const safe = normalizeWorkshopWidgetOriginR1W9G(raw.replace(/[),.;]+$/g, ''));
      if (safe && found.indexOf(safe) < 0) found.push(safe);
      return raw;
    });
    return found;
  }

  function validateWorkshopWidgetHtmlR1W9G(bytes, widget) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    const html = new TextDecoder('utf-8').decode(view);
    if (!html.trim()) throw new Error(t('widget.html пуст.', 'widget.html is empty.'));
    if (/<\s*base\b/i.test(html) || /\bsrcdoc\s*=/i.test(html)) throw new Error(t('Widget v1 не разрешает base/srcdoc.', 'Widget v1 does not allow base/srcdoc.'));
    if (/\b(?:file|chrome|electron|node|javascript)\s*:/i.test(html)) throw new Error(t('Widget v1 содержит запрещённую URL-схему.', 'Widget v1 contains a forbidden URL scheme.'));
    if (/<\s*(?:object|embed)\b/i.test(html)) throw new Error(t('Widget v1 не разрешает object/embed markup.', 'Widget v1 does not allow object/embed markup.'));
    const capabilities = widget && widget.capabilities || {};
    const hasExecutableMarkup = /<\s*script\b/i.test(html) || /\son[a-z0-9_-]+\s*=/i.test(html);
    if (hasExecutableMarkup && capabilities.javascript !== true) throw new Error(t('widget.html содержит JavaScript, но capability JavaScript не объявлен.', 'widget.html contains JavaScript but JavaScript capability is not declared.'));
    const external = extractWorkshopWidgetExternalOriginsR1W9G(html);
    if (external.length && capabilities.network !== true) throw new Error(t('widget.html использует сеть, но capability Network не объявлен.', 'widget.html uses network resources but Network capability is not declared.'));
    const declared = Array.isArray(capabilities.externalOrigins) ? capabilities.externalOrigins : [];
    external.forEach(function (origin) {
      if (declared.indexOf(origin) < 0) throw new Error(t('Внешний origin не объявлен в widget.json: ', 'External origin is not declared in widget.json: ') + origin);
    });
    return html;
  }

  function workshopInstalledWidgetCatalogEntryR1W9G(record) {
    const base = workshopInstalledTemplateCatalogEntry(record);
    base.widget = record && record.widget && typeof record.widget === 'object' ? JSON.parse(JSON.stringify(record.widget)) : {};
    return base;
  }

  function listWorkshopInstalledWidgetsR1W9G() {
    return readWorkshopInstalledRegistry().filter(function (record) {
      if (!record || String(record.type || '') !== 'widget') return false;
      const product = String(record.compatibility && record.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    }).map(workshopInstalledWidgetCatalogEntryR1W9G);
  }

  async function materializeWorkshopInstalledWidgetSnapshotR1W9G(packageId) {
    const wanted = String(packageId || '');
    const record = readWorkshopInstalledRegistry().find(function (entry) {
      if (!entry || String(entry.type || '') !== 'widget') return false;
      if (String(entry.packageId || '') !== wanted) return false;
      const product = String(entry.compatibility && entry.compatibility.product || 'webstudio').trim().toLowerCase();
      return !product || product === 'webstudio';
    });
    if (!record) throw new Error(t('Установленный виджет не найден.', 'Installed widget was not found.'));
    const manifestFile = (record.files || []).find(function (file) { return file && String(file.path || '').toLowerCase() === 'widget.json'; });
    if (!manifestFile || !manifestFile.blobKey) throw new Error(t('В установленном виджете отсутствует widget.json.', 'Installed widget is missing widget.json.'));
    const manifestStored = await getWorkshopBytes(manifestFile.blobKey);
    if (!manifestStored || !(manifestStored.bytes instanceof ArrayBuffer)) throw new Error(t('Не найдено локальное содержимое widget.json.', 'Local widget.json content was not found.'));
    const manifestBytes = manifestStored.bytes.slice(0);
    if (manifestBytes.byteLength !== Number(manifestFile.size || 0)) throw new Error(t('Размер widget.json не совпадает с манифестом.', 'widget.json size does not match manifest.'));
    const manifestDigest = await sha256ArrayBuffer(manifestBytes);
    if (manifestDigest !== String(manifestFile.sha256 || '').toLowerCase()) throw new Error(t('SHA-256 widget.json не совпадает.', 'widget.json SHA-256 does not match.'));
    const widget = parseWorkshopWidgetDocumentR1W9G(new Uint8Array(manifestBytes));
    let html = '';
    if (widget.runtime && widget.runtime.mode === 'local') {
      const htmlFile = (record.files || []).find(function (file) { return file && String(file.path || '').toLowerCase() === String(widget.runtime.entry || widget.entry || '').toLowerCase(); });
      if (!htmlFile || !htmlFile.blobKey) throw new Error(t('В установленном локальном виджете отсутствует widget.html.', 'Installed local widget is missing widget.html.'));
      const htmlStored = await getWorkshopBytes(htmlFile.blobKey);
      if (!htmlStored || !(htmlStored.bytes instanceof ArrayBuffer)) throw new Error(t('Не найдено локальное содержимое widget.html.', 'Local widget.html content was not found.'));
      const htmlBytes = htmlStored.bytes.slice(0);
      if (htmlBytes.byteLength !== Number(htmlFile.size || 0)) throw new Error(t('Размер widget.html не совпадает с манифестом.', 'widget.html size does not match manifest.'));
      const htmlDigest = await sha256ArrayBuffer(htmlBytes);
      if (htmlDigest !== String(htmlFile.sha256 || '').toLowerCase()) throw new Error(t('SHA-256 widget.html не совпадает.', 'widget.html SHA-256 does not match.'));
      html = validateWorkshopWidgetHtmlR1W9G(new Uint8Array(htmlBytes), widget);
    }
    return {
      ok: true,
      format: 'irgeztne-webstudio-widget-snapshot',
      formatVersion: '1.0',
      package: workshopInstalledWidgetCatalogEntryR1W9G(record),
      widget: widget,
      html: html,
      materializedAt: new Date().toISOString()
    };
  }

  async function uninstallWorkshopInstalledPackage(installId) {
    const registry = readWorkshopInstalledRegistry();
    const requestedInstallId = String(installId || '');
    const record = registry.find(function (entry) {
      const entryInstallId = String(entry.installId || (String(entry.packageId || '') + '@' + String(entry.version || '')));
      return entryInstallId === requestedInstallId;
    });
    if (!record) {
      setNotice(t('Установленный пакет не найден.', 'Installed package was not found.'));
      return;
    }

    const title = String(record.title || t('Пакет без названия', 'Untitled package'));
    const version = String(record.version || '');
    const confirmed = window.confirm(t(
      'Удалить установленный пакет «' + title + '» версии ' + version + '? Авторский пакет в «Мои пакеты» затронут не будет.',
      'Remove installed package “' + title + '” version ' + version + '? The creator package in My Packages will not be changed.'
    ));
    if (!confirmed) return;

    const recordInstallId = String(record.installId || (String(record.packageId || '') + '@' + String(record.version || '')));
    const nextRegistry = registry.filter(function (entry) {
      const entryInstallId = String(entry.installId || (String(entry.packageId || '') + '@' + String(entry.version || '')));
      return entryInstallId !== recordInstallId;
    });
    const blobKeys = (record.files || []).map(function (file) { return file && file.blobKey; }).filter(Boolean);
    try {
      writeWorkshopInstalledRegistry(nextRegistry);
      try {
        await deleteWorkshopBytesBatch(blobKeys);
      } catch (deleteError) {
        try { writeWorkshopInstalledRegistry(registry); } catch (restoreError) { console.warn('[Workshop] installed registry restore failed', restoreError); }
        throw deleteError;
      }
      uiState.view = VIEW_INSTALLED;
      setInstallFeedback('success', t('Установленная копия удалена. Авторский пакет в «Мои пакеты» не изменён.', 'Installed copy removed. The creator package in My Packages was not changed.'));
      setNotice(t('Установленная копия удалена. Авторский пакет в «Мои пакеты» не изменён.', 'Installed copy removed. The creator package in My Packages was not changed.'));
    } catch (error) {
      console.warn('[Workshop] uninstall failed', error);
      setInstallFeedback('error', t('Не удалось удалить установленный пакет.', 'Could not remove the installed package.'));
      setNotice(t('Не удалось удалить установленный пакет.', 'Could not remove the installed package.'));
    }
  }

  function workshopSemverParts(value) {
    const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  }

  function compareWorkshopSemver(left, right) {
    const a = workshopSemverParts(left);
    const b = workshopSemverParts(right);
    if (!a || !b) return null;
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  }

  function strictWorkshopInstallPath(value) {
    const raw = String(value || '');
    if (!raw || raw.indexOf('\0') >= 0 || raw.indexOf('\\') >= 0 || raw[0] === '/' || /^[A-Za-z]:/.test(raw)) return '';
    const parts = raw.split('/');
    if (parts.some(function (part) { return !part || part === '.' || part === '..'; })) return '';
    return parts.join('/');
  }

  function workshopInstallPathIsForbidden(path) {
    return /\.(?:exe|msi|bat|cmd|com|scr|ps1|appimage|dmg|pkg|deb|rpm|dll|dylib|so|node|jar)$/i.test(String(path || ''));
  }

  function normalizeWorkshopInstalledAuthor(author) {
    if (author && typeof author === 'object' && !Array.isArray(author)) {
      return {
        name: String(author.name || '').trim(),
        id: String(author.id || '').trim(),
        source: String(author.source || '').trim()
      };
    }
    const text = String(author || '').trim();
    return text && text !== '[object Object]' ? text : '';
  }

  function workshopInstalledAuthorLabel(author) {
    if (author && typeof author === 'object' && !Array.isArray(author)) {
      return String(author.name || author.id || '').trim() || '—';
    }
    const text = String(author || '').trim();
    return text && text !== '[object Object]' ? text : '—';
  }

  function workshopInstalledDestination(type) {
    const labels = {
      template: t('Шаблоны Web Studio', 'Web Studio Templates'),
      theme: t('Дизайн / темы', 'Design / themes'),
      component: t('Библиотека компонентов', 'Component library'),
      widget: t('Библиотека виджетов сайта', 'Site widget library')
    };
    return labels[type] || t('Web Studio', 'Web Studio');
  }


  // IRGEZTNE_WORKSHOP_THEME_DOCUMENT_R1W9E
  const WORKSHOP_THEME_FORMAT_R1W9E = 'irgeztne-webstudio-theme';
  const WORKSHOP_THEME_FIELDS_R1W9E = ['accentColor', 'menuColor', 'buttonColor', 'backgroundColor', 'textColor', 'fontFamily', 'headingFont'];
  const WORKSHOP_THEME_COLOR_FIELDS_R1W9E = ['accentColor', 'menuColor', 'buttonColor', 'backgroundColor', 'textColor'];
  const WORKSHOP_THEME_FONT_FIELDS_R1W9E = ['fontFamily', 'headingFont'];
  const WORKSHOP_THEME_FONTS_R1W9E = new Set(['Inter', 'system', 'Manrope', 'Montserrat', 'Rubik', 'Nunito', 'Comfortaa', 'Oswald', 'Playfair', 'serif', 'geometric', 'JetBrains', 'mono']);

  function normalizeWorkshopThemePayloadR1W9E(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    if (!source) throw new Error(t('theme.json должен содержать объект theme.', 'theme.json must contain a theme object.'));
    const result = {};
    WORKSHOP_THEME_COLOR_FIELDS_R1W9E.forEach(function (key) {
      if (source[key] == null || source[key] === '') return;
      const raw = String(source[key]).trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(raw)) throw new Error(t('Некорректный цвет темы: ', 'Invalid theme color: ') + key);
      result[key] = raw.toLowerCase();
    });
    WORKSHOP_THEME_FONT_FIELDS_R1W9E.forEach(function (key) {
      if (source[key] == null || source[key] === '') return;
      const raw = String(source[key]).trim();
      if (!WORKSHOP_THEME_FONTS_R1W9E.has(raw)) throw new Error(t('Неподдерживаемый шрифт темы: ', 'Unsupported theme font: ') + raw);
      result[key] = raw;
    });
    if (!Object.keys(result).length) throw new Error(t('theme.json не содержит поддерживаемых параметров дизайна.', 'theme.json contains no supported design fields.'));
    return result;
  }

  function parseWorkshopThemeDocumentR1W9E(bytes) {
    let documentValue;
    try {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
      documentValue = JSON.parse(new TextDecoder('utf-8').decode(view));
    } catch (error) {
      throw new Error(t('theme.json содержит некорректный JSON.', 'theme.json contains invalid JSON.'));
    }
    if (!documentValue || documentValue.format !== WORKSHOP_THEME_FORMAT_R1W9E || String(documentValue.formatVersion || '') !== '1.0') {
      throw new Error(t('Неподдерживаемый формат theme.json.', 'Unsupported theme.json format.'));
    }
    return normalizeWorkshopThemePayloadR1W9E(documentValue.theme);
  }

  function findWorkshopZipEnd(bytes) {
    const minimum = Math.max(0, bytes.length - 65557);
    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x05 && bytes[offset + 3] === 0x06) return offset;
    }
    return -1;
  }

  async function inflateWorkshopZipEntry(bytes, expectedSize) {
    if (typeof DecompressionStream !== 'function') throw new Error(t('ZIP использует сжатие, которое эта версия Workspace не может распаковать.', 'The ZIP uses compression this Workspace build cannot unpack.'));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const chunk = part.value instanceof Uint8Array ? part.value : new Uint8Array(part.value || 0);
      total += chunk.length;
      if (total > Number(expectedSize || 0) || total > WORKSHOP_MAX_FILE_BYTES) {
        try { await reader.cancel(); } catch (error) {}
        throw new Error(t('Распакованный файл превышает заявленный размер.', 'Unpacked file exceeds its declared size.'));
      }
      chunks.push(chunk);
    }
    return concatWorkshopBytes(chunks);
  }

  async function parseWorkshopZip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer || new ArrayBuffer(0));
    if (!bytes.length) throw new Error(t('ZIP пуст.', 'The ZIP is empty.'));
    if (bytes.length > WORKSHOP_MAX_ZIP_BYTES) throw new Error(t('ZIP слишком большой для локальной установки.', 'The ZIP is too large for local installation.'));
    const endOffset = findWorkshopZipEnd(bytes);
    if (endOffset < 0) throw new Error(t('Не найден центральный каталог ZIP.', 'ZIP central directory was not found.'));
    const endView = new DataView(bytes.buffer, bytes.byteOffset + endOffset, bytes.length - endOffset);
    const disk = endView.getUint16(4, true);
    const centralDisk = endView.getUint16(6, true);
    const entriesOnDisk = endView.getUint16(8, true);
    const entryCount = endView.getUint16(10, true);
    const centralSize = endView.getUint32(12, true);
    const centralOffset = endView.getUint32(16, true);
    if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) throw new Error(t('Многотомные ZIP не поддерживаются.', 'Multi-disk ZIP files are not supported.'));
    if (entryCount < 1 || entryCount > WORKSHOP_MAX_FILES + 16) throw new Error(t('Некорректное количество файлов в ZIP.', 'Invalid ZIP entry count.'));
    if (centralOffset + centralSize > bytes.length) throw new Error(t('Повреждён центральный каталог ZIP.', 'ZIP central directory is corrupt.'));

    const decoder = new TextDecoder('utf-8');
    const result = [];
    const seen = new Set();
    let totalBytes = 0;
    let cursor = centralOffset;

    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > bytes.length) throw new Error(t('Повреждена запись ZIP.', 'ZIP entry is corrupt.'));
      const view = new DataView(bytes.buffer, bytes.byteOffset + cursor, bytes.length - cursor);
      if (view.getUint32(0, true) !== 0x02014b50) throw new Error(t('Повреждён центральный каталог ZIP.', 'ZIP central directory is corrupt.'));
      const flags = view.getUint16(8, true);
      const method = view.getUint16(10, true);
      const crc = view.getUint32(16, true);
      const compressedSize = view.getUint32(20, true);
      const uncompressedSize = view.getUint32(24, true);
      const nameLength = view.getUint16(28, true);
      const extraLength = view.getUint16(30, true);
      const commentLength = view.getUint16(32, true);
      const localOffset = view.getUint32(42, true);
      if ([compressedSize, uncompressedSize, localOffset].some(function (value) { return value === 0xffffffff; })) throw new Error(t('ZIP64 пока не поддерживается.', 'ZIP64 is not supported yet.'));
      if (flags & 0x0001) throw new Error(t('Зашифрованные ZIP не поддерживаются.', 'Encrypted ZIP files are not supported.'));
      const nameStart = cursor + 46;
      const nameEnd = nameStart + nameLength;
      if (nameEnd + extraLength + commentLength > bytes.length) throw new Error(t('Повреждено имя файла в ZIP.', 'ZIP file name is corrupt.'));
      const rawName = decoder.decode(bytes.slice(nameStart, nameEnd));
      cursor = nameEnd + extraLength + commentLength;
      if (rawName.endsWith('/')) continue;
      const safeName = strictWorkshopInstallPath(rawName);
      if (!safeName) throw new Error(t('Небезопасный путь в ZIP: ', 'Unsafe ZIP path: ') + rawName);
      const pathKey = safeName.toLowerCase();
      if (seen.has(pathKey)) throw new Error(t('Дублирующийся путь в ZIP: ', 'Duplicate ZIP path: ') + safeName);
      seen.add(pathKey);
      if (uncompressedSize > WORKSHOP_MAX_FILE_BYTES) throw new Error(t('Файл ZIP слишком большой: ', 'ZIP entry is too large: ') + safeName);
      totalBytes += uncompressedSize;
      if (totalBytes > WORKSHOP_MAX_PACKAGE_BYTES) throw new Error(t('Распакованный пакет превышает допустимый размер.', 'The unpacked package exceeds the allowed size.'));
      if (localOffset + 30 > bytes.length) throw new Error(t('Повреждена локальная запись ZIP: ', 'ZIP local entry is corrupt: ') + safeName);
      const localView = new DataView(bytes.buffer, bytes.byteOffset + localOffset, bytes.length - localOffset);
      if (localView.getUint32(0, true) !== 0x04034b50) throw new Error(t('Повреждена локальная запись ZIP: ', 'ZIP local entry is corrupt: ') + safeName);
      const localNameLength = localView.getUint16(26, true);
      const localExtraLength = localView.getUint16(28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) throw new Error(t('Повреждено содержимое ZIP: ', 'ZIP entry data is corrupt: ') + safeName);
      const compressed = bytes.slice(dataStart, dataEnd);
      let content;
      if (method === 0) content = compressed;
      else if (method === 8) content = await inflateWorkshopZipEntry(compressed, uncompressedSize);
      else throw new Error(t('Неподдерживаемый метод сжатия ZIP: ', 'Unsupported ZIP compression method: ') + method);
      if (content.length !== uncompressedSize) throw new Error(t('Размер распакованного файла не совпадает: ', 'Unpacked file size does not match: ') + safeName);
      if (crc32Workshop(content) !== crc) throw new Error(t('CRC ZIP не совпадает: ', 'ZIP CRC does not match: ') + safeName);
      result.push({ name: safeName, bytes: content });
    }
    return result;
  }

  async function verifyWorkshopInstallArchive(entries) {
    const byPath = new Map();
    (entries || []).forEach(function (entry) { byPath.set(String(entry.name || '').toLowerCase(), entry); });
    const manifestEntry = byPath.get('irgeztne-package.json');
    if (!manifestEntry || manifestEntry.name !== 'irgeztne-package.json') throw new Error(t('В корне ZIP отсутствует irgeztne-package.json.', 'irgeztne-package.json is missing from the ZIP root.'));
    let manifest;
    try { manifest = JSON.parse(new TextDecoder('utf-8').decode(manifestEntry.bytes)); }
    catch (error) { throw new Error(t('irgeztne-package.json содержит некорректный JSON.', 'irgeztne-package.json contains invalid JSON.')); }
    if (!manifest || manifest.format !== 'irgeztne-workshop-package' || String(manifest.formatVersion || '') !== '1.0') throw new Error(t('Неподдерживаемый формат пакета Мастерской.', 'Unsupported Workshop package format.'));
    const pkg = manifest.package || {};
    const packageId = String(pkg.id || '').trim();
    const type = String(pkg.type || '').trim();
    const version = String(pkg.version || '').trim();
    if (!packageId || packageId.length > 200) throw new Error(t('Некорректный package id.', 'Invalid package id.'));
    if (!TYPE_OPTIONS.includes(type)) throw new Error(t('Тип пакета не поддерживается.', 'Package type is not supported.'));
    if (!String(pkg.title || '').trim()) throw new Error(t('Требуется название пакета.', 'Package title is required.'));
    if (!workshopSemverParts(version)) throw new Error(t('Версия должна быть в формате x.y.z.', 'Version must use semantic x.y.z format.'));
    if (!String(pkg.author || '').trim()) throw new Error(t('Требуется имя автора.', 'Author name is required.'));
    if (!String(pkg.license || '').trim()) throw new Error(t('Требуется лицензия пакета.', 'Package license is required.'));
    if (!['free', 'freemium'].includes(String(pkg.distribution || 'free'))) throw new Error(t('Режим распространения пакета не поддерживается.', 'Package distribution mode is not supported.'));
    const minVersion = String(pkg.compatibility && pkg.compatibility.minAppVersion || '1.0.0').trim();
    if (!workshopSemverParts(minVersion)) throw new Error(t('Минимальная версия Workspace должна быть в формате x.y.z.', 'Minimum Workspace version must use semantic x.y.z format.'));
    if (compareWorkshopSemver(minVersion, WORKSHOP_RUNTIME_VERSION) > 0) throw new Error(t('Пакет требует более новую версию Workspace: ', 'Package requires a newer Workspace version: ') + minVersion);

    const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
    if (!manifestFiles.length || manifestFiles.length > WORKSHOP_MAX_FILES) throw new Error(t('Некорректный список файлов в манифесте.', 'Invalid manifest file list.'));
    const declared = new Set();
    const verifiedFiles = [];
    let totalBytes = 0;
    let hasEntryFile = false;
    for (const meta of manifestFiles) {
      const path = strictWorkshopInstallPath(meta && meta.path);
      if (!path || path.toLowerCase() === 'irgeztne-package.json') throw new Error(t('Небезопасный путь файла пакета: ', 'Unsafe package file path: ') + String(meta && meta.path || ''));
      const key = path.toLowerCase();
      if (declared.has(key)) throw new Error(t('Дублирующийся путь файла пакета: ', 'Duplicate package file path: ') + path);
      declared.add(key);
      if (workshopInstallPathIsForbidden(path)) throw new Error(t('Исполняемый файл или установщик запрещён в Мастерской v1: ', 'Executable or installer file is not allowed in Workshop v1: ') + path);
      const size = Number(meta && meta.size);
      if (!Number.isInteger(size) || size < 0 || size > WORKSHOP_MAX_FILE_BYTES) throw new Error(t('Некорректный размер файла в манифесте: ', 'Invalid manifest file size: ') + path);
      const expectedHash = String(meta && meta.sha256 || '').toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error(t('Для файла пакета отсутствует или некорректен SHA-256: ', 'SHA-256 is missing or invalid for package file: ') + path);
      const entry = byPath.get(key);
      if (!entry) throw new Error(t('Файл из манифеста отсутствует в ZIP: ', 'Manifest file is missing from ZIP: ') + path);
      if (entry.bytes.length !== size) throw new Error(t('Размер файла ZIP не совпадает с манифестом: ', 'ZIP file size does not match manifest: ') + path);
      const digest = await sha256ArrayBuffer(entry.bytes.buffer.slice(entry.bytes.byteOffset, entry.bytes.byteOffset + entry.bytes.byteLength));
      if (digest !== expectedHash) throw new Error(t('SHA-256 файла ZIP не совпадает: ', 'ZIP file SHA-256 does not match: ') + path);
      totalBytes += size;
      if (totalBytes > WORKSHOP_MAX_PACKAGE_BYTES) throw new Error(t('Пакет слишком большой для локальной установки.', 'Package is too large for local installation.'));
      if (meta.role === 'main' || meta.role === 'template' || /(^|\/)index\.html?$/i.test(path)) hasEntryFile = true;
      verifiedFiles.push({ meta: meta, path: path, entry: entry, sha256: digest });
    }
    const undeclared = (entries || []).filter(function (entry) { return entry.name !== 'irgeztne-package.json' && !declared.has(entry.name.toLowerCase()); });
    if (undeclared.length) throw new Error(t('ZIP содержит файл, не объявленный в манифесте: ', 'ZIP contains a file not declared in the manifest: ') + undeclared[0].name);
    if (type === 'template' && !hasEntryFile) throw new Error(t('Для шаблона не найден основной HTML-файл.', 'Template package has no main HTML file.'));
    let verifiedThemeR1W9E = null;
    if (type === 'theme') {
      const themeFileR1W9E = verifiedFiles.find(function (file) { return String(file.path || '').toLowerCase() === 'theme.json'; });
      if (!themeFileR1W9E) throw new Error(t('Для темы требуется theme.json в корне пакета.', 'Theme package requires theme.json at the package root.'));
      if (String(themeFileR1W9E.meta && themeFileR1W9E.meta.role || '') !== 'main') throw new Error(t('theme.json должен иметь role: main.', 'theme.json must use role: main.'));
      if (String(themeFileR1W9E.meta && themeFileR1W9E.meta.kind || '') !== 'data') throw new Error(t('theme.json должен иметь kind: data.', 'theme.json must use kind: data.'));
      if (String(themeFileR1W9E.meta && themeFileR1W9E.meta.mime || '').toLowerCase() !== 'application/json') throw new Error(t('theme.json должен иметь MIME application/json.', 'theme.json must use MIME application/json.'));
      verifiedThemeR1W9E = parseWorkshopThemeDocumentR1W9E(themeFileR1W9E.entry.bytes);
    }
    let verifiedComponentR1W9F = null;
    if (type === 'component') {
      const componentManifestR1W9F = verifiedFiles.find(function (file) { return String(file.path || '').toLowerCase() === 'component.json'; });
      if (!componentManifestR1W9F) throw new Error(t('Для компонента требуется component.json в корне пакета.', 'Component package requires component.json at the package root.'));
      if (String(componentManifestR1W9F.meta && componentManifestR1W9F.meta.role || '') !== 'main') throw new Error(t('component.json должен иметь role: main.', 'component.json must use role: main.'));
      if (String(componentManifestR1W9F.meta && componentManifestR1W9F.meta.kind || '') !== 'data') throw new Error(t('component.json должен иметь kind: data.', 'component.json must use kind: data.'));
      if (String(componentManifestR1W9F.meta && componentManifestR1W9F.meta.mime || '').toLowerCase() !== 'application/json') throw new Error(t('component.json должен иметь MIME application/json.', 'component.json must use MIME application/json.'));
      verifiedComponentR1W9F = parseWorkshopComponentDocumentR1W9F(componentManifestR1W9F.entry.bytes);
      const componentHtmlR1W9F = verifiedFiles.find(function (file) { return String(file.path || '').toLowerCase() === String(verifiedComponentR1W9F.entry || '').toLowerCase(); });
      if (!componentHtmlR1W9F) throw new Error(t('Для компонента требуется component.html в корне пакета.', 'Component package requires component.html at the package root.'));
      if (String(componentHtmlR1W9F.meta && componentHtmlR1W9F.meta.role || '') !== 'component') throw new Error(t('component.html должен иметь role: component.', 'component.html must use role: component.'));
      if (String(componentHtmlR1W9F.meta && componentHtmlR1W9F.meta.kind || '') !== 'html') throw new Error(t('component.html должен иметь kind: html.', 'component.html must use kind: html.'));
      if (String(componentHtmlR1W9F.meta && componentHtmlR1W9F.meta.mime || '').toLowerCase() !== 'text/html') throw new Error(t('component.html должен иметь MIME text/html.', 'component.html must use MIME text/html.'));
      validateWorkshopComponentHtmlR1W9F(componentHtmlR1W9F.entry.bytes);
      const extraComponentFilesR1W9F = verifiedFiles.filter(function (file) {
        const p = String(file.path || '').toLowerCase();
        return p !== 'component.json' && p !== 'component.html';
      });
      if (extraComponentFilesR1W9F.length) throw new Error(t('Component v1 допускает только component.json и component.html.', 'Component v1 allows only component.json and component.html.'));
    }
    let verifiedWidgetR1W9G = null;
    if (type === 'widget') {
      const widgetManifestR1W9G = verifiedFiles.find(function (file) { return String(file.path || '').toLowerCase() === 'widget.json'; });
      if (!widgetManifestR1W9G) throw new Error(t('Для виджета требуется widget.json в корне пакета.', 'Widget package requires widget.json at the package root.'));
      if (String(widgetManifestR1W9G.meta && widgetManifestR1W9G.meta.role || '') !== 'main') throw new Error(t('widget.json должен иметь role: main.', 'widget.json must use role: main.'));
      if (String(widgetManifestR1W9G.meta && widgetManifestR1W9G.meta.kind || '') !== 'data') throw new Error(t('widget.json должен иметь kind: data.', 'widget.json must use kind: data.'));
      if (String(widgetManifestR1W9G.meta && widgetManifestR1W9G.meta.mime || '').toLowerCase() !== 'application/json') throw new Error(t('widget.json должен иметь MIME application/json.', 'widget.json must use MIME application/json.'));
      verifiedWidgetR1W9G = parseWorkshopWidgetDocumentR1W9G(widgetManifestR1W9G.entry.bytes);
      const widgetRuntimeR1W9H = verifiedWidgetR1W9G.runtime && typeof verifiedWidgetR1W9G.runtime === 'object' ? verifiedWidgetR1W9G.runtime : { mode: 'local', entry: verifiedWidgetR1W9G.entry || 'widget.html' };
      const widgetHtmlR1W9G = verifiedFiles.find(function (file) { return String(file.path || '').toLowerCase() === String(widgetRuntimeR1W9H.entry || '').toLowerCase(); });
      if (widgetRuntimeR1W9H.mode === 'local') {
        if (!widgetHtmlR1W9G) throw new Error(t('Для локального виджета требуется widget.html в корне пакета.', 'Local Widget package requires widget.html at the package root.'));
        if (String(widgetHtmlR1W9G.meta && widgetHtmlR1W9G.meta.role || '') !== 'widget') throw new Error(t('widget.html должен иметь role: widget.', 'widget.html must use role: widget.'));
        if (String(widgetHtmlR1W9G.meta && widgetHtmlR1W9G.meta.kind || '') !== 'html') throw new Error(t('widget.html должен иметь kind: html.', 'widget.html must use kind: html.'));
        if (String(widgetHtmlR1W9G.meta && widgetHtmlR1W9G.meta.mime || '').toLowerCase() !== 'text/html') throw new Error(t('widget.html должен иметь MIME text/html.', 'widget.html must use MIME text/html.'));
        validateWorkshopWidgetHtmlR1W9G(widgetHtmlR1W9G.entry.bytes, verifiedWidgetR1W9G);
      } else if (widgetHtmlR1W9G) {
        throw new Error(t('Hosted Widget v1 не должен включать локальный widget.html.', 'Hosted Widget v1 must not include local widget.html.'));
      }
      const allowedWidgetPathsR1W9H = new Set(['widget.json']);
      if (widgetRuntimeR1W9H.mode === 'local') allowedWidgetPathsR1W9H.add('widget.html');
      const extraWidgetFilesR1W9G = verifiedFiles.filter(function (file) {
        return !allowedWidgetPathsR1W9H.has(String(file.path || '').toLowerCase());
      });
      if (extraWidgetFilesR1W9G.length) throw new Error(t('Widget v1 содержит неподдерживаемый локальный файл: ', 'Widget v1 contains an unsupported local file: ') + String(extraWidgetFilesR1W9G[0].path || ''));
    }
    const cover = String(pkg.preview && pkg.preview.cover || '').trim();
    if (cover && !declared.has(cover.toLowerCase())) throw new Error(t('Обложка не найдена среди проверенных файлов пакета.', 'Cover was not found among verified package files.'));
    return { manifest: manifest, package: pkg, files: verifiedFiles, totalBytes: totalBytes, runtimeVersion: WORKSHOP_RUNTIME_VERSION, theme: verifiedThemeR1W9E, component: verifiedComponentR1W9F, widget: verifiedWidgetR1W9G };
  }

  async function installWorkshopZipFile(file) {
    if (!file) return;
    setInstallFeedback('working', t('Проверяю ZIP перед установкой…', 'Validating ZIP before installation…'));
    setNotice(t('Проверяю ZIP перед установкой…', 'Validating ZIP before installation…'));
    try {
      const raw = await file.arrayBuffer();
      const entries = await parseWorkshopZip(raw);
      const verified = await verifyWorkshopInstallArchive(entries);
      const pkg = verified.package;
      const registry = readWorkshopInstalledRegistry();
      const existing = registry.find(function (entry) { return entry.packageId === String(pkg.id); });
      if (existing) {
        if (existing.version === String(pkg.version)) throw new Error(t('Эта версия пакета уже установлена. Повторная установка без явного обновления запрещена.', 'This package version is already installed. Silent reinstall is not allowed.'));
        throw new Error(t('Другая версия этого пакета уже установлена. Обновление будет отдельным подтверждаемым действием.', 'Another version of this package is already installed. Updating will be a separate confirmed action.'));
      }

      const stored = [];
      try {
        for (const fileEntry of verified.files) {
          const blobKey = workshopBlobKey('installed:' + String(pkg.id));
          const exactBuffer = fileEntry.entry.bytes.buffer.slice(fileEntry.entry.bytes.byteOffset, fileEntry.entry.bytes.byteOffset + fileEntry.entry.bytes.byteLength);
          await putWorkshopBytes({
            blobKey: blobKey,
            bytes: exactBuffer,
            name: fileEntry.path,
            mime: String(fileEntry.meta.mime || 'application/octet-stream'),
            size: fileEntry.entry.bytes.length,
            sha256: fileEntry.sha256,
            installedPackageId: String(pkg.id)
          });
          stored.push({
            path: fileEntry.path,
            role: String(fileEntry.meta.role || 'asset'),
            kind: String(fileEntry.meta.kind || 'asset'),
            size: fileEntry.entry.bytes.length,
            mime: String(fileEntry.meta.mime || ''),
            sha256: fileEntry.sha256,
            blobKey: blobKey
          });
        }
        const record = {
          installId: String(pkg.id) + '@' + String(pkg.version),
          packageId: String(pkg.id),
          type: String(pkg.type),
          title: String(pkg.title),
          version: String(pkg.version),
          author: normalizeWorkshopInstalledAuthor(pkg.author),
          license: String(pkg.license || ''),
          distribution: String(pkg.distribution || 'free'),
          description: pkg.description || {},
          tags: Array.isArray(pkg.tags) ? pkg.tags : [],
          preview: pkg.preview || {},
          compatibility: pkg.compatibility || {},
          theme: verified.theme && typeof verified.theme === 'object' ? Object.assign({}, verified.theme) : null,
          component: verified.component && typeof verified.component === 'object' ? Object.assign({}, verified.component) : null,
          widget: verified.widget && typeof verified.widget === 'object' ? JSON.parse(JSON.stringify(verified.widget)) : null,
          files: stored,
          sourceZipName: String(file.name || ''),
          installedAt: new Date().toISOString(),
          integrity: 'PASS',
          algorithm: 'SHA-256'
        };
        writeWorkshopInstalledRegistry(registry.concat([record]));
      } catch (error) {
        for (const storedFile of stored) {
          try { await deleteWorkshopBytes(storedFile.blobKey); } catch (cleanupError) { console.warn('[Workshop] failed install cleanup', cleanupError); }
        }
        throw error;
      }
      uiState.view = VIEW_INSTALLED;
      setInstallFeedback('success', t('ZIP успешно проверен и установлен. Пакет появился в разделе «Установленные».', 'ZIP validated and installed successfully. The package now appears in Installed.'));
      setNotice(t('Пакет установлен локально. Манифест, пути, размеры и SHA-256 повторно проверены.', 'Package installed locally. Manifest, paths, sizes, and SHA-256 were re-validated.'));
    } catch (error) {
      console.warn('[Workshop] ZIP install rejected', error);
      const installErrorText = String(error && error.message || error || t('неизвестная ошибка', 'unknown error'));
      setInstallFeedback('error', t('ZIP не установлен: ', 'ZIP was not installed: ') + installErrorText);
      setNotice(t('ZIP не установлен: ', 'ZIP was not installed: ') + installErrorText);
    }
  }

  function safeWorkshopFileName(value) {
    const base = String(value || 'irgeztne-package').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (base || 'irgeztne-package').slice(0, 120);
  }

  async function exportWorkshopZip(item) {
    const report = await runWorkshopCustoms(item);
    uiState.customsReports[item.id] = report;
    if (!report.isReady) return { ok: false, report: report };

    const entries = [];
    for (const file of item.files || []) {
      const record = await getWorkshopBytes(file.blobKey);
      if (!record || !(record.bytes instanceof ArrayBuffer)) throw new Error('Package bytes missing: ' + file.path);
      entries.push({ name: file.path, bytes: new Uint8Array(record.bytes) });
    }

    const manifest = {
      format: 'irgeztne-workshop-package',
      formatVersion: '1.0',
      package: {
        id: item.id,
        type: item.type,
        title: item.title,
        version: item.version,
        license: item.license,
        author: item.author,
        description: item.description,
        tags: item.tags || [],
        distribution: item.distribution || 'free',
        preview: item.preview,
        compatibility: item.compatibility
      },
      files: (item.files || []).map(function (file) {
        return {
          path: file.path,
          role: file.role,
          kind: file.kind,
          size: Number(file.size || 0),
          mime: file.mime || '',
          sha256: file.sha256
        };
      }),
      customs: { status: 'PASS', checkedAt: report.checkedAt, algorithm: 'SHA-256' }
    };
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    entries.push({ name: 'irgeztne-package.json', bytes: manifestBytes });

    const zipBytes = buildWorkshopStoredZip(entries);
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeWorkshopFileName(item.title) + '-' + safeWorkshopFileName(item.version) + '.zip';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return { ok: true, report: report, fileName: anchor.download, byteLength: zipBytes.length };
  }

  async function cleanupWorkshopBlobIfUnreferenced(blobKey) {
    if (!blobKey) return;
    const store = getStore();
    const stillUsed = store && store.getAll().some(function (item) {
      return (item.files || []).some(function (file) { return file.blobKey === blobKey; });
    });
    if (!stillUsed) {
      try { await deleteWorkshopBytes(blobKey); } catch (error) { console.warn('[Workshop] orphan byte cleanup failed', error); }
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }

  function getItemMetaReport(itemId) {
    return itemId && uiState.metaReports ? uiState.metaReports[itemId] : null;
  }

  function setItemMetaReport(itemId, report) {
    if (!itemId) return;
    uiState.metaReports[itemId] = report || null;
  }

  function hasPath(paths, path) {
    return Array.isArray(paths) && paths.includes(path);
  }

  function validateTemplateMeta(rawMeta) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : null;
    const errors = [];
    const warnings = [];
    const checks = [];

    function addCheck(state, label, detail) {
      checks.push({
        state: state,
        label: label,
        detail: detail || ''
      });
    }

    if (!meta) {
      errors.push(t('meta.json не удалось прочитать как объект.', 'meta.json could not be read as an object.'));
      addCheck('fail', t('meta.json', 'meta.json'), t('Файл должен быть JSON-объектом.', 'The file must be a JSON object.'));
      return {
        source: 'meta.json',
        isReady: false,
        errors: errors,
        warnings: warnings,
        checks: checks,
        summary: {}
      };
    }

    const pkg = meta.package || {};
    const template = meta.template || {};
    const supports = template.supports || meta.supports || {};
    const compatibility = template.compatibility || meta.compatibility || {};
    const security = template.security || meta.security || {};
    const output = meta.output || {};
    const publishing = meta.publishing || {};
    const files = Array.isArray(output.files) ? output.files : [];
    const fileManifest = Array.isArray(output.fileManifest) ? output.fileManifest : [];

    if (pkg.format === 'irgeztne-template-package') {
      addCheck('pass', t('Формат пакета', 'Package format'), 'irgeztne-template-package');
    } else {
      errors.push(t('package.format должен быть irgeztne-template-package.', 'package.format must be irgeztne-template-package.'));
      addCheck('fail', t('Формат пакета', 'Package format'), t('Ожидается irgeztne-template-package.', 'Expected irgeztne-template-package.'));
    }

    if (pkg.formatVersion) {
      addCheck('pass', t('Версия формата', 'Format version'), String(pkg.formatVersion));
    } else {
      errors.push(t('package.formatVersion отсутствует.', 'package.formatVersion is missing.'));
      addCheck('fail', t('Версия формата', 'Format version'), t('Укажите версию формата пакета.', 'Add a package format version.'));
    }

    if (template.id && template.name && template.version) {
      addCheck('pass', t('Template identity', 'Template identity'), [template.id, template.name, template.version].filter(Boolean).join(' · '));
    } else {
      errors.push(t('template.id, template.name и template.version обязательны.', 'template.id, template.name, and template.version are required.'));
      addCheck('fail', t('Template identity', 'Template identity'), t('Нужны id, name и version.', 'id, name, and version are required.'));
    }

    const requiredFiles = ['index.html', 'styles.css', 'content/page.json', 'meta.json'];
    const missingRequired = requiredFiles.filter(function (path) { return !hasPath(files, path); });
    if (!missingRequired.length) {
      addCheck('pass', t('Базовые файлы', 'Base files'), requiredFiles.join(' · '));
    } else {
      errors.push(t('В output.files не хватает базовых файлов: ', 'Missing base files in output.files: ') + missingRequired.join(', '));
      addCheck('fail', t('Базовые файлы', 'Base files'), missingRequired.join(', '));
    }

    const faviconFiles = [
      'favicon.ico',
      'assets/icons/favicon.ico',
      'assets/icons/favicon.svg',
      'assets/icons/favicon-16x16.png',
      'assets/icons/favicon-32x32.png',
      'assets/icons/apple-touch-icon.png',
      'assets/icons/android-chrome-192x192.png',
      'assets/icons/android-chrome-512x512.png',
      'assets/icons/site.webmanifest'
    ];
    const missingFavicons = faviconFiles.filter(function (path) { return !hasPath(files, path); });
    if (!missingFavicons.length && supports.faviconPackage === true) {
      addCheck('pass', t('Favicon package', 'Favicon package'), t('Полный набор найден.', 'Full package found.'));
    } else if (!missingFavicons.length) {
      warnings.push(t('Favicon-файлы есть, но template.supports.faviconPackage не true.', 'Favicon files exist, but template.supports.faviconPackage is not true.'));
      addCheck('warn', t('Favicon package', 'Favicon package'), t('Файлы есть, но supports.faviconPackage не включён.', 'Files exist, but supports.faviconPackage is not enabled.'));
    } else {
      warnings.push(t('Favicon package неполный: ', 'Favicon package is incomplete: ') + missingFavicons.join(', '));
      addCheck('warn', t('Favicon package', 'Favicon package'), missingFavicons.join(', '));
    }

    if (fileManifest.length) {
      addCheck('pass', t('File manifest', 'File manifest'), t('Есть output.fileManifest.', 'output.fileManifest exists.'));
    } else {
      warnings.push(t('output.fileManifest отсутствует. Мастерская пакетов сможет работать, но проверка будет слабее.', 'output.fileManifest is missing. Package Workshop can still work, but validation is weaker.'));
      addCheck('warn', t('File manifest', 'File manifest'), t('Добавьте роли файлов.', 'Add file roles.'));
    }

    if (compatibility.codehubReady === true) {
      addCheck('pass', t('Готово для Веб-мастерской', 'Package Workshop ready'), t('Пакет помечен как готовый к Веб-мастерской.', 'Package is marked Package Workshop-ready.'));
    } else {
      warnings.push(t('compatibility.codehubReady не true.', 'compatibility.codehubReady is not true.'));
      addCheck('warn', t('Готово для Веб-мастерской', 'Package Workshop ready'), t('Желательно указать true.', 'Prefer setting it to true.'));
    }

    if (security.noCdn === true && security.externalScripts !== true) {
      addCheck('pass', t('Без CDN', 'No CDN'), t('В meta.json указано, что внешних CDN/скриптов нет.', 'meta.json says there are no external CDN/scripts.'));
    } else {
      errors.push(t('Для official/local template package нужны noCdn: true и externalScripts: false.', 'Official/local template packages need noCdn: true and externalScripts: false.'));
      addCheck('fail', t('Без CDN', 'No CDN'), t('Проверьте security.noCdn и security.externalScripts.', 'Check security.noCdn and security.externalScripts.'));
    }

    if (security.inlineScripts === true) {
      warnings.push(t('inlineScripts включены. Для official templates лучше отдельный script.js.', 'inlineScripts are enabled. Official templates should prefer a separate script.js.'));
      addCheck('warn', t('Inline scripts', 'Inline scripts'), t('Лучше вынести JS в отдельный файл.', 'Prefer moving JS into a separate file.'));
    } else {
      addCheck('pass', t('Inline scripts', 'Inline scripts'), t('Не включены.', 'Not enabled.'));
    }

    if (security.inlineEventHandlers === true) {
      warnings.push(t('inlineEventHandlers включены. Позже лучше заменить onclick/oninput на script.js.', 'inlineEventHandlers are enabled. Later, replace onclick/oninput handlers with script.js.'));
      addCheck('warn', t('Inline event handlers', 'Inline event handlers'), t('Допустимо пока, но лучше убрать в будущем.', 'Allowed for now, but better to remove later.'));
    } else {
      addCheck('pass', t('Inline event handlers', 'Inline event handlers'), t('Не включены.', 'Not enabled.'));
    }

    if (publishing.requiresServer === false && publishing.relativePathsOnly === true) {
      addCheck('pass', t('Static/IPFS publishing', 'Static/IPFS publishing'), t('Пакет готов к статическому хостингу/IPFS-папке.', 'Package is ready for static hosting/IPFS folder.'));
    } else {
      warnings.push(t('publishing.requiresServer должен быть false, а relativePathsOnly — true.', 'publishing.requiresServer should be false and relativePathsOnly should be true.'));
      addCheck('warn', t('Static/IPFS publishing', 'Static/IPFS publishing'), t('Проверьте publishing-настройки.', 'Check publishing settings.'));
    }

    return {
      source: 'meta.json',
      isReady: errors.length === 0,
      errors: errors,
      warnings: warnings,
      checks: checks,
      summary: {
        id: template.id || '',
        name: template.name || '',
        version: template.version || '',
        formatVersion: pkg.formatVersion || '',
        fileCount: files.length,
        readyForIpfsFolder: publishing.readyForIpfsFolder === true
      }
    };
  }


  function getRoots() {
    return Array.from(document.querySelectorAll('[data-codehub-root]'));
  }

  function getStore() {
    return window.NSCodeHubStore || null;
  }

  function ensureWorkshopReadabilityStyles() {
    const styleId = 'ns-codehub-v1-r1w3-readability';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '[data-codehub-root] .ns-codehub-v1__hero-copy p{font-size:15px!important;line-height:1.55!important;}',
      '[data-codehub-root] .ns-codehub-v1__panel-head>span{font-size:14.5px!important;line-height:1.55!important;}',
      '[data-codehub-root] .ns-codehub-v1__type-card span{font-size:14.5px!important;line-height:1.55!important;}',
      '[data-codehub-root] .ns-codehub-v1__flow-step span{font-size:15.5px!important;line-height:1.55!important;}',
      '[data-codehub-root] .ns-codehub-v1__rule-card strong{font-size:15px!important;line-height:1.45!important;}',
      '[data-codehub-root] .ns-codehub-v1__rule-card span{font-size:15px!important;line-height:1.55!important;}',
      '[data-codehub-root] .ns-codehub-v1__summary-card span{font-size:13.5px!important;line-height:1.45!important;}',
      '[data-codehub-root] .ns-codehub-v1__recent-copy span,[data-codehub-root] .ns-codehub-v1__card-meta,[data-codehub-root] .ns-codehub-v1__empty{font-size:13.5px!important;line-height:1.5!important;}',
      '[data-codehub-root] .ns-codehub-v1__side{padding:18px!important;}',
      '[data-codehub-root] .ns-codehub-v1__side .ns-codehub-v1__panel-head{margin-bottom:10px!important;}',
      '[data-codehub-root] .ns-codehub-v1__side .ns-codehub-v1__panel-head h4{font-size:18px!important;line-height:1.3!important;}',
      '[data-codehub-root] .ns-codehub-v1__side .ns-codehub-v1__panel-head>span{font-size:14.5px!important;line-height:1.45!important;}',
      '[data-codehub-root] .ns-codehub-v1__side-row{padding:7px 0!important;}',
      '[data-codehub-root] .ns-codehub-v1__side-row strong{font-size:15px!important;line-height:1.4!important;}',
      '[data-codehub-root] .ns-codehub-v1__side-row span{font-size:15.5px!important;line-height:1.45!important;}',
      '[data-codehub-root] .ns-codehub-v1__check-row span{font-size:13.5px!important;line-height:1.5!important;}',
      '[data-codehub-root] .ns-codehub-v1__field>span,[data-codehub-root] .ns-codehub-v1__hint{font-size:13.5px!important;line-height:1.5!important;}',
      '[data-codehub-root] .ns-codehub-v1__license-custom{margin-top:8px!important;}',
      '[data-codehub-root] .ns-codehub-v1__validation-head{display:flex!important;align-items:center!important;gap:12px!important;flex-wrap:wrap!important;}',
      '[data-codehub-root] .ns-codehub-v1__validation-head>strong,[data-codehub-root] .ns-codehub-v1__validation-head>span{display:inline-block!important;}',
      '[data-codehub-root] .ns-codehub-v1__builder-tabs{display:flex!important;align-items:center!important;align-content:flex-start!important;gap:8px!important;padding-top:2px!important;}',
      '[data-codehub-root] .ns-codehub-v1__builder-tab{height:38px!important;min-height:38px!important;max-height:38px!important;padding:0 12px!important;align-self:flex-start!important;flex:0 0 auto!important;border-radius:10px!important;font-size:14px!important;line-height:1!important;}',
      '[data-codehub-root] .ns-codehub-v1__save-state{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border:1px solid rgba(67,211,138,.45);border-radius:9px;font-size:13.5px;font-weight:700;line-height:1;color:#9cf3c2;background:rgba(32,142,91,.14);}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__save-state{color:#17643f;background:rgba(33,166,99,.10);border-color:rgba(33,166,99,.28);}',
      '[data-codehub-root] .ns-codehub-v1__live-preview{margin:0 0 18px;padding:14px;border:1px solid rgba(148,163,184,.22);border-radius:14px;background:rgba(10,17,31,.18);}',
      '[data-codehub-root] .ns-codehub-v1__live-preview-frame{width:100%;height:420px;border:1px solid rgba(148,163,184,.26);border-radius:12px;background:#fff;display:block;}',
      '[data-codehub-root] .ns-codehub-v1__live-preview-note{font-size:13.5px;line-height:1.5;margin-top:9px;opacity:.78;}',
      '[data-codehub-root] .ns-codehub-v1__file-path-hint{font-size:13.5px;line-height:1.5;opacity:.78;margin-top:8px;}',
      '[data-codehub-root] .ns-codehub-v1__upload,[data-codehub-root] .ns-codehub-v1__btn[data-codehub-action="pick-folder"]{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:42px!important;padding:0 16px!important;border:1px solid rgba(91,166,255,.42)!important;border-radius:11px!important;background:rgba(35,92,164,.18)!important;color:inherit!important;font-size:14.5px!important;font-weight:700!important;line-height:1!important;cursor:pointer!important;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease!important;}',
      '[data-codehub-root] .ns-codehub-v1__upload:hover,[data-codehub-root] .ns-codehub-v1__btn[data-codehub-action="pick-folder"]:hover{background:rgba(46,126,229,.30)!important;border-color:rgba(93,177,255,.78)!important;box-shadow:0 0 0 2px rgba(61,139,235,.10),0 8px 20px rgba(0,0,0,.16)!important;transform:translateY(-1px)!important;}',
      '[data-codehub-root] .ns-codehub-v1__upload:active,[data-codehub-root] .ns-codehub-v1__btn[data-codehub-action="pick-folder"]:active{transform:translateY(0)!important;box-shadow:none!important;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__upload,[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__btn[data-codehub-action="pick-folder"]{background:#edf5ff!important;border-color:#a9c9ef!important;color:#153a67!important;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__upload:hover,[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__btn[data-codehub-action="pick-folder"]:hover{background:#dcecff!important;border-color:#6ca8e9!important;box-shadow:0 8px 18px rgba(44,99,164,.13)!important;}'
,
      '[data-codehub-root] .ns-codehub-v1__workshop-toolbar{display:flex;align-items:center;justify-content:flex-start;gap:14px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid rgba(116,156,211,.22);}',
      '[data-codehub-root] .ns-codehub-v1__workshop-toolbar .ns-codehub-v1__topnav{margin:0!important;padding:0!important;border:0!important;display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;}',
      '[data-codehub-root] .ns-codehub-v1__workshop-toolbar .ns-codehub-v1__hero-actions{margin:0!important;display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;}',
      '[data-codehub-root] .ns-codehub-v1__installed-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0;}',
      '[data-codehub-root] .ns-codehub-v1__my-packages-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}',
      '[data-codehub-root] .ns-codehub-v1__install-feedback{display:flex;align-items:flex-start;gap:10px;margin:0 0 14px;padding:11px 13px;border:1px solid rgba(116,156,211,.28);border-radius:11px;background:rgba(13,29,50,.42);font-size:13.5px;line-height:1.45;}',
      '[data-codehub-root] .ns-codehub-v1__install-feedback strong{flex:0 0 auto;}',
      '[data-codehub-root] .ns-codehub-v1__install-feedback span{min-width:0;}',
      '[data-codehub-root] .ns-codehub-v1__install-feedback.is-working{border-color:rgba(91,166,255,.48);background:rgba(35,92,164,.12);}',
      '[data-codehub-root] .ns-codehub-v1__install-feedback.is-success{border-color:rgba(67,211,138,.42);background:rgba(32,142,91,.12);}',
      '[data-codehub-root] .ns-codehub-v1__install-feedback.is-error{border-color:rgba(231,90,106,.46);background:rgba(176,45,66,.11);}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-feedback{background:#f7fbff;border-color:#bfd3ea;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-feedback.is-working{background:#eef6ff;border-color:#8fb8e6;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-feedback.is-success{background:#edf9f2;border-color:#8fd0ac;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-feedback.is-error{background:#fff1f3;border-color:#e6a1aa;}',
      '[data-codehub-root] .ns-codehub-v1__install-dropzone{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:12px 0 14px;padding:16px 18px;min-height:76px;border:1.5px dashed rgba(91,166,255,.58);border-radius:13px;background:rgba(35,92,164,.10);transition:background .16s ease,border-color .16s ease,box-shadow .16s ease;}',
      '[data-codehub-root] .ns-codehub-v1__install-drop-copy{flex:1 1 420px;min-width:0;}',
      '[data-codehub-root] .ns-codehub-v1__install-drop-title{display:block;font-size:17px;line-height:1.35;font-weight:800;letter-spacing:.01em;}',
      '[data-codehub-root] .ns-codehub-v1__install-drop-note{display:block;margin-top:4px;font-size:13.5px;line-height:1.5;opacity:.78;}',
      '[data-codehub-root] .ns-codehub-v1__install-dropzone.is-dragover{background:rgba(32,142,91,.15);border-color:rgba(67,211,138,.82);box-shadow:0 0 0 2px rgba(67,211,138,.12) inset;}',
      '[data-codehub-root] .ns-codehub-v1__install-dropzone.is-dragover .ns-codehub-v1__install-drop-title{color:#9cf3c2;}',
      '[data-codehub-root] .ns-codehub-v1__installed-panel .ns-codehub-v1__panel-head>span{font-size:15px!important;line-height:1.55!important;}',
      '[data-codehub-root] .ns-codehub-v1__installed-empty{font-size:15px!important;line-height:1.55!important;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-dropzone{background:#f4f8fd;border-color:#8fb8e6;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-dropzone.is-dragover{background:#eaf8f0;border-color:#4cae78;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__install-dropzone.is-dragover .ns-codehub-v1__install-drop-title{color:#17643f;}',
      '[data-codehub-root] .ns-codehub-v1__installed-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px;}',
      '[data-codehub-root] .ns-codehub-v1__installed-card{padding:15px;border:1px solid rgba(116,156,211,.28);border-radius:13px;background:rgba(13,29,50,.42);}',
      '[data-codehub-root] .ns-codehub-v1__installed-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;}',
      '[data-codehub-root] .ns-codehub-v1__installed-card-head strong{font-size:16px;line-height:1.35;}',
      '[data-codehub-root] .ns-codehub-v1__installed-card-head span{font-size:12.5px;opacity:.74;white-space:nowrap;}',
      '[data-codehub-root] .ns-codehub-v1__installed-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;font-size:13.5px;line-height:1.45;}',
      '[data-codehub-root] .ns-codehub-v1__installed-meta span{opacity:.72;display:block;font-size:12px;margin-bottom:2px;}',
      '[data-codehub-root] .ns-codehub-v1__installed-pass{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:5px 8px;border:1px solid rgba(67,211,138,.36);border-radius:8px;background:rgba(32,142,91,.12);color:#9cf3c2;font-size:12.5px;font-weight:700;}',
      '[data-codehub-root] .ns-codehub-v1__installed-card-actions{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;}',
      '[data-codehub-root] .ns-codehub-v1__installed-card-actions .ns-codehub-v1__installed-pass{margin-top:0;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__installed-card{background:#f7fbff;border-color:#bfd3ea;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__installed-pass{color:#17643f;background:rgba(33,166,99,.10);border-color:rgba(33,166,99,.28);}',
      '[data-codehub-root] .ns-codehub-v1__preview-overlay{position:fixed;z-index:100000;top:14px;left:14px;right:14px;bottom:14px;display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid rgba(116,156,211,.34);border-radius:16px;background:#0a111d;color:#eef5ff;box-shadow:0 24px 70px rgba(0,0,0,.48);overflow:hidden;box-sizing:border-box;}',
      '[data-codehub-root] .ns-codehub-v1__preview-toolbar{position:relative;z-index:2;display:flex;align-items:center;gap:10px;min-height:58px;flex:0 0 auto;padding:9px 12px;border-bottom:1px solid rgba(148,163,184,.22);background:#101a2a;box-sizing:border-box;}',
      '[data-codehub-root] .ns-codehub-v1__preview-toolbar-main{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto;}',
      '[data-codehub-root] .ns-codehub-v1__preview-toolbar-title{min-width:0;}',
      '[data-codehub-root] .ns-codehub-v1__preview-toolbar-title strong{display:block;font-size:15px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '[data-codehub-root] .ns-codehub-v1__preview-toolbar-title span{display:block;margin-top:2px;font-size:12.5px;line-height:1.25;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '[data-codehub-root] .ns-codehub-v1__preview-devices{display:flex;align-items:center;gap:5px;padding:4px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(0,0,0,.14);}',
      '[data-codehub-root] .ns-codehub-v1__preview-device{min-height:32px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:inherit;font-size:13px;font-weight:700;cursor:pointer;}',
      '[data-codehub-root] .ns-codehub-v1__preview-device:hover{background:rgba(74,139,226,.16);}',
      '[data-codehub-root] .ns-codehub-v1__preview-device.is-active{background:#1f6fd1;color:#fff;}',
      '[data-codehub-root] .ns-codehub-v1__preview-stage{position:relative;z-index:1;flex:1 1 auto;min-height:0;overflow:auto;padding:18px;background:radial-gradient(circle at 50% 0,rgba(63,101,160,.12),transparent 50%),#070d16;box-sizing:border-box;}',
      '[data-codehub-root] .ns-codehub-v1__preview-viewport{height:100%;min-height:360px;margin:0 auto;background:#fff;border:1px solid rgba(148,163,184,.3);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.28);overflow:hidden;transition:width .18s ease;}',
      '[data-codehub-root] .ns-codehub-v1__preview-viewport[data-device="desktop"]{width:100%;}',
      '[data-codehub-root] .ns-codehub-v1__preview-viewport[data-device="tablet"]{width:min(820px,100%);}',
      '[data-codehub-root] .ns-codehub-v1__preview-viewport[data-device="mobile"]{width:min(390px,100%);}',
      '[data-codehub-root] .ns-codehub-v1__preview-full-frame{display:block;width:100%;height:100%;min-height:360px;border:0;background:#fff;}',
      '[data-codehub-root] .ns-codehub-v1__preview-loading{display:grid;place-items:center;height:100%;min-height:360px;font-size:14px;opacity:.78;}',
      '[data-codehub-root] .ns-codehub-v1__preview-security{padding:7px 12px;border-top:1px solid rgba(148,163,184,.18);background:#0d1624;font-size:12.5px;line-height:1.4;opacity:.78;}',
      '[data-codehub-root] .ns-codehub-v1__my-packages-intro{margin-bottom:12px;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__preview-overlay{background:#f5f8fc;color:#142033;border-color:#b9c9dd;box-shadow:0 24px 70px rgba(35,58,87,.22);}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__preview-toolbar{background:#edf3fa;border-color:#cbd7e6;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__preview-stage{background:#dfe7f1;}',
      '[data-codehub-root][data-codehub-theme="light"] .ns-codehub-v1__preview-security{background:#edf3fa;border-color:#cbd7e6;}',
      '@media(max-width:760px){[data-codehub-root] .ns-codehub-v1__preview-overlay{top:6px;left:6px;right:6px;bottom:6px;border-radius:12px;}[data-codehub-root] .ns-codehub-v1__preview-toolbar{align-items:flex-start;flex-wrap:wrap;}[data-codehub-root] .ns-codehub-v1__preview-devices{order:3;width:100%;justify-content:center;}[data-codehub-root] .ns-codehub-v1__preview-stage{padding:8px;}}'    ].join('');
    document.head.appendChild(style);
  }

  function ensureInit() {
    if (initialized) return true;
    const store = getStore();
    if (!store) {
      console.warn('[NSCodeHubV1] store unavailable');
      return false;
    }

    ensureWorkshopReadabilityStyles();
    bindRoots();
    unsubscribe = store.subscribe(renderAll);
    initialized = true;
    renderAll();
    return true;
  }

  window.addEventListener('irg:language-changed', renderAll);
  document.addEventListener('irg:language-changed', renderAll);

  function bindRoots() {
    getRoots().forEach(function (root) {
      if (root.dataset.codehubBound === 'true') return;
      root.dataset.codehubBound = 'true';
      root.addEventListener('click', function (event) {
        withLanguageRoot(root, function () { handleRootClick(event); });
      });
      root.addEventListener('input', function (event) {
        withLanguageRoot(root, function () { handleRootInput(event); });
      });
      root.addEventListener('change', function (event) {
        withLanguageRoot(root, function () { handleRootChange(event); });
      });
      root.addEventListener('dragover', function (event) {
        withLanguageRoot(root, function () { handleRootDragOver(event); });
      });
      root.addEventListener('dragleave', function (event) {
        withLanguageRoot(root, function () { handleRootDragLeave(event); });
      });
      root.addEventListener('drop', function (event) {
        withLanguageRoot(root, function () { void handleRootDrop(event); });
      });
    });
  }

  function setInstallFeedback(kind, message) {
    uiState.installFeedbackKind = String(kind || 'info');
    uiState.installFeedback = String(message || '');
  }

  function setNotice(message) {
    uiState.notice = String(message || '');
    renderAll();
  }

  function clearNotice() {
    if (!uiState.notice) return;
    uiState.notice = '';
  }

  function getActiveItem() {
    const store = getStore();
    return store ? store.getActiveItem() : null;
  }

  function getItems() {
    const store = getStore();
    return store ? store.getAll() : [];
  }

  function getFilteredItems() {
    return getItems()
      .filter(function (item) {
        if (uiState.filterStatus !== 'all' && item.status !== uiState.filterStatus) return false;
        if (uiState.filterType !== 'all' && item.type !== uiState.filterType) return false;
        if (uiState.query) {
          const haystack = [item.title, item.type, item.version, item.description && item.description.short, item.author && item.author.name, (item.tags || []).join(' ')].join(' ').toLowerCase();
          if (!haystack.includes(uiState.query.toLowerCase())) return false;
        }
        return true;
      })
      .sort(function (a, b) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  function renderAll() {
    bindRoots();
    const store = getStore();
    if (!store) return;

    const counts = store.getCounts();
    const activeItem = store.getActiveItem();
    const filteredItems = getFilteredItems();

    getRoots().forEach(function (root) {
      withLanguageRoot(root, function () {
        const surface = root.getAttribute('data-codehub-surface') || 'workspace';
        root.innerHTML = renderSurface(surface, {
          counts: counts,
          activeItem: activeItem,
          filteredItems: filteredItems,
          allItems: getItems(),
          notice: uiState.notice
        });
      });
    });
  }

  // IRGEZTNE_PACKAGE_WORKSHOP_COVER_V060B
  function renderPackageWorkshopReleaseCover(surface, context) {
    const classes = ['ns-codehub-v1', 'ns-codehub-v1--cover-mode'];
    if (surface === 'cabinet') classes.push('ns-codehub-v1--cabinet');
    else classes.push('ns-codehub-v1--workspace');

    const openButton = surface !== 'cabinet'
      ? '<button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="open-cabinet">' + escapeHtml(t('Открыть полностью', 'Open full view')) + '</button>'
      : '';

    return [
      '<div class="' + classes.join(' ') + '" data-codehub-surface="' + escapeHtml(surface) + '">',
      context && context.notice ? '<div class="ns-codehub-v1__notice">' + escapeHtml(localizeRuntimeText(context.notice)) + '</div>' : '',

      '<section class="panel-card ns-codehub-v1__cover-hero">',
      '<div class="ns-codehub-v1__cover-copy">',

      '<div class="ns-codehub-v1__kicker">' +
        escapeHtml(t('Мастерская Web Studio', 'Web Studio Workshop')) +
      '</div>',

      '<h3 class="ns-codehub-v1__brand">' +
        escapeHtml(t('Мастерская', 'Workshop')) +
      '</h3>',

      '<p>' +
        escapeHtml(t(
          'Здесь будут собираться полезные элементы для сайтов: готовые секции, блоки, темы, виджеты, иконки и другие ассеты Web Studio.',
          'This space will bring together useful website elements: ready sections, blocks, themes, widgets, icons, and other Web Studio assets.'
        )) +
      '</p>',

      '<p class="ns-codehub-v1__cover-note">' +
        escapeHtml(t(
          'В Workspace 1.0.0 Мастерская пока знакомит с будущим направлением. Официальные шаблоны уже доступны в разделе «Шаблоны», а собственные наборы и их проверка появятся позже.',
          'In Workspace 1.0.0, Workshop introduces this future direction. Official templates are already available in Templates; custom reusable sets and validation will follow later.'
        )) +
      '</p>',

      '<div class="ns-codehub-v1__cover-actions">',
      openButton,

      '<span class="ns-codehub-v1__cover-pill">' +
        escapeHtml(t('Связано с Web Studio', 'Connected to Web Studio')) +
      '</span>',

      '<span class="ns-codehub-v1__cover-pill">' +
        escapeHtml(t('Готовится', 'In preparation')) +
      '</span>',

      '</div>',
      '</div>',

      '<div class="ns-codehub-v1__cover-visual" aria-hidden="true">' +
        '<div class="ns-codehub-v1__cover-stack">' +
          '<span></span><span></span><span></span>' +
        '</div>' +
        '<div class="ns-codehub-v1__cover-cube">◇</div>' +
      '</div>',

      '</section>',

      '<div class="ns-codehub-v1__cover-grid">',

      '<section class="panel-card ns-codehub-v1__cover-card">' +
        '<strong>' + escapeHtml(t('Уже доступно', 'Available now')) + '</strong>' +
        '<span>' +
          escapeHtml(t(
            'Web Studio и галерея официальных шаблонов уже работают. Мастерская станет их естественным продолжением.',
            'Web Studio and the official template gallery already work. Workshop will become their natural continuation.'
          )) +
        '</span>' +
      '</section>',

      '<section class="panel-card ns-codehub-v1__cover-card">' +
        '<strong>' + escapeHtml(t('Следующий шаг', 'Next step')) + '</strong>' +
        '<span>' +
          escapeHtml(t(
            'Собственные секции, темы и ассеты можно будет сохранять как аккуратные повторно используемые наборы.',
            'Custom sections, themes, and assets will be saved as clean reusable sets.'
          )) +
        '</span>' +
      '</section>',

      '<section class="panel-card ns-codehub-v1__cover-card">' +
        '<strong>' + escapeHtml(t('Позже', 'Later')) + '</strong>' +
        '<span>' +
          escapeHtml(t(
            'Публичная библиотека появится только с понятным авторством, версиями, лицензиями и проверкой качества — без рекламного базара.',
            'A public library will come only with clear authorship, versions, licenses, and quality checks — without an advertising bazaar.'
          )) +
        '</span>' +
      '</section>',

      '</div>',
      '</div>'
    ].join('');
  }


  // IRGEZTNE Workspace v031l Workshop Restore.
  // Полноценная Мастерская снова является активной поверхностью.
  // Release-cover сохранён выше как исторический fallback, но не вызывается.
  function renderSurface(surface, context) {
    const classes = ['ns-codehub-v1'];
    if (surface === 'cabinet') {
      classes.push('ns-codehub-v1--cabinet');
    } else {
      classes.push('ns-codehub-v1--workspace');
    }

    return [
      '<div class="' + classes.join(' ') + '" data-codehub-surface="' + escapeHtml(surface) + '">',
      renderSurfaceHead(surface),
      context.notice ? '<div class="ns-codehub-v1__notice">' + escapeHtml(localizeRuntimeText(context.notice)) + '</div>' : '',
      renderSurfaceBody(surface, context),
      '</div>'
    ].join('');
  }

  // IRGEZTNE_WORKSHOP_ACCOUNT_CONTEXT_RELEASE_R1
  function renderWorkshopAccountReleaseR1() {
    var account = window.IRGEZTNEConnected || null;
    var connected = Boolean(account && typeof account.isConnected === 'function' && account.isConnected());
    var state = account && typeof account.getState === 'function' ? (account.getState() || {}) : {};
    var label = connected
      ? (state.displayName || state.email || 'IRGEZTNE ID')
      : t('Аккаунт', 'Account');
    var title = connected
      ? t('IRGEZTNE ID подключён', 'IRGEZTNE ID connected')
      : t('Локальная работа доступна без аккаунта. Аккаунт нужен для сетевой отправки и публикации.', 'Local work is available without an account. An account is required for network submission and publishing.');

    return '<button type="button" class="ns-codehub-v1__account-release-r1' + (connected ? ' is-connected' : '') + '" data-codehub-action="open-account" title="' +
      escapeHtml(title) + '"><span></span>' + escapeHtml(label) + '</button>';
  }

  function renderSurfaceHead(surface) {
    const openFullButton = surface === 'workspace'
      ? '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--muted" data-codehub-action="open-cabinet">' + escapeHtml(t('Открыть Мастерскую', 'Open Workshop')) + '</button>'
      : '';

    return [
      '<section class="panel-card ns-codehub-v1__hero">',
      '  <div class="ns-codehub-v1__hero-copy">',
      '    <div class="ns-codehub-v1__kicker">' + escapeHtml(t('Пространство автора', 'Creator Workspace')) + '</div>',
      '    <h3 class="ns-codehub-v1__brand">' + escapeHtml(t('Мастерская', 'Workshop')) + '</h3>',
      '    <p>' + escapeHtml(t('Создавайте пакеты для Web Studio: шаблоны, темы, компоненты и виджеты. Локальная подготовка и проверка пакета работают без аккаунта. Для публикации в Мастерской используется IRGEZTNE Account.', 'Create Web Studio packages: templates, themes, components, and widgets. Local preparation and package validation work without an account. Publishing to the Workshop uses IRGEZTNE Account.')) + '</p>',
      '  </div>',
      '  <div class="ns-codehub-v1__workshop-toolbar">',
      renderTopNav(),
      openFullButton ? '    <div class="ns-codehub-v1__hero-actions">' + openFullButton + '</div>' : '',
      '  </div>',
      '</section>'
    ].join('');
  }

  function isMyPackagesView() {
    return uiState.view === VIEW_HOME || uiState.view === VIEW_LIST || uiState.view === VIEW_BUILDER || uiState.view === VIEW_RULES;
  }

  function renderTopNav() {
    return [
      '<div class="ns-codehub-v1__topnav">',
      '  <button type="button" class="ns-codehub-v1__topnav-btn' + (uiState.view === VIEW_CATALOG ? ' is-active' : '') + '" data-codehub-nav="catalog">' + escapeHtml(t('Каталог', 'Catalog')) + '</button>',
      '  <button type="button" class="ns-codehub-v1__topnav-btn' + (uiState.view === VIEW_INSTALLED ? ' is-active' : '') + '" data-codehub-nav="installed">' + escapeHtml(t('Установленные', 'Installed')) + '</button>',
      '  <button type="button" class="ns-codehub-v1__topnav-btn' + (isMyPackagesView() ? ' is-active' : '') + '" data-codehub-nav="home">' + escapeHtml(t('Мои пакеты', 'My Packages')) + '</button>',
      '</div>'
    ].join('');
  }


  function renderMyPackagesActions() {
    return [
      '<div class="ns-codehub-v1__my-packages-actions">',
      '  <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="new-item">' + escapeHtml(t('Новый пакет', 'New Package')) + '</button>',
      '  <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--muted" data-codehub-nav="rules">' + escapeHtml(t('Как это работает', 'How it works')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderSurfaceBody(surface, context) {
    if (uiState.view === VIEW_CATALOG) return renderCatalogView(surface, context);
    if (uiState.view === VIEW_INSTALLED) return renderInstalledView(surface, context);
    if (uiState.view === VIEW_LIST) return renderListView(surface, context);
    if (uiState.view === VIEW_BUILDER) return renderBuilderView(surface, context);
    if (uiState.view === VIEW_RULES) return renderRulesView(surface, context);
    return renderHomeView(surface, context);
  }

  function renderCatalogView() {
    const catalogItems = [];
    const counts = workshopTypeCounts(catalogItems);
    const selectedLabel = workshopTypeFilterLabel(uiState.catalogFilterType);
    return [
      '<section class="panel-card ns-codehub-v1__panel ns-codehub-v1__catalog-panel">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Каталог', 'Catalog')) + '</h4><span>' + escapeHtml(t('Единый каталог пакетов Мастерской: шаблоны, темы, компоненты и виджеты сайта.', 'One Workshop catalog for templates, themes, components, and site widgets.')) + '</span></div>',
      renderWorkshopTypeFilter('catalog', counts, uiState.catalogFilterType),
      '  <div class="ns-codehub-v1__empty ns-codehub-v1__empty--release-filter"><strong>' + escapeHtml(t('Публичный каталог пока не подключён.', 'The public catalog is not connected yet.')) + '</strong><span>' + escapeHtml(t('Фильтр «' + selectedLabel + '» готов для реальных опубликованных пакетов. Демо и вымышленные позиции не показываются.', 'The “' + selectedLabel + '” filter is ready for real published packages. Demo and invented entries are not shown.')) + '</span></div>',
      '</section>'
    ].join('');
  }

  function renderInstalledView() {
    const allInstalled = readWorkshopInstalledRegistry().slice().sort(function (a, b) {
      return new Date(b.installedAt || 0).getTime() - new Date(a.installedAt || 0).getTime();
    });
    const counts = workshopTypeCounts(allInstalled);
    const installed = allInstalled.filter(function (item) {
      return uiState.installedFilterType === 'all' || String(item && item.type || '') === uiState.installedFilterType;
    });
    const cards = installed.map(function (item) {
      const date = item.installedAt ? new Date(item.installedAt).toLocaleString(isRu() ? 'ru-RU' : 'en-US') : '—';
      return [
        '<article class="ns-codehub-v1__installed-card">',
        '  <div class="ns-codehub-v1__installed-card-head"><strong>' + escapeHtml(item.title || t('Пакет без названия', 'Untitled package')) + '</strong><span>' + escapeHtml(getTypeLabel(item.type)) + ' · ' + escapeHtml(item.version) + '</span></div>',
        '  <div class="ns-codehub-v1__installed-meta">',
        '    <div><span>' + escapeHtml(t('Автор', 'Author')) + '</span>' + escapeHtml(workshopInstalledAuthorLabel(item.author)) + '</div>',
        '    <div><span>' + escapeHtml(t('Лицензия', 'License')) + '</span>' + escapeHtml(item.license || '—') + '</div>',
        '    <div><span>' + escapeHtml(t('Файлы', 'Files')) + '</span>' + String((item.files || []).length) + '</div>',
        '    <div><span>' + escapeHtml(t('Установлено', 'Installed')) + '</span>' + escapeHtml(date) + '</div>',
        '    <div><span>' + escapeHtml(t('Назначение', 'Destination')) + '</span>' + escapeHtml(workshopInstalledDestination(item.type)) + '</div>',
        '    <div><span>Package ID</span>' + escapeHtml(item.packageId) + '</div>',
        '  </div>',
        '  <div class="ns-codehub-v1__installed-card-actions">',
        '    <div class="ns-codehub-v1__installed-pass">✓ SHA-256 · ' + escapeHtml(t('целостность проверена', 'integrity verified')) + '</div>',
        '    <button type="button" class="ns-codehub-v1__inline-btn ns-codehub-v1__inline-btn--danger" data-codehub-action="uninstall-installed" data-codehub-install-id="' + escapeHtml(item.installId || (String(item.packageId) + '@' + String(item.version))) + '">' + escapeHtml(t('Удалить установленный', 'Remove installed')) + '</button>',
        '  </div>',
        '</article>'
      ].join('');
    }).join('');
    const empty = !allInstalled.length
      ? t('Установленных пакетов пока нет. После успешной проверки установленный пакет появится здесь.', 'No packages are installed yet. After successful validation, the installed package will appear here.')
      : t('Нет установленных пакетов типа «' + workshopTypeFilterLabel(uiState.installedFilterType) + '». Выберите другой фильтр.', 'No installed packages match “' + workshopTypeFilterLabel(uiState.installedFilterType) + '”. Choose another filter.');
    return [
      '<section class="panel-card ns-codehub-v1__panel ns-codehub-v1__installed-panel">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Установленные пакеты', 'Installed packages')) + '</h4><span>' + escapeHtml(t('Импортированный ZIP всегда повторно проверяется локально. Авторский черновик и установленная копия остаются разными сущностями.', 'Every imported ZIP is re-validated locally. Creator drafts and installed copies remain separate entities.')) + '</span></div>',
      '  <div class="ns-codehub-v1__install-dropzone" data-codehub-install-dropzone>',
      '    <div class="ns-codehub-v1__install-drop-copy">',
      '      <strong class="ns-codehub-v1__install-drop-title">' + escapeHtml(t('Перетащите ZIP-файл сюда', 'Drop a ZIP file here')) + '</strong>',
      '      <span class="ns-codehub-v1__install-drop-note">' + escapeHtml(t('Или выберите ZIP кнопкой справа. После выбора сразу будет показан результат проверки и установки.', 'Or choose a ZIP with the button on the right. The validation and installation result will be shown here immediately.')) + '</span>',
      '    </div>',
      '    <div class="ns-codehub-v1__installed-actions">',
      '      <label class="ns-codehub-v1__upload"><span>' + escapeHtml(t('Выбрать ZIP', 'Choose ZIP')) + '</span><input type="file" accept=".zip,application/zip" data-codehub-install-zip-input hidden></label>',
      '    </div>',
      '  </div>',
      uiState.installFeedback
        ? '<div class="ns-codehub-v1__install-feedback is-' + escapeHtml(uiState.installFeedbackKind || 'info') + '"><strong>' + escapeHtml(t('Статус ZIP', 'ZIP status')) + '</strong><span>' + escapeHtml(localizeRuntimeText(uiState.installFeedback)) + '</span></div>'
        : '',
      renderWorkshopTypeFilter('installed', counts, uiState.installedFilterType),
      installed.length
        ? '<div class="ns-codehub-v1__installed-grid">' + cards + '</div>'
        : '<div class="ns-codehub-v1__empty ns-codehub-v1__installed-empty">' + escapeHtml(empty) + '</div>',
      '</section>'
    ].join('');
  }

  function renderHomeView(surface, context) {
    const counts = context.counts;
    const recent = context.allItems.slice().sort(function (a, b) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }).slice(0, surface === 'workspace' ? 4 : 6);

    return [
      '<section class="panel-card ns-codehub-v1__panel ns-codehub-v1__my-packages-intro">',
      '  <div class="ns-codehub-v1__panel-head"><div><h4>' + escapeHtml(t('Мои пакеты', 'My Packages')) + '</h4><span>' + escapeHtml(t('Авторская зона: создавайте, проверяйте и экспортируйте собственные пакеты локально.', 'Creator area: build, validate, and export your own packages locally.')) + '</span></div>' + renderMyPackagesActions() + '</div>',
      '</section>',
      '<div class="ns-codehub-v1__grid ns-codehub-v1__grid--home">',
      '  <section class="panel-card ns-codehub-v1__summary">',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Всего пакетов', 'Total packages')) + '</span><strong>' + counts.all + '</strong></div>',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Черновики', 'Drafts')) + '</span><strong>' + counts.draft + '</strong></div>',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Проверено', 'Validated')) + '</span><strong>' + counts.validated + '</strong></div>',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Готово к публикации', 'Ready to publish')) + '</span><strong>' + counts.ready + '</strong></div>',
      '  </section>',
      '  <section class="panel-card ns-codehub-v1__panel">',
      '    <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Недавние пакеты', 'Recent Packages')) + '</h4><button type="button" class="ns-codehub-v1__inline-btn" data-codehub-nav="list">' + escapeHtml(t('Открыть список', 'Open list')) + '</button></div>',
      renderRecentList(recent),
      '  </section>',
      '  <section class="panel-card ns-codehub-v1__panel">',
      '    <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Типы пакетов', 'Package Types')) + '</h4><span>' + escapeHtml(t('Выберите, что хотите создать.', 'Choose what you want to create.')) + '</span></div>',
      '    <div class="ns-codehub-v1__type-grid">',
      getTypeOptions().map(function (pair) {
        return [
          '<button type="button" class="ns-codehub-v1__type-card" data-codehub-action="new-item" data-codehub-type="' + pair[0] + '">',
          '  <strong>' + pair[1] + '</strong>',
          '  <span>' + getTypeHelp(pair[0]) + '</span>',
          '</button>'
        ].join('');
      }).join(''),
      '    </div>',
      '  </section>',
      '  <section class="panel-card ns-codehub-v1__panel">',
      '    <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Как это работает', 'How it works')) + '</h4><span>' + escapeHtml(t('Четыре понятных шага от идеи до готового ZIP.', 'Four clear steps from idea to a ready ZIP.')) + '</span></div>',
      '    <div class="ns-codehub-v1__flow">',
      '      <div class="ns-codehub-v1__flow-step"><strong>1</strong><span>' + escapeHtml(t('Создайте шаблон, тему, компонент или виджет.', 'Create a template, theme, component, or widget.')) + '</span></div>',
      '      <div class="ns-codehub-v1__flow-step"><strong>2</strong><span>' + escapeHtml(t('Добавьте реальные файлы, автора, лицензию и превью.', 'Add real files, author, license, and previews.')) + '</span></div>',
      '      <div class="ns-codehub-v1__flow-step"><strong>3</strong><span>' + escapeHtml(t('Проверьте пакет: структура, файлы и целостность проверяются локально.', 'Validate the package: structure, files, and integrity are checked locally.')) + '</span></div>',
      '      <div class="ns-codehub-v1__flow-step"><strong>4</strong><span>' + escapeHtml(t('Экспортируйте пакет в ZIP. Для публикации в Мастерской потребуется IRGEZTNE Account.', 'Export the package as ZIP. Publishing to the Workshop requires IRGEZTNE Account.')) + '</span></div>',
      '    </div>',
      '  </section>',
      '</div>'
    ].join('');
  }

  function renderRecentList(items) {
    if (!items.length) {
      return '<div class="ns-codehub-v1__empty">' + escapeHtml(t('Пакетов пока нет. Создайте первый черновик через «Новый пакет».', 'No packages yet. Create the first draft from New Package.')) + '</div>';
    }

    return [
      '<div class="ns-codehub-v1__recent-list">',
      items.map(function (item) {
        return [
          '<div class="ns-codehub-v1__recent-row">',
          '  <div class="ns-codehub-v1__recent-copy">',
          '    <strong>' + escapeHtml(normalizePackageTitle(item.title || t('Пакет без названия', 'Untitled package'))) + '</strong>',
          '    <span>' + escapeHtml(normalizeUiText([getTypeLabel(item.type), getStatusLabels()[item.status] || item.status, item.version].filter(Boolean).join(' · '))) + '</span>',
          '  </div>',
          '  <div class="ns-codehub-v1__recent-actions">',
          '    <button type="button" class="ns-codehub-v1__inline-btn" data-codehub-action="open-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Открыть', 'Open')) + '</button>',
          '    <button type="button" class="ns-codehub-v1__inline-btn ns-codehub-v1__inline-btn--danger" data-codehub-action="delete-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
          '  </div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderListView(surface, context) {
    const typeCounts = workshopTypeCounts(context.allItems);
    return [
      '<section class="panel-card ns-codehub-v1__panel">',
      '  <div class="ns-codehub-v1__panel-head"><div><h4>' + escapeHtml(t('Мои пакеты', 'My Packages')) + '</h4><span>' + escapeHtml(t('Локальный список пакетов для Web Studio.', 'Local package list for Web Studio.')) + '</span></div>' + renderMyPackagesActions() + '</div>',
      renderWorkshopTypeFilter('my-packages', typeCounts, uiState.filterType),
      '  <div class="ns-codehub-v1__toolbar ns-codehub-v1__toolbar--my-packages">',
      '    <input class="ns-codehub-v1__input ns-codehub-v1__search" type="text" placeholder="' + escapeHtml(t('Поиск пакетов...', 'Search packages...')) + '" data-codehub-filter="query" value="' + escapeHtml(uiState.query) + '">',
      '    <select class="ns-codehub-v1__select" data-codehub-filter="status">',
      renderSelectOptions([['all', t('Все статусы', 'All statuses')]].concat(Object.keys(getStatusLabels()).map(function (key) { return [key, getStatusLabels()[key]]; })), uiState.filterStatus),
      '    </select>',
      '  </div>',
      renderPackageList(context.filteredItems, surface),
      '</section>'
    ].join('');
  }

  function renderPackageList(items, surface) {
    if (!items.length) {
      return '<div class="ns-codehub-v1__empty">' + escapeHtml(t('По текущим фильтрам пакеты не найдены.', 'No packages match the current filters.')) + '</div>';
    }

    return [
      '<div class="ns-codehub-v1__list">',
      items.map(function (item) {
        return renderPackageCard(item, surface);
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderPackageCard(item) {
    return [
      '<article class="ns-codehub-v1__card">',
      '  <div class="ns-codehub-v1__card-head">',
      '    <div>',
      '      <div class="ns-codehub-v1__card-kicker">' + escapeHtml(getTypeLabel(item.type)) + ' · ' + escapeHtml(item.version) + '</div>',
      '      <h5>' + escapeHtml(normalizePackageTitle(item.title || t('Пакет без названия', 'Untitled package'))) + '</h5>',
      '    </div>',
      '    <div class="ns-codehub-v1__badge-row">',
      '      <span class="ns-codehub-v1__badge">' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</span>',
      '      <span class="ns-codehub-v1__badge ns-codehub-v1__badge--muted">' + escapeHtml(item.trust) + '</span>',
      '    </div>',
      '  </div>',
      '  <p class="ns-codehub-v1__card-copy">' + escapeHtml(item.description && item.description.short ? item.description.short : getBuilderNoDescription()) + '</p>',
      '  <div class="ns-codehub-v1__card-meta">' + escapeHtml(t('Обновлено', 'Updated')) + ' ' + escapeHtml(formatDate(item.updatedAt)) + '</div>',
      '  <div class="ns-codehub-v1__card-tags">' + renderTags(item.tags) + '</div>',
      '  <div class="ns-codehub-v1__card-actions">',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="open-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Открыть', 'Open')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="duplicate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button>',
      item.status === 'archived'
        ? '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="restore-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Восстановить', 'Restore')) + '</button>'
        : '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="archive-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('В архив', 'Archive')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--danger" data-codehub-action="delete-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderBuilderView(surface, context) {
    const item = context.activeItem;
    if (!item) {
      return [
        '<section class="panel-card ns-codehub-v1__panel">',
        '  <div class="ns-codehub-v1__empty">' + escapeHtml(t('Активного пакета пока нет. Создайте его, чтобы открыть конструктор.', 'No active package yet. Create one to open the builder.')) + '</div>',
        '</section>'
      ].join('');
    }

    const verifiedValidation = getItemCustomsReport(item);
    const baseValidation = getStore().validateItem(item.id);
    const validation = verifiedValidation || Object.assign({}, baseValidation, {
      isReady: false,
      requiresCheck: !!baseValidation.isReady,
      realBytesChecked: false
    });

    return [
      '<div class="ns-codehub-v1__grid ns-codehub-v1__grid--builder">',
      '  <section class="panel-card ns-codehub-v1__builder-shell">',
      '    <div class="ns-codehub-v1__panel-head">',
      '      <div><h4>' + escapeHtml(normalizePackageTitle(item.title)) + '</h4><span>' + escapeHtml(getTypeLabel(item.type)) + ' · ' + escapeHtml(item.version) + '</span></div>',
      '      <div class="ns-codehub-v1__builder-head-actions">',
      uiState.savedItemId === item.id ? '        <span class="ns-codehub-v1__save-state">✓ ' + escapeHtml(t('Сохранено', 'Saved')) + '</span>' : '',
      '        <button type="button" class="ns-codehub-v1__btn" data-codehub-nav="list">' + escapeHtml(t('Назад к списку', 'Back to list')) + '</button>',
      '        <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="save-draft" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Сохранить черновик', 'Save draft')) + '</button>',
      '      </div>',
      '    </div>',
      renderBuilderTabs(),
      renderBuilderTab(item, validation),
      '  </section>',
      surface === 'cabinet' ? renderBuilderSideSummary(item, validation) : '',
      '</div>'
    ].join('');
  }

  function renderBuilderTabs() {
    return [
      '<div class="ns-codehub-v1__builder-tabs">',
      BUILDER_TABS.map(function (tab) {
        return '<button type="button" class="ns-codehub-v1__builder-tab' + (uiState.builderTab === tab ? ' is-active' : '') + '" data-codehub-builder-tab="' + tab + '">' + escapeHtml(getBuilderTabLabel(tab)) + '</button>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderBuilderSideSummary(item, validation) {
    return [
      '<aside class="panel-card ns-codehub-v1__side">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Кратко', 'At a glance')) + '</h4><span>' + escapeHtml(t('Состояние пакета', 'Package state')) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Статус', 'Status')) + '</strong><span>' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Доверие', 'Trust')) + '</strong><span>' + escapeHtml(item.trust) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Файлы', 'Files')) + '</strong><span>' + item.files.length + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Проверка', 'Validation')) + '</strong><span>' + escapeHtml(getValidationStateLabel(validation)) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Обновлено', 'Updated')) + '</strong><span>' + escapeHtml(formatDate(item.updatedAt)) + '</span></div>',
      '</aside>'
    ].join('');
  }

  function renderBuilderTab(item, validation) {
    if (uiState.builderTab === 'details') return renderDetailsTab(item);
    if (uiState.builderTab === 'files') return renderFilesTab(item);
    if (uiState.builderTab === 'preview') return renderPreviewTab(item);
    if (uiState.builderTab === 'compatibility') return renderCompatibilityTab(item);
    if (uiState.builderTab === 'validation') return renderValidationTab(item, validation);
    if (uiState.builderTab === 'submit') return renderValidationTab(item, validation);
    return renderOverviewTab(item, validation);
  }

  function renderOverviewTab(item, validation) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__overview-grid">',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Тип', 'Type')) + '</span><strong>' + escapeHtml(getTypeLabel(item.type)) + '</strong></div>',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Статус', 'Status')) + '</span><strong>' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</strong></div>',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Файлы', 'Files')) + '</span><strong>' + item.files.length + '</strong></div>',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Проверка', 'Validation')) + '</span><strong>' + escapeHtml(getValidationSummaryLabel(validation)) + '</strong></div>',
      '  </div>',
      '  <div class="ns-codehub-v1__overview-note">',
      '    <strong>' + escapeHtml(t('Краткое описание', 'Short description')) + '</strong>',
      '    <p>' + escapeHtml(item.description && item.description.short ? item.description.short : getBuilderNoDescription()) + '</p>',
      '  </div>',
      '  <div class="ns-codehub-v1__actions">',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Проверить пакет', 'Validate package')) + '</button>',
      item.status !== 'ready' ? '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="mark-ready" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Пометить как готовый', 'Mark ready')) + '</button>' : '',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--danger" data-codehub-action="delete-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderDetailsTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__field-grid two-up">',
      renderField(t('Название пакета', 'Package title'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="title" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(normalizePackageTitle(item.title)) + '">'),
      renderField(t('Тип', 'Type'), '<select class="ns-codehub-v1__select" data-codehub-field="type" data-codehub-id="' + escapeHtml(item.id) + '">' + renderSelectOptions(getTypeOptions(), item.type) + '</select>'),
      renderField(t('Автор', 'Author'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="author.name" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.author && item.author.name) + '" placeholder="' + escapeHtml(t('Введите имя автора', 'Enter author name')) + '">'),
      renderField(t('Версия', 'Version'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="version" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.version) + '">'),
      renderField(t('Лицензия пакета', 'Package license'), renderLicenseControl(item)),
      renderField(t('Распространение', 'Distribution'), '<select class="ns-codehub-v1__select" data-codehub-field="distribution" data-codehub-id="' + escapeHtml(item.id) + '">' + renderSelectOptions(getDistributionOptions(), item.distribution || 'free') + '<option value="pro" disabled>PRO — ' + escapeHtml(t('после запуска публичной Мастерской', 'after Marketplace launch')) + '</option></select>'),
      '  </div>',
      renderField(t('Краткое описание', 'Short description'), '<textarea class="ns-codehub-v1__textarea" rows="3" data-codehub-field="description.short" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.description && item.description.short) + '</textarea>'),
      renderField(t('Полное описание', 'Full description'), '<textarea class="ns-codehub-v1__textarea" rows="6" data-codehub-field="description.full" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.description && item.description.full) + '</textarea>'),
      renderField(t('Теги', 'Tags'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="tags" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml((item.tags || []).join(', ')) + '" placeholder="' + escapeHtml(t('новости, редактура, минимализм', 'news, editorial, minimal')) + '">'),
      '</div>'
    ].join('');
  }

  function renderFilesTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__panel-head compact"><h4>' + escapeHtml(t('Файлы', 'Files')) + '</h4><span>' + escapeHtml(t('Добавляйте отдельные файлы или целую папку сайта. Структура css / js / images сохраняется, для каждого файла считается SHA-256.', 'Add individual files or a whole website folder. The css / js / images structure is preserved and SHA-256 is calculated for every file.')) + '</span></div>',
      '  <div class="ns-codehub-v1__actions">',
      '    <label class="ns-codehub-v1__upload"><input type="file" multiple data-codehub-files-input data-codehub-id="' + escapeHtml(item.id) + '" hidden><span>' + escapeHtml(t('Добавить файлы', 'Add files')) + '</span></label>',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="pick-folder" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Добавить папку', 'Add folder')) + '</button>',
      '  </div>',
      '  <div class="ns-codehub-v1__file-path-hint">' + escapeHtml(t('При импорте папки сохраняются относительные пути. В ZIP останутся, например: index.html, css/style.css, js/main.js, images/hero.jpg.', 'Folder import preserves relative paths. The ZIP keeps paths such as index.html, css/style.css, js/main.js, images/hero.jpg.')) + '</div>',
      item.files.length ? [
        '<div class="ns-codehub-v1__file-list">',
        item.files.map(function (file) {
          return [
            '<div class="ns-codehub-v1__file-row">',
            '  <div class="ns-codehub-v1__file-copy">',
            '    <strong>' + escapeHtml(file.path) + '</strong>',
            '    <span>' + escapeHtml([file.kind, file.size ? formatBytes(file.size) : '0 B', file.sha256 ? ('SHA-256 ' + file.sha256.slice(0, 12) + '…') : t('нет SHA-256', 'no SHA-256')].join(' · ')) + '</span>',
            '  </div>',
            '  <div class="ns-codehub-v1__file-actions">',
            '    <select class="ns-codehub-v1__select compact" data-codehub-file-role data-codehub-id="' + escapeHtml(item.id) + '" data-codehub-file-id="' + escapeHtml(file.id) + '">',
            renderSelectOptions([
              ['main', 'Основной'],
              ['style', 'Стиль'],
              ['template', 'Шаблон'],
              ['asset', t('Ресурс', 'Resource')],
              ['cover', 'Обложка'],
              ['preview', 'Превью'],
              ['data', 'Данные']
            ], file.role),
            '    </select>',
            '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="remove-file" data-codehub-id="' + escapeHtml(item.id) + '" data-codehub-file-id="' + escapeHtml(file.id) + '">' + escapeHtml(t('Убрать', 'Remove')) + '</button>',
            '  </div>',
            '</div>'
          ].join('');
        }).join(''),
        '</div>'
      ].join('') : '<div class="ns-codehub-v1__empty">' + escapeHtml(t('Файлов пока нет. Добавьте хотя бы один основной файл; содержимое сохранится локально.', 'No files yet. Add at least one main file; its content will be stored locally.')) + '</div>',
      '</div>'
    ].join('');
  }

  function normalizeWorkshopPath(value) {
    const raw = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = [];
    raw.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') {
        if (parts.length) parts.pop();
        return;
      }
      parts.push(part);
    });
    return parts.join('/');
  }

  function folderRootForPickedFiles(files) {
    const roots = (files || []).map(function (file) {
      const rel = String(file && file.webkitRelativePath || '').replace(/\\/g, '/');
      return rel.includes('/') ? rel.split('/')[0] : '';
    }).filter(Boolean);
    if (!roots.length) return '';
    return roots.every(function (root) { return root === roots[0]; }) ? roots[0] : '';
  }

  function importedWorkshopPath(file, fromFolder, folderRoot) {
    let path = String(file && file.webkitRelativePath || file && file.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (fromFolder && folderRoot && path.indexOf(folderRoot + '/') === 0) path = path.slice(folderRoot.length + 1);
    return normalizeWorkshopPath(path || (file && file.name));
  }

  function inferWorkshopRole(path, kind, fromPreview, existingFiles, fromFolder) {
    if (fromPreview) return 'cover';
    const normalized = normalizeWorkshopPath(path).toLowerCase();
    const hasMain = (existingFiles || []).some(function (file) { return file.role === 'main' || file.role === 'template'; });
    if (!hasMain && /(^|\/)index\.html?$/.test(normalized)) return 'main';
    if (!fromFolder && !hasMain && kind === 'document') return 'main';
    if (kind === 'stylesheet') return 'style';
    if (/cover|thumbnail/.test(normalized) && kind === 'image') return 'cover';
    return 'asset';
  }

  function getTemplatePreviewEntry(item) {
    const files = item && item.files || [];
    return files.find(function (file) {
      return (file.role === 'main' || file.role === 'template') && /\.html?$/i.test(file.path || '');
    }) || files.find(function (file) { return /(^|\/)index\.html?$/i.test(file.path || ''); }) || files.find(function (file) { return /\.html?$/i.test(file.path || ''); }) || null;
  }

  function workshopRefIsExternal(value) {
    const ref = String(value || '').trim();
    return !ref || ref[0] === '#' || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(ref) || ref.indexOf('{{') >= 0 || ref.indexOf('<%') >= 0 || ref.indexOf('${') >= 0;
  }

  function resolveWorkshopReference(sourcePath, reference) {
    const raw = String(reference || '').trim().replace(/^['\"]|['\"]$/g, '');
    if (!raw || workshopRefIsExternal(raw)) return '';
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) return '';
    if (clean[0] === '/') return normalizeWorkshopPath(clean);
    const base = normalizeWorkshopPath(sourcePath).split('/');
    base.pop();
    return normalizeWorkshopPath(base.concat(clean.split('/')).join('/'));
  }

  function extractWorkshopLocalReferences(text, sourcePath, kind) {
    const local = [];
    const external = [];
    const seen = new Set();
    function add(ref) {
      const value = String(ref || '').trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      if (/^(?:https?:|\/\/)/i.test(value)) external.push(value);
      const resolved = resolveWorkshopReference(sourcePath, value);
      if (resolved) local.push({ raw: value, path: resolved });
    }
    if (kind === 'document') {
      String(text || '').replace(/\b(?:src|href|poster)\s*=\s*([\"'])(.*?)\1/gi, function (match, q, ref) { add(ref); return match; });
      String(text || '').replace(/\bsrcset\s*=\s*([\"'])(.*?)\1/gi, function (match, q, value) {
        String(value || '').split(',').forEach(function (part) { add(part.trim().split(/\s+/)[0]); });
        return match;
      });
    }
    if (kind === 'stylesheet') {
      String(text || '').replace(/url\(\s*([\"']?)(.*?)\1\s*\)/gi, function (match, q, ref) { add(ref); return match; });
      String(text || '').replace(/@import\s+(?:url\()?\s*([\"'])(.*?)\1/gi, function (match, q, ref) { add(ref); return match; });
    }
    return { local: local, external: external };
  }

  function workshopArrayBufferToDataUrl(buffer, mime) {
    const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return 'data:' + (mime || 'application/octet-stream') + ';base64,' + btoa(binary);
  }

  function replaceWorkshopRefs(text, sourcePath, replacements, mode) {
    function replacementFor(raw) {
      const resolved = resolveWorkshopReference(sourcePath, raw);
      return resolved && replacements[resolved] ? replacements[resolved] : raw;
    }
    let out = String(text || '');
    if (mode === 'css') {
      out = out.replace(/url\(\s*([\"']?)(.*?)\1\s*\)/gi, function (match, q, ref) {
        const next = replacementFor(ref);
        return 'url("' + String(next).replace(/"/g, '%22') + '")';
      });
      out = out.replace(/@import\s+([\"'])(.*?)\1/gi, function (match, q, ref) { return '@import "' + replacementFor(ref) + '"'; });
      return out;
    }
    out = out.replace(/\b(src|href|poster)\s*=\s*([\"'])(.*?)\2/gi, function (match, attr, q, ref) {
      return attr + '=' + q + replacementFor(ref) + q;
    });
    out = out.replace(/\bsrcset\s*=\s*([\"'])(.*?)\1/gi, function (match, q, value) {
      const next = String(value || '').split(',').map(function (part) {
        const pieces = part.trim().split(/\s+/);
        if (pieces[0]) pieces[0] = replacementFor(pieces[0]);
        return pieces.join(' ');
      }).join(', ');
      return 'srcset=' + q + next + q;
    });
    return out;
  }

  function workshopPreviewFileIsScript(file) {
    const path = normalizeWorkshopPath(file && file.path || '').toLowerCase();
    const mime = String(file && file.mime || '').toLowerCase();
    return /\.m?js$/i.test(path) || /(?:java|ecma)script/.test(mime);
  }

  function workshopPreviewAttr(attrs, name) {
    const match = String(attrs || '').match(new RegExp('\\b' + name + '\\s*=\\s*(["\\\'])(.*?)\\1', 'i'));
    return match ? match[2] : '';
  }

  function workshopPreviewStripAttr(attrs, name) {
    return String(attrs || '').replace(new RegExp('\\s*\\b' + name + '\\s*=\\s*(["\\\']).*?\\1', 'ig'), '');
  }

  function workshopPreviewSafeInlineScript(text) {
    return String(text || '').replace(/<\/script/gi, '<\\/script');
  }

  function workshopPreviewSafeInlineStyle(text) {
    return String(text || '').replace(/<\/style/gi, '<\\/style');
  }

  function buildWorkshopPreviewCss(path, records, replacements, stack) {
    const normalized = normalizeWorkshopPath(path);
    const row = records[normalized];
    if (!row) return '';
    const seen = stack || new Set();
    if (seen.has(normalized)) return '';
    seen.add(normalized);
    let css = new TextDecoder().decode(row.bytes);
    css = css.replace(/@import\s+(?:url\(\s*)?(["'])(.*?)\1\s*\)?\s*;/gi, function (match, q, ref) {
      const resolved = resolveWorkshopReference(normalized, ref);
      const imported = resolved && records[resolved];
      if (!imported || imported.file.kind !== 'stylesheet') return match;
      return buildWorkshopPreviewCss(resolved, records, replacements, new Set(seen));
    });
    return replaceWorkshopRefs(css, normalized, replacements, 'css');
  }

  function rewriteWorkshopPreviewDocument(html, entryPath, records, replacements) {
    let out = String(html || '');

    out = out.replace(/<link\b([^>]*)>/gi, function (match, attrs) {
      const rel = workshopPreviewAttr(attrs, 'rel').toLowerCase();
      const href = workshopPreviewAttr(attrs, 'href');
      if (!/(?:^|\s)stylesheet(?:\s|$)/.test(rel) || !href) return match;
      const resolved = resolveWorkshopReference(entryPath, href);
      const row = resolved && records[resolved];
      if (!row || row.file.kind !== 'stylesheet') return match;
      const css = workshopPreviewSafeInlineStyle(buildWorkshopPreviewCss(resolved, records, replacements));
      return '<style data-workshop-source="' + escapeHtml(resolved) + '">' + css + '</style>';
    });

    out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi, function (match, attrs, css) {
      return '<style' + attrs + '>' + workshopPreviewSafeInlineStyle(replaceWorkshopRefs(css, entryPath, replacements, 'css')) + '</style>';
    });

    out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, function (match, attrs, body) {
      const src = workshopPreviewAttr(attrs, 'src');
      if (!src) return match;
      const resolved = resolveWorkshopReference(entryPath, src);
      const row = resolved && records[resolved];
      if (!row || !workshopPreviewFileIsScript(row.file)) return match;
      let cleanAttrs = workshopPreviewStripAttr(attrs, 'src');
      cleanAttrs = workshopPreviewStripAttr(cleanAttrs, 'integrity');
      cleanAttrs = workshopPreviewStripAttr(cleanAttrs, 'crossorigin');
      cleanAttrs = workshopPreviewStripAttr(cleanAttrs, 'referrerpolicy');
      const js = workshopPreviewSafeInlineScript(new TextDecoder().decode(row.bytes));
      return '<script' + cleanAttrs + ' data-workshop-source="' + escapeHtml(resolved) + '">' + js + '</script>';
    });

    return replaceWorkshopRefs(out, entryPath, replacements, 'html');
  }

  async function buildWorkshopLivePreview(item) {
    const entry = getTemplatePreviewEntry(item);
    if (!entry) throw new Error(t('В шаблоне не найден основной HTML-файл.', 'No main HTML file was found in the template.'));
    const records = {};
    for (const file of item.files || []) {
      if (!file.blobKey) continue;
      const record = await getWorkshopBytes(file.blobKey);
      if (!record || !(record.bytes instanceof ArrayBuffer)) continue;
      records[normalizeWorkshopPath(file.path)] = { file: file, bytes: record.bytes };
    }
    if (!records[normalizeWorkshopPath(entry.path)]) throw new Error(t('Не найдено локальное содержимое основного HTML-файла.', 'Local bytes for the main HTML file were not found.'));

    const replacements = {};
    Object.keys(records).forEach(function (path) {
      const row = records[path];
      if (row.file.kind === 'document' || row.file.kind === 'stylesheet' || workshopPreviewFileIsScript(row.file)) return;
      replacements[path] = workshopArrayBufferToDataUrl(row.bytes, row.file.mime);
    });

    const html = new TextDecoder().decode(records[normalizeWorkshopPath(entry.path)].bytes);
    const rewritten = rewriteWorkshopPreviewDocument(html, entry.path, records, replacements);
    const csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; media-src data: blob:; font-src data: blob:; style-src \'unsafe-inline\' data: blob:; script-src \'unsafe-inline\'; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; navigate-to \'none\'">';
    if (/<head(?:\s[^>]*)?>/i.test(rewritten)) return rewritten.replace(/<head(?:\s[^>]*)?>/i, function (match) { return match + csp; });
    return '<!doctype html><html><head>' + csp + '</head><body>' + rewritten + '</body></html>';
  }

  function workshopPreviewOverlayForRoot(root) {
    return root && root.querySelector ? root.querySelector('[data-codehub-preview-overlay]') : null;
  }

  function workshopPreviewUseFullscreenOverlay(overlay) {
    if (!overlay) return;
    // R1W7G: fixed CSS owns the app viewport. The preview must cover the
    // Web Studio header instead of being fitted into the Workshop card.
    overlay.style.top = '';
    overlay.style.left = '';
    overlay.style.right = '';
    overlay.style.bottom = '';
  }

  function workshopPreviewSetDevice(overlay, device) {
    if (!overlay) return;
    const next = device === 'tablet' || device === 'mobile' ? device : 'desktop';
    const viewport = overlay.querySelector('[data-codehub-preview-viewport]');
    if (viewport) viewport.setAttribute('data-device', next);
    overlay.querySelectorAll('[data-codehub-preview-device]').forEach(function (button) {
      const active = button.getAttribute('data-codehub-preview-device') === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function hydrateWorkshopPreviewOverlay(itemId, overlay) {
    const store = getStore();
    const item = store && store.getById(itemId);
    const stage = overlay && overlay.querySelector('[data-codehub-preview-stage]');
    if (!item || !stage) return;
    stage.innerHTML = '<div class="ns-codehub-v1__preview-loading">' + escapeHtml(t('Собираю безопасный локальный предпросмотр…', 'Building a safe local preview…')) + '</div>';
    try {
      const srcdoc = await buildWorkshopLivePreview(item);
      stage.innerHTML = '<div class="ns-codehub-v1__preview-viewport" data-codehub-preview-viewport data-device="desktop"><iframe class="ns-codehub-v1__preview-full-frame" sandbox="allow-scripts" referrerpolicy="no-referrer" title="' + escapeHtml(t('Предпросмотр шаблона', 'Template preview')) + '"></iframe></div>';
      const frame = stage.querySelector('iframe');
      if (frame) frame.srcdoc = srcdoc;
      workshopPreviewSetDevice(overlay, overlay.getAttribute('data-codehub-preview-device-current') || 'desktop');
    } catch (error) {
      stage.innerHTML = '<div class="ns-codehub-v1__preview-loading">' + escapeHtml(t('Не удалось открыть предпросмотр: ', 'Could not open preview: ') + String(error && error.message || error)) + '</div>';
    }
  }

  async function renderWorkshopLivePreview(itemId, sourceButton) {
    const store = getStore();
    const item = store && store.getById(itemId);
    if (!item) return;
    const root = (sourceButton && sourceButton.closest('[data-codehub-root]')) || getRoots()[0];
    if (!root) return;
    const previous = workshopPreviewOverlayForRoot(root);
    if (previous && previous.__workshopPreviewResizeHandler) window.removeEventListener('resize', previous.__workshopPreviewResizeHandler);
    if (previous) previous.remove();

    const entry = getTemplatePreviewEntry(item);
    const overlay = document.createElement('section');
    overlay.className = 'ns-codehub-v1__preview-overlay';
    overlay.setAttribute('data-codehub-preview-overlay', 'true');
    overlay.setAttribute('data-codehub-id', itemId);
    overlay.setAttribute('data-codehub-preview-device-current', 'desktop');
    overlay.innerHTML = [
      '<div class="ns-codehub-v1__preview-toolbar">',
      '  <div class="ns-codehub-v1__preview-toolbar-main">',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="close-live-preview">' + escapeHtml(t('← Назад', '← Back')) + '</button>',
      '    <div class="ns-codehub-v1__preview-toolbar-title"><strong>' + escapeHtml(normalizePackageTitle(item.title || t('Пакет без названия', 'Untitled package'))) + '</strong><span>' + escapeHtml(entry ? entry.path : '') + '</span></div>',
      '  </div>',
      '  <div class="ns-codehub-v1__preview-devices" aria-label="' + escapeHtml(t('Размер предпросмотра', 'Preview size')) + '">',
      '    <button type="button" class="ns-codehub-v1__preview-device is-active" data-codehub-action="preview-device" data-codehub-preview-device="desktop" aria-pressed="true">' + escapeHtml(t('Компьютер', 'Desktop')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__preview-device" data-codehub-action="preview-device" data-codehub-preview-device="tablet" aria-pressed="false">' + escapeHtml(t('Планшет', 'Tablet')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__preview-device" data-codehub-action="preview-device" data-codehub-preview-device="mobile" aria-pressed="false">' + escapeHtml(t('Телефон', 'Phone')) + '</button>',
      '  </div>',
      '  <button type="button" class="ns-codehub-v1__btn" data-codehub-action="refresh-live-preview" data-codehub-id="' + escapeHtml(itemId) + '">' + escapeHtml(t('Обновить', 'Refresh')) + '</button>',
      '</div>',
      '<div class="ns-codehub-v1__preview-stage" data-codehub-preview-stage></div>',
      '<div class="ns-codehub-v1__preview-security">' + escapeHtml(t('Изолированный просмотр: локальные CSS, JavaScript и изображения работают внутри шаблона; сеть, Node.js, Electron API и данные Workspace заблокированы.', 'Isolated preview: local CSS, JavaScript, and images work inside the template; network access, Node.js, Electron APIs, and Workspace data are blocked.')) + '</div>'
    ].join('');
    root.appendChild(overlay);
    workshopPreviewUseFullscreenOverlay(overlay);
    await hydrateWorkshopPreviewOverlay(itemId, overlay);
  }

  function renderPreviewTab(item) {
    const images = (item.files || []).filter(function (file) { return file.kind === 'image'; });
    const entry = item.type === 'template' ? getTemplatePreviewEntry(item) : null;
    const selectedGallery = new Set(item.preview && item.preview.gallery || []);
    const coverOptions = [['', t('Выберите изображение из файлов пакета', 'Choose an image from package files')]].concat(images.map(function (file) { return [file.path, file.path]; }));
    const galleryOptions = images.map(function (file) {
      return '<option value="' + escapeHtml(file.path) + '"' + (selectedGallery.has(file.path) ? ' selected' : '') + '>' + escapeHtml(file.path) + '</option>';
    }).join('');
    return [
      item.type === 'template' ? [
        '<div class="ns-codehub-v1__live-preview">',
        '  <div class="ns-codehub-v1__panel-head compact"><h4>' + escapeHtml(t('Живой предпросмотр шаблона', 'Live template preview')) + '</h4><span>' + escapeHtml(t('Открывает настоящий шаблон на большой отдельной поверхности с режимами Компьютер / Планшет / Телефон.', 'Opens the real template on a large dedicated preview surface with Desktop / Tablet / Phone modes.')) + '</span></div>',
        entry ? '  <div class="ns-codehub-v1__actions"><button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="open-live-preview" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Открыть предпросмотр', 'Open preview')) + '</button><span class="ns-codehub-v1__hint">' + escapeHtml(entry.path) + '</span></div>' : '',
        entry ? '  <div class="ns-codehub-v1__empty">' + escapeHtml(t('Открывает шаблон в полноэкранном предпросмотре с режимами Компьютер / Планшет / Телефон. Локальные CSS, JavaScript и изображения работают внутри изолированного шаблона.', 'Opens the template in a full-screen preview with Desktop / Tablet / Phone modes. Local CSS, JavaScript, and images run inside the isolated template.')) + '</div>' : '  <div class="ns-codehub-v1__empty">' + escapeHtml(t('Добавьте папку шаблона или основной HTML-файл, чтобы появился живой предпросмотр.', 'Add a template folder or main HTML file to enable live preview.')) + '</div>',
        '</div>'
      ].join('') : '',
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__panel-head compact"><h4>' + escapeHtml(t('Обложка и галерея', 'Cover and gallery')) + '</h4><span>' + escapeHtml(t('Это изображения для карточки и страницы пакета в Мастерской. Они не заменяют живой предпросмотр самого сайта.', 'These images present the package in Workshop. They do not replace the live preview of the website itself.')) + '</span></div>',
      '  <div class="ns-codehub-v1__actions">',
      '    <label class="ns-codehub-v1__upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" multiple data-codehub-files-input data-codehub-preview-files-input data-codehub-id="' + escapeHtml(item.id) + '" hidden><span>' + escapeHtml(t('Добавить изображение', 'Add image')) + '</span></label>',
      '  </div>',
      images.length
        ? renderField(t('Обложка', 'Cover'), '<select class="ns-codehub-v1__select" data-codehub-field="preview.cover" data-codehub-id="' + escapeHtml(item.id) + '">' + renderSelectOptions(coverOptions, item.preview && item.preview.cover) + '</select>')
        : '<div class="ns-codehub-v1__empty">' + escapeHtml(t('Изображений пока нет. Нажмите «Добавить изображение» — первое добавленное изображение станет обложкой автоматически.', 'No images yet. Click “Add image” — the first added image will automatically become the cover.')) + '</div>',
      images.length ? renderField(t('Галерея — до 6 изображений', 'Gallery — up to 6 images'), '<select class="ns-codehub-v1__select" multiple size="' + Math.min(Math.max(images.length, 3), 6) + '" data-codehub-field="preview.gallery" data-codehub-id="' + escapeHtml(item.id) + '">' + galleryOptions + '</select>') : '',
      renderField(t('Заметка к превью', 'Preview note'), '<textarea class="ns-codehub-v1__textarea" rows="3" data-codehub-field="preview.note" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.preview && item.preview.note) + '</textarea>'),
      '</div>'
    ].join('');
  }

  function renderCompatibilityTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__overview-note">',
      '    <strong>' + escapeHtml(t('Назначение', 'Target')) + '</strong>',
      '    <p>' + escapeHtml(t('Пакет предназначен для IRGEZTNE Web Studio. Для релиза достаточно указать минимальную совместимую версию Workspace.', 'The package targets IRGEZTNE Web Studio. For release, only the minimum compatible Workspace version is required.')) + '</p>',
      '  </div>',
      renderField(t('Минимальная версия IRGEZTNE Workspace', 'Minimum IRGEZTNE Workspace version'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="compatibility.minAppVersion" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.compatibility && item.compatibility.minAppVersion || '1.0.0') + '" placeholder="1.0.0">'),
      '</div>'
    ].join('');
  }

  function renderValidationTab(item, validation) {
    const metaReport = getItemMetaReport(item.id);
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__customs-release-r1">',
      '    <strong>' + escapeHtml(t('Проверка пакета', 'Package validation')) + '</strong>',
      '    <span>' + escapeHtml(t('Локальная проверка: реальные файлы, целостность SHA-256, метаданные, лицензия, безопасные пути, отсутствие установщиков и основной файл.', 'Local validation: real files, SHA-256 integrity, metadata, license, safe paths, no installers, and a primary file.')) + '</span>',
      '  </div>',
      '  <div class="ns-codehub-v1__actions">',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Запустить проверку', 'Run validation')) + '</button>',
      item.status !== 'ready' ? '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="mark-ready" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Пометить как готовый', 'Mark ready')) + '</button>' : '',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="export-package" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Экспорт ZIP', 'Export ZIP')) + '</button>',
      '  </div>',
      renderValidationResult(validation),
      '<div class="ns-codehub-v1__overview-note"><strong>irgeztne-package.json</strong><p>' + escapeHtml(t('Единый manifest создаётся автоматически при экспорте ZIP и содержит тип, версию, автора, лицензию, распространение, превью, совместимость и SHA-256 файлов.', 'The unified manifest is generated automatically during ZIP export and contains type, version, author, license, distribution, previews, compatibility, and file SHA-256 values.')) + '</p></div>',
      '</div>'
    ].join('');
  }

  function renderSubmitTab(item, validation) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__submit-card">',
      '    <h4>' + escapeHtml(t('Локальная готовность', 'Local readiness')) + '</h4>',
      '    <p>' + escapeHtml(t('Локально подготовьте и экспортируйте ZIP. После подключения публичной Мастерской отправка будет идти через единый IRGEZTNE Account.', 'Prepare and export the ZIP locally. Once the public Workshop is connected, submission will use the single IRGEZTNE Account.')) + '</p>',
      '    <div class="ns-codehub-v1__submit-meta">',
      '      <span><strong>' + escapeHtml(t('Название', 'Title')) + ':</strong> ' + escapeHtml(normalizePackageTitle(item.title)) + '</span>',
      '      <span><strong>' + escapeHtml(t('Статус', 'Status')) + ':</strong> ' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</span>',
      '      <span><strong>' + escapeHtml(t('Проверка', 'Validation')) + ':</strong> ' + escapeHtml(getValidationStateLabel(validation)) + '</span>',
      '    </div>',
      '    <div class="ns-codehub-v1__actions">',
      '      <button type="button" class="ns-codehub-v1__btn" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Проверить снова', 'Validate again')) + '</button>',
      '      <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Проверить пакет', 'Validate package')) + '</button>',
      '    </div>',
      renderValidationResult(validation),
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderRulesView() {
    return [
      '<section class="panel-card ns-codehub-v1__panel">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Как это работает', 'How it works')) + '</h4><span>' + escapeHtml(t('Создание, проверка пакета и экспорт ZIP работают локально без аккаунта. IRGEZTNE Account нужен только для отправки в публичную Мастерскую и связи пакета с профилем автора.', 'Creation, package validation, and ZIP export work locally without an account. IRGEZTNE Account is needed only to submit to the public Workshop and link the package to the creator profile.')) + '</span></div>',
      '  <div class="ns-codehub-v1__rules-grid">',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Типы Workshop 1.0', 'Workshop 1.0 types')) + '</strong><span>' + escapeHtml(t('Шаблон · Тема · Компонент / блок · Виджет. Плагины с исполняемым кодом — после 1.0 и отдельной модели безопасности.', 'Template · Theme · Component / block · Widget. Executable-code plugins come after 1.0 with a separate security model.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Обязательные поля', 'Required fields')) + '</strong><span>' + escapeHtml(t('Название, версия, автор, краткое описание, превью обложки и хотя бы один файл.', 'Title, version, author, short description, preview cover, and at least one file.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Проверка пакета', 'Package validation')) + '</strong><span>' + escapeHtml(t('Перед статусом «Готово к публикации» повторно проверяются реальные локальные файлы и их целостность, затем поля, лицензия, версия, пути и запрещённые файлы.', 'Before Ready to publish, real local files and their integrity are rechecked, followed by fields, license, version, paths, and prohibited files.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Локальный поток статусов', 'Local status flow')) + '</strong><span>' + escapeHtml(t('Черновик → Проверено → Готово к публикации. Сетевые статусы Отправлено → На рассмотрении → Опубликовано / Отклонено подключаются вместе с публичной Мастерской.', 'Draft → Validated → Ready to publish. Network states Submitted → In review → Published / Rejected are connected with the public Workshop.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Распространение', 'Distribution')) + '</strong><span>' + escapeHtml(t('FREE — полностью бесплатно. FREEMIUM — бесплатная базовая версия с возможными Pro-функциями автора. PRO заложен в модель, но до запуска публичной Мастерской выключен.', 'FREE is fully free. FREEMIUM is a free base version with optional creator Pro features. PRO is reserved in the model but disabled until Marketplace.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>irgeztne-package.json</strong><span>' + escapeHtml(t('Manifest формируется автоматически из реального содержимого пакета; отдельная ручная проверка второго metadata-файла не требуется.', 'The manifest is generated automatically from the real package contents; a second manually checked metadata file is not required.')) + '</span></div>',
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderValidationResult(validation) {
    const heading = validation.requiresCheck
      ? t('Требуется повторная проверка', 'Validation must be run again')
      : (validation.isReady ? t('Проверка пройдена', 'Validation passed') : t('Проверке нужно внимание', 'Validation needs attention'));
    return [
      '<div class="ns-codehub-v1__validation ' + (validation.isReady ? 'is-passed' : 'is-failed') + '">',
      '  <div class="ns-codehub-v1__validation-head"><strong>' + escapeHtml(heading) + '</strong>' + (validation.realBytesChecked ? '<span>' + escapeHtml(t('Файлы проверены · SHA-256', 'Files verified · SHA-256')) + '</span>' : '') + '</div>',
      validation.errors.length
        ? '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Ошибки', 'Errors')) + '</span><ul>' + validation.errors.map(function (error) { return '<li>' + escapeHtml(localizeRuntimeText(error)) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Ошибки', 'Errors')) + '</span><p>' + escapeHtml(t('Блокирующих ошибок нет.', 'No blocking errors.')) + '</p></div>',
      validation.warnings.length
        ? '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Предупреждения', 'Warnings')) + '</span><ul>' + validation.warnings.map(function (warning) { return '<li>' + escapeHtml(localizeRuntimeText(warning)) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Предупреждения', 'Warnings')) + '</span><p>' + escapeHtml(t('Предупреждений нет.', 'No warnings.')) + '</p></div>',
      '</div>'
    ].join('');
  }


  function renderMetaReport(report) {
    if (!report) {
      return [
        '<div class="ns-codehub-v1__meta-report is-empty">',
        '  <div class="ns-codehub-v1__validation-head"><strong>' + escapeHtml(t('Template package meta.json', 'Template package meta.json')) + '</strong></div>',
        '  <p>' + escapeHtml(t('Загрузите meta.json из экспортированного ZIP, чтобы проверить стандарт irgeztne-template-package 0.1.0.', 'Load meta.json from an exported ZIP to check the irgeztne-template-package 0.1.0 standard.')) + '</p>',
        '</div>'
      ].join('');
    }

    const summary = report.summary || {};
    return [
      '<div class="ns-codehub-v1__meta-report ' + (report.isReady ? 'is-passed' : 'is-failed') + '">',
      '  <div class="ns-codehub-v1__validation-head"><strong>' + escapeHtml(report.isReady ? t('meta.json прошёл базовую проверку', 'meta.json passed base validation') : t('meta.json требует внимания', 'meta.json needs attention')) + '</strong></div>',
      '  <div class="ns-codehub-v1__meta-summary">',
      '    <span><strong>ID:</strong> ' + escapeHtml(summary.id || '—') + '</span>',
      '    <span><strong>' + escapeHtml(t('Название', 'Name')) + ':</strong> ' + escapeHtml(summary.name || '—') + '</span>',
      '    <span><strong>' + escapeHtml(t('Версия', 'Version')) + ':</strong> ' + escapeHtml(summary.version || '—') + '</span>',
      '    <span><strong>' + escapeHtml(t('Файлы', 'Files')) + ':</strong> ' + escapeHtml(String(summary.fileCount || 0)) + '</span>',
      '  </div>',
      report.errors.length
        ? '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Ошибки meta.json', 'meta.json errors')) + '</span><ul>' + report.errors.map(function (error) { return '<li>' + escapeHtml(localizeRuntimeText(error)) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Ошибки meta.json', 'meta.json errors')) + '</span><p>' + escapeHtml(t('Блокирующих ошибок нет.', 'No blocking errors.')) + '</p></div>',
      report.warnings.length
        ? '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Предупреждения meta.json', 'meta.json warnings')) + '</span><ul>' + report.warnings.map(function (warning) { return '<li>' + escapeHtml(localizeRuntimeText(warning)) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Предупреждения meta.json', 'meta.json warnings')) + '</span><p>' + escapeHtml(t('Предупреждений нет.', 'No warnings.')) + '</p></div>',
      '<div class="ns-codehub-v1__check-list">',
      (report.checks || []).map(function (check) {
        return '<div class="ns-codehub-v1__check-row is-' + escapeHtml(check.state || 'warn') + '"><strong>' + escapeHtml(localizeRuntimeText(check.label)) + '</strong><span>' + escapeHtml(localizeRuntimeText(check.detail || '')) + '</span></div>';
      }).join(''),
      '</div>',
      '</div>'
    ].join('');
  }

  function renderField(label, control) {
    return [
      '<label class="ns-codehub-v1__field">',
      '  <span>' + escapeHtml(label) + '</span>',
      '  ' + control,
      '</label>'
    ].join('');
  }

  function renderTags(tags) {
    if (!tags || !tags.length) {
      return '<span class="ns-codehub-v1__tag ns-codehub-v1__tag--muted">' + escapeHtml(t('Без тегов', 'No tags')) + '</span>';
    }

    return tags.slice(0, 4).map(function (tag) {
      return '<span class="ns-codehub-v1__tag">' + escapeHtml(tag) + '</span>';
    }).join('');
  }

  function renderSelectOptions(options, currentValue) {
    return options.map(function (option) {
      const value = option[0];
      const label = option[1];
      return '<option value="' + escapeHtml(value) + '"' + (currentValue === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }

  function getTypeLabel(type) {
    const found = getTypeOptions().find(function (pair) {
      return pair[0] === type;
    });
    return found ? found[1] : t('Пакет', 'Package');
  }

  function getBuilderTabLabel(tab) {
    const labels = {
      overview: t('Обзор', 'Overview'),
      details: t('Детали', 'Details'),
      files: t('Файлы', 'Files'),
      preview: t('Превью', 'Preview'),
      compatibility: t('Совместимость', 'Compatibility'),
      validation: t('Проверка', 'Validation'),
      submit: t('Готовность', 'Ready')
    };
    return labels[tab] || tab;
  }

  function getValidationStateLabel(validation) {
    if (validation && validation.requiresCheck) return t('Требуется проверка', 'Validation required');
    return validation && validation.isReady
      ? t('Пройдено', 'Passed')
      : String((validation && validation.errors ? validation.errors.length : 0)) + ' ' + t('ошибок', 'errors');
  }

  function getValidationSummaryLabel(validation) {
    if (validation && validation.requiresCheck) return t('Требуется проверка', 'Validation required');
    return validation && validation.isReady
      ? t('Готово', 'Ready')
      : t('Нужно доработать', 'Needs work');
  }

  function getBuilderNoDescription() {
    return t('Краткое описание пока не добавлено.', 'No short description yet.');
  }

  function getTypeHelp(type) {
    const map = isRu()
      ? {
          template: 'Готовая основа сайта или страницы для Web Studio.',
          theme: 'Оформление: стили, типографика и визуальный язык.',
          component: 'Переиспользуемая секция или блок страницы.',
          widget: 'Самостоятельный функциональный элемент для сайта: форма, карта, комментарии и другие функции.'
        }
      : {
          template: 'Ready website or page foundation for Web Studio.',
          theme: 'Styling, typography, and visual language.',
          component: 'Reusable page section or block.',
          widget: 'Standalone website function such as a form, map, comments, or another interactive feature.'
        };
    return map[type] || t('Элемент пакета для Web Studio.', 'Package item for Web Studio use.');
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    return (value / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function handleRootClick(event) {
    const actionButton = event.target.closest('[data-codehub-action]');
    if (actionButton) {
      void handleAction(actionButton);
      return;
    }

    const navButton = event.target.closest('[data-codehub-nav]');
    if (navButton) {
      uiState.view = navButton.getAttribute('data-codehub-nav') || VIEW_HOME;
      clearNotice();
      renderAll();
      return;
    }

    const typeFilterButton = event.target.closest('[data-codehub-type-filter]');
    if (typeFilterButton) {
      const scope = String(typeFilterButton.getAttribute('data-codehub-type-filter') || '');
      const type = String(typeFilterButton.getAttribute('data-codehub-type') || 'all');
      const safeType = getTypeFilterOptions().some(function (pair) { return pair[0] === type; }) ? type : 'all';
      if (scope === 'catalog') uiState.catalogFilterType = safeType;
      else if (scope === 'installed') uiState.installedFilterType = safeType;
      else if (scope === 'my-packages') uiState.filterType = safeType;
      clearNotice();
      renderAll();
      return;
    }

    const builderTabButton = event.target.closest('[data-codehub-builder-tab]');
    if (builderTabButton) {
      uiState.builderTab = builderTabButton.getAttribute('data-codehub-builder-tab') || 'overview';
      clearNotice();
      renderAll();
    }
  }

  function handleRootInput(event) {
    const field = event.target.closest('[data-codehub-field]');
    if (field) {
      applyFieldUpdate(field);
      return;
    }

    const queryField = event.target.closest('[data-codehub-filter="query"]');
    if (queryField) {
      uiState.query = String(queryField.value || '');
      renderAll();
    }
  }

  function handleRootChange(event) {
    const field = event.target.closest('[data-codehub-field]');
    if (field) {
      applyFieldUpdate(field);
      return;
    }

    const statusFilter = event.target.closest('[data-codehub-filter="status"]');
    if (statusFilter) {
      uiState.filterStatus = String(statusFilter.value || 'all');
      renderAll();
      return;
    }

    const typeFilter = event.target.closest('[data-codehub-filter="type"]');
    if (typeFilter) {
      uiState.filterType = String(typeFilter.value || 'all');
      renderAll();
      return;
    }

    const filesInput = event.target.closest('[data-codehub-files-input]');
    if (filesInput) {
      void handleFilesInput(filesInput);
      return;
    }

    const installZipInput = event.target.closest('[data-codehub-install-zip-input]');
    if (installZipInput) {
      const selected = installZipInput.files && installZipInput.files[0];
      installZipInput.value = '';
      if (selected) void installWorkshopZipFile(selected);
      return;
    }

    const metaInput = event.target.closest('[data-codehub-meta-input]');
    if (metaInput) {
      handleMetaInput(metaInput);
      return;
    }

    const fileRole = event.target.closest('[data-codehub-file-role]');
    if (fileRole) {
      updateFileRole(fileRole);
    }
  }

  function workshopInstallDropzoneFromEvent(event) {
    const target = event && event.target && event.target.closest ? event.target.closest('[data-codehub-install-dropzone]') : null;
    return target || null;
  }

  function handleRootDragOver(event) {
    const zone = workshopInstallDropzoneFromEvent(event);
    if (!zone) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('is-dragover');
  }

  function handleRootDragLeave(event) {
    const zone = workshopInstallDropzoneFromEvent(event);
    if (!zone) return;
    const next = event.relatedTarget;
    if (next && zone.contains(next)) return;
    zone.classList.remove('is-dragover');
  }

  async function handleRootDrop(event) {
    const zone = workshopInstallDropzoneFromEvent(event);
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove('is-dragover');
    const files = Array.from(event.dataTransfer && event.dataTransfer.files || []);
    const zip = files.find(function (file) {
      return /\.zip$/i.test(String(file && file.name || '')) || String(file && file.type || '').toLowerCase() === 'application/zip';
    });
    if (!zip) {
      setInstallFeedback('error', t('Файл не принят: нужен ZIP-пакет Мастерской.', 'File not accepted: a Workshop ZIP package is required.'));
      setNotice(t('Перетащите ZIP-пакет Мастерской.', 'Drop a Workshop ZIP package.'));
      return;
    }
    await installWorkshopZipFile(zip);
  }

  function applyFieldUpdate(field) {
    const store = getStore();
    if (!store) return;

    const itemId = field.getAttribute('data-codehub-id');
    const fieldKey = field.getAttribute('data-codehub-field');
    if (!itemId || !fieldKey) return;

    const item = store.getById(itemId);
    if (!item) return;

    const value = field.value;
    const patch = {};

    switch (fieldKey) {
      case 'title':
      case 'type':
      case 'version':
      case 'distribution':
        patch[fieldKey] = value;
        break;
      case 'license.preset':
        if (value === '__other__') {
          uiState.customLicenseItems[itemId] = true;
          uiState.savedItemId = '';
          renderAll();
          return;
        }
        delete uiState.customLicenseItems[itemId];
        patch.license = value;
        break;
      case 'license.custom':
        uiState.customLicenseItems[itemId] = true;
        patch.license = value;
        break;
      case 'author.name':
        patch.author = { name: value };
        break;
      case 'description.short':
        patch.description = { short: value };
        break;
      case 'description.full':
        patch.description = { full: value };
        break;
      case 'tags':
        patch.tags = value.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean);
        break;
      case 'preview.cover':
        patch.preview = { cover: value };
        break;
      case 'preview.gallery':
        patch.preview = { gallery: Array.from(field.selectedOptions || []).map(function (option) { return option.value; }).filter(Boolean).slice(0, 6) };
        break;
      case 'preview.note':
        patch.preview = { note: value };
        break;
      case 'compatibility.minAppVersion':
        patch.compatibility = { minAppVersion: value };
        break;
      default:
        return;
    }

    uiState.savedItemId = '';
    store.updateItem(itemId, patch);
    invalidateWorkshopPackageAfterMaterialChange(store, itemId);
  }

  function handleMetaInput(input) {
    const itemId = input.getAttribute('data-codehub-id');
    const file = input.files && input.files[0];
    if (!itemId || !file) return;
    const contextRoot = languageContextRoot || input.closest('[data-codehub-root]');

    const reader = new FileReader();
    reader.onload = function () {
      withLanguageRoot(contextRoot, function () {
        try {
          const meta = JSON.parse(String(reader.result || ''));
          const report = validateTemplateMeta(meta);
          setItemMetaReport(itemId, report);
          uiState.builderTab = 'validation';
          setNotice(report.isReady
            ? t('meta.json прошёл базовую проверку CodeHub.', 'meta.json passed Package Workshop base validation.')
            : t('meta.json проверен: есть ошибки или предупреждения.', 'meta.json checked: there are errors or warnings.'));
        } catch (error) {
          setItemMetaReport(itemId, {
            source: 'meta.json',
            isReady: false,
            errors: [t('Не удалось прочитать meta.json: неверный JSON.', 'Could not read meta.json: invalid JSON.')],
            warnings: [],
            checks: [{ state: 'fail', label: t('JSON parse', 'JSON parse'), detail: String(error && error.message || error) }],
            summary: {}
          });
          uiState.builderTab = 'validation';
          setNotice(t('meta.json не удалось прочитать.', 'meta.json could not be read.'));
        } finally {
          input.value = '';
          renderAll();
        }
      });
    };
    reader.onerror = function () {
      withLanguageRoot(contextRoot, function () {
        setItemMetaReport(itemId, {
          source: 'meta.json',
          isReady: false,
          errors: [t('Не удалось открыть файл meta.json.', 'Could not open the meta.json file.')],
          warnings: [],
          checks: [],
          summary: {}
        });
        input.value = '';
        renderAll();
      });
    };
    reader.readAsText(file);
  }

  function workshopPickedBytesToArrayBuffer(bytes) {
    if (bytes instanceof ArrayBuffer) return bytes.slice(0);
    if (ArrayBuffer.isView(bytes)) {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
    if (bytes && bytes.type === 'Buffer' && Array.isArray(bytes.data)) {
      return Uint8Array.from(bytes.data).buffer;
    }
    if (Array.isArray(bytes)) return Uint8Array.from(bytes).buffer;
    return new ArrayBuffer(0);
  }

  function invalidateWorkshopPackageAfterMaterialChange(store, itemId) {
    const latest = store && store.getById ? store.getById(itemId) : null;
    if (latest && (latest.status === 'validated' || latest.status === 'ready')) {
      store.setStatus(itemId, 'draft');
    }
    delete uiState.customsReports[itemId];
    uiState.savedItemId = '';
  }

  async function resolveWorkshopImportConflicts(paths) {
    const cleanPaths = Array.isArray(paths) ? paths.filter(Boolean) : [];
    if (!cleanPaths.length) return 'replace';
    const api = window.nsAPI;
    if (api && typeof api.workshopResolveImportConflicts === 'function') {
      const result = await api.workshopResolveImportConflicts({
        locale: isRu() ? 'ru' : 'en',
        count: cleanPaths.length,
        paths: cleanPaths.slice(0, 5)
      });
      if (result && (result.action === 'replace' || result.action === 'skip' || result.action === 'cancel')) {
        return result.action;
      }
    }
    return window.confirm(t(
      'В пакете уже есть файлы с такими путями. Заменить совпадающие файлы?',
      'Matching file paths already exist in this package. Replace matching files?'
    )) ? 'replace' : 'cancel';
  }

  async function importWorkshopPickedFiles(itemId, picked, options) {
    const store = getStore();
    if (!store) return;
    const item = store.getById(itemId);
    if (!item || !picked || !picked.length) return;
    options = options || {};

    const fromPreview = !!options.fromPreview;
    const fromFolder = !!options.fromFolder;
    const folderRoot = fromFolder ? folderRootForPickedFiles(picked) : '';
    const currentFiles = item.files.slice();
    const existingByPath = new Map(currentFiles.map(function (file) {
      return [normalizeWorkshopPath(file.path).toLowerCase(), file];
    }));
    const incomingByPath = new Set();
    let incoming = [];

    for (let index = 0; index < picked.length; index += 1) {
      const file = picked[index];
      const packagePath = importedWorkshopPath(file, fromFolder, folderRoot);
      const pathKey = normalizeWorkshopPath(packagePath).toLowerCase();
      if (!packagePath || !pathKey) {
        setNotice(t('Не удалось добавить файл: некорректный путь.', 'Could not add file: invalid path.'));
        return;
      }
      if (incomingByPath.has(pathKey)) {
        setNotice(t('В выбранной папке повторяется путь: ', 'The selected folder contains a duplicate path: ') + packagePath);
        return;
      }
      incomingByPath.add(pathKey);
      if (Number(file.size || 0) > WORKSHOP_MAX_FILE_BYTES) {
        setNotice(t('Файл слишком большой: ', 'File is too large: ') + packagePath);
        return;
      }
      incoming.push({
        file: file,
        packagePath: packagePath,
        pathKey: pathKey,
        existing: existingByPath.get(pathKey) || null
      });
    }

    const conflicts = incoming.filter(function (entry) { return !!entry.existing; });
    let conflictAction = 'replace';
    if (conflicts.length) {
      conflictAction = await resolveWorkshopImportConflicts(conflicts.map(function (entry) { return entry.packagePath; }));
      if (conflictAction === 'cancel') {
        setNotice(t('Импорт отменён. Пакет не изменён.', 'Import canceled. The package was not changed.'));
        return;
      }
      if (conflictAction === 'skip') {
        incoming = incoming.filter(function (entry) { return !entry.existing; });
      }
    }

    if (!incoming.length) {
      setNotice(t('Новых файлов для импорта нет. Совпадающие файлы оставлены без изменений.', 'There are no new files to import. Matching files were left unchanged.'));
      return;
    }

    const replaceKeys = new Set(
      conflictAction === 'replace'
        ? incoming.filter(function (entry) { return !!entry.existing; }).map(function (entry) { return entry.pathKey; })
        : []
    );
    let nextFiles = currentFiles.filter(function (file) {
      return !replaceKeys.has(normalizeWorkshopPath(file.path).toLowerCase());
    });
    const replacedRecords = currentFiles.filter(function (file) {
      return replaceKeys.has(normalizeWorkshopPath(file.path).toLowerCase());
    });

    if (nextFiles.length + incoming.length > WORKSHOP_MAX_FILES) {
      setNotice(t('Слишком много файлов для одного пакета.', 'Too many files for one package.'));
      return;
    }

    const currentBytes = nextFiles.reduce(function (sum, file) { return sum + Number(file.size || 0); }, 0);
    const incomingBytes = incoming.reduce(function (sum, entry) { return sum + Number(entry.file.size || 0); }, 0);
    if (currentBytes + incomingBytes > WORKSHOP_MAX_PACKAGE_BYTES) {
      setNotice(t('Папка или набор файлов превышает допустимый размер пакета.', 'The folder or selected files exceed the package size limit.'));
      return;
    }

    const addedBlobKeys = [];
    const addedFiles = [];
    let added = 0;
    let replaced = 0;

    try {
      for (let index = 0; index < incoming.length; index += 1) {
        const entry = incoming[index];
        const file = entry.file;
        const packagePath = entry.packagePath;
        const buffer = await file.arrayBuffer();
        const sha256 = await sha256ArrayBuffer(buffer);
        const blobKey = workshopBlobKey(itemId);
        await putWorkshopBytes({
          blobKey: blobKey,
          bytes: buffer,
          sha256: sha256,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          originalName: file.name,
          savedAt: new Date().toISOString()
        });
        addedBlobKeys.push(blobKey);

        const kind = guessKind(packagePath, file.type);
        const previous = entry.existing;
        const fileRecord = {
          id: previous && previous.id
            ? previous.id
            : 'file_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 6),
          path: packagePath,
          originalName: file.name,
          role: previous && previous.role
            ? previous.role
            : inferWorkshopRole(packagePath, kind, fromPreview, nextFiles, fromFolder),
          kind: kind,
          size: file.size,
          mime: file.type,
          sha256: sha256,
          blobKey: blobKey,
          byteState: 'ready',
          order: previous && Number.isFinite(Number(previous.order)) ? Number(previous.order) : nextFiles.length
        };
        nextFiles.push(fileRecord);
        addedFiles.push(fileRecord);
        if (previous && conflictAction === 'replace') replaced += 1;
        else added += 1;
      }

      nextFiles.sort(function (a, b) {
        return Number(a.order || 0) - Number(b.order || 0);
      });
      store.setFiles(itemId, nextFiles);
      invalidateWorkshopPackageAfterMaterialChange(store, itemId);

      if (fromPreview && !(item.preview && item.preview.cover)) {
        const firstImage = addedFiles.find(function (file) { return file.kind === 'image'; });
        if (firstImage) store.updateItem(itemId, { preview: { cover: firstImage.path } });
      }

      for (const record of replacedRecords) {
        if (record && record.blobKey) {
          try { await cleanupWorkshopBlobIfUnreferenced(record.blobKey); }
          catch (cleanupError) { console.warn('[Workshop] failed replaced-blob cleanup', cleanupError); }
        }
      }

      if (fromPreview) {
        setNotice(t(
          'Изображение добавлено в пакет. Обложка выбрана автоматически, если раньше её не было.',
          'Image added to the package. It was selected as the cover automatically if no cover was set.'
        ));
      } else if (fromFolder) {
        if (conflictAction === 'replace' && replaced) {
          setNotice(t(
            'Папка импортирована: добавлено ' + added + ', заменено ' + replaced + ' файлов. Структура сохранена; пакет нужно проверить заново.',
            'Folder imported: ' + added + ' added, ' + replaced + ' replaced. Structure preserved; the package must be checked again.'
          ));
        } else if (conflictAction === 'skip' && conflicts.length) {
          setNotice(t(
            'Папка импортирована: добавлено ' + added + ' новых файлов, совпадающих пропущено ' + conflicts.length + '. Структура сохранена; пакет нужно проверить заново.',
            'Folder imported: ' + added + ' new files added, ' + conflicts.length + ' matching files skipped. Structure preserved; the package must be checked again.'
          ));
        } else {
          setNotice(t(
            'Папка добавлена: ' + added + ' файлов. Структура сохранена, SHA-256 рассчитан локально; пакет нужно проверить заново.',
            'Folder added: ' + added + ' files. Structure preserved and SHA-256 calculated locally; the package must be checked again.'
          ));
        }
      } else {
        setNotice(t(
          'Добавлены реальные файлы: ' + added + '. SHA-256 рассчитан локально; пакет нужно проверить заново.',
          'Real files added: ' + added + '. SHA-256 calculated locally; the package must be checked again.'
        ));
      }
    } catch (error) {
      for (const blobKey of addedBlobKeys) {
        try { await deleteWorkshopBytes(blobKey); }
        catch (cleanupError) { console.warn('[Workshop] failed import cleanup', cleanupError); }
      }
      console.warn('[Workshop] file import failed', error);
      setNotice(t('Не удалось добавить файл: ', 'Could not add file: ') + String(error && error.message || error));
    }
  }

  async function handleFilesInput(input) {
    const itemId = input.getAttribute('data-codehub-id');
    if (!itemId) return;
    const picked = Array.from(input.files || []);
    if (!picked.length) return;
    try {
      await importWorkshopPickedFiles(itemId, picked, {
        fromPreview: input.hasAttribute('data-codehub-preview-files-input'),
        fromFolder: input.hasAttribute('data-codehub-folder-input')
      });
    } finally {
      input.value = '';
    }
  }

  async function handleWorkshopFolderPick(itemId) {
    const api = window.nsAPI;
    if (!api || typeof api.workshopPickFolder !== 'function') {
      setNotice(t('Системный выбор папки недоступен в этой сборке.', 'Native folder selection is unavailable in this build.'));
      return;
    }

    setNotice(t('Выберите папку сайта целиком.', 'Choose the whole website folder.'));
    const result = await api.workshopPickFolder();
    if (!result || result.canceled) {
      clearNotice();
      renderAll();
      return;
    }
    if (!result.ok || !Array.isArray(result.files)) {
      const message = result && result.error && result.error.message;
      setNotice(t('Не удалось импортировать папку: ', 'Could not import folder: ') + String(message || t('неизвестная ошибка', 'unknown error')));
      return;
    }

    const picked = result.files.map(function (entry) {
      return {
        name: String(entry && entry.name || '').trim(),
        type: String(entry && entry.mime || 'application/octet-stream'),
        size: Number(entry && entry.size || 0),
        webkitRelativePath: String(entry && entry.relativePath || '').replace(/\\/g, '/'),
        arrayBuffer: async function () { return workshopPickedBytesToArrayBuffer(entry && entry.bytes); }
      };
    }).filter(function (file) { return file.name && file.webkitRelativePath; });

    await importWorkshopPickedFiles(itemId, picked, { fromFolder: true });
    renderAll();
  }

  function guessKind(fileName, mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    const lower = String(fileName || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(lower)) return 'image';
    if (/\.css$/i.test(lower)) return 'stylesheet';
    if (/\.json$/i.test(lower)) return 'data';
    if (/\.html?$/i.test(lower)) return 'document';
    return 'asset';
  }

  function updateFileRole(select) {
    const store = getStore();
    if (!store) return;
    const itemId = select.getAttribute('data-codehub-id');
    const fileId = select.getAttribute('data-codehub-file-id');
    if (!itemId || !fileId) return;
    const item = store.getById(itemId);
    if (!item) return;

    const nextFiles = item.files.map(function (file) {
      if (file.id !== fileId) return file;
      return Object.assign({}, file, { role: select.value || 'asset' });
    });

    store.setFiles(itemId, nextFiles);
    invalidateWorkshopPackageAfterMaterialChange(store, itemId);
  }

  async function handleAction(button) {
    const action = button.getAttribute('data-codehub-action');
    const id = button.getAttribute('data-codehub-id') || '';
    const type = button.getAttribute('data-codehub-type') || 'template';
    const store = getStore();
    if (!store) return;

    if (action === 'close-live-preview') {
      const overlay = button.closest('[data-codehub-preview-overlay]');
      if (overlay && overlay.__workshopPreviewResizeHandler) window.removeEventListener('resize', overlay.__workshopPreviewResizeHandler);
      if (overlay) overlay.remove();
      return;
    }

    if (action === 'preview-device') {
      const overlay = button.closest('[data-codehub-preview-overlay]');
      const device = button.getAttribute('data-codehub-preview-device') || 'desktop';
      if (overlay) overlay.setAttribute('data-codehub-preview-device-current', device);
      workshopPreviewSetDevice(overlay, device);
      return;
    }

    if (action === 'refresh-live-preview' && id) {
      const overlay = button.closest('[data-codehub-preview-overlay]');
      if (overlay) await hydrateWorkshopPreviewOverlay(id, overlay);
      return;
    }

    if (action === 'open-live-preview' && id) {
      await renderWorkshopLivePreview(id, button);
      return;
    }

    if (action === 'pick-folder' && id) {
      await handleWorkshopFolderPick(id);
      return;
    }

    if (action === 'open-account') {
      var account = window.IRGEZTNEConnected || null;
      if (account && typeof account.openMenuFrom === 'function') {
        account.openMenuFrom(button);
      } else if (account && typeof account.openMenu === 'function') {
        account.openMenu();
      } else if (account && typeof account.signIn === 'function') {
        account.signIn('account');
      }
      return;
    }

    if (action === 'new-item') {
      const item = store.createItem({ type: type || 'template' });
      uiState.view = VIEW_BUILDER;
      uiState.builderTab = 'details';
      setNotice(t('Черновик пакета создан.', 'New package draft created.'));
      store.setActiveItem(item.id);
      return;
    }

    if (action === 'open-item' && id) {
      store.setActiveItem(id);
      uiState.view = VIEW_BUILDER;
      clearNotice();
      renderAll();
      return;
    }

    if (action === 'duplicate-item' && id) {
      const item = store.duplicateItem(id);
      uiState.view = VIEW_BUILDER;
      uiState.builderTab = 'details';
      setNotice(item ? t('Пакет продублирован.', 'Package duplicated.') : t('Не удалось продублировать пакет.', 'Failed to duplicate package.'));
      return;
    }

    if (action === 'archive-item' && id) {
      store.archiveItem(id);
      setNotice(t('Пакет отправлен в архив.', 'Package archived.'));
      return;
    }

    if (action === 'restore-item' && id) {
      store.restoreItem(id);
      setNotice(t('Пакет восстановлен в черновик.', 'Package restored to draft.'));
      return;
    }

    if (action === 'uninstall-installed') {
      const installId = button.getAttribute('data-codehub-install-id') || '';
      await uninstallWorkshopInstalledPackage(installId);
      return;
    }

    if (action === 'delete-item' && id) {
      const item = store.getById(id);
      const title = item && item.title ? normalizePackageTitle(item.title) : t('Пакет без названия', 'Untitled package');
      const confirmed = window.confirm(t('Удалить пакет «' + title + '»? Это действие нельзя отменить.', 'Delete package “' + title + '”? This cannot be undone.'));
      if (!confirmed) return;
      const blobKeys = item ? (item.files || []).map(function (file) { return file.blobKey; }).filter(Boolean) : [];
      const removed = store.deleteItem(id);
      delete uiState.customsReports[id];
      for (const blobKey of blobKeys) await cleanupWorkshopBlobIfUnreferenced(blobKey);
      setNotice(removed ? t('Пакет удалён.', 'Package deleted.') : t('Не удалось удалить пакет.', 'Failed to delete package.'));
      if (uiState.view === VIEW_BUILDER && !store.getActiveItem()) {
        uiState.view = VIEW_LIST;
      }
      renderAll();
      return;
    }

    if (action === 'remove-file' && id) {
      const fileId = button.getAttribute('data-codehub-file-id');
      const before = store.getById(id);
      const removed = before && (before.files || []).find(function (file) { return file.id === fileId; });
      store.removeFile(id, fileId);
      invalidateWorkshopPackageAfterMaterialChange(store, id);
      if (removed && removed.blobKey) await cleanupWorkshopBlobIfUnreferenced(removed.blobKey);
      setNotice(t('Файл удалён из пакета.', 'File removed from package.'));
      return;
    }

    if (action === 'save-draft' && id) {
      store.setStatus(id, 'draft');
      uiState.savedItemId = id;
      setNotice(t('✓ Сохранено. Черновик сохранён локально.', '✓ Saved. Draft saved locally.'));
      return;
    }

    if (action === 'validate-item' && id) {
      const item = store.getById(id);
      const validation = await runWorkshopCustoms(item);
      uiState.customsReports[id] = validation;
      uiState.builderTab = 'validation';
      setNotice(validation.isReady ? t('Проверка пройдена: целостность реальных файлов подтверждена.', 'Validation passed: integrity of the real files is confirmed.') : t('Проверка нашла проблемы, которые нужно исправить.', 'Validation found problems to fix.'));
      renderAll();
      return;
    }

    if (action === 'mark-ready' && id) {
      const item = store.getById(id);
      const validation = await runWorkshopCustoms(item);
      uiState.customsReports[id] = validation;
      uiState.builderTab = 'validation';
      if (validation.isReady) store.setStatus(id, 'ready');
      setNotice(validation.isReady ? t('Пакет успешно проверен.', 'Package validated successfully.') : t('Пакет пока не готов.', 'Package is not ready yet.'));
      renderAll();
      return;
    }

    if (action === 'export-package' && id) {
      const item = store.getById(id);
      try {
        const result = await exportWorkshopZip(item);
        uiState.builderTab = 'validation';
        if (result.ok) {
          store.setStatus(id, 'ready');
          setNotice(t('ZIP собран из реальных файлов. Пакет готов к будущей публикации.', 'ZIP built from real files. The package is ready for future publishing.'));
        } else {
          setNotice(t('ZIP не создан: пакет не прошёл проверку.', 'ZIP was not created: package did not pass validation.'));
        }
      } catch (error) {
        console.warn('[Workshop] ZIP export failed', error);
        setNotice(t('Не удалось экспортировать ZIP.', 'Could not export ZIP.'));
      }
      renderAll();
      return;
    }

    if (action === 'submit-item' && id) {
      setNotice(t('Сетевая отправка будет подключена вместе с публичной Мастерской и IRGEZTNE Account. Локально используйте «Проверить пакет» и «Экспорт ZIP».', 'Network submission will be connected with the public Workshop and IRGEZTNE Account. Locally, use Validate package and Export ZIP.'));
      return;
    }

    if (action === 'open-cabinet') {
      document.dispatchEvent(new CustomEvent('ns-codehub:open-cabinet'));
      return;
    }

    if (action === 'open-workspace') {
      document.dispatchEvent(new CustomEvent('ns-codehub:open-workspace'));
      return;
    }
  }

  const api = {
    init: ensureInit,
    render: renderAll,
    createNewItem: function (type) {
      const store = getStore();
      if (!store) return null;
      const item = store.createItem({ type: type || 'template' });
      uiState.view = VIEW_BUILDER;
      uiState.builderTab = 'details';
      renderAll();
      return item;
    },
    openItemById: function (id) {
      const store = getStore();
      if (!store || !id) return null;
      store.setActiveItem(id);
      uiState.view = VIEW_BUILDER;
      renderAll();
      return store.getById(id);
    },
    openList: function () {
      uiState.view = VIEW_LIST;
      renderAll();
    },
    getState: function () {
      const store = getStore();
      return store ? store.getState() : null;
    },
    getInstalledTemplates: function () {
      return listWorkshopInstalledTemplates();
    },
    getInstalledTemplatePreviewSrcdoc: function (packageId) {
      return buildWorkshopInstalledTemplatePreview(packageId);
    },
    materializeInstalledTemplateSnapshot: function (packageId) {
      return materializeWorkshopInstalledTemplateSnapshotR1W9D(packageId);
    },
    getInstalledThemes: function () {
      return listWorkshopInstalledThemesR1W9E();
    },
    materializeInstalledThemeSnapshot: function (packageId) {
      return materializeWorkshopInstalledThemeSnapshotR1W9E(packageId);
    },
    getInstalledComponents: function () {
      return listWorkshopInstalledComponentsR1W9F();
    },
    materializeInstalledComponentSnapshot: function (packageId) {
      return materializeWorkshopInstalledComponentSnapshotR1W9F(packageId);
    },
    getInstalledWidgets: function () {
      return listWorkshopInstalledWidgetsR1W9G();
    },
    materializeInstalledWidgetSnapshot: function (packageId) {
      return materializeWorkshopInstalledWidgetSnapshotR1W9G(packageId);
    },
    openInstalled: function () {
      uiState.view = VIEW_INSTALLED;
      renderAll();
    }
  };

  window.NSCodeHubV1 = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInit, { once: true });
  } else {
    ensureInit();
  }
})();
