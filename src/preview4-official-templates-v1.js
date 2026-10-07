(function () {
  if (window.__IRGEZTNE_PREVIEW4_OFFICIAL_TEMPLATES_V1__) return;
  window.__IRGEZTNE_PREVIEW4_OFFICIAL_TEMPLATES_V1__ = true;

  const STORAGE_KEY = 'irgeztne.preview4.selectedOfficialTemplate.v1';

  // IRGEZTNE_OFFICIAL_TEMPLATE_GALLERY_V068B
  const templates = [
    {
      id: 'project-landing',
      title: { ru: 'Лендинг', en: 'Landing' },
      kind: { ru: 'Лендинг / продукт', en: 'Landing / product' },
      badge: { ru: 'Official · Free', en: 'Official · Free' },
      description: {
        ru: 'Широкий стартовый шаблон для продукта, приложения, сервиса или презентации проекта.',
        en: 'A modern widescreen landing page for a product, app, service, or project presentation.'
      },
      accent: 'blue',
      sections: ['Hero', 'Возможности', 'Сценарий', 'Доказательства', 'FAQ', 'CTA'],
      structure: {
        templateType: 'wide-landing',
        pages: ['Главная'],
        layout: 'widescreen split hero',
        export: ['html', 'site-studio']
      }
    },
    {
      id: 'studio-portfolio',
      title: { ru: 'Портфолио', en: 'Portfolio' },
      kind: { ru: 'Портфолио / showcase', en: 'Portfolio / showcase' },
      badge: { ru: 'Official · Free', en: 'Official · Free' },
      description: {
        ru: 'Визуальный шаблон для автора, студии, команды, работ, кейсов и личного проекта.',
        en: 'A visual template for a creator, studio, team, work showcase, case studies, or personal project.'
      },
      accent: 'violet',
      sections: ['Главная', 'Работы', 'О нас'],
      structure: {
        templateType: 'studio-portfolio',
        pages: ['Главная', 'Работы', 'О нас', 'Контакты'],
        layout: 'widescreen showcase',
        export: ['html', 'site-studio']
      }
    },
    {
      id: 'documentation-wide',
      title: { ru: 'Документация', en: 'Documentation' },
      kind: { ru: 'Документация / docs', en: 'Documentation / docs' },
      badge: { ru: 'Official · Free', en: 'Official · Free' },
      description: {
        ru: 'Широкий шаблон для документации, руководств, справки, инструкций и описания продукта.',
        en: 'A wide template for documentation, manuals, help pages, guides, and product reference.'
      },
      accent: 'blue',
      sections: ['Начало', 'Разделы', 'Справка'],
      structure: {
        templateType: 'documentation-wide',
        pages: ['Введение', 'Установка', 'Гайды', 'Справка'],
        layout: 'wide docs sidebar',
        export: ['html', 'site-studio']
      }
    },
    {
      id: 'business-product',
      title: { ru: 'Бизнес / продукт', en: 'Business / Product' },
      kind: { ru: 'Компания / продукт', en: 'Company / product' },
      badge: { ru: 'Official · Free', en: 'Official · Free' },
      description: {
        ru: 'Шаблон для компании, сервиса, малого бизнеса, продукта, предложения или презентации услуг.',
        en: 'A template for a company, service, small business, product, offer, or service presentation.'
      },
      accent: 'green',
      sections: ['Главная', 'Услуги', 'Процесс'],
      structure: {
        templateType: 'business-product',
        pages: ['Главная', 'Услуги', 'О компании', 'Контакты'],
        layout: 'business sections',
        export: ['html', 'site-studio']
      }
    },
    {
      id: 'agency-studio',
      title: { ru: 'Студия / агентство', en: 'Agency / Studio' },
      kind: { ru: 'Студия / веб-студия', en: 'Agency / web studio' },
      badge: { ru: 'Official · Free', en: 'Official · Free' },
      description: {
        ru: 'Шаблон для веб-студии, дизайнера, команды, агентства, услуг и кейсов.',
        en: 'A template for a web studio, designer, team, agency, services, and case studies.'
      },
      accent: 'violet',
      sections: ['Главная', 'Кейсы', 'Услуги'],
      structure: {
        templateType: 'agency-studio',
        pages: ['Главная', 'Кейсы', 'Услуги', 'Контакты'],
        layout: 'agency showcase',
        export: ['html', 'site-studio']
      }
    },
    {
      id: 'blog-news',
      title: { ru: 'Блог / новости', en: 'Blog / News' },
      kind: { ru: 'Блог / портал', en: 'Blog / portal' },
      badge: { ru: 'Official · Free', en: 'Official · Free' },
      description: {
        ru: 'Шаблон для блога, журнала, новостной страницы, заметок и публикаций.',
        en: 'A template for a blog, journal, news page, notes, and publications.'
      },
      accent: 'green',
      sections: ['Главная', 'Статьи', 'Темы'],
      structure: {
        templateType: 'blog-news',
        pages: ['Главная', 'Статьи', 'Темы', 'О проекте'],
        layout: 'blog news grid',
        export: ['html', 'site-studio']
      }
    }
  ];

  function isRu() {
    const htmlLang = (document.documentElement.lang || '').toLowerCase();
    if (htmlLang.startsWith('ru')) return true;
    if (htmlLang.startsWith('en')) return false;
    return /[А-Яа-яЁё]/.test(document.querySelector('.cabinet-title, .workspace-shell-title, body')?.textContent || '');
  }

  function t(value) {
    const lang = isRu() ? 'ru' : 'en';
    if (value && typeof value === 'object') return value[lang] || value.en || value.ru || '';
    return String(value || '');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }


  function ensureWorkspaceCompactStyles() {
    if (document.getElementById('preview4-official-templates-compact-style-v029e')) return;

    const style = document.createElement('style');
    style.id = 'preview4-official-templates-compact-style-v029e';
    style.textContent = `
      .preview4-official-templates--workspace-compact {
        display: grid;
        gap: 10px;
        min-width: 0;
      }

      .preview4-official-templates--workspace-compact .preview4-official-templates-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 15px;
      }

      .preview4-official-templates--workspace-compact .preview4-official-templates-head h3 {
        margin: 3px 0 0;
        font-size: 15px;
        line-height: 1.15;
      }

      .preview4-official-templates--workspace-compact .preview4-official-templates-head p {
        display: none !important;
      }

      .preview4-official-templates--workspace-compact .preview4-official-templates-head strong {
        min-width: 42px;
        min-height: 32px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 13px;
        white-space: nowrap;
      }

      .preview4-template-compact-list {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        min-width: 0;
        width: 100%;
      }

      .preview4-template-compact-card {
        display: grid;
        grid-template-columns: 1fr;
        min-width: 0;
        width: 100%;
        overflow: hidden;
        border: 1px solid rgba(118, 169, 255, 0.18);
        border-radius: 18px;
        background:
          radial-gradient(circle at 12% 0%, rgba(73, 142, 255, 0.14), transparent 42%),
          linear-gradient(180deg, rgba(18, 40, 76, 0.94), rgba(9, 21, 42, 0.98));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }

      .preview4-template-compact-body {
        min-width: 0;
        display: grid;
        align-content: start;
        gap: 8px;
        padding: 12px;
      }

      .preview4-template-compact-topline {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 22px;
        overflow: hidden;
      }

      .preview4-template-compact-topline span {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 0 8px;
        border-radius: 999px;
        border: 1px solid rgba(118, 169, 255, 0.15);
        background: rgba(255,255,255,0.04);
        color: rgba(220, 232, 248, 0.88);
        font-size: 9px;
        font-weight: 850;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .preview4-template-compact-body h4 {
        margin: 0;
        color: #fff;
        font-size: 17px;
        line-height: 1.12;
      }

      .preview4-template-compact-preview {
        min-height: 178px;
        margin: 0 12px;
        padding: 10px;
        overflow: hidden;
        border: 1px solid rgba(118, 169, 255, 0.12);
        border-radius: 15px;
        background:
          radial-gradient(circle at top left, rgba(74, 124, 255, 0.16), transparent 36%),
          linear-gradient(180deg, rgba(22, 40, 75, 0.98), rgba(12, 25, 50, 0.98));
      }

      .preview4-template-compact-preview .preview4-template-visual {
        min-width: 0;
        width: 100%;
        height: 158px !important;
        min-height: 158px !important;
        transform: none;
        transform-origin: initial;
        border-radius: 13px;
      }

      .preview4-template-compact-preview .preview4-template-browserbar {
        min-height: 18px;
        padding: 0 8px;
        font-size: 7px;
      }

      .preview4-template-compact-preview .preview4-template-browserbar i {
        width: 6px;
        height: 6px;
      }

      .preview4-template-compact-preview .preview4-template-mini-site {
        min-height: 132px;
        padding: 12px;
        gap: 8px;
      }

      .preview4-template-compact-preview .preview4-template-mini-header {
        gap: 8px;
      }

      .preview4-template-compact-preview .preview4-template-mini-brand span {
        width: 24px;
        height: 24px;
        font-size: 9px;
      }

      .preview4-template-compact-preview .preview4-template-mini-brand strong {
        font-size: 10px;
      }

      .preview4-template-compact-preview .preview4-template-mini-nav {
        gap: 4px;
      }

      .preview4-template-compact-preview .preview4-template-mini-nav-item {
        padding: 3px 6px;
        font-size: 7px;
      }

      .preview4-template-compact-preview .preview4-template-mini-body {
        gap: 10px;
      }

      .preview4-template-compact-preview .preview4-template-mini-copy em {
        font-size: 8px;
      }

      .preview4-template-compact-preview .preview4-template-mini-copy b {
        font-size: 16px;
        line-height: 1.05;
      }

      .preview4-template-compact-preview .preview4-template-mini-copy small {
        font-size: 9px;
        line-height: 1.2;
      }

      .preview4-template-compact-preview .preview4-template-mini-panel {
        min-height: 58px;
        gap: 6px;
      }

      .preview4-template-compact-preview .preview4-template-mini-row {
        gap: 6px;
      }

      .preview4-template-compact-preview .preview4-template-mini-row span {
        min-height: 30px;
        padding: 5px 7px;
      }

      .preview4-template-compact-preview .preview4-template-mini-row b {
        font-size: 9px;
      }

      .preview4-template-compact-preview .preview4-template-mini-row small,
      .preview4-template-compact-preview .preview4-template-mini-footer {
        font-size: 7px;
      }

      .preview4-template-compact-body p {
        margin: 0;
        color: rgba(187, 205, 232, 0.88);
        font-size: 12px;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .preview4-template-compact-actions {
        display: grid;
        gap: 6px;
        margin-top: 2px;
      }

      .preview4-template-compact-actions button {
        width: auto;
        min-width: 120px;
        max-width: 170px;
        justify-self: start;
        min-height: 32px;
        border-radius: 12px;
        border: 1px solid rgba(142, 190, 255, 0.32);
        background: linear-gradient(180deg, rgba(58, 132, 255, 0.98), rgba(33, 94, 210, 0.98));
        color: #fff;
        font-size: 12px;
        font-weight: 850;
        padding: 0 14px;
      }

      @media (max-width: 1500px) {
        .preview4-template-compact-preview {
          min-height: 166px;
        }

        .preview4-template-compact-preview .preview4-template-visual {
          height: 146px;
        }

        .preview4-template-compact-preview .preview4-template-mini-site {
          padding: 10px;
        }

        .preview4-template-compact-preview .preview4-template-mini-copy b {
          font-size: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function templateJson(template) {
    return {
      format: 'irgeztne-official-template-preview4',
      id: template.id,
      title: template.title.en,
      titleRu: template.title.ru,
      free: true,
      official: true,
      credits: false,
      marketplace: false,
      version: '1.0.0',
      description: template.description.en,
      descriptionRu: template.description.ru,
      sections: template.sections,
      structure: template.structure
    };
  }

  function downloadJson(template) {
    const data = JSON.stringify(templateJson(template), null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = template.id + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function copyJson(template) {
    const data = JSON.stringify(templateJson(template), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data).catch(() => {});
    }
  }

  function openWebStudio(template) {
    const payload = {
      selectedAt: new Date().toISOString(),
      owner: 'webstudio-official',
      template: templateJson(template)
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    try {
      document.dispatchEvent(new CustomEvent('irgeztne:preview4-template-selected', { detail: payload }));
      window.dispatchEvent(new CustomEvent('irgeztne:preview4-template-selected', { detail: payload }));
    } catch (error) {}

    if (
      window.IRGEZTNESiteStudioSafeV5 &&
      typeof window.IRGEZTNESiteStudioSafeV5.openTemplateSelection === 'function'
    ) {
      window.IRGEZTNESiteStudioSafeV5.openTemplateSelection(
        templateJson(template)
      );
      return;
    }

    if (window.IRGEZTNESiteStudioSafeV5 && typeof window.IRGEZTNESiteStudioSafeV5.open === 'function') {
      window.IRGEZTNESiteStudioSafeV5.open();
      return;
    }

    const trigger =
      document.querySelector('.cabinet-grid-nav button[data-open-section="site-pages"]') ||
      document.querySelector('.cabinet-tile[data-open-section="site-pages"]') ||
      document.querySelector('.workspace-nav-btn[data-section="site-pages"]') ||
      document.querySelector('.cabinet-inner-nav-btn[data-section="site-pages"]');

    if (trigger) {
      trigger.click();
      return;
    }

    window.dispatchEvent(new CustomEvent('irgeztne:open-site-studio-safe-v5'));
    document.dispatchEvent(new CustomEvent('irgeztne:open-site-studio-safe-v5'));
  }

  function localizedTemplateSections(template) {
    const map = {
      'project-landing': {
        ru: ['Главная', 'Продукт', 'Контакты'],
        en: ['Home', 'Product', 'Contact']
      },
      'studio-portfolio': {
        ru: ['Главная', 'Работы', 'О нас'],
        en: ['Home', 'Works', 'About']
      },
      'documentation-wide': {
        ru: ['Начало', 'Разделы', 'Справка'],
        en: ['Start', 'Sections', 'Reference']
      },
      'business-product': {
        ru: ['Главная', 'Услуги', 'Процесс'],
        en: ['Home', 'Services', 'Process']
      },
      'agency-studio': {
        ru: ['Главная', 'Кейсы', 'Услуги'],
        en: ['Home', 'Cases', 'Services']
      },
      'blog-news': {
        ru: ['Главная', 'Статьи', 'Темы'],
        en: ['Home', 'Articles', 'Topics']
      }
    };
    const item = map[template.id] || null;
    if (item) return isRu() ? item.ru : item.en;
    return Array.isArray(template.sections) ? template.sections : [];
  }

  function templatePreviewData(template) {
    const ru = isRu();
    const data = {
      'project-landing': {
        site: 'Project Studio',
        tagline: ru ? 'Локальная студия публикации' : 'Local-first publishing workspace',
        kicker: ru ? 'Лендинг' : 'Landing',
        headline: ru ? 'Соберите сайт продукта' : 'Build a product website',
        body: ru ? 'Чистый старт для приложения, сервиса или личного проекта.' : 'A clean start for an app, service, or personal project.',
        blocks: ru ? ['Описание', 'Преимущества', 'Публикация'] : ['Overview', 'Benefits', 'Publish'],
        footer: ru ? 'Подвал: О нас · Контакты' : 'Footer: About · Contact',
        mode: 'landing'
      },
      'studio-portfolio': {
        site: ru ? 'Studio' : 'Studio',
        tagline: ru ? 'Работы, команда и контакты' : 'Work, team, and contact',
        kicker: ru ? 'Портфолио' : 'Portfolio',
        headline: ru ? 'Покажите проект спокойно' : 'Show the project clearly',
        body: ru ? 'Визуальная основа для студии, команды, автора или showcase.' : 'A visual base for a studio, team, creator, or showcase.',
        blocks: ru ? ['Работа 01', 'Работа 02', 'Контакты'] : ['Work 01', 'Work 02', 'Contact'],
        footer: ru ? 'Подвал: О нас · Контакты' : 'Footer: About · Contact',
        mode: 'portfolio'
      },
      'documentation-wide': {
        site: ru ? 'Docs' : 'Docs',
        tagline: ru ? 'Документация и руководства' : 'Documentation and guides',
        kicker: ru ? 'Документация' : 'Documentation',
        headline: ru ? 'Широкая документация продукта' : 'Wide product documentation',
        body: ru ? 'Левое дерево разделов, центральный контент и спокойная структура.' : 'A left section tree, central content, and calm structure.',
        blocks: ru ? ['Начало', 'Раздел', 'Справка'] : ['Start', 'Section', 'Reference'],
        footer: ru ? 'Подвал: Лицензия · История' : 'Footer: License · Changelog',
        mode: 'knowledge'
      },
      'business-product': {
        site: ru ? 'Business' : 'Business',
        tagline: ru ? 'Компания, услуги и продукт' : 'Company, services, and product',
        kicker: ru ? 'Бизнес' : 'Business',
        headline: ru ? 'Представьте продукт и услуги' : 'Present products and services',
        body: ru ? 'Структура для компании, сервиса, малого бизнеса и предложения.' : 'A structure for a company, service, small business, and offer.',
        blocks: ru ? ['Услуги', 'Процесс', 'Контакты'] : ['Services', 'Process', 'Contact'],
        footer: ru ? 'Подвал: Компания · Контакты' : 'Footer: Company · Contact',
        mode: 'landing'
      },
      'agency-studio': {
        site: ru ? 'Agency' : 'Agency',
        tagline: ru ? 'Кейсы, услуги и команда' : 'Cases, services, and team',
        kicker: ru ? 'Студия' : 'Studio',
        headline: ru ? 'Покажите студию и кейсы' : 'Show the studio and cases',
        body: ru ? 'Шаблон для веб-студии, дизайнера, агентства и проектной команды.' : 'A template for a web studio, designer, agency, and project team.',
        blocks: ru ? ['Кейс 01', 'Услуги', 'Команда'] : ['Case 01', 'Services', 'Team'],
        footer: ru ? 'Подвал: Работы · Контакты' : 'Footer: Work · Contact',
        mode: 'portfolio'
      },
      'blog-news': {
        site: ru ? 'Journal' : 'Journal',
        tagline: ru ? 'Статьи, темы и обновления' : 'Articles, topics, and updates',
        kicker: ru ? 'Блог / новости' : 'Blog / News',
        headline: ru ? 'Публикуйте статьи и новости' : 'Publish articles and news',
        body: ru ? 'Сетка публикаций для блога, журнала, портала или новостей проекта.' : 'A publication grid for a blog, journal, portal, or project news.',
        blocks: ru ? ['Статья', 'Тема', 'Обновление'] : ['Article', 'Topic', 'Update'],
        footer: ru ? 'Подвал: Архив · RSS' : 'Footer: Archive · RSS',
        mode: 'landing'
      }
    };
    return data[template.id] || data['project-landing'];
  }

  // IRGEZTNE_TEMPLATE_CARD_REALISTIC_PREVIEWS_V068O
  function previewMarkup(template) {
    const canonicalOwner = window.IRGEZTNESiteStudioSafeV5;
    if (canonicalOwner && typeof canonicalOwner.loadTemplateThumbnail === 'function') {
      return [
        '<div class="preview4-template-visual preview4-template-visual--canonical-r1m">',
        '  <iframe class="preview4-template-canonical-frame-r1m" loading="lazy" tabindex="-1" aria-hidden="true" data-preview4-canonical-template-frame-r1m="1" data-template-id="' + escapeHtml(template.id) + '" title=""></iframe>',
        '</div>'
      ].join('');
    }

    // Emergency fallback only: retain the old schematic thumbnail if the
    // canonical Web Studio owner is unavailable during an incomplete boot.
    const info = templatePreviewData(template);
    const id = String(template.id || 'project-landing');
    const title = escapeHtml(info.headline || t(template.title));
    const body = escapeHtml(info.body || t(template.description));
    const kicker = escapeHtml(info.kicker || t(template.category || 'Template'));

    function browser(inner, pageBg) {
      return [
        '<div class="preview4-template-visual preview4-template-visual--' + escapeHtml(template.accent) + '">',
        '  <div style="border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,.14);background:' + pageBg + ';box-shadow:0 18px 45px rgba(15,23,42,.12)">',
        '    <div style="height:28px;background:#e5e7eb;display:flex;align-items:center;gap:6px;padding:0 12px;color:#64748b;font-size:9px;font-weight:900">',
        '      <i style="width:8px;height:8px;border-radius:50%;background:#94a3b8"></i><i style="width:8px;height:8px;border-radius:50%;background:#cbd5e1"></i><i style="width:8px;height:8px;border-radius:50%;background:#cbd5e1"></i>',
        '      <span style="margin-left:auto;opacity:.72">' + escapeHtml(id) + '</span>',
        '    </div>',
        inner,
        '  </div>',
        '</div>'
      ].join('');
    }

    if (id === 'documentation-wide') {
      return browser([
        '<div style="display:grid;grid-template-columns:116px 1fr;min-height:225px;background:#f8fafc;color:#0f172a">',
        '  <aside style="padding:16px 14px;border-right:1px solid #e2e8f0;background:#ffffff">',
        '    <strong style="display:block;font-size:12px;margin-bottom:14px;color:#1d4ed8">Docs</strong>',
        '    <span style="display:block;padding:7px 9px;border-radius:9px;background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:900;margin-bottom:7px">Overview</span>',
        '    <span style="display:block;padding:7px 9px;border-radius:9px;color:#64748b;font-size:10px;font-weight:800;margin-bottom:5px">Start</span>',
        '    <span style="display:block;padding:7px 9px;border-radius:9px;color:#64748b;font-size:10px;font-weight:800;margin-bottom:5px">Guides</span>',
        '    <span style="display:block;padding:7px 9px;border-radius:9px;color:#64748b;font-size:10px;font-weight:800">API</span>',
        '  </aside>',
        '  <main style="padding:17px 18px">',
        '    <div style="height:25px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;margin-bottom:15px;color:#94a3b8;font-size:10px;display:flex;align-items:center;padding-left:10px">Search documentation</div>',
        '    <small style="display:block;color:#2563eb;font-weight:950;margin-bottom:5px">' + kicker + '</small>',
        '    <strong style="display:block;font-size:20px;line-height:1.08;margin-bottom:8px">' + title + '</strong>',
        '    <p style="margin:0 0 13px;color:#64748b;font-size:11px;line-height:1.45">' + body + '</p>',
        '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">',
        '      <div style="border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:10px"><b style="font-size:11px">Getting started</b><span style="display:block;margin-top:7px;height:6px;width:70%;border-radius:99px;background:#e2e8f0"></span></div>',
        '      <div style="border:1px solid #e2e8f0;border-radius:14px;background:#fff;padding:10px"><b style="font-size:11px">Reference</b><span style="display:block;margin-top:7px;height:6px;width:64%;border-radius:99px;background:#e2e8f0"></span></div>',
        '    </div>',
        '  </main>',
        '</div>'
      ].join(''), '#f8fafc');
    }

    if (id === 'business-product') {
      return browser([
        '<div style="min-height:225px;background:#f6fbf8;color:#10201a;padding:17px">',
        '  <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><strong style="font-size:13px">Bespoke Co.</strong><span style="padding:6px 10px;border-radius:99px;background:#dcfce7;color:#15803d;font-size:10px;font-weight:950">Contact</span></header>',
        '  <section style="display:grid;grid-template-columns:1fr 150px;gap:16px;align-items:center">',
        '    <div><small style="color:#15803d;font-weight:950">' + kicker + '</small><strong style="display:block;font-size:21px;line-height:1.08;margin:7px 0">' + title + '</strong><p style="margin:0;color:#64748b;font-size:11px;line-height:1.45">' + body + '</p></div>',
        '    <div style="height:104px;border-radius:24px;background:radial-gradient(circle at 70% 30%,#bbf7d0 0 20px,transparent 21px),linear-gradient(135deg,#166534,#2dd4bf);box-shadow:0 18px 34px rgba(22,101,52,.22)"></div>',
        '  </section>',
        '  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px">',
        '    <article style="border-radius:13px;background:#fff;padding:10px;border:1px solid #dcfce7"><b style="font-size:10px">Service</b></article>',
        '    <article style="border-radius:13px;background:#fff;padding:10px;border:1px solid #dcfce7"><b style="font-size:10px">Process</b></article>',
        '    <article style="border-radius:13px;background:#fff;padding:10px;border:1px solid #dcfce7"><b style="font-size:10px">Results</b></article>',
        '  </div>',
        '</div>'
      ].join(''), '#f6fbf8');
    }

    if (id === 'agency-studio') {
      return browser([
        '<div style="min-height:225px;background:#f8fafc;color:#0f172a;padding:17px">',
        '  <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:15px"><strong style="font-size:13px">Studio North</strong><span style="font-size:10px;color:#7c3aed;font-weight:950">Cases · Services</span></header>',
        '  <section style="display:grid;grid-template-columns:1fr 152px;gap:15px;align-items:center">',
        '    <div><small style="color:#7c3aed;font-weight:950">' + kicker + '</small><strong style="display:block;font-size:21px;line-height:1.06;margin:7px 0">' + title + '</strong><p style="margin:0;color:#64748b;font-size:11px;line-height:1.45">' + body + '</p></div>',
        '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">',
        '      <span style="height:58px;border-radius:17px;background:linear-gradient(135deg,#7c3aed,#c4b5fd)"></span>',
        '      <span style="height:58px;border-radius:17px;background:linear-gradient(135deg,#111827,#475569)"></span>',
        '      <span style="height:44px;border-radius:17px;background:#ede9fe"></span>',
        '      <span style="height:44px;border-radius:17px;background:#ddd6fe"></span>',
        '    </div>',
        '  </section>',
        '  <div style="height:38px;margin-top:15px;border-radius:14px;background:#111827;color:#fff;display:flex;align-items:center;padding:0 12px;font-size:10px;font-weight:900">Selected work · Brand · Web · Product</div>',
        '</div>'
      ].join(''), '#f8fafc');
    }

    if (id === 'blog-news') {
      return browser([
        '<div style="min-height:225px;background:#fffaf4;color:#0f172a;padding:17px">',
        '  <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><strong style="font-size:13px">Journal</strong><span style="font-size:10px;color:#ea580c;font-weight:950">Latest news</span></header>',
        '  <div style="display:grid;grid-template-columns:1.25fr .75fr;gap:13px">',
        '    <article style="border-radius:20px;background:#fff;border:1px solid #fed7aa;padding:12px">',
        '      <div style="height:70px;border-radius:16px;background:linear-gradient(135deg,#fb7185,#f97316);margin-bottom:11px"></div>',
        '      <small style="color:#ea580c;font-weight:950">' + kicker + '</small>',
        '      <strong style="display:block;font-size:17px;line-height:1.12;margin-top:5px">' + title + '</strong>',
        '      <p style="margin:7px 0 0;color:#64748b;font-size:10px;line-height:1.4">' + body + '</p>',
        '    </article>',
        '    <aside style="display:grid;gap:8px">',
        '      <div style="border-radius:15px;background:#fff;border:1px solid #fed7aa;padding:10px"><b style="font-size:10px">Update</b></div>',
        '      <div style="border-radius:15px;background:#fff;border:1px solid #fed7aa;padding:10px"><b style="font-size:10px">Review</b></div>',
        '      <div style="border-radius:15px;background:#fff;border:1px solid #fed7aa;padding:10px"><b style="font-size:10px">Notes</b></div>',
        '    </aside>',
        '  </div>',
        '</div>'
      ].join(''), '#fffaf4');
    }

    if (id === 'studio-portfolio') {
      return browser([
        '<div style="min-height:225px;background:#fbf7ff;color:#0f172a;padding:17px">',
        '  <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:13px"><strong style="font-size:13px">Portfolio</strong><span style="font-size:10px;color:#7c3aed;font-weight:950">Work showcase</span></header>',
        '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px">',
        '    <div style="height:78px;border-radius:19px;background:linear-gradient(135deg,#8b5cf6,#d8b4fe)"></div>',
        '    <div style="height:78px;border-radius:19px;background:linear-gradient(135deg,#111827,#6d28d9)"></div>',
        '  </div>',
        '  <small style="color:#7c3aed;font-weight:950">' + kicker + '</small>',
        '  <strong style="display:block;font-size:20px;line-height:1.08;margin:6px 0">' + title + '</strong>',
        '  <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4">' + body + '</p>',
        '</div>'
      ].join(''), '#fbf7ff');
    }

    return browser([
      '<div style="min-height:225px;background:#f8fbff;color:#0f172a;padding:17px">',
      '  <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><strong style="font-size:13px">Workspace</strong><span style="padding:6px 10px;border-radius:99px;background:#dbeafe;color:#2563eb;font-size:10px;font-weight:950">Product</span></header>',
      '  <section style="display:grid;grid-template-columns:1fr 150px;gap:16px;align-items:center">',
      '    <div><small style="color:#2563eb;font-weight:950">' + kicker + '</small><strong style="display:block;font-size:22px;line-height:1.05;margin:7px 0">' + title + '</strong><p style="margin:0;color:#64748b;font-size:11px;line-height:1.45">' + body + '</p></div>',
      '    <div style="height:104px;border-radius:26px;background:linear-gradient(135deg,#2563eb,#93c5fd);box-shadow:0 18px 36px rgba(37,99,235,.22);position:relative"><span style="position:absolute;left:16px;right:16px;top:18px;height:10px;border-radius:99px;background:rgba(255,255,255,.78)"></span><span style="position:absolute;left:16px;bottom:17px;width:58%;height:30px;border-radius:13px;background:rgba(255,255,255,.42)"></span></div>',
      '  </section>',
      '  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px"><span style="height:33px;border-radius:13px;background:#fff;border:1px solid #dbeafe"></span><span style="height:33px;border-radius:13px;background:#fff;border:1px solid #dbeafe"></span><span style="height:33px;border-radius:13px;background:#fff;border:1px solid #dbeafe"></span></div>',
      '</div>'
    ].join(''), '#f8fbff');
  }

  // IRGEZTNE_TEMPLATE_VITRINA_CANONICAL_PREVIEWS_R1M
  function ensureCanonicalPreviewStylesR1M() {
    if (document.getElementById('preview4-template-canonical-preview-style-r1m')) return;
    const style = document.createElement('style');
    style.id = 'preview4-template-canonical-preview-style-r1m';
    style.textContent = `
      .preview4-template-visual--canonical-r1m {
        position: relative !important;
        overflow: hidden !important;
        min-width: 0 !important;
        background: #07101d !important;
      }
      .preview4-template-canonical-frame-r1m {
        position: absolute;
        display: block;
        width: 1440px;
        height: 900px;
        margin: 0;
        border: 0;
        background: #07101d;
        pointer-events: none;
        transform-origin: 0 0;
      }
      .preview4-template-compact-preview .preview4-template-visual--canonical-r1m {
        height: 158px !important;
        min-height: 158px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function fitCanonicalTemplateFrameR1M(frame) {
    if (!frame || !frame.parentElement) return;
    const wrap = frame.parentElement;
    const baseWidth = 1440;
    const baseHeight = 900;
    const width = Math.max(1, wrap.clientWidth || 0);
    const height = Math.max(1, wrap.clientHeight || 0);
    const scale = Math.min(width / baseWidth, height / baseHeight);
    frame.style.left = Math.max(0, (width - baseWidth * scale) / 2) + 'px';
    frame.style.top = Math.max(0, (height - baseHeight * scale) / 2) + 'px';
    frame.style.transform = 'scale(' + scale + ')';
  }

  function hydrateCanonicalTemplatePreviewsR1M(root) {
    if (!root || !root.querySelectorAll) return;
    const owner = window.IRGEZTNESiteStudioSafeV5;
    if (!owner || typeof owner.loadTemplateThumbnail !== 'function') return;

    root.querySelectorAll('[data-preview4-canonical-template-frame-r1m="1"]').forEach((frame) => {
      fitCanonicalTemplateFrameR1M(frame);
      frame.addEventListener('load', () => {
        frame.removeAttribute('data-v5-template-preview-loading');
        fitCanonicalTemplateFrameR1M(frame);
        window.setTimeout(() => fitCanonicalTemplateFrameR1M(frame), 120);
      }, { once: true });

      if (frame.dataset.preview4CanonicalHydratedR1m === '1') return;
      frame.dataset.preview4CanonicalHydratedR1m = '1';

      // The Cabinet Templates panel is normally hidden during initial boot.
      // Re-fit when its card becomes visible instead of freezing a 1px scale.
      if (typeof ResizeObserver === 'function' && frame.parentElement) {
        const observer = new ResizeObserver(() => fitCanonicalTemplateFrameR1M(frame));
        observer.observe(frame.parentElement);
        frame.__preview4CanonicalResizeObserverR1m = observer;
      }

      const id = frame.getAttribute('data-template-id') || '';
      Promise.resolve(owner.loadTemplateThumbnail(frame, id)).catch(() => {
        frame.removeAttribute('data-v5-template-preview-loading');
      });
    });
  }

  if (!window.__IRGEZTNE_TEMPLATE_VITRINA_CANONICAL_RESIZE_R1M__) {
    window.__IRGEZTNE_TEMPLATE_VITRINA_CANONICAL_RESIZE_R1M__ = true;
    window.addEventListener('resize', () => {
      document.querySelectorAll('[data-preview4-canonical-template-frame-r1m="1"]').forEach(fitCanonicalTemplateFrameR1M);
    });
  }

  function cardMarkup(template) {
    return [
      '<article class="preview4-template-card" data-template-id="' + escapeHtml(template.id) + '">',
      '  <div class="preview4-template-card-head">',
      '    <div>',
      '      <div class="preview4-template-kicker">' + escapeHtml(t(template.badge)) + '</div>',
      '      <h4>' + escapeHtml(t(template.title)) + '</h4>',
      '    </div>',
      '    <span class="preview4-template-kind">' + escapeHtml(t(template.kind)) + '</span>',
      '  </div>',
      previewMarkup(template),
      '  <p>' + escapeHtml(t(template.description)) + '</p>',
      '  <div class="preview4-template-actions">',
      '    <button type="button" data-preview4-template-action="use" data-template-id="' + escapeHtml(template.id) + '">' + escapeHtml(isRu() ? 'Выбрать шаблон' : 'Choose template') + '</button>',
      '    <span class="preview4-template-action-note">' + escapeHtml(isRu() ? 'Выбор передаёт Web Studio полный официальный starter с его страницами и секциями.' : 'Selection passes the complete official starter with its pages and sections to Web Studio.') + '</span>',
      '  </div>',
      '</article>'
    ].join('');
  }


  function compactCardMarkup(template) {
    return [
      '<article class="preview4-template-compact-card" data-template-id="' + escapeHtml(template.id) + '">',
      '  <div class="preview4-template-compact-body">',
      '    <div class="preview4-template-compact-topline">',
      '      <span>' + escapeHtml(t(template.badge)) + '</span>',
      '      <span>' + escapeHtml(t(template.kind)) + '</span>',
      '    </div>',
      '    <h4>' + escapeHtml(t(template.title)) + '</h4>',
      '  </div>',
      '  <div class="preview4-template-compact-preview">' + previewMarkup(template) + '</div>',
      '  <div class="preview4-template-compact-body">',
      '    <p>' + escapeHtml(t(template.description)) + '</p>',
      '    <div class="preview4-template-compact-actions">',
      '      <button type="button" data-preview4-template-action="use" data-template-id="' + escapeHtml(template.id) + '">' + escapeHtml(isRu() ? 'Выбрать' : 'Choose') + '</button>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderWorkspaceRoot(root) {
    ensureWorkspaceCompactStyles();

    root.innerHTML = [
      '<section class="preview4-official-templates preview4-official-templates--workspace-compact">',
      '  <div class="preview4-official-templates-head">',
      '    <div>',
      '      <div class="preview4-template-kicker">IRGEZTNE PREVIEW.4</div>',
      '      <h3>' + escapeHtml(isRu() ? 'Официальные шаблоны' : 'Official templates') + '</h3>',
      '      <p></p>',
      '    </div>',
      '    <strong>' + escapeHtml(String(templates.length)) + '</strong>',
      '  </div>',
      '  <div class="preview4-template-compact-list">',
      templates.map(compactCardMarkup).join(''),
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderCabinetRoot(root) {
    root.innerHTML = [
      '<section class="preview4-official-templates">',
      '  <div class="preview4-official-templates-head">',
      '    <div>',
      '      <div class="preview4-template-kicker">IRGEZTNE PREVIEW.4</div>',
      '      <h3>' + escapeHtml(isRu() ? 'Официальные бесплатные шаблоны' : 'Official free templates') + '</h3>',
      '      <p>' + escapeHtml(isRu()
        ? 'Шесть стартовых шаблонов с каноническим мини-превью из текущего Web Studio renderer.'
        : 'Six starter templates with canonical mini previews from the current Web Studio renderer.'
      ) + '</p>',
      '    </div>',
      '    <strong>' + escapeHtml(isRu() ? '6 шаблонов' : '6 templates') + '</strong>',
      '  </div>',
      '  <div class="preview4-template-grid">',
      templates.map(cardMarkup).join(''),
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderRoot(root) {
    ensureCanonicalPreviewStylesR1M();
    const surface = (root.getAttribute('data-vitrina-surface') || '').toLowerCase();
    if (surface === 'workspace') {
      renderWorkspaceRoot(root);
      hydrateCanonicalTemplatePreviewsR1M(root);
      return;
    }

    renderCabinetRoot(root);
    hydrateCanonicalTemplatePreviewsR1M(root);
  }

  function renderAll() {
    document.querySelectorAll('[data-vitrina-root]').forEach(renderRoot);
  }

  // IRGEZTNE_V083G_EXPOSE_OFFICIAL_TEMPLATES_RENDER
  window.IRGEZTNEPreview4OfficialTemplatesV1 = {
    renderAll: renderAll,
    renderRoot: renderRoot,
    templates: templates
  };

  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-preview4-template-action]');
    if (!button) return;

    const id = button.getAttribute('data-template-id');
    const template = templates.find((item) => item.id === id);
    if (!template) return;

    const action = button.getAttribute('data-preview4-template-action');

    if (action === 'use') openWebStudio(template);
    if (action === 'export') downloadJson(template);
    if (action === 'copy') copyJson(template);
  });

  document.addEventListener('DOMContentLoaded', renderAll);
  document.addEventListener('irg:language-changed', renderAll);
  window.addEventListener('irg:language-changed', renderAll);
  setTimeout(renderAll, 200);
  setTimeout(renderAll, 900);
})();

/* =========================================================
   IRGEZTNE Templates v037c
   Real Templates button polish.
   Targets actual preview4/vitrina template buttons.
   Logic unchanged.
   ========================================================= */
(function () {
  if (typeof document === 'undefined') return;
  if (document.getElementById('irgeztne-templates-v037c-button-polish')) return;

  const style = document.createElement('style');
  style.id = 'irgeztne-templates-v037c-button-polish';
  style.textContent = `
    .preview4-template-actions button[data-preview4-template-action],
    .preview4-template-card button[data-preview4-template-action],
    .preview4-template-card button,
    .preview4-official-templates button,
    .ns-vitrina-v1__btn,
    .ns-vitrina-v1 button[data-vitrina-action],
    .ns-editor-template-card button {
      position: relative !important;
      overflow: hidden !important;
      transition:
        transform 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        background 0.18s ease,
        filter 0.18s ease !important;
      will-change: transform, box-shadow, border-color, background !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.12),
        0 8px 18px rgba(0,0,0,0.14) !important;
    }

    .preview4-template-actions button[data-preview4-template-action]::after,
    .preview4-template-card button[data-preview4-template-action]::after,
    .preview4-template-card button::after,
    .preview4-official-templates button::after,
    .ns-vitrina-v1__btn::after,
    .ns-vitrina-v1 button[data-vitrina-action]::after,
    .ns-editor-template-card button::after {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      pointer-events: none !important;
      background: linear-gradient(120deg, transparent, rgba(255,255,255,0.14), transparent) !important;
      transform: translateX(-120%) !important;
      transition: transform 0.36s ease !important;
    }

    .preview4-template-actions button[data-preview4-template-action]:hover,
    .preview4-template-card button[data-preview4-template-action]:hover,
    .preview4-template-card button:hover,
    .preview4-official-templates button:hover,
    .ns-vitrina-v1__btn:hover,
    .ns-vitrina-v1 button[data-vitrina-action]:hover,
    .ns-editor-template-card button:hover {
      transform: translateY(-1px) !important;
      border-color: rgba(132, 195, 255, 0.62) !important;
      filter: saturate(1.08) brightness(1.05) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.16),
        0 15px 32px rgba(41, 113, 255, 0.22) !important;
    }

    .preview4-template-actions button[data-preview4-template-action]:hover::after,
    .preview4-template-card button[data-preview4-template-action]:hover::after,
    .preview4-template-card button:hover::after,
    .preview4-official-templates button:hover::after,
    .ns-vitrina-v1__btn:hover::after,
    .ns-vitrina-v1 button[data-vitrina-action]:hover::after,
    .ns-editor-template-card button:hover::after {
      transform: translateX(120%) !important;
    }

    .preview4-template-actions button[data-preview4-template-action]:active,
    .preview4-template-card button[data-preview4-template-action]:active,
    .preview4-template-card button:active,
    .preview4-official-templates button:active,
    .ns-vitrina-v1__btn:active,
    .ns-vitrina-v1 button[data-vitrina-action]:active,
    .ns-editor-template-card button:active {
      transform: translateY(0) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08),
        0 5px 12px rgba(0,0,0,0.16) !important;
    }

    .preview4-template-actions button[data-preview4-template-action]:focus-visible,
    .preview4-template-card button[data-preview4-template-action]:focus-visible,
    .preview4-template-card button:focus-visible,
    .preview4-official-templates button:focus-visible,
    .ns-vitrina-v1__btn:focus-visible,
    .ns-vitrina-v1 button[data-vitrina-action]:focus-visible,
    .ns-editor-template-card button:focus-visible {
      outline: 2px solid rgba(111, 184, 255, 0.86) !important;
      outline-offset: 2px !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .preview4-template-actions button[data-preview4-template-action],
      .preview4-template-card button[data-preview4-template-action],
      .preview4-template-card button,
      .preview4-official-templates button,
      .ns-vitrina-v1__btn,
      .ns-vitrina-v1 button[data-vitrina-action],
      .ns-editor-template-card button {
        transition: none !important;
      }

      .preview4-template-actions button[data-preview4-template-action]:hover,
      .preview4-template-card button[data-preview4-template-action]:hover,
      .preview4-template-card button:hover,
      .preview4-official-templates button:hover,
      .ns-vitrina-v1__btn:hover,
      .ns-vitrina-v1 button[data-vitrina-action]:hover,
      .ns-editor-template-card button:hover {
        transform: none !important;
      }
    }
  `;

  document.head.appendChild(style);
})();
