(function () {
  'use strict';

  const HIDDEN_CLASS = 'irgeztne-site-studio-topbar-clean-hidden-v5';
  const MARK = 'site-studio-topbar-clean-v5';

  const KEEP_WORDS = [
    'pages panel', 'settings panel', '+ new page', 'new page', 'html',
    'панель страниц', 'панель настроек', '+ новая страница', 'новая страница'
  ];

  const TOP_TAB_ORDER = ['sites', 'page', 'pages', 'menu', 'identity', 'preview', 'server'];
  const TOP_TAB_LABELS = {
    sites: { en: 'Sites', ru: 'Сайты' },
    page: { en: 'Editor', ru: 'Редактор' },
    pages: { en: 'Pages', ru: 'Страницы' },
    menu: { en: 'Menu', ru: 'Меню' },
    identity: { en: 'Design', ru: 'Дизайн' },
    preview: { en: 'Preview', ru: 'Предпросмотр' },
    server: { en: 'Server', ru: 'Сервер' },
    publish: { en: 'Publish', ru: 'Опубликовать' }
  };
  const TOP_TAB_BY_TEXT = {
    sites: 'sites', site: 'sites', 'сайты': 'sites', 'сайт': 'sites',
    editor: 'page', edit: 'page', 'редактор': 'page',
    pages: 'pages', 'страницы': 'pages',
    menu: 'menu', 'меню': 'menu',
    design: 'identity', identity: 'identity', 'дизайн': 'identity',
    preview: 'preview', 'предпросмотр': 'preview',
    server: 'server', 'сервер': 'server', setup: 'server', settings: 'server', 'настройка публикации': 'server', 'настроить сервер': 'server', 'подключение сервера': 'server',
    publish: 'publish', publishing: 'publish', deploy: 'publish', polish: 'server', publication: 'publish', 'публикация': 'server', 'опубликовать': 'publish'
  };
  const RU_TEXT_FIXES = {
    'Publish': 'Публикация',
    'Ready': 'Готово',
    'Ready to publish': 'Готово к публикации',
    'Setup once': 'Настроить один раз',
    'Save to finish': 'Сохранить',
    'Deploy site': 'Публикация сайта',
    'Deploy сайта': 'Публикация сайта',
    'Repository pages': 'Страницы репозитория',
    'Pages репозитория': 'Страницы репозитория',
    'Project deploy': 'Публикация проекта',
    'Deploy проекта': 'Публикация проекта',
    'Direct upload': 'Прямая загрузка',
    'CI pages': 'CI страницы',
    'CI Pages': 'CI страницы',
    'Bucket upload': 'Загрузка в bucket',
    'Secure hosting': 'Безопасный хостинг'
  };

  const RU_CONTROL_TEXT_FIXES = {
    'Open': 'Открыть',
    'Delete': 'Удалить',
    'Open site': 'Открыть сайт',
    'OpenSite': 'Открыть сайт',
    'Open сайт': 'Открыть сайт',
    'Open current': 'Открыть текущую',
    'Open текущую': 'Открыть текущую',
    'Open current page': 'Открыть текущую страницу',
    'Open текущую страницу': 'Открыть текущую страницу',
    'Open Backup Center': 'Открыть центр резервных копий',
    'Download HTML': 'Скачать HTML',
    'Normal view': 'Обычный вид',
    'Large view': 'Большой вид',
    'Edit page': 'Править страницу',
    'Settings panel': 'Панель настроек'
  };

  function norm(value) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function rawText(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hasKeepWords(text) {
    return KEEP_WORDS.some((word) => text.includes(word));
  }

  function isBackText(text) {
    if (!text || text.length > 42) return false;
    return (
      /^←?\s*back\s+to\s+editor$/.test(text) ||
      /^←?\s*к\s+редактору$/.test(text) ||
      /^←?\s*назад\s+к\s+редактору$/.test(text)
    );
  }

  function isEscHintText(text) {
    if (!text || text.length > 42) return false;
    return (
      /^esc\s*closes\s+studio$/.test(text) ||
      /^esc\s*close\s+studio$/.test(text) ||
      /^esc\s*закрывает\s+studio$/.test(text) ||
      /^esc\s*закрывает\s+студию$/.test(text) ||
      /^esc\s*закрыть\s+studio$/.test(text) ||
      /^esc\s*закрыть\s+студию$/.test(text)
    );
  }

  function hide(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    const text = norm(el.innerText || el.textContent || '');
    if (!text || text.length > 60 || hasKeepWords(text)) return;
    el.classList.add(HIDDEN_CLASS);
    el.setAttribute('data-irgeztne-hidden-by', MARK);
    el.setAttribute('aria-hidden', 'true');
    if (el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  }

  function closestSmallExact(node, matcher) {
    let current = node;
    let steps = 0;
    let best = null;

    while (current && current !== document.body && current !== document.documentElement && steps < 5) {
      const text = norm(current.innerText || current.textContent || '');
      if (matcher(text) && !hasKeepWords(text)) best = current;

      // Do not climb into the whole toolbar/topbar. It contains labels we must keep.
      if (text.length > 70 || hasKeepWords(text)) break;

      current = current.parentElement;
      steps += 1;
    }

    return best || node;
  }

  function getOverlay() {
    return document.querySelector('.ir-site-studio-v5-overlay');
  }

  function readSavedStudioLang() {
    try {
      const value = localStorage.getItem('irgeztne.webStudio.lang.v1');
      if (value === 'ru' || value === 'en') return value;
    } catch (error) {}
    return '';
  }

  function isRuStudio(overlay) {
    overlay = overlay || getOverlay();
    if (overlay && overlay.classList.contains('ir-site-studio-v5-lang-ru')) return true;
    if (overlay && overlay.classList.contains('ir-site-studio-v5-lang-en')) return false;
    const toggle = overlay && overlay.querySelector('[data-v5-action="toggle-studio-lang"]');
    const toggleText = rawText(toggle && (toggle.innerText || toggle.textContent));
    if (toggleText === 'RU') return true;
    if (toggleText === 'EN') return false;
    const saved = readSavedStudioLang();
    if (saved === 'ru') return true;
    if (saved === 'en') return false;
    const htmlLang = rawText(document.documentElement.getAttribute('lang')).toLowerCase();
    if (htmlLang.indexOf('ru') === 0) return true;
    const bodyText = (document.body && document.body.innerText || '').slice(0, 6000);
    return bodyText.indexOf('Студия сайта') !== -1 || bodyText.indexOf('Главная') !== -1;
  }

  function normalizeTopTabId(value, fallback) {
    const key = norm(value);
    return TOP_TAB_BY_TEXT[key] || TOP_TAB_BY_TEXT[key.replace(/[.]/g, '')] || fallback || 'page';
  }

  function repairWebStudioTopTabs() {
    const overlay = getOverlay();
    if (!overlay) return;
    const ru = isRuStudio(overlay);
    overlay.classList.toggle('ir-site-studio-v5-lang-ru', ru);
    overlay.classList.toggle('ir-site-studio-v5-lang-en', !ru);

    const buttons = Array.from(overlay.querySelectorAll('.ir-site-studio-v5-tabs--top .ir-site-studio-v5-tab'));
    buttons.forEach((button, index) => {
      const fallback = TOP_TAB_ORDER[index] || 'publish';
      const rawId = button.getAttribute('data-v5-tab') || '';
      let id = normalizeTopTabId(rawId, '');
      if (!id || TOP_TAB_ORDER.indexOf(id) === -1) id = normalizeTopTabId(button.textContent || button.innerText || '', fallback);
      if (id === 'publish') id = 'server';
      if (TOP_TAB_ORDER.indexOf(id) === -1) id = fallback;
      const label = (TOP_TAB_LABELS[id] || TOP_TAB_LABELS.page)[ru ? 'ru' : 'en'];
      if (button.getAttribute('data-v5-tab') !== id) button.setAttribute('data-v5-tab', id);
      if (button.getAttribute('data-v5-visible-label') !== label) button.setAttribute('data-v5-visible-label', label);
      if (rawText(button.textContent || button.innerText || '') !== label) button.textContent = label;
      if (button.title !== label) button.title = label;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      if (button.style.fontSize !== '13px') button.style.fontSize = '13px';
      if (id === 'publish') {
        const width = ru ? '104px' : '76px';
        if (button.style.minWidth !== width) button.style.minWidth = width;
      }
    });
  }

  function repairPublishProviderText() {
    const overlay = getOverlay();
    if (!overlay || !isRuStudio(overlay)) return;
    overlay.querySelectorAll('.ir-site-studio-v5-publish-provider small, .ir-site-studio-v5-publish-provider em').forEach((el) => {
      const text = rawText(el.innerText || el.textContent || '');
      if (RU_TEXT_FIXES[text]) el.textContent = RU_TEXT_FIXES[text];
    });
  }

  function repairRuControlText() {
    const overlay = getOverlay();
    if (!overlay || !isRuStudio(overlay)) return;

    overlay.querySelectorAll('button, summary, [title], [aria-label]').forEach((el) => {
      const text = rawText(el.innerText || el.textContent || '');
      if (RU_CONTROL_TEXT_FIXES[text]) el.textContent = RU_CONTROL_TEXT_FIXES[text];

      const title = rawText(el.getAttribute && el.getAttribute('title'));
      if (title && RU_CONTROL_TEXT_FIXES[title]) el.setAttribute('title', RU_CONTROL_TEXT_FIXES[title]);

      const aria = rawText(el.getAttribute && el.getAttribute('aria-label'));
      if (aria && RU_CONTROL_TEXT_FIXES[aria]) el.setAttribute('aria-label', RU_CONTROL_TEXT_FIXES[aria]);
    });
  }

  function repairWebStudioLabels() {
    repairWebStudioTopTabs();
    repairPublishProviderText();
    repairRuControlText();
  }

  function clean() {
    const studioRoots = Array.from(document.querySelectorAll(
      '.irgeztne-site-studio, .site-studio, [class*="site-studio"], [data-site-studio]'
    ));

    const roots = studioRoots.length ? studioRoots : [];

    roots.forEach((root) => {
      const controls = root.querySelectorAll('button, a, [role="button"]');
      controls.forEach((el) => {
        const text = norm(el.innerText || el.textContent || '');
        if (isBackText(text)) hide(el);
      });

      const possibleEsc = root.querySelectorAll('kbd, span, small, em, strong, button, a, [role="button"], [class*="pill"], [class*="hint"], [class*="kbd"], [class*="esc"]');
      possibleEsc.forEach((el) => {
        const text = norm(el.innerText || el.textContent || '');
        if (!isEscHintText(text)) return;
        hide(closestSmallExact(el, isEscHintText));
      });
    });

    repairWebStudioLabels();
  }

  function scheduleClean() {
    clean();
    requestAnimationFrame(clean);
    setTimeout(clean, 30);
    setTimeout(clean, 100);
    setTimeout(clean, 250);
    setTimeout(clean, 600);
  }

  function boot() {
    scheduleClean();

    const observer = new MutationObserver(() => scheduleClean());
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-v5-tab'] });

    window.addEventListener('focus', scheduleClean, true);
    window.addEventListener('click', () => setTimeout(scheduleClean, 0), true);
    window.addEventListener('keyup', () => setTimeout(scheduleClean, 0), true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
