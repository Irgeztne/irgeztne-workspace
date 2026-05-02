(function (root) {
  const TEMPLATE_LIBRARY_SRC = "src/ns-template-library.js";
  const SITE_PROFILE_STORE_SRC = "src/site-profile-store.js";
  const JODIT_STYLE_SRC = "node_modules/jodit/es2021/jodit.fat.min.css";
  const JODIT_SCRIPT_SRC = "node_modules/jodit/es2021/jodit.fat.min.js";

  function loadTemplateLibrary(callback) {
    if (root.NSTemplateLibrary && typeof root.NSTemplateLibrary.getTemplates === "function") {
      callback();
      return;
    }

    const existing = document.querySelector("script[data-ns-template-library-loader]");
    if (existing) {
      existing.addEventListener("load", callback, { once: true });
      existing.addEventListener("error", callback, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TEMPLATE_LIBRARY_SRC;
    script.async = false;
    script.dataset.nsTemplateLibraryLoader = "true";
    script.addEventListener("load", callback, { once: true });
    script.addEventListener("error", callback, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function loadSiteProfileStore(callback) {
    if (root.NSSiteProfileStore && typeof root.NSSiteProfileStore.getProfile === "function") {
      callback();
      return;
    }

    const existing = document.querySelector("script[data-ns-site-profile-loader]");
    if (existing) {
      existing.addEventListener("load", callback, { once: true });
      existing.addEventListener("error", callback, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SITE_PROFILE_STORE_SRC;
    script.async = false;
    script.dataset.nsSiteProfileLoader = "true";
    script.addEventListener("load", callback, { once: true });
    script.addEventListener("error", callback, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }


  function loadJoditAssets(callback) {
    if (root.Jodit && typeof root.Jodit.make === "function") {
      callback(true);
      return;
    }

    const finish = (ok) => {
      try {
        callback(Boolean(ok));
      } catch (error) {
        console.warn('[NSEditorV1] Jodit callback failed:', error);
      }
    };

    const existingScript = document.querySelector("script[data-ns-jodit-loader]");
    if (existingScript) {
      existingScript.addEventListener("load", () => finish(true), { once: true });
      existingScript.addEventListener("error", () => finish(false), { once: true });
      return;
    }

    if (!document.querySelector('link[data-ns-jodit-style-loader]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = JODIT_STYLE_SRC;
      link.dataset.nsJoditStyleLoader = 'true';
      (document.head || document.documentElement).appendChild(link);
    }

    const script = document.createElement("script");
    script.src = JODIT_SCRIPT_SRC;
    script.async = true;
    script.dataset.nsJoditLoader = "true";
    script.addEventListener("load", () => finish(true), { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function boot() {
  const STORAGE_KEY = "ns.browser.v8.editor.v1";
  const WRITE_MODES = ["visual", "markdown", "blocks"];
  const WRITE_THEMES = ["dark", "light"];
  const STABLE_EDITOR_MODE = "visual";
  const STABLE_EDITOR_THEME = "light";
  const CABINET_TABS = ["write", "preview", "deploy"];
  const WORKSPACE_TABS = ["draft", "preview", "deploy"];
  const VALID_BLOCK_TYPES = ["paragraph", "heading-1", "heading-2", "quote", "list"];
  const OUTPUT_FILES = ["index.html", "styles.css", "content/page.json", "meta.json"];

  function getTemplateLibrary() {
    return root.NSTemplateLibrary && typeof root.NSTemplateLibrary.getTemplates === "function" ? root.NSTemplateLibrary : null;
  }

  function getSharedTemplates() {
    const library = getTemplateLibrary();
    const templates = library ? library.getTemplates() : [];
    return Array.isArray(templates) ? templates : [];
  }

  const FALLBACK_TEMPLATES = getSharedTemplates();

  function getCurrentTemplates() {
    const templates = getSharedTemplates();
    return Array.isArray(templates) && templates.length ? templates : FALLBACK_TEMPLATES;
  }

  function getDefaultTemplateId() {
    const templates = getCurrentTemplates();
    return templates[0] ? templates[0].id : "";
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeLocale(value) {
    return String(value || "").toLowerCase() === "ru" ? "ru" : "en";
  }

  function normalizeWriteTheme(value) {
    return String(value || '').toLowerCase() === 'dark' ? 'dark' : 'light';
  }

  function getUiLanguage() {
    try {
      if (root.__IRG_BROWSER_SHELL_API && typeof root.__IRG_BROWSER_SHELL_API.getLanguage === "function") {
        return normalizeLocale(root.__IRG_BROWSER_SHELL_API.getLanguage());
      }
    } catch (error) {
      console.warn('[NSEditorV1] language lookup failed:', error);
    }

    const htmlLang = typeof document !== "undefined" && document.documentElement
      ? String(document.documentElement.getAttribute("lang") || "")
      : "";
    return normalizeLocale(htmlLang || "en");
  }

  function t(en, ru) {
    return getUiLanguage() === 'ru' ? ru : en;
  }

  function hasCyrillic(value) {
    return /[А-Яа-яЁёІіЇїЄє]/.test(String(value || ""));
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeLinkUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(https?:|mailto:|tel:|\/)/i.test(raw)) return raw;
    return `https://${raw}`;
  }

  function countWords(value) {
    const matches = String(value || "").trim().match(/\S+/gu);
    return matches ? matches.length : 0;
  }

  function countCharacters(value) {
    return String(value || "").replace(/\s+/g, "").length;
  }

  function estimateReadingMinutes(wordCount) {
    if (!wordCount) return 0;
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  function formatClock(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return t("Not saved yet", "Еще не сохранено");
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return t("Not saved yet", "Еще не сохранено");
    return date.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  function bodyToParagraphs(body) {
    return String(body || "")
      .split(/\n{2,}/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function parseTags(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    return String(value || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function uniqueIds(value) {
    return Array.from(new Set((Array.isArray(value) ? value : []).filter(Boolean).map((item) => String(item))));
  }

  function tagsToString(tags) {
    return Array.isArray(tags) ? tags.join(", ") : "";
  }

  function getInitials(value) {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return "NS";
    return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "NS";
  }


  function sanitizeFaviconLetters(value, fallback) {
    const source = String(value || fallback || "")
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 3);
    return (source || "NS").toUpperCase();
  }

  function sanitizeHexColor(value, fallback) {
    const raw = String(value || "").trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
    return fallback;
  }

  function getFaviconShapeRadius(shape) {
    const next = String(shape || "rounded").toLowerCase();
    if (next === "circle") return "128";
    if (next === "square") return "0";
    return "56";
  }

  function buildLetterFaviconSvg(options = {}) {
    const letters = sanitizeFaviconLetters(options.letters, "NS");
    const background = sanitizeHexColor(options.background, "#111827");
    const foreground = sanitizeHexColor(options.foreground, "#ffffff");
    const radius = getFaviconShapeRadius(options.shape);
    const fontSize = letters.length > 2 ? 92 : letters.length > 1 ? 108 : 128;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="${radius}" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-8" fill="${foreground}">${escapeHtml(letters)}</text></svg>`;
  }

  function svgToDataUrl(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(String(svg || ""))}`;
  }

  function buildGeneratedFaviconDataUrl(options = {}) {
    return svgToDataUrl(buildLetterFaviconSvg(options));
  }

  function getFaviconLinkType(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/\.svg(\?|#|$)/i.test(raw) || /^data:image\/svg\+xml/i.test(raw)) return 'type="image/svg+xml"';
    if (/\.ico(\?|#|$)/i.test(raw) || /^data:image\/(x-icon|vnd\.microsoft\.icon)/i.test(raw)) return 'sizes="any"';
    if (/\.png(\?|#|$)/i.test(raw) || /^data:image\/png/i.test(raw)) return 'type="image/png"';
    return "";
  }

  function buildFaviconLinkMarkup(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const href = escapeHtml(normalizeAppAssetPath(raw));
    const typeAttr = getFaviconLinkType(raw);
    return `<link rel="icon" href="${href}"${typeAttr ? ` ${typeAttr}` : ""} />`;
  }

  function translateWriteModeLabel(value) {
    const map = {
      visual: t("Visual", "Визуально"),
      markdown: "Markdown",
      blocks: t("Blocks", "Блоки")
    };
    return map[value] || value;
  }

  function translateWriteThemeLabel(value) {
    const map = {
      dark: t("Dark", "Темная"),
      light: t("Light", "Светлая")
    };
    return map[value] || value;
  }

  function translateBlockTypeLabel(value) {
    const map = {
      paragraph: t("Paragraph", "Абзац"),
      "heading-1": t("Heading 1", "Заголовок 1"),
      "heading-2": t("Heading 2", "Заголовок 2"),
      quote: t("Quote", "Цитата"),
      list: t("List", "Список")
    };
    return map[value] || value;
  }

  function translateSiteLabel(value) {
    const map = {
      "Article Preview": "Предпросмотр статьи",
      "Editorial Preview": "Редакционный предпросмотр",
      "Analysis Preview": "Предпросмотр анализа",
      "Website Preview": "Предпросмотр сайта",
      "Press Preview": "Предпросмотр пресс-страницы",
      "Page Preview": "Предпросмотр страницы"
    };
    return map[value] || value;
  }

  function normalizeAppAssetPath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(data:|https?:|file:|blob:|about:|chrome:|#)/i.test(raw)) return raw;
    if (raw.startsWith("./") || raw.startsWith("/")) return raw;
    if (raw.startsWith("../../../assets/")) return `./assets/${raw.slice(16)}`;
    if (raw.startsWith("../../assets/")) return `./assets/${raw.slice(13)}`;
    if (raw.startsWith("../assets/")) return `./assets/${raw.slice(10)}`;
    if (raw.startsWith("assets/")) return `./${raw}`;
    return raw;
  }

  function translateTemplateCategory(value) {
    const map = {
      website: t('Website','Сайт'),
      blog: t('Blog','Блог'),
      article: t('Editorial','Редакционный'),
      analysis: t('Analysis','Аналитика'),
      press: t('Press page','Пресс-страница')
    };
    return map[String(value || '').toLowerCase()] || String(value || 'Шаблон');
  }


  function getTemplateUiMeta(template) {
    const id = String(template && template.id || '').toLowerCase();
    const fallbackName = String(template && template.name || t('Template','Шаблон'));
    const fallbackDescription = String(template && template.description || '');
    const meta = {
      'website-starter': {
        name: ["Website Starter", "Стартовый сайт"],
        description: [
          "A reliable one-page starter site: Home, About, Work, Contact — all links are real anchors.",
          "Честный one-page сайт: Home, About, Work, Contact — все ссылки работают как якоря."
        ]
      },
      'blog-post': {
        name: ["Medium-style Article", "Статья в стиле Medium"],
        description: [
          "A clean longform article template with headline, lead, body, quote, and conclusion.",
          "Чистый длинный article-шаблон: заголовок, лид, основной текст, цитата и вывод."
        ]
      },
      'vitrina-editorial-brief': {
        name: ["Editorial Brief", "Редакционный бриф"],
        description: [
          "A compact newsroom brief with lead, key facts, timeline, and next angles.",
          "Более сильный newsroom-template с лидом, ключевыми фактами, таймлайном и следующими углами освещения."
        ]
      },
      'vitrina-news-analysis': {
        name: ["News Analysis", "Новостной анализ"],
        description: [
          "A longer analysis template for context, facts, and a calm conclusion.",
          "Более длинный template разбора для контекста, фактов и спокойного вывода."
        ]
      },
      'vitrina-press-landing': {
        name: ["Press Landing", "Пресс-лендинг"],
        description: [
          "A stronger landing page for a newsroom, studio, profile, or project home.",
          "Более сильный стартовый лендинг для newsroom, студии, профиля или главной страницы проекта."
        ]
      }
    };
    const found = meta[id];
    if (!found) return { name: fallbackName, description: fallbackDescription };
    return {
      name: t(found.name[0], found.name[1]),
      description: t(found.description[0], found.description[1])
    };
  }

  function renderSiteIdentityPreview(profile) {
    const next = normalizeSiteProfile(profile);
    const initials = getInitials(next.siteName);
    const logoMarkup = next.logoPath
      ? `<div class="ns-editor-site-identity__media"><img class="ns-editor-site-identity__logo" src="${escapeHtml(normalizeAppAssetPath(next.logoPath))}" alt="${escapeHtml(next.logoAlt || next.siteName)}" /></div>`
      : "";
    const faviconMarkup = next.faviconPath
      ? `<img class="ns-editor-site-identity__favicon" src="${escapeHtml(normalizeAppAssetPath(next.faviconPath))}" alt="${escapeHtml(t('Favicon preview','Предпросмотр favicon'))}" />`
      : `<div class="ns-editor-site-identity__favicon ns-editor-site-identity__favicon--fallback" aria-hidden="true">${escapeHtml(initials.slice(0, 2))}</div>`;
    const navMarkup = (Array.isArray(next.navItems) ? next.navItems : []).slice(0, 4)
      .map((item) => `<span class="ns-editor-site-identity__chip">${escapeHtml(item)}</span>`)
      .join("");

    return `
      <div class="ns-editor-site-identity__preview-card">
        ${logoMarkup}
        <div class="ns-editor-site-identity__copy">
          <strong>${escapeHtml(next.siteName)}</strong>
          <span>${escapeHtml(next.tagline || t("Add a short site tagline.", "Добавьте короткий слоган сайта."))}</span>
          <div class="ns-editor-site-identity__meta-row">
            <span>${escapeHtml(next.contactEmail || t("Add contact email", "Добавьте контактную почту"))}</span>
            <span>${escapeHtml(next.footerText || t("Add footer text", "Добавьте текст подвала"))}</span>
          </div>
          <div class="ns-editor-site-identity__chips">${navMarkup || `<span class="ns-editor-site-identity__chip">${t('Overview','Обзор')}</span>`}</div>
        </div>
        <div class="ns-editor-site-identity__favicon-wrap">
          <span>${escapeHtml(t('Tab icon','Иконка вкладки'))}</span>
          ${faviconMarkup}
        </div>
      </div>
    `;
  }


  function getEditorCanvasPreset(draft) {
    const template = getTemplate(draft && draft.templateId);
    const category = slugify((draft && draft.meta && draft.meta.category) || (template && template.category) || "page") || "page";
    const templateId = slugify((draft && draft.templateId) || (template && template.id) || category) || category;

    if (/website|press/.test(category)) {
      return {
        category,
        templateId,
        frameClass: "ns-editor-document-canvas--site",
        typeLabel: t("Site canvas","Холст сайта"),
        note: t("This template should feel like a site, not like a generic blue block.","Здесь шаблон должен выглядеть как сайт, а не как общий синий блок."),
        widthLabel: t("Wide theme","Широкая тема")
      };
    }

    if (/blog/.test(category)) {
      return {
        category,
        templateId,
        frameClass: "ns-editor-document-canvas--article",
        typeLabel: t("Article canvas","Холст статьи"),
        note: t("A clean readable article with its own document surface.","Чистая читаемая статья с отдельной поверхностью документа."),
        widthLabel: t("Article","Статья")
      };
    }

    if (/article/.test(category)) {
      return {
        category,
        templateId,
        frameClass: "ns-editor-document-canvas--editorial",
        typeLabel: t("Editorial canvas","Редакционный холст"),
        note: t("A stricter working surface for an editorial template.","Более строгая рабочая поверхность для редакционного шаблона."),
        widthLabel: t("Editorial","Редакционный")
      };
    }

    if (/analysis/.test(category)) {
      return {
        category,
        templateId,
        frameClass: "ns-editor-document-canvas--analysis",
        typeLabel: t("Analysis canvas","Холст анализа"),
        note: t("A calm analysis surface with a more collected presentation.","Спокойная аналитическая поверхность с более собранной подачей."),
        widthLabel: t("Analysis","Аналитика")
      };
    }

    return {
      category,
      templateId,
      frameClass: "ns-editor-document-canvas--default",
      typeLabel: t("Document canvas","Холст документа"),
      note: t("A separate document surface inside the editor.","Отдельная поверхность документа внутри редактора."),
      widthLabel: t("Document","Документ")
    };
  }

  function ensureEditorDocumentCanvasStyles() {
    if (document.getElementById("ns-editor-document-canvas-styles")) return;
    const style = document.createElement("style");
    style.id = "ns-editor-document-canvas-styles";
    style.textContent = `
      .ns-editor-document-canvas {
        display: grid;
        gap: 0;
        border-radius: 28px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 24px 60px rgba(8, 12, 24, 0.22);
        background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
      }
      .ns-editor-document-canvas__bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: rgba(12, 18, 32, 0.78);
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .ns-editor-document-canvas__meta {
        min-width: 0;
        display: grid;
        gap: 4px;
      }
      .ns-editor-document-canvas__eyebrow {
        font-size: 11px;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: rgba(214,225,255,.72);
      }
      .ns-editor-document-canvas__title {
        font-size: 15px;
        font-weight: 700;
        color: #f4f7ff;
      }
      .ns-editor-document-canvas__note {
        font-size: 12px;
        line-height: 1.5;
        color: rgba(214,225,255,.64);
      }
      .ns-editor-document-canvas__chips {display:flex; flex-wrap:wrap; gap:8px;}
      .ns-editor-document-canvas__chip {
        display:inline-flex; align-items:center; min-height:28px; padding:0 10px; border-radius:999px;
        border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.05); color:#eef3ff; font-size:12px;
      }
      .ns-editor-document-canvas__viewport {
        padding: 28px;
        background: linear-gradient(180deg, #f7f3ec 0%, #efe5d8 100%);
      }
      .ns-editor-document-canvas .ns-editor-visual,
      .ns-editor-document-canvas .ns-editor-textarea--writer,
      .ns-editor-document-canvas .ns-editor-blocks {
        width: 100%;
        max-width: 100%;
        min-height: 560px;
        margin: 0 auto;
        border-radius: 24px;
        border: 1px solid rgba(118, 86, 56, 0.12) !important;
        background: rgba(255,252,247,0.92) !important;
        color: #281f18 !important;
        box-shadow: 0 18px 50px rgba(95, 62, 34, 0.10);
      }
      .ns-editor-document-canvas .ns-editor-visual {
        padding: 36px 40px !important;
      }
      .ns-editor-document-canvas .ns-editor-textarea--writer {
        padding: 32px 34px !important;
      }
      .ns-editor-document-canvas .ns-editor-blocks {
        padding: 18px !important;
      }
      .ns-editor-document-canvas--site .ns-editor-document-canvas__viewport {
        background: linear-gradient(180deg, #fbf6ef 0%, #efe2d1 100%);
      }
      .ns-editor-document-canvas--site .ns-editor-visual,
      .ns-editor-document-canvas--site .ns-editor-textarea--writer,
      .ns-editor-document-canvas--site .ns-editor-blocks {
        max-width: 1320px;
      }
      .ns-editor-document-canvas--article .ns-editor-document-canvas__viewport {
        background: linear-gradient(180deg, #fffdfa 0%, #f4ebe2 100%);
      }
      .ns-editor-document-canvas--article .ns-editor-visual,
      .ns-editor-document-canvas--article .ns-editor-textarea--writer,
      .ns-editor-document-canvas--article .ns-editor-blocks {
        max-width: 860px;
      }
      .ns-editor-document-canvas--editorial .ns-editor-document-canvas__viewport {
        background: linear-gradient(180deg, #fbf8f9 0%, #efe7ea 100%);
      }
      .ns-editor-document-canvas--editorial .ns-editor-visual,
      .ns-editor-document-canvas--editorial .ns-editor-textarea--writer,
      .ns-editor-document-canvas--editorial .ns-editor-blocks {
        max-width: 940px;
      }
      .ns-editor-document-canvas--analysis .ns-editor-document-canvas__viewport {
        background: linear-gradient(180deg, #f4faf7 0%, #e1eee8 100%);
      }
      .ns-editor-document-canvas--analysis .ns-editor-visual,
      .ns-editor-document-canvas--analysis .ns-editor-textarea--writer,
      .ns-editor-document-canvas--analysis .ns-editor-blocks {
        max-width: 980px;
      }
      .ns-editor-write-root .ns-editor-writer-stage {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 28px;
        padding: 18px;
      }
      .ns-editor-write-root .ns-editor-write-surface[data-write-surface="visual"],
      .ns-editor-write-root .ns-editor-write-surface[data-write-surface="markdown"],
      .ns-editor-write-root .ns-editor-write-surface[data-write-surface="blocks"] {
        background: transparent !important;
      }
      .ns-editor-write-root .ns-editor-visual h1,
      .ns-editor-write-root .ns-editor-visual h2,
      .ns-editor-write-root .ns-editor-visual h3,
      .ns-editor-write-root .ns-editor-visual p,
      .ns-editor-write-root .ns-editor-visual li,
      .ns-editor-write-root .ns-editor-visual blockquote {
        color: #281f18 !important;
      }
      .ns-editor-write-root .ns-editor-visual blockquote {
        border-left: 3px solid rgba(134,90,49,.72);
        background: rgba(255,255,255,.65);
        border-radius: 18px;
        padding: 18px 20px;
      }
      .ns-editor-write-root .ns-editor-visual a { color: #865a31 !important; }
      .ns-editor-write-root .ns-editor-write-theme--dark .ns-editor-document-canvas__bar,
      .ns-editor-write-root.ns-editor-write-theme--dark .ns-editor-document-canvas__bar {
        background: rgba(8, 14, 24, 0.84);
      }

      .ns-editor-write-root .ns-editor-visual:has(.irgeztne-project-landing),
      .ns-editor-write-root .ns-editor-jodit-content:has(.irgeztne-project-landing),
      .ns-editor-write-root .jodit-wysiwyg:has(.irgeztne-project-landing) {
        width: 100% !important;
        max-width: none !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      .ns-editor-write-root .ns-editor-visual .irgeztne-project-landing,
      .ns-editor-write-root .ns-editor-jodit-content .irgeztne-project-landing,
      .ns-editor-write-root .jodit-wysiwyg .irgeztne-project-landing {
        width: 100% !important;
        max-width: none !important;
        margin-left: auto !important;
        margin-right: auto !important;
        opacity: 1 !important;
        filter: none !important;
        mix-blend-mode: normal !important;
      }

      .ns-editor-write-root .irgeztne-project-landing,
      .ns-editor-write-root .irgeztne-project-landing h1,
      .ns-editor-write-root .irgeztne-project-landing h2,
      .ns-editor-write-root .irgeztne-project-landing h3,
      .ns-editor-write-root .irgeztne-project-landing strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-title,
      .ns-editor-write-root .irgeztne-project-landing .pl-title *,
      .ns-editor-write-root .irgeztne-project-landing .pl-brand strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-card-head strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-feature strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-work strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-step strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-metric strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-float strong,
      .ns-editor-write-root .irgeztne-project-landing .pl-nav a,
      .ns-editor-write-root .irgeztne-project-landing .pl-pill,
      .ns-editor-write-root .irgeztne-project-landing .pl-button {
        color: var(--pl-text) !important;
        -webkit-text-fill-color: var(--pl-text) !important;
        opacity: 1 !important;
        filter: none !important;
        mix-blend-mode: normal !important;
      }

      .ns-editor-write-root .irgeztne-project-landing p,
      .ns-editor-write-root .irgeztne-project-landing span,
      .ns-editor-write-root .irgeztne-project-landing .pl-lead,
      .ns-editor-write-root .irgeztne-project-landing .pl-brand span,
      .ns-editor-write-root .irgeztne-project-landing .pl-card-head span,
      .ns-editor-write-root .irgeztne-project-landing .pl-feature p,
      .ns-editor-write-root .irgeztne-project-landing .pl-work p,
      .ns-editor-write-root .irgeztne-project-landing .pl-step p,
      .ns-editor-write-root .irgeztne-project-landing .pl-metric span,
      .ns-editor-write-root .irgeztne-project-landing .pl-float span,
      .ns-editor-write-root .irgeztne-project-landing .pl-section-head p,
      .ns-editor-write-root .irgeztne-project-landing .pl-footer,
      .ns-editor-write-root .irgeztne-project-landing .pl-footer * {
        color: var(--pl-muted) !important;
        -webkit-text-fill-color: var(--pl-muted) !important;
        opacity: 1 !important;
        filter: none !important;
        mix-blend-mode: normal !important;
      }

      .ns-editor-write-root .irgeztne-project-landing .pl-kicker,
      .ns-editor-write-root .irgeztne-project-landing .pl-eyebrow,
      .ns-editor-write-root .irgeztne-project-landing .pl-icon,
      .ns-editor-write-root .irgeztne-project-landing .pl-chip {
        color: var(--pl-orange-2) !important;
        -webkit-text-fill-color: var(--pl-orange-2) !important;
      }

      .ns-editor-write-root .irgeztne-project-landing .pl-button--primary,
      .ns-editor-write-root .irgeztne-project-landing .pl-button--primary * {
        color: #fff !important;
        -webkit-text-fill-color: #fff !important;
      }

      .ns-editor-write-root .irgeztne-project-landing .pl-logo,
      .ns-editor-write-root .irgeztne-project-landing .pl-logo * {
        background: var(--pl-text) !important;
        color: var(--pl-bg) !important;
        -webkit-text-fill-color: var(--pl-bg) !important;
      }

      .ns-editor-write-root .irgeztne-project-landing .pl-status {
        color: #259957 !important;
        -webkit-text-fill-color: #259957 !important;
      }

      .ns-editor-write-root .irgeztne-project-landing .pl-number,
      .ns-editor-write-root .irgeztne-project-landing .pl-number * {
        background: var(--pl-text) !important;
        color: var(--pl-bg) !important;
        -webkit-text-fill-color: var(--pl-bg) !important;
      }

      .ns-editor-write-root .irgeztne-project-landing:not([data-theme="night"]) .pl-note,
      .ns-editor-write-root .irgeztne-project-landing:not([data-theme="night"]) .pl-note h2,
      .ns-editor-write-root .irgeztne-project-landing:not([data-theme="night"]) .pl-note p,
      .ns-editor-write-root .irgeztne-project-landing:not([data-theme="night"]) .pl-note .pl-eyebrow {
        color: #fff8ef !important;
        -webkit-text-fill-color: #fff8ef !important;
      }

      .ns-editor-write-root .irgeztne-project-landing[data-theme="night"] .pl-note,
      .ns-editor-write-root .irgeztne-project-landing[data-theme="night"] .pl-note h2,
      .ns-editor-write-root .irgeztne-project-landing[data-theme="night"] .pl-note p,
      .ns-editor-write-root .irgeztne-project-landing[data-theme="night"] .pl-note .pl-eyebrow {
        color: #17131a !important;
        -webkit-text-fill-color: #17131a !important;
      }

      .ns-editor-write-root .irgeztne-project-landing .pl-note .pl-button--primary,
      .ns-editor-write-root .irgeztne-project-landing .pl-note .pl-button--primary * {
        color: #fff !important;
        -webkit-text-fill-color: #fff !important;
      }

      @media (max-width: 980px) {
        .ns-editor-document-canvas__bar { flex-direction: column; align-items: stretch; }
        .ns-editor-document-canvas__viewport { padding: 18px; }
        .ns-editor-document-canvas .ns-editor-visual,
        .ns-editor-document-canvas .ns-editor-textarea--writer,
        .ns-editor-document-canvas .ns-editor-blocks { min-height: 460px; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }


  const TEMPLATE_LOCALE_OVERRIDES = {
    "website-starter": {
      en: {
        title: "Untitled Website",
        summary: "A clean one-page website starter for v1: top menu links go to real sections, not empty pages.",
        excerpt: "A one-page website starter prepared in IRGEZTNE Workspace.",
        seoTitle: "Untitled Website",
        seoDescription: "A one-page website starter prepared in IRGEZTNE Workspace.",
        visualHtml: `<section class="ns-page-section ns-page-hero ns-page-hero--split" id="home">
  <div class="ns-page-hero__content">
    <div class="ns-page-kicker">One-page Website Starter</div>
    <h1>Build a clear one-page website</h1>
    <p class="ns-page-lead">A simple starter for a project, author page, studio, or small publication. The top menu uses real sections: Home, About, Work, and Contact.</p>
    <div class="ns-page-actions">
      <a class="ns-page-button ns-page-button--primary" href="#contact">Contact</a>
      <a class="ns-page-button" href="#work">See work</a>
    </div>
  </div>
  <aside class="ns-page-panel ns-page-panel--feature">
    <div class="ns-page-panel__eyebrow">v1 structure</div>
    <strong>One page, working anchors</strong>
    <p>This starter is intentionally simple for the first release. Multi-page website templates can be added later.</p>
  </aside>
</section>
<section class="ns-page-section" id="about">
  <div class="ns-page-section__head">
    <h2>About</h2>
    <p>Explain who you are, what this project does, and why it matters.</p>
  </div>
  <div class="ns-page-grid ns-page-grid--two">
    <div class="ns-page-card">
      <span>Purpose</span>
      <strong>Clear first impression</strong>
      <p>Give visitors a short, direct explanation of the project or service.</p>
    </div>
    <div class="ns-page-card">
      <span>Format</span>
      <strong>Simple public page</strong>
      <p>Keep the page readable and easy to adapt before adding complex publishing features.</p>
    </div>
  </div>
</section>
<section class="ns-page-section" id="work">
  <div class="ns-page-section__head">
    <h2>Work</h2>
    <p>Show the most important directions, services, projects, or materials.</p>
  </div>
  <div class="ns-page-grid ns-page-grid--three">
    <div class="ns-page-card">
      <span>01</span>
      <strong>Direction</strong>
      <p>Describe the main work or service in one short paragraph.</p>
    </div>
    <div class="ns-page-card">
      <span>02</span>
      <strong>Project</strong>
      <p>Add one example, publication, case, or product direction.</p>
    </div>
    <div class="ns-page-card">
      <span>03</span>
      <strong>Next step</strong>
      <p>Tell visitors what to do next: contact, download, follow, or open the project.</p>
    </div>
  </div>
</section>
<section class="ns-page-section" id="contact">
  <div class="ns-page-callout">
    <div>
      <div class="ns-page-callout__eyebrow">Contact</div>
      <h2>Add the real contact path</h2>
      <p>Replace this placeholder with a real email, link, or contact message.</p>
    </div>
    <a class="ns-page-button ns-page-button--primary" href="mailto:hello@example.com">Write</a>
  </div>
</section>`,
        markdown: `# Build a clear one-page website

A simple starter for a project, author page, studio, or small publication.

## About

Explain who you are, what this project does, and why it matters.

## Work

Show the most important directions, services, projects, or materials.

## Contact

Add the real contact path.`,
        blocks: [
          { type: "heading-1", text: "Build a clear one-page website" },
          { type: "paragraph", text: "A simple starter for a project, author page, studio, or small publication." },
          { type: "heading-2", text: "About" },
          { type: "paragraph", text: "Explain who you are, what this project does, and why it matters." },
          { type: "heading-2", text: "Work" },
          { type: "paragraph", text: "Show the most important directions, services, projects, or materials." },
          { type: "heading-2", text: "Contact" },
          { type: "paragraph", text: "Add the real contact path." }
        ]
      }
    },
    "folder-website-starter": {
      en: {
        title: "Untitled Folder Website",
        summary: "A local file website starter loaded from the templates folder.",
        excerpt: "A website starter that now lives as a real JSON file.",
        seoTitle: "Untitled Folder Website",
        seoDescription: "A local file website starter loaded from the templates folder.",
        visualHtml: `<section class="ns-page-section ns-page-hero ns-page-hero--split"><div class="ns-page-hero__content"><div class="ns-page-kicker">Folder Website Starter</div><h1>Launch from a real template file</h1><p>This starter lives in the templates folder and loads into Catalog and Editor as a separate item.</p></div><aside class="ns-page-panel ns-page-panel--feature"><div class="ns-page-panel__eyebrow">Local file</div><strong>Real JSON template</strong><p>Keep templates separated from the JS incubator and extend them one by one.</p></aside></section><section class="ns-page-section" id="about"><div class="ns-page-section__head"><h2>About</h2><p>Describe the site, project, newsroom, or profile here.</p></div></section><section class="ns-page-section" id="services"><div class="ns-page-section__head"><h2>Sections</h2><p>Use cards, sections, and simple structure for a first publish path.</p></div></section><section class="ns-page-section" id="contact"><div class="ns-page-callout"><div><div class="ns-page-callout__eyebrow">Call to action</div><h2>Ready to publish?</h2><p>Add the final action here.</p></div><a class="ns-page-button ns-page-button--primary" href="mailto:hello@example.com">Contact</a></div></section>`,
        markdown: `# Launch from a real template file

This starter lives in the templates folder and loads into Catalog and Editor as a separate item.

## About

Describe the site, project, newsroom, or profile here.

## Sections

Use cards, sections, and simple structure for a first publish path.

## Call to action

Add the final action here.`,
        blocks: [
          { type: "heading-1", text: "Launch from a real template file" },
          { type: "paragraph", text: "This starter lives in the templates folder and loads into Catalog and Editor as a separate item." },
          { type: "heading-2", text: "About" },
          { type: "paragraph", text: "Describe the site, project, newsroom, or profile here." },
          { type: "heading-2", text: "Sections" },
          { type: "paragraph", text: "Use cards, sections, and simple structure for a first publish path." },
          { type: "heading-2", text: "Call to action" },
          { type: "paragraph", text: "Add the final action here." }
        ]
      }
    },
    "blog-post": {
      en: {
        title: "Untitled Blog Post",
        summary: "A readable article summary for cards, previews, and search snippets.",
        excerpt: "A stronger longform starter prepared in IRGEZTNE Workspace.",
        seoTitle: "Untitled Blog Post",
        seoDescription: "A stronger blog post starter prepared in IRGEZTNE Workspace.",
        visualHtml: `<article class="ns-page-section ns-post"><div class="ns-page-kicker">Blog Post</div><h1>Your article headline</h1><p class="ns-page-lead"><strong>Lead:</strong> Open with the strongest idea in one or two sentences.</p><div class="ns-page-meta-strip"><span>5 min read</span><span>Context</span><span>Analysis</span></div></article><section class="ns-page-section"><div class="ns-page-grid ns-page-grid--article"><div class="ns-page-prose"><p>Continue with the main text. Build rhythm with short readable paragraphs and strong transitions.</p><h2>Main point</h2><p>Add details, evidence, or explanation. Let each paragraph hold one idea.</p><blockquote>Use one compact quote or highlighted thought to add rhythm and emphasis.</blockquote><h2>Takeaway</h2><p>End with a useful closing, conclusion, or next step that leaves the reader with direction.</p></div><aside class="ns-page-panel ns-page-panel--sidebar"><div class="ns-page-panel__eyebrow">Article map</div><strong>Before publishing</strong><ul class="ns-page-list"><li>Check the headline</li><li>Tighten the lead</li><li>Check the final takeaway</li></ul></aside></div></section>`,
        markdown: `# Your article headline

**Lead:** Open with the strongest idea in one or two sentences.

Continue with the main text. Build rhythm with short readable paragraphs and strong transitions.

## Main point

Add details, evidence, or explanation. Let each paragraph hold one idea.

> Use one compact quote or highlighted thought to add rhythm and emphasis.

## Takeaway

End with a useful closing, conclusion, or next step that leaves the reader with direction.`,
        blocks: [
          { type: "heading-1", text: "Your article headline" },
          { type: "paragraph", text: "Lead: Open with the strongest idea in one or two sentences." },
          { type: "heading-2", text: "Main point" },
          { type: "paragraph", text: "Add details, evidence, or explanation. Let each paragraph hold one idea." },
          { type: "quote", text: "Use one compact quote or highlighted thought to add rhythm and emphasis." },
          { type: "heading-2", text: "Takeaway" },
          { type: "paragraph", text: "End with a useful closing, conclusion, or next step that leaves the reader with direction." }
        ]
      }
    },
    "folder-blog-post": {
      en: {
        title: "Untitled Folder Blog Post",
        summary: "A local file article template loaded from the templates folder.",
        excerpt: "A blog post starter that now lives as a real JSON file.",
        seoTitle: "Untitled Folder Blog Post",
        seoDescription: "A local file blog starter loaded from the templates folder.",
        visualHtml: `<article class="ns-page-section ns-post"><div class="ns-page-kicker">Folder Blog Post</div><h1>Your headline from the templates folder</h1><p class="ns-page-lead"><strong>Lead:</strong> Start with the strongest line and keep the opening tight.</p><h2>Main point</h2><p>Build the body with clear rhythm, evidence, and a clean transition.</p><blockquote>Use one compact quote or highlighted insight.</blockquote><h2>Takeaway</h2><p>Close with a useful ending, conclusion, or next step.</p></article>`,
        markdown: `# Your headline from the templates folder

**Lead:** Start with the strongest line and keep the opening tight.

## Main point

Build the body with clear rhythm, evidence, and a clean transition.

> Use one compact quote or highlighted insight.

## Takeaway

Close with a useful ending, conclusion, or next step.`,
        blocks: [
          { type: "heading-1", text: "Your headline from the templates folder" },
          { type: "paragraph", text: "Lead: Start with the strongest line and keep the opening tight." },
          { type: "heading-2", text: "Main point" },
          { type: "paragraph", text: "Build the body with clear rhythm, evidence, and a clean transition." },
          { type: "quote", text: "Use one compact quote or highlighted insight." },
          { type: "heading-2", text: "Takeaway" },
          { type: "paragraph", text: "Close with a useful ending, conclusion, or next step." }
        ]
      }
    },
    "vitrina-editorial-brief": {
      en: {
        title: "Untitled Editorial Brief",
        summary: "A stronger newsroom brief with key facts, a timeline, and a clear why-it-matters structure.",
        excerpt: "A stronger editorial starter prepared in IRGEZTNE Workspace.",
        seoTitle: "Untitled Editorial Brief",
        seoDescription: "A stronger editorial starter prepared in IRGEZTNE Workspace.",
        visualHtml: `<article class="ns-page-section ns-post"><div class="ns-page-kicker">Editorial Brief</div><h1>Main story headline</h1><p class="ns-page-lead"><strong>Lead:</strong> Start with the strongest confirmed fact, then tell the reader why this story matters now.</p><div class="ns-page-meta-strip"><span>Lead</span><span>Key facts</span><span>Next angle</span></div></article><section class="ns-page-section"><div class="ns-page-grid ns-page-grid--article"><div class="ns-page-prose"><h2>What happened</h2><p>Lay out the core event in a clear chronological block so the reader quickly understands the main line.</p><h2>Key facts</h2><p>Pull out three to five confirmed points that matter most for the brief.</p><blockquote>Use one short editorial note, quote, or line that locks the angle of the piece.</blockquote><h2>Why it matters</h2><p>Explain what changed, who it affects, and what the newsroom should watch next.</p></div><aside class="ns-page-panel ns-page-panel--sidebar"><div class="ns-page-panel__eyebrow">Coverage map</div><strong>Before publishing</strong><ul class="ns-page-list"><li>Check the lead fact</li><li>Verify names and dates</li><li>Add the next reporting angle</li></ul></aside></div></section><section class="ns-page-section"><div class="ns-page-grid ns-page-grid--two"><div class="ns-page-card"><strong>Timeline</strong><p>Add a short sequence of the important updates, decisions, or developments.</p></div><div class="ns-page-card"><strong>Next angle</strong><p>Note the follow-up question, missing evidence, or next reporting target.</p></div></div></section>`,
        markdown: `# Main story headline

**Lead:** Start with the strongest confirmed fact, then tell the reader why this story matters now.

## What happened

Lay out the core event in a clear chronological block so the reader quickly understands the main line.

## Key facts

Pull out three to five confirmed points that matter most for the brief.

## Why it matters

Explain what changed, who it affects, and what the newsroom should watch next.

## Next angle

Note the follow-up question, missing evidence, or next reporting target.`,
        blocks: [
          { type: "heading-1", text: "Main story headline" },
          { type: "paragraph", text: "Lead: Start with the strongest confirmed fact, then tell the reader why this story matters now." },
          { type: "heading-2", text: "What happened" },
          { type: "paragraph", text: "Lay out the core event in a clear chronological block so the reader quickly understands the main line." },
          { type: "heading-2", text: "Key facts" },
          { type: "paragraph", text: "Pull out three to five confirmed points that matter most for the brief." },
          { type: "heading-2", text: "Why it matters" },
          { type: "paragraph", text: "Explain what changed, who it affects, and what the newsroom should watch next." },
          { type: "heading-2", text: "Next angle" },
          { type: "paragraph", text: "Note the follow-up question, missing evidence, or next reporting target." }
        ]
      }
    },
    "folder-editorial-brief": {
      en: {
        title: "Untitled Folder Editorial Brief",
        summary: "A local file editorial brief loaded from the templates folder.",
        excerpt: "A newsroom starter that now lives as a real JSON file.",
        seoTitle: "Untitled Folder Editorial Brief",
        seoDescription: "A local file editorial brief loaded from the templates folder.",
        visualHtml: `<article class="ns-page-section ns-post"><div class="ns-page-kicker">Folder Editorial Brief</div><h1>Main story headline</h1><p><strong>Lead:</strong> Start with the strongest confirmed fact.</p><h2>What happened</h2><p>Lay out the core event in a clear block.</p><h2>Why it matters</h2><p>Explain why the story matters now and what to watch next.</p></article>`,
        markdown: `# Main story headline

**Lead:** Start with the strongest confirmed fact.

## What happened

Lay out the core event in a clear block.

## Why it matters

Explain why the story matters now and what to watch next.`,
        blocks: [
          { type: "heading-1", text: "Main story headline" },
          { type: "paragraph", text: "Lead: Start with the strongest confirmed fact." },
          { type: "heading-2", text: "What happened" },
          { type: "paragraph", text: "Lay out the core event in a clear block." },
          { type: "heading-2", text: "Why it matters" },
          { type: "paragraph", text: "Explain why the story matters now and what to watch next." }
        ]
      }
    },
    "vitrina-news-analysis": {
      en: {
        name: "News Analysis",
        title: "Untitled News Analysis",
        summary: "A short analysis summary for cards and previews.",
        excerpt: "An analysis starter focused on context, prepared in IRGEZTNE Workspace.",
        seoTitle: "Untitled News Analysis",
        seoDescription: "An analysis starter focused on context, prepared in IRGEZTNE Workspace.",
        visualHtml: `<article class="ns-page-section ns-post"><div class="ns-page-kicker">News Analysis</div><h1>Context headline</h1><p><strong>Lead:</strong> Frame the issue and explain why readers should care.</p><h2>Background</h2><p>Add history, context, and the relevant timeline.</p><h2>Signals</h2><p>Pull out the strongest facts, patterns, or contradictions.</p><h2>Conclusion</h2><p>Close with a calm conclusion and the next thing to watch.</p></article>`,
        markdown: `# Context headline

**Lead:** Frame the issue and explain why readers should care.

## Background

Add history, context, and the relevant timeline.

## Signals

Pull out the strongest facts, patterns, or contradictions.

## Conclusion

Close with a calm conclusion and the next thing to watch.`,
        blocks: [
          { type: "heading-1", text: "Context headline" },
          { type: "paragraph", text: "Lead: Frame the issue and explain why readers should care." },
          { type: "heading-2", text: "Background" },
          { type: "paragraph", text: "Add history, context, and the relevant timeline." },
          { type: "heading-2", text: "Signals" },
          { type: "paragraph", text: "Pull out the strongest facts, patterns, or contradictions." },
          { type: "heading-2", text: "Conclusion" },
          { type: "paragraph", text: "Close with a calm conclusion and the next thing to watch." }
        ]
      }
    },
    "vitrina-press-landing": {
      en: {
        title: "Untitled Press Landing",
        summary: "A stronger landing summary with a headline, coverage, highlights, and a contact path.",
        excerpt: "A stronger landing page starter prepared in IRGEZTNE Workspace.",
        seoTitle: "Untitled Press Landing",
        seoDescription: "A stronger landing page starter prepared in IRGEZTNE Workspace.",
        visualHtml: `<section class="ns-page-section ns-page-hero ns-page-hero--split" id="overview"><div class="ns-page-hero__content"><div class="ns-page-kicker">Press Landing</div><h1>Project or newsroom title</h1><p>Use this page as the entry point for a small newsroom, studio, campaign, or publication that needs one clean public landing page.</p><div class="ns-page-actions"><a class="ns-page-button ns-page-button--primary" href="#contact">Contact</a><a class="ns-page-button" href="#coverage">Coverage</a></div></div><aside class="ns-page-panel ns-page-panel--feature"><div class="ns-page-panel__eyebrow">Front page</div><strong>Ready public landing</strong><p>Headline, coverage, highlights, publication links, and a final contact path are already prepared so the page feels like a real public-facing site.</p><ul class="ns-page-list"><li>Headline with actions</li><li>Coverage and highlights</li><li>Contact and public links</li></ul></aside></section><section class="ns-page-section" id="coverage"><div class="ns-page-section__head"><h2>Coverage</h2><p>Describe the beat, publication focus, campaign direction, or product coverage in three clear cards.</p></div><div class="ns-page-grid ns-page-grid--three"><div class="ns-page-card"><span>Beat</span><strong>Main topic</strong><p>Explain the main topic, focus area, or reporting direction.</p></div><div class="ns-page-card"><span>Format</span><strong>What you publish</strong><p>Say whether this is articles, releases, explainers, interviews, or project updates.</p></div><div class="ns-page-card"><span>Audience</span><strong>Who it is for</strong><p>Show who should read, contact, or follow this work.</p></div></div></section><section class="ns-page-section" id="highlights"><div class="ns-page-section__head"><h2>Highlights</h2><p>Use this section for featured releases, recent stories, key links, or press materials.</p></div><div class="ns-page-grid ns-page-grid--two"><div class="ns-page-card"><strong>Recent release or story</strong><p>Add the latest important update or featured publication here.</p></div><div class="ns-page-card"><strong>Press kit or key link</strong><p>Use this card for media contacts, download links, or a core project document.</p></div></div></section><section class="ns-page-section" id="contact"><div class="ns-page-callout"><div><div class="ns-page-callout__eyebrow">Contact</div><h2>Ready to point people to the right place?</h2><p>Add the newsroom email, press contact, project channel, or subscription path here.</p></div><a class="ns-page-button ns-page-button--primary" href="mailto:hello@example.com">Contact</a></div></section>`,
        markdown: `# Project or newsroom title

Use this page as the entry point for a small newsroom, studio, campaign, or publication that needs one clean public landing page.

## Coverage

- Main topic
- What you publish
- Who it is for

## Highlights

Add the main releases, recent stories, or press materials.

## Contact

Add the newsroom email, press contact, project channel, or subscription path here.`,
        blocks: [
          { type: "heading-1", text: "Project or newsroom title" },
          { type: "paragraph", text: "Use this page as the entry point for a small newsroom, studio, campaign, or publication that needs one clean public landing page." },
          { type: "heading-2", text: "Coverage" },
          { type: "list", text: "Main topic\nWhat you publish\nWho it is for" },
          { type: "heading-2", text: "Highlights" },
          { type: "paragraph", text: "Add the main releases, recent stories, or press materials." },
          { type: "heading-2", text: "Contact" },
          { type: "paragraph", text: "Add the newsroom email, press contact, project channel, or subscription path here." }
        ]
      }
    }
  };

  function getTemplate(templateId) {
    const library = getTemplateLibrary();
    const shared = library && typeof library.getTemplate === "function" ? library.getTemplate(templateId) : null;
    const templates = getCurrentTemplates();
    return shared || templates.find((item) => item.id === templateId) || templates[0];
  }

  function getTemplateForLocale(templateId, locale) {
    const base = deepClone(getTemplate(templateId) || {});
    if (!base || !base.defaults) return base;
    const nextLocale = normalizeLocale(locale || getUiLanguage());
    const override = TEMPLATE_LOCALE_OVERRIDES[String(base.id || templateId || "")];
    if (!override || !override[nextLocale]) return base;
    const localized = override[nextLocale];
    base.name = String(localized.name || base.name || "");
    base.description = String(localized.description || base.description || "");
    base.defaults = Object.assign({}, base.defaults, localized);
    if (Array.isArray(localized.blocks)) {
      base.defaults.blocks = deepClone(localized.blocks);
    }
    return base;
  }

  function localizeDraftIfTemplateDefault(rawDraft, locale) {
    const draft = deepClone(rawDraft || {});
    if (!draft || !draft.templateId) return draft;

    const targetLocale = normalizeLocale(locale || getUiLanguage());
    const targetTemplate = getTemplateForLocale(draft.templateId, targetLocale);
    if (!targetTemplate || !targetTemplate.defaults) {
      draft.locale = targetLocale;
      return draft;
    }

    const knownTemplates = ["en", "ru"].map((item) => getTemplateForLocale(draft.templateId, item)).filter(Boolean);
    const nextMeta = Object.assign({}, draft.meta || {});
    const nextWrite = Object.assign({}, draft.write || {});

    const pickLocalizedValue = (currentValue, extractor) => {
      const currentText = String(currentValue || "");
      for (const template of knownTemplates) {
        const candidate = String(extractor(template) || "");
        if (candidate && candidate === currentText) {
          return extractor(targetTemplate) || currentValue;
        }
      }
      return currentValue;
    };

    nextMeta.title = pickLocalizedValue(nextMeta.title, (tpl) => tpl.defaults.title);
    nextMeta.kicker = pickLocalizedValue(nextMeta.kicker, (tpl) => tpl.defaults.kicker);
    nextMeta.author = pickLocalizedValue(nextMeta.author, (tpl) => tpl.defaults.author);
    nextMeta.summary = pickLocalizedValue(nextMeta.summary, (tpl) => tpl.defaults.summary);
    nextMeta.excerpt = pickLocalizedValue(nextMeta.excerpt, (tpl) => tpl.defaults.excerpt);
    nextMeta.seoTitle = pickLocalizedValue(nextMeta.seoTitle, (tpl) => tpl.defaults.seoTitle);
    nextMeta.seoDescription = pickLocalizedValue(nextMeta.seoDescription, (tpl) => tpl.defaults.seoDescription);

    for (const template of knownTemplates) {
      if (String(nextWrite.visualHtml || "") === String(template.defaults.visualHtml || "")) {
        nextWrite.visualHtml = targetTemplate.defaults.visualHtml;
        break;
      }
    }
    for (const template of knownTemplates) {
      if (String(nextWrite.markdown || "") === String(template.defaults.markdown || "")) {
        nextWrite.markdown = targetTemplate.defaults.markdown;
        break;
      }
    }
    for (const template of knownTemplates) {
      if (JSON.stringify(normalizeBlocks(nextWrite.blocks || [], template)) === JSON.stringify(normalizeBlocks(template.defaults.blocks, template))) {
        nextWrite.blocks = deepClone(targetTemplate.defaults.blocks);
        break;
      }
    }

    draft.locale = targetLocale;
    draft.meta = nextMeta;
    draft.write = nextWrite;
    draft.content = Object.assign({}, draft.content || {}, { body: buildBodyFromWrite(nextWrite) });
    draft.project = Object.assign({}, draft.project || {});
    if (!draft.project.name || draft.project.name === String(rawDraft?.meta?.title || "")) {
      draft.project.name = nextMeta.title;
    }
    if (!draft.meta.slug) {
      draft.meta.slug = slugify(nextMeta.title) || draft.meta.slug || uid("draft");
    }
    return draft;
  }

  function normalizeWriteMode(value) {
    return STABLE_EDITOR_MODE;
  }

  function normalizeWriteTheme(value) {
    return String(value || "").toLowerCase() === "dark" ? "dark" : "light";
  }

  function normalizeCabinetTab(value) {
    return CABINET_TABS.includes(value) ? value : "write";
  }

  function normalizeWorkspaceTab(value) {
    return WORKSPACE_TABS.includes(value) ? value : "draft";
  }

  function normalizeBlockType(value) {
    return VALID_BLOCK_TYPES.includes(value) ? value : "paragraph";
  }

  function ensureBlockId(block, index) {
    return block?.id || uid(`block${index || 0}`);
  }

  function normalizeBlocks(blocks, template) {
    const source = Array.isArray(blocks) ? blocks : template.defaults.blocks;
    return source.map((block, index) => ({
      id: ensureBlockId(block, index),
      type: normalizeBlockType(block?.type),
      text: String(block?.text || "")
    }));
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let paragraph = [];
    let list = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!list.length) return;
      html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }

    lines.forEach((line) => {
      const trimmed = String(line || "").trim();
      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      if (/^#{1,6}\s+/.test(trimmed)) {
        flushParagraph();
        flushList();
        const level = Math.min(trimmed.match(/^#+/)[0].length, 6);
        html.push(`<h${level}>${inlineMarkdown(trimmed.replace(/^#{1,6}\s+/, ""))}</h${level}>`);
        return;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        flushParagraph();
        list.push(trimmed.replace(/^[-*]\s+/, ""));
        return;
      }

      if (/^>\s+/.test(trimmed)) {
        flushParagraph();
        flushList();
        html.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s+/, ""))}</blockquote>`);
        return;
      }

      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    return html.join("\n");
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function htmlToPlainText(html) {
    const host = document.createElement("div");
    host.innerHTML = String(html || "");
    return host.textContent || host.innerText || "";
  }

  function blocksToHtml(blocks) {
    return normalizeBlocks(blocks, getTemplate(DEFAULT_TEMPLATE_ID)).map((block) => {
      const text = escapeHtml(block.text || "");
      if (block.type === "heading-1") return `<h1>${text}</h1>`;
      if (block.type === "heading-2") return `<h2>${text}</h2>`;
      if (block.type === "quote") return `<blockquote>${text}</blockquote>`;
      if (block.type === "list") {
        const items = String(block.text || "")
          .split(/\n+/)
          .map((item) => item.trim())
          .filter(Boolean);
        return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
      return `<p>${text}</p>`;
    }).join("\n");
  }

  function blocksToMarkdown(blocks) {
    return normalizeBlocks(blocks, getTemplate(DEFAULT_TEMPLATE_ID)).map((block) => {
      if (block.type === "heading-1") return `# ${block.text}`;
      if (block.type === "heading-2") return `## ${block.text}`;
      if (block.type === "quote") return `> ${block.text}`;
      if (block.type === "list") {
        return String(block.text || "")
          .split(/\n+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => `- ${item}`)
          .join("\n");
      }
      return block.text;
    }).join("\n\n");
  }

  function textToBlocks(text) {
    const parts = String(text || "")
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      return [{ id: uid("block"), type: "paragraph", text: "" }];
    }

    return parts.map((part, index) => ({
      id: uid("block"),
      type: index === 0 ? "heading-1" : "paragraph",
      text: part
    }));
  }

  function buildBodyFromWrite(write) {
    if (!write) return "";
    if (write.mode === "visual") {
      return htmlToPlainText(write.visualHtml).trim();
    }
    if (write.mode === "markdown") {
      return String(write.markdown || "").trim();
    }
    return normalizeBlocks(write.blocks, getTemplate(DEFAULT_TEMPLATE_ID))
      .map((block) => block.text.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function buildPreviewHtmlFromWrite(write) {
    if (!write) return "";
    if (write.mode === "visual") return String(write.visualHtml || "");
    if (write.mode === "markdown") return markdownToHtml(write.markdown || "");
    return blocksToHtml(write.blocks || []);
  }

  function createWriteState(template) {
    return {
      mode: STABLE_EDITOR_MODE,
      theme: normalizeWriteTheme(template.defaults && template.defaults.theme ? template.defaults.theme : STABLE_EDITOR_THEME),
      visualHtml: template.defaults.visualHtml,
      markdown: template.defaults.markdown,
      blocks: normalizeBlocks(template.defaults.blocks, template),
      activeCabinetTab: "write",
      activeWorkspaceTab: "draft"
    };
  }

  function createDeployState(slug) {
    return {
      manual: {
        fileName: `${slug || "untitled"}.html`
      },
      sftp: {
        host: "",
        port: "22",
        username: "",
        remotePath: `/public_html/${slug || "untitled"}/`
      },
      github: {
        repo: "",
        branch: "main",
        folder: "/",
        customDomain: ""
      },
      netlify: {
        siteName: "",
        publishDir: "/",
        customDomain: ""
      },
      vercel: {
        projectName: "",
        outputDir: "/",
        customDomain: ""
      }
    };
  }

  function createDraft(templateId, options) {
    const locale = normalizeLocale(options && options.locale ? options.locale : getUiLanguage());
    const template = getTemplateForLocale(templateId, locale);
    const title = template.defaults.title;
    const slug = slugify(title) || uid("draft");
    const time = nowIso();
    const write = createWriteState(template);

    return {
      id: uid("draft"),
      templateId: template.id,
      locale,
      status: "draft",
      createdAt: time,
      updatedAt: time,
      project: {
        name: title,
        slug
      },
      meta: {
        title,
        slug,
        author: template.defaults.author,
        category: template.category,
        kicker: template.defaults.kicker,
        summary: template.defaults.summary,
        excerpt: template.defaults.excerpt,
        seoTitle: template.defaults.seoTitle,
        seoDescription: template.defaults.seoDescription,
        keywords: [...template.defaults.keywords],
        tags: [...template.defaults.tags]
      },
      content: {
        body: buildBodyFromWrite(write)
      },
      write,
      deploy: createDeployState(slug),
      projectId: "",
      linkedFileIds: [],
      linkedNoteIds: [],
      output: {
        files: [...OUTPUT_FILES]
      }
    };
  }

  function migrateDraft(rawDraft) {
    const draft = deepClone(rawDraft || {});
    const template = getTemplate(draft.templateId);
    const inferredLocale = draft && draft.locale
      ? normalizeLocale(draft.locale)
      : (hasCyrillic((draft && draft.meta && draft.meta.title) || '') || hasCyrillic((draft && draft.content && draft.content.body) || '') || hasCyrillic((draft && draft.write && draft.write.visualHtml) || '') ? 'ru' : 'en');
    const title = draft?.meta?.title || template.defaults.title;
    const slug = slugify(draft?.meta?.slug || draft?.project?.slug || title) || uid("draft");

    const write = draft.write
      ? {
          mode: STABLE_EDITOR_MODE,
          theme: normalizeWriteTheme(draft.write.theme || template.defaults.theme || STABLE_EDITOR_THEME),
          visualHtml: String(draft.write.visualHtml || template.defaults.visualHtml),
          markdown: String(draft.write.markdown || draft.content?.body || template.defaults.markdown),
          blocks: normalizeBlocks(draft.write.blocks, template),
          activeCabinetTab: normalizeCabinetTab(draft.write.activeCabinetTab),
          activeWorkspaceTab: normalizeWorkspaceTab(draft.write.activeWorkspaceTab)
        }
      : {
          mode: STABLE_EDITOR_MODE,
          theme: normalizeWriteTheme(template.defaults.theme || STABLE_EDITOR_THEME),
          visualHtml: draft.content?.body
            ? bodyToParagraphs(draft.content.body).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
            : template.defaults.visualHtml,
          markdown: draft.content?.body || template.defaults.markdown,
          blocks: textToBlocks(draft.content?.body || template.defaults.markdown),
          activeCabinetTab: "write",
          activeWorkspaceTab: "draft"
        };

    const deploy = {
      manual: {
        fileName: draft?.deploy?.manual?.fileName || `${slug}.html`
      },
      sftp: {
        host: draft?.deploy?.sftp?.host || "",
        port: draft?.deploy?.sftp?.port || "22",
        username: draft?.deploy?.sftp?.username || "",
        remotePath: draft?.deploy?.sftp?.remotePath || `/public_html/${slug}/`
      },
      github: {
        repo: draft?.deploy?.github?.repo || "",
        branch: draft?.deploy?.github?.branch || "main",
        folder: draft?.deploy?.github?.folder || "/",
        customDomain: draft?.deploy?.github?.customDomain || ""
      },
      netlify: {
        siteName: draft?.deploy?.netlify?.siteName || "",
        publishDir: draft?.deploy?.netlify?.publishDir || "/",
        customDomain: draft?.deploy?.netlify?.customDomain || ""
      },
      vercel: {
        projectName: draft?.deploy?.vercel?.projectName || "",
        outputDir: draft?.deploy?.vercel?.outputDir || "/",
        customDomain: draft?.deploy?.vercel?.customDomain || ""
      }
    };

    return {
      id: draft.id || uid("draft"),
      templateId: template.id,
      locale: inferredLocale,
      status: draft.status || "draft",
      createdAt: draft.createdAt || nowIso(),
      updatedAt: draft.updatedAt || nowIso(),
      project: {
        name: title,
        slug
      },
      meta: {
        title,
        slug,
        author: draft?.meta?.author || template.defaults.author,
        category: draft?.meta?.category || template.category,
        kicker: draft?.meta?.kicker || template.defaults.kicker,
        summary: draft?.meta?.summary || template.defaults.summary,
        excerpt: draft?.meta?.excerpt || draft?.meta?.summary || template.defaults.excerpt,
        seoTitle: draft?.meta?.seoTitle || draft?.meta?.title || title,
        seoDescription: draft?.meta?.seoDescription || draft?.meta?.summary || template.defaults.seoDescription,
        keywords: parseTags(draft?.meta?.keywords || template.defaults.keywords),
        tags: parseTags(draft?.meta?.tags || template.defaults.tags)
      },
      content: {
        body: draft?.content?.body || buildBodyFromWrite(write)
      },
      write,
      deploy,
      projectId: draft?.projectId ? String(draft.projectId) : "",
      linkedFileIds: uniqueIds(draft?.linkedFileIds),
      linkedNoteIds: uniqueIds(draft?.linkedNoteIds),
      output: {
        files: Array.isArray(draft?.output?.files) && draft.output.files.length ? [...draft.output.files] : [...OUTPUT_FILES]
      }
    };
  }

  class EditorStore {
    constructor() {
      this.state = this.read();
    }

    read() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return { version: 2, drafts: [], activeDraftId: null };
        }

        const parsed = JSON.parse(raw);
        return {
          version: 2,
          drafts: Array.isArray(parsed.drafts) ? parsed.drafts.map((draft) => migrateDraft(draft)) : [],
          activeDraftId: parsed.activeDraftId || null
        };
      } catch (error) {
        console.warn("[NSEditorV1] Failed to read store:", error);
        return { version: 2, drafts: [], activeDraftId: null };
      }
    }

    write() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    getDrafts() {
      return [...this.state.drafts].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }

    getDraft(id) {
      const draft = this.state.drafts.find((item) => item.id === id);
      return draft ? migrateDraft(draft) : null;
    }

    saveDraft(draft) {
      const payload = migrateDraft(draft);
      payload.updatedAt = nowIso();

      const index = this.state.drafts.findIndex((item) => item.id === payload.id);
      if (index === -1) {
        this.state.drafts.push(payload);
      } else {
        this.state.drafts[index] = payload;
      }

      this.state.activeDraftId = payload.id;
      this.write();
      return deepClone(payload);
    }

    deleteDraft(id) {
      this.state.drafts = this.state.drafts.filter((draft) => draft.id !== id);
      if (this.state.activeDraftId === id) {
        this.state.activeDraftId = this.state.drafts[0]?.id || null;
      }
      this.write();
    }

    deleteDrafts(ids) {
      const set = new Set((Array.isArray(ids) ? ids : []).map((item) => String(item || '')));
      if (!set.size) return;
      this.state.drafts = this.state.drafts.filter((draft) => !set.has(String(draft.id || '')));
      if (!this.state.drafts.some((draft) => draft.id === this.state.activeDraftId)) {
        this.state.activeDraftId = this.state.drafts[0]?.id || null;
      }
      this.write();
    }

    clearDrafts(options = {}) {
      const keepId = options && options.keepId ? String(options.keepId) : '';
      this.state.drafts = this.state.drafts.filter((draft) => keepId && String(draft.id) === keepId);
      this.state.activeDraftId = keepId && this.state.drafts[0] ? keepId : (this.state.drafts[0]?.id || null);
      this.write();
    }

    setActiveDraft(id) {
      this.state.activeDraftId = id;
      this.write();
    }
  }

  function buildPageJson(draft) {
    return {
      version: 2,
      projectId: draft.projectId || "",
      templateId: draft.templateId,
      locale: draft.locale || "ru",
      status: draft.status,
      title: draft.meta.title,
      slug: draft.meta.slug,
      author: draft.meta.author,
      category: draft.meta.category,
      kicker: draft.meta.kicker,
      summary: draft.meta.summary,
      excerpt: draft.meta.excerpt,
      seoTitle: draft.meta.seoTitle,
      seoDescription: draft.meta.seoDescription,
      keywords: draft.meta.keywords,
      tags: draft.meta.tags,
      writeMode: draft.write.mode,
      body: draft.content.body,
      html: buildPreviewHtmlFromWrite(draft.write),
      blocks: draft.write.blocks,
      linkedFileIds: uniqueIds(draft.linkedFileIds),
      linkedNoteIds: uniqueIds(draft.linkedNoteIds),
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt
    };
  }

  function buildMetaJson(draft) {
    const template = getTemplate(draft.templateId);
    return {
      version: 2,
      projectId: draft.projectId || "",
      status: draft.status,
      locale: draft.locale || "ru",
      template: {
        id: template.id,
        name: template.name,
        category: template.category
      },
      project: draft.project,
      relations: {
        projectId: draft.projectId || "",
        linkedFileIds: uniqueIds(draft.linkedFileIds),
        linkedNoteIds: uniqueIds(draft.linkedNoteIds)
      },
      output: {
        index: "index.html",
        styles: "styles.css",
        content: "content/page.json",
        meta: "meta.json"
      },
      write: {
        mode: draft.write.mode,
        cabinetTab: draft.write.activeCabinetTab,
        workspaceTab: draft.write.activeWorkspaceTab
      },
      deploy: deepClone(draft.deploy),
      timestamps: {
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      }
    };
  }

  function buildProjectLandingBrandMarkup(siteProfile, siteHeaderName, siteHeaderMeta) {
    const name = String(siteHeaderName || siteProfile.siteName || DEFAULT_SITE_PROFILE.siteName || "Project Studio").trim();
    const meta = String(siteHeaderMeta || siteProfile.tagline || DEFAULT_SITE_PROFILE.tagline || "").trim();
    const logoMarkup = siteProfile.logoPath
      ? `<span class="pl-logo pl-logo--image" aria-hidden="true"><img src="${escapeHtml(normalizeAppAssetPath(siteProfile.logoPath))}" alt="" /></span>`
      : "";
    return `<a class="pl-brand${logoMarkup ? "" : " pl-brand--text-only"}" href="#home" aria-label="${escapeHtml(name)} home" style="text-decoration:none;color:inherit;">
        ${logoMarkup}
        <span>
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(meta)}</span>
        </span>
      </a>`;
  }

  function buildProjectLandingNavMarkup(navItems) {
    const anchors = ["#home", "#service", "#work", "#contact"];
    const items = (Array.isArray(navItems) && navItems.length ? navItems : DEFAULT_SITE_PROFILE.navItems)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    return `<nav class="pl-nav" aria-label="Project navigation">
        ${items.map((item, index) => `<a href="${escapeHtml(anchors[index] || "#")}">${escapeHtml(item)}</a>`).join("\n        ")}
      </nav>`;
  }

  function applySiteIdentityToProjectLanding(html, siteProfile, siteHeaderName, siteHeaderMeta) {
    const source = String(html || "");
    if (!source || !source.includes("irgeztne-project-landing")) return source;
    const profile = normalizeSiteProfile(siteProfile);
    let next = source;
    const brandMarkup = buildProjectLandingBrandMarkup(profile, siteHeaderName, siteHeaderMeta);
    next = next.replace(/<a class="pl-brand[^"]*"[\s\S]*?<\/a>\s*(?=<nav class="pl-nav")/i, `${brandMarkup}\n\n      `);
    const navMarkup = buildProjectLandingNavMarkup(profile.navItems);
    next = next.replace(/<nav class="pl-nav"[\s\S]*?<\/nav>/i, navMarkup);
    return next;
  }

  function buildIndexHtml(draft) {
    const previewHtml = buildPreviewHtmlFromWrite(draft.write);
    const categoryClass = slugify(draft.meta.category || "page") || "page";
    const templateClass = slugify(draft.templateId || categoryClass || "page") || "page";
    const locale = normalizeLocale(draft && draft.locale ? draft.locale : getUiLanguage());
    const siteLabelMap = locale === 'ru'
      ? {
          blog: "Предпросмотр статьи",
          article: "Редакционный предпросмотр",
          analysis: "Предпросмотр анализа",
          website: "Предпросмотр сайта",
          press: "Предпросмотр пресс-страницы"
        }
      : {
          blog: "Article Preview",
          article: "Editorial Preview",
          analysis: "Analysis Preview",
          website: "Website Preview",
          press: "Press Landing Preview"
        };
    const siteLabel = siteLabelMap[categoryClass] || (locale === 'ru' ? "Предпросмотр страницы" : "Page Preview");
    const isSitePreview = /website|press/.test(categoryClass);
    const siteProfile = getSiteProfile();
    const untitledSite = locale === 'ru' ? 'Сайт без названия' : 'Untitled Site';
    const untitledDraft = locale === 'ru' ? 'Без названия' : 'Untitled';
    const siteHeaderName = isSitePreview ? (siteProfile.siteName || draft.meta.title || untitledSite) : (draft.meta.title || untitledDraft);
    const siteHeaderMeta = isSitePreview
      ? (siteProfile.tagline || draft.meta.summary || `${draft.meta.author} · ${draft.meta.category || siteLabel}`)
      : (draft.meta.summary || `${draft.meta.author} · ${draft.meta.category || siteLabel}`);
    const siteTitle = draft.meta.title || siteHeaderName || "Untitled";
    const isOnePageWebsiteStarter = isSitePreview && String(draft.templateId || "") === "website-starter";
    const navItems = /blog|article|analysis/.test(categoryClass)
      ? (locale === "ru" ? ["Последнее", "Темы", "Архив"] : ["Latest", "Topics", "Archive"])
      : (isOnePageWebsiteStarter
        ? (locale === "ru" ? ["Главная", "О проекте", "Работа", "Контакт"] : ["Home", "About", "Work", "Contact"])
        : (Array.isArray(siteProfile.navItems) && siteProfile.navItems.length ? siteProfile.navItems : (locale === "ru" ? ["Обзор", "Услуги", "Контакт"] : ["Overview", "Services", "Contact"])));
    const navAnchors = isOnePageWebsiteStarter
      ? ["#home", "#about", "#work", "#contact"]
      : navItems.map(() => "#");
    const siteContactEmail = String(siteProfile.contactEmail || DEFAULT_SITE_PROFILE.contactEmail || "hello@example.com").trim();
    const siteFooterText = String(siteProfile.footerText || DEFAULT_SITE_PROFILE.footerText || "Сделано в IRGEZTNE").trim();
    const siteFaviconPath = String(siteProfile.faviconPath || DEFAULT_SITE_PROFILE.faviconPath || "").trim() || (isSitePreview
      ? buildGeneratedFaviconDataUrl({
          letters: getInitials(siteHeaderName),
          background: siteProfile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor,
          foreground: "#ffffff",
          shape: "rounded"
        })
      : "");
    const previewHtmlResolved = isSitePreview
      ? applySiteIdentityToProjectLanding(previewHtml, siteProfile, siteHeaderName, siteHeaderMeta)
          .replace(/mailto:hello@example\.com/gi, `mailto:${siteContactEmail}`)
          .replace(/hello@example\.com/gi, siteContactEmail)
      : previewHtml;
    const brandMedia = isSitePreview && siteProfile.logoPath
      ? `<img class="ns-preview-site-brand__logo" src="${escapeHtml(normalizeAppAssetPath(siteProfile.logoPath))}" alt="${escapeHtml(siteProfile.logoAlt || siteHeaderName)}" />`
      : "";
    const brandMarkup = isSitePreview
      ? `<div class="ns-preview-site-brand">
        ${brandMedia}
        <div class="ns-preview-site-brand__body">
          <span class="ns-preview-label">${escapeHtml(siteLabel)}</span>
          <div class="ns-preview-site-brand__name">${escapeHtml(siteHeaderName)}</div>
          <p class="ns-preview-site-brand__meta">${escapeHtml(siteHeaderMeta)}</p>
        </div>
      </div>`
      : `<div class="ns-preview-brand">
        <span class="ns-preview-label">${escapeHtml(siteLabel)}</span>
        <h1>${escapeHtml(siteTitle)}</h1>
        <p>${escapeHtml(draft.meta.author)} · ${escapeHtml(draft.meta.category || siteLabel)}</p>
      </div>`;
    const heroMarkup = isSitePreview
      ? ""
      : `<section class="ns-preview-hero">
      <div class="ns-preview-hero__eyebrow">${escapeHtml(draft.meta.kicker || siteLabel)}</div>
      <div class="ns-preview-hero__title">${escapeHtml(siteTitle)}</div>
      <p class="ns-preview-hero__summary">${escapeHtml(draft.meta.summary || "")}</p>
    </section>`;

    return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(draft.meta.seoTitle || siteTitle || siteHeaderName || "Черновик без названия")}</title>
  <meta name="description" content="${escapeHtml(draft.meta.seoDescription || draft.meta.summary || siteHeaderMeta || "")}" />
  <meta name="keywords" content="${escapeHtml(tagsToString(draft.meta.keywords || []))}" />
  ${buildFaviconLinkMarkup(siteFaviconPath)}
  <link rel="stylesheet" href="./styles.css" />
</head>
<body class="ns-preview ns-preview--${escapeHtml(categoryClass)} ns-preview-theme--${escapeHtml(templateClass)}" style="--page-accent:${escapeHtml(siteProfile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor)};--page-accent-strong:${escapeHtml(siteProfile.accentColor || DEFAULT_SITE_PROFILE.accentColor)};">
  <div class="ns-preview-shell">
    <header class="ns-preview-topbar${isSitePreview ? " ns-preview-topbar--site" : ""}">
      ${brandMarkup}
      <nav class="ns-preview-nav">
        ${navItems.map((item, index) => `<a href="${escapeHtml(navAnchors[index] || "#")}">${escapeHtml(item)}</a>`).join("")}
      </nav>
    </header>

    ${heroMarkup}

    <main class="ns-preview-main${isSitePreview ? " ns-preview-main--site" : ""}">
      <article class="ns-preview-page ns-preview-page--${escapeHtml(categoryClass)}${isSitePreview ? " ns-preview-page--site" : ""}">
        <div class="ns-page__body">${previewHtmlResolved}</div>
        <div class="ns-page__tags">
          ${(draft.meta.tags || []).map((tag) => `<span class="ns-page__tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </article>
    </main>

    <footer class="ns-preview-footer">
      <span>${escapeHtml(siteFooterText || "Локальный пакет предпросмотра")}</span>
      <span class="ns-preview-footer__right">
        ${siteContactEmail ? `<a class="ns-preview-footer__link" href="mailto:${escapeHtml(siteContactEmail)}">${escapeHtml(siteContactEmail)}</a>` : ""}
        <span>${escapeHtml(draft.meta.seoTitle || siteTitle || siteHeaderName || "Черновик без названия")}</span>
      </span>
    </footer>
  </div>
</body>
</html>`;
  }

  function buildStylesCss() {
    return `:root {
  --page-bg: #f5f0ea;
  --page-surface: rgba(255, 255, 255, 0.84);
  --page-panel: rgba(255, 255, 255, 0.92);
  --page-card: rgba(255, 255, 255, 0.94);
  --page-text: #2f241d;
  --page-muted: #756456;
  --page-border: rgba(103, 77, 52, 0.12);
  --page-accent: #9a6b40;
  --page-accent-strong: #724729;
  --page-shadow: 0 20px 50px rgba(52, 38, 28, 0.10);
  --page-radius: 24px;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background: linear-gradient(180deg, #f8f4ef 0%, #efe6db 100%);
  color: var(--page-text);
  font-family: Inter, Arial, sans-serif;
}
body {
  padding: 0;
}
a { color: inherit; }
.ns-preview-shell {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
.ns-preview-topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--page-border);
}
.ns-preview-brand {
  min-width: 0;
}
.ns-preview-label,
.ns-preview-hero__eyebrow,
.ns-page-kicker,
.ns-page__kicker,
.ns-page-panel__eyebrow,
.ns-page-callout__eyebrow {
  display: inline-block;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--page-accent);
}
.ns-preview-brand h1 {
  margin: 10px 0 4px;
  font-size: clamp(26px, 4vw, 44px);
  line-height: 1.05;
}
.ns-preview-brand p {
  margin: 0;
  color: var(--page-muted);
  font-size: 14px;
}
.ns-preview-site-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.ns-preview-site-brand__mark {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 56px;
  background: linear-gradient(180deg, var(--page-accent), var(--page-accent-strong));
  color: #fff8f1;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.08em;
  box-shadow: 0 14px 30px rgba(64, 41, 22, 0.16);
}
.ns-preview-site-brand__logo {
  display: block;
  width: auto;
  max-width: min(180px, 28vw);
  height: 44px;
  object-fit: contain;
  object-position: left center;
  flex: 0 0 auto;
}
.ns-preview-site-brand__body {
  min-width: 0;
}
.ns-preview-site-brand__name {
  margin-top: 8px;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.04;
  font-weight: 800;
}
.ns-preview-site-brand__meta {
  margin: 8px 0 0;
  max-width: 62ch;
  color: var(--page-muted);
  font-size: 14px;
  line-height: 1.55;
}
.ns-preview-nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ns-preview-nav a {
  padding: 10px 0;
  color: var(--page-muted);
  text-decoration: none;
  font-size: 13px;
  border-bottom: 1px solid transparent;
}
.ns-preview-nav a:hover {
  color: var(--page-text);
  border-bottom-color: var(--page-accent);
}
.ns-page-site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px;
  margin: 0 0 18px;
  border: 1px solid var(--page-border);
  border-radius: 18px;
  background: rgba(255, 250, 244, 0.88);
}
.ns-page-site-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  color: var(--page-text);
  text-decoration: none;
  background: rgba(255,255,255,0.72);
  border: 1px solid var(--page-border);
  font-size: 13px;
  font-weight: 800;
}
.ns-page-site-nav a:hover {
  background: #f2e6d9;
}
.ns-preview-hero {
  margin-top: 28px;
  padding: 0 0 18px;
}
.ns-preview-hero__title {
  margin-top: 12px;
  font-size: clamp(34px, 5vw, 68px);
  line-height: 1.02;
  font-weight: 800;
  max-width: 16ch;
}
.ns-preview-hero__summary {
  margin: 16px 0 0;
  max-width: 64ch;
  color: var(--page-muted);
  line-height: 1.75;
  font-size: 18px;
}
.ns-preview-main {
  margin-top: 8px;
}
.ns-preview-page {
  background: var(--page-panel);
  border: 1px solid var(--page-border);
  border-radius: var(--page-radius);
  padding: 28px;
  box-shadow: var(--page-shadow);
}
.ns-page__body {
  display: grid;
  gap: 20px;
}
.ns-page-section {
  display: grid;
  gap: 16px;
}
.ns-page-section__head h2,
.ns-page__body h1,
.ns-page__body h2,
.ns-page__body h3 {
  margin: 0;
  line-height: 1.14;
}
.ns-page__body h1 { font-size: clamp(34px, 5vw, 58px); }
.ns-page__body h2 { font-size: clamp(24px, 3vw, 34px); }
.ns-page__body p,
.ns-page__body li,
.ns-page-section p {
  margin: 0;
  color: var(--page-text);
  line-height: 1.78;
  font-size: 17px;
}
.ns-page-lead { font-size: 20px; }
.ns-page-hero--split,
.ns-page-grid--article {
  display: grid;
  grid-template-columns: minmax(0, 1.52fr) minmax(340px, 0.92fr);
  align-items: start;
  gap: 22px;
}
.ns-page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.ns-page-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--page-border);
  background: rgba(255,255,255,0.45);
  color: var(--page-text);
  text-decoration: none;
  font-weight: 600;
}
.ns-page-button--primary {
  background: linear-gradient(180deg, var(--page-accent), var(--page-accent-strong));
  color: #fffaf5;
  border-color: transparent;
}
.ns-page-panel,
.ns-page-card,
.ns-page-callout,
.ns-page-meta-strip {
  border: 1px solid var(--page-border);
  background: var(--page-card);
  border-radius: 20px;
}
.ns-page-panel,
.ns-page-card { padding: 18px; }
.ns-page-panel strong,
.ns-page-card strong {
  display: block;
  font-size: 20px;
  line-height: 1.2;
  color: var(--page-text);
}
.ns-page-panel p,
.ns-page-card p {
  margin-top: 10px;
  font-size: 15px;
  color: var(--page-muted);
}
.ns-page-grid { display: grid; gap: 16px; }
.ns-page-grid--stats,
.ns-page-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ns-page-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ns-page-card span {
  display: inline-block;
  margin-bottom: 10px;
  color: var(--page-accent);
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ns-page-list {
  display: grid;
  gap: 10px;
  margin: 14px 0 0;
  padding-left: 18px;
}
.ns-page-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
}
.ns-page-callout h2 { margin: 0; }
.ns-page-meta-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
}
.ns-page-meta-strip span,
.ns-page__tag {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.5);
  border: 1px solid var(--page-border);
  color: var(--page-muted);
  font-size: 12px;
}
.ns-page-prose { display: grid; gap: 18px; }
.ns-page__body blockquote {
  margin: 0;
  padding: 18px 20px;
  border-radius: 18px;
  border-left: 3px solid var(--page-accent-strong);
  background: rgba(255,255,255,0.55);
  color: var(--page-text);
  font-size: 18px;
}
.ns-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}
.ns-preview-footer {
  margin-top: 18px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--page-muted);
  font-size: 13px;
}
.ns-preview-footer__right {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  align-items: center;
}
.ns-preview-footer__link {
  color: var(--page-accent-strong);
  text-decoration: none;
}
.ns-preview-footer__link:hover {
  text-decoration: underline;
}

.ns-editor-site-identity__preview-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  background: rgba(255,255,255,0.03);
}
.ns-editor-site-identity__media {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}
.ns-editor-site-identity__logo {
  display: block;
  max-width: 180px;
  max-height: 52px;
  width: auto;
  height: auto;
  object-fit: contain;
}
.ns-editor-site-identity__fallback {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #9a6b40, #724729);
  color: #fffaf4;
  font-weight: 800;
}
.ns-editor-site-identity__copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}
.ns-editor-site-identity__copy strong {
  font-size: 15px;
}
.ns-editor-site-identity__copy span {
  color: rgba(224,232,255,0.72);
  font-size: 13px;
  line-height: 1.5;
}
.ns-editor-site-identity__meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: rgba(224,232,255,0.62);
  font-size: 12px;
}
.ns-editor-site-identity__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ns-editor-site-identity__chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.04);
  color: rgba(232,238,255,0.82);
  font-size: 12px;
}

body.ns-preview--website,
body.ns-preview-theme--website-starter,
body.ns-preview-theme--folder-website-starter,
body.ns-preview-theme--vitrina-press-landing,
body.ns-preview--press {
  --page-bg: #f4ede4;
  --page-surface: rgba(255, 248, 239, 0.82);
  --page-panel: rgba(255, 248, 240, 0.9);
  --page-card: rgba(255, 251, 246, 0.94);
  --page-text: #2c2016;
  --page-muted: #6d5640;
  --page-border: rgba(150, 112, 66, 0.16);
  --page-accent: #ad7a45;
  --page-accent-strong: #865a31;
  --page-shadow: 0 24px 60px rgba(93, 62, 31, 0.12);
  background: linear-gradient(180deg, #fbf6ef 0%, #efe2d1 100%);
}
body.ns-preview--website .ns-preview-shell,
body.ns-preview-theme--website-starter .ns-preview-shell,
body.ns-preview-theme--folder-website-starter .ns-preview-shell,
body.ns-preview-theme--vitrina-press-landing .ns-preview-shell,
body.ns-preview--press .ns-preview-shell {
  max-width: 1340px;
}
body.ns-preview--website .ns-preview-topbar,
body.ns-preview-theme--website-starter .ns-preview-topbar,
body.ns-preview-theme--folder-website-starter .ns-preview-topbar,
body.ns-preview-theme--vitrina-press-landing .ns-preview-topbar,
body.ns-preview--press .ns-preview-topbar {
  align-items: center;
}
body.ns-preview--website .ns-preview-nav a,
body.ns-preview-theme--website-starter .ns-preview-nav a,
body.ns-preview-theme--folder-website-starter .ns-preview-nav a,
body.ns-preview-theme--vitrina-press-landing .ns-preview-nav a,
body.ns-preview--press .ns-preview-nav a {
  padding: 10px 14px;
  border: 1px solid var(--page-border);
  border-radius: 999px;
  background: rgba(255,255,255,0.45);
}
body.ns-preview--website .ns-preview-hero,
body.ns-preview-theme--website-starter .ns-preview-hero,
body.ns-preview-theme--folder-website-starter .ns-preview-hero,
body.ns-preview-theme--vitrina-press-landing .ns-preview-hero,
body.ns-preview--press .ns-preview-hero {
  padding: 16px 0 22px;
}
body.ns-preview--website .ns-preview-topbar--site,
body.ns-preview-theme--website-starter .ns-preview-topbar--site,
body.ns-preview-theme--folder-website-starter .ns-preview-topbar--site,
body.ns-preview-theme--vitrina-press-landing .ns-preview-topbar--site,
body.ns-preview--press .ns-preview-topbar--site {
  padding-bottom: 22px;
}
body.ns-preview--website .ns-preview-main--site,
body.ns-preview-theme--website-starter .ns-preview-main--site,
body.ns-preview-theme--folder-website-starter .ns-preview-main--site,
body.ns-preview-theme--vitrina-press-landing .ns-preview-main--site,
body.ns-preview--press .ns-preview-main--site {
  margin-top: 18px;
}
body.ns-preview--website .ns-preview-page--site,
body.ns-preview-theme--website-starter .ns-preview-page--site,
body.ns-preview-theme--folder-website-starter .ns-preview-page--site,
body.ns-preview-theme--vitrina-press-landing .ns-preview-page--site,
body.ns-preview--press .ns-preview-page--site {
  padding-top: 24px;
}
body.ns-preview--website .ns-preview-hero__title,
body.ns-preview-theme--website-starter .ns-preview-hero__title,
body.ns-preview-theme--folder-website-starter .ns-preview-hero__title,
body.ns-preview-theme--vitrina-press-landing .ns-preview-hero__title,
body.ns-preview--press .ns-preview-hero__title {
  max-width: 18ch;
}
body.ns-preview--website .ns-preview-hero__summary,
body.ns-preview-theme--website-starter .ns-preview-hero__summary,
body.ns-preview-theme--folder-website-starter .ns-preview-hero__summary,
body.ns-preview-theme--vitrina-press-landing .ns-preview-hero__summary,
body.ns-preview--press .ns-preview-hero__summary {
  max-width: 76ch;
  font-size: 19px;
}
body.ns-preview--website .ns-preview-page,
body.ns-preview-theme--website-starter .ns-preview-page,
body.ns-preview-theme--folder-website-starter .ns-preview-page,
body.ns-preview-theme--vitrina-press-landing .ns-preview-page,
body.ns-preview--press .ns-preview-page {
  padding: 36px 40px;
}
body.ns-preview--website .ns-page-panel,
body.ns-preview--website .ns-page-card,
body.ns-preview-theme--website-starter .ns-page-panel,
body.ns-preview-theme--website-starter .ns-page-card,
body.ns-preview-theme--folder-website-starter .ns-page-panel,
body.ns-preview-theme--folder-website-starter .ns-page-card,
body.ns-preview-theme--vitrina-press-landing .ns-page-panel,
body.ns-preview-theme--vitrina-press-landing .ns-page-card,
body.ns-preview--press .ns-page-panel,
body.ns-preview--press .ns-page-card {
  padding: 22px;
}

body.ns-preview--blog,
body.ns-preview-theme--blog-post,
body.ns-preview-theme--folder-blog-post {
  --page-bg: #fcf7f2;
  --page-surface: rgba(255, 251, 247, 0.88);
  --page-panel: rgba(255, 252, 248, 0.95);
  --page-card: rgba(255, 255, 255, 0.95);
  --page-text: #2e231d;
  --page-muted: #7a665b;
  --page-border: rgba(163, 109, 73, 0.16);
  --page-accent: #b06d4c;
  --page-accent-strong: #8c4f34;
  --page-shadow: 0 12px 34px rgba(94, 59, 36, 0.08);
  background: linear-gradient(180deg, #fffdfa 0%, #f4ebe2 100%);
}

/* Project Landing preview: no old preview header, full-width layout. */
body.ns-preview-theme--project-landing {
  background:
    radial-gradient(circle at 12% 8%, rgba(242,153,74,0.12), transparent 32%),
    radial-gradient(circle at 88% 10%, rgba(94,116,255,0.10), transparent 34%),
    linear-gradient(180deg, #fffaf2 0%, #f4ede4 100%);
}

body.ns-preview-theme--project-landing {
  overflow-x: hidden;
}

body.ns-preview-theme--project-landing .ns-preview-shell {
  width: 100%;
  max-width: none;
  padding: 0;
  overflow-x: hidden;
}

body.ns-preview-theme--project-landing .ns-preview-topbar,
body.ns-preview-theme--project-landing .ns-preview-hero {
  display: none !important;
}

body.ns-preview-theme--project-landing .ns-preview-main,
body.ns-preview-theme--project-landing .ns-preview-main--site {
  margin: 0;
  padding: 0;
}

body.ns-preview-theme--project-landing .ns-preview-page,
body.ns-preview-theme--project-landing .ns-preview-page--site {
  width: 100%;
  max-width: none;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

body.ns-preview-theme--project-landing .irgeztne-project-landing {
  width: 100%;
  max-width: none;
  min-height: 100vh;
  margin: 0;
  border-radius: 0;
  border-left: 0;
  border-right: 0;
}

body.ns-preview-theme--project-landing .ns-preview-footer,
body.ns-preview-theme--project-landing .ns-preview-footer *,
body.ns-preview-theme--project-landing .ns-preview-tags,
body.ns-preview-theme--project-landing .ns-preview-meta,
body.ns-preview-theme--project-landing .ns-preview-built,
body.ns-preview-theme--project-landing .ns-preview-contact,
body.ns-preview-theme--project-landing .ns-page__tags,
body.ns-preview-theme--project-landing .ns-page__tag,
body.ns-preview-theme--project-landing .ns-preview-footer__link {
  display: none !important;
}

body.ns-preview--blog .ns-preview-shell,
body.ns-preview-theme--blog-post .ns-preview-shell,
body.ns-preview-theme--folder-blog-post .ns-preview-shell {
  max-width: 860px;
}
body.ns-preview--blog .ns-preview-topbar,
body.ns-preview-theme--blog-post .ns-preview-topbar,
body.ns-preview-theme--folder-blog-post .ns-preview-topbar {
  align-items: flex-start;
}
body.ns-preview--blog .ns-preview-nav,
body.ns-preview-theme--blog-post .ns-preview-nav,
body.ns-preview-theme--folder-blog-post .ns-preview-nav {
  display: none;
}
body.ns-preview--blog .ns-preview-page,
body.ns-preview-theme--blog-post .ns-preview-page,
body.ns-preview-theme--folder-blog-post .ns-preview-page {
  border-radius: 0;
  border-left: 0;
  border-right: 0;
  background: transparent;
  box-shadow: none;
  padding: 8px 0 0;
}
body.ns-preview--blog .ns-page-panel,
body.ns-preview--blog .ns-page-card,
body.ns-preview-theme--blog-post .ns-page-panel,
body.ns-preview-theme--blog-post .ns-page-card,
body.ns-preview-theme--folder-blog-post .ns-page-panel,
body.ns-preview-theme--folder-blog-post .ns-page-card {
  background: #fffdfa;
}

body.ns-preview--article,
body.ns-preview-theme--editorial-brief,
body.ns-preview-theme--folder-editorial-brief,
body.ns-preview-theme--vitrina-editorial-brief {
  --page-bg: #f6f2f3;
  --page-surface: rgba(255, 251, 252, 0.86);
  --page-panel: rgba(255, 251, 252, 0.92);
  --page-card: rgba(255, 255, 255, 0.96);
  --page-text: #241d23;
  --page-muted: #76626f;
  --page-border: rgba(141, 88, 100, 0.14);
  --page-accent: #9d6270;
  --page-accent-strong: #774855;
  --page-shadow: 0 16px 40px rgba(88, 55, 64, 0.08);
  background: linear-gradient(180deg, #fbf8f9 0%, #efe7ea 100%);
}
body.ns-preview--article .ns-preview-shell,
body.ns-preview-theme--editorial-brief .ns-preview-shell,
body.ns-preview-theme--folder-editorial-brief .ns-preview-shell,
body.ns-preview-theme--vitrina-editorial-brief .ns-preview-shell {
  max-width: 920px;
}
body.ns-preview--article .ns-preview-nav,
body.ns-preview-theme--editorial-brief .ns-preview-nav,
body.ns-preview-theme--folder-editorial-brief .ns-preview-nav,
body.ns-preview-theme--vitrina-editorial-brief .ns-preview-nav {
  display: none;
}
body.ns-preview--article .ns-preview-page,
body.ns-preview-theme--editorial-brief .ns-preview-page,
body.ns-preview-theme--folder-editorial-brief .ns-preview-page,
body.ns-preview-theme--vitrina-editorial-brief .ns-preview-page {
  background: #fffdfd;
}

body.ns-preview--analysis,
body.ns-preview-theme--vitrina-news-analysis {
  --page-bg: #edf4f0;
  --page-surface: rgba(245, 251, 247, 0.86);
  --page-panel: rgba(247, 252, 249, 0.92);
  --page-card: rgba(255, 255, 255, 0.95);
  --page-text: #1f2b27;
  --page-muted: #61746e;
  --page-border: rgba(86, 132, 119, 0.14);
  --page-accent: #4a8b7a;
  --page-accent-strong: #316757;
  --page-shadow: 0 18px 40px rgba(40, 72, 63, 0.10);
  background: linear-gradient(180deg, #f4faf7 0%, #e1eee8 100%);
}
body.ns-preview--analysis .ns-preview-shell,
body.ns-preview-theme--vitrina-news-analysis .ns-preview-shell {
  max-width: 980px;
}
body.ns-preview--analysis .ns-preview-page,
body.ns-preview-theme--vitrina-news-analysis .ns-preview-page {
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(243,249,246,0.92));
}
body.ns-preview--analysis .ns-page-panel,
body.ns-preview--analysis .ns-page-card,
body.ns-preview-theme--vitrina-news-analysis .ns-page-panel,
body.ns-preview-theme--vitrina-news-analysis .ns-page-card {
  background: rgba(248, 252, 249, 0.96);
}

@media (max-width: 940px) {
  .ns-preview-topbar,
  .ns-page-callout {
    flex-direction: column;
    align-items: stretch;
  }
  .ns-preview-site-brand {
    align-items: flex-start;
  }
  .ns-page-hero--split,
  .ns-page-grid--article,
  .ns-page-grid--stats,
  .ns-page-grid--three,
  .ns-page-grid--two { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .ns-preview-shell { padding: 18px 12px 36px; }
  .ns-preview-page { padding: 18px; }
  .ns-page-panel,
  .ns-page-card,
  .ns-page-callout { padding: 14px 16px; }
  .ns-page__body p,
  .ns-page__body li,
  .ns-page-section p { font-size: 16px; }
}`;
  }
  function buildOutputPackage(draft) {
    return {
      "index.html": buildIndexHtml(draft),
      "styles.css": buildStylesCss(),
      "content/page.json": JSON.stringify(buildPageJson(draft), null, 2),
      "meta.json": JSON.stringify(buildMetaJson(draft), null, 2)
    };
  }

  function buildInlinePreviewDocument(draft) {
    const baseHref = (() => {
      try {
        return typeof window !== 'undefined' && window.location && window.location.href
          ? String(window.location.href)
          : '';
      } catch (error) {
        return '';
      }
    })();
    return buildIndexHtml(draft)
      .replace(/<link rel="stylesheet" href="\.\/styles\.css" \/>/i, `<style>${buildStylesCss()}</style>`)
      .replace('</head>', `${baseHref ? `<base href="${escapeHtml(baseHref)}" />` : ''}</head>`);
  }

  function getPreviewBridge() {
    try {
      if (typeof window !== "undefined" && window.nsAPI && typeof window.nsAPI === "object") {
        return window.nsAPI;
      }
    } catch (error) {
      console.warn("[NSEditorV1] preview bridge lookup failed:", error);
    }
    return null;
  }

  function getProjectStore() {
    return window.NSProjectStore || null;
  }

  function getNotesStore() {
    return window.NSNotesStore || null;
  }

  function getLibraryStore() {
    return window.NSLibraryStore || null;
  }

  const DEFAULT_SITE_PROFILE = {
    siteName: "Project Studio",
    tagline: "Local-first publishing workspace",
    logoPath: "",
    logoAlt: "Project Studio",
    faviconPath: "",
    contactEmail: "hello@example.com",
    footerText: "Сделано в IRGEZTNE",
    navItems: ["Обзор", "Истории", "Контакт"],
    socialLinks: [
      { label: "Почта", url: "mailto:hello@example.com" },
      { label: "Контакт", url: "#contact" }
    ],
    primaryColor: "#9a6b40",
    accentColor: "#724729"
  };

  function cleanLegacyBrandPath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = raw.replace(/\\/g, "/").toLowerCase();
    if (
      normalized.includes("assets/branding/wordmark") ||
      normalized.includes("assets/branding/favicon")
    ) {
      return "";
    }
    return raw;
  }

  function cleanLegacyText(value, legacyValue, fallback) {
    const raw = String(value || "").trim();
    return raw === legacyValue ? fallback : raw;
  }

  function normalizeSiteProfile(input) {
    const source = input && typeof input === "object" ? input : {};
    const navItems = Array.isArray(source.navItems)
      ? source.navItems.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    return {
      siteName: cleanLegacyText(source.siteName || DEFAULT_SITE_PROFILE.siteName, "IRGEZTNE Studio", DEFAULT_SITE_PROFILE.siteName),
      tagline: String(source.tagline || DEFAULT_SITE_PROFILE.tagline),
      logoPath: cleanLegacyBrandPath(source.logoPath === "" ? "" : String(source.logoPath || DEFAULT_SITE_PROFILE.logoPath)),
      logoAlt: cleanLegacyText(source.logoAlt || source.siteName || DEFAULT_SITE_PROFILE.logoAlt, "IRGEZTNE", DEFAULT_SITE_PROFILE.logoAlt),
      faviconPath: cleanLegacyBrandPath(source.faviconPath === "" ? "" : String(source.faviconPath || DEFAULT_SITE_PROFILE.faviconPath)),
      contactEmail: String(source.contactEmail || DEFAULT_SITE_PROFILE.contactEmail),
      footerText: String(source.footerText || DEFAULT_SITE_PROFILE.footerText),
      navItems: navItems.length ? navItems : [...DEFAULT_SITE_PROFILE.navItems],
      socialLinks: Array.isArray(source.socialLinks) ? deepClone(source.socialLinks) : deepClone(DEFAULT_SITE_PROFILE.socialLinks),
      primaryColor: String(source.primaryColor || DEFAULT_SITE_PROFILE.primaryColor),
      accentColor: String(source.accentColor || DEFAULT_SITE_PROFILE.accentColor)
    };
  }

  function getSiteProfileStore() {
    return window.NSSiteProfileStore || null;
  }

  function getSiteProfile() {
    const store = getSiteProfileStore();
    if (store && typeof store.getProfile === "function") {
      return normalizeSiteProfile(store.getProfile());
    }
    return normalizeSiteProfile(DEFAULT_SITE_PROFILE);
  }

  function updateSiteProfile(patch) {
    const store = getSiteProfileStore();
    if (!store || typeof store.updateProfile !== "function") return getSiteProfile();
    return normalizeSiteProfile(store.updateProfile(patch || {}));
  }

  function resetSiteProfile() {
    const store = getSiteProfileStore();
    if (!store || typeof store.resetProfile !== "function") return normalizeSiteProfile(DEFAULT_SITE_PROFILE);
    return normalizeSiteProfile(store.resetProfile());
  }

  function getProjectOptions(currentProjectId) {
    const store = getProjectStore();
    const items = store && typeof store.getAll === "function" ? store.getAll() : [];
    const options = ['<option value="">No project</option>'];
    items.forEach((project) => {
      options.push(`<option value="${escapeHtml(project.id)}" ${project.id === currentProjectId ? "selected" : ""}>${escapeHtml(project.title || project.id)}</option>`);
    });
    return options.join("");
  }

  function getProjectById(projectId) {
    const store = getProjectStore();
    return store && projectId && typeof store.getById === "function" ? store.getById(projectId) : null;
  }

  function getNoteById(noteId) {
    const store = getNotesStore();
    return store && noteId && typeof store.getById === "function" ? store.getById(noteId) : null;
  }

  function getLibraryItemById(fileId) {
    const store = getLibraryStore();
    return store && fileId && typeof store.getItemById === "function" ? store.getItemById(fileId) : null;
  }

  function getActiveLibraryFileId() {
    const store = getLibraryStore();
    if (!store || typeof store.getState !== "function") return "";
    const state = store.getState();
    return state && state.activeId ? String(state.activeId) : "";
  }

  function getActiveLibraryItem() {
    return getLibraryItemById(getActiveLibraryFileId());
  }

  function getActiveNoteId() {
    const store = getNotesStore();
    return store && typeof store.getLastOpenedNoteId === "function" ? String(store.getLastOpenedNoteId() || "") : "";
  }

  function getActiveNote() {
    return getNoteById(getActiveNoteId());
  }

  function diffAdded(previousList, nextList) {
    const prev = new Set(uniqueIds(previousList));
    return uniqueIds(nextList).filter((item) => !prev.has(item));
  }

  function diffRemoved(previousList, nextList) {
    const next = new Set(uniqueIds(nextList));
    return uniqueIds(previousList).filter((item) => !next.has(item));
  }

  class EditorSurface {
    constructor(root, store) {
      this.root = root;
      this.store = store;
      this.instanceId = uid("surface");
      this.surfaceType =
        root.dataset.editorSurface ||
        (root.id === "nsEditorCabinetMount" ? "cabinet" : "workspace");

      this.currentDraft = null;
      this.slugEdited = false;
      this.autosaveTimer = null;
      this.activeTab = this.surfaceType === "cabinet" ? "write" : "draft";
      this.resizeObserver = null;
      this.formInputHandler = null;
      this.formChangeHandler = null;
      this.writeInputHandler = null;
      this.writeMouseDownHandler = null;
      this.savedVisualRange = null;
      this.focusMode = false;
      this.leftPanelOpen = false;
      this.rightPanelOpen = false;
      this.lastSavedAt = "";
      this.lastCreatedTemplateId = "";
      this.siteIdentityPanelOpen = false;
      this.handleTemplateLibraryChanged = () => {
        if (!this.refs) return;
        this.renderPickerGrid();
        this.renderLeftTemplates();
      };
      this.handleSiteProfileChanged = () => {
        if (!this.currentDraft) return;
        this.renderDynamicPanels(this.currentDraft);
      };
      this.boundRootEvents = false;
      this.rootClickHandler = null;
      this.storeUpdateHandler = null;
      this.previewShellOpening = false;
      this.previewExternalOpening = false;
      this.exportZipBusy = false;
      this.lastExportZipPath = "";
      window.addEventListener("ns-vitrina:templates-changed", this.handleTemplateLibraryChanged);
      window.addEventListener("ns-template-library:changed", this.handleTemplateLibraryChanged);
      window.addEventListener("ns-site-profile:changed", this.handleSiteProfileChanged);
      this.handleLanguageChanged = () => {
        if (this.currentDraft && this.refs?.writeMount?.querySelector('[name="title"]')) {
          this.currentDraft = this.readForm();
          this.store.saveDraft(this.currentDraft);
        }
        this.render({ initialTab: this.activeTab });
      };
      window.addEventListener("irg:language-changed", this.handleLanguageChanged);
      document.addEventListener("irg:language-changed", this.handleLanguageChanged);

      this.render({ initialTab: this.activeTab });
    }

    render(options = {}) {
      if (this.surfaceType === "cabinet") {
        this.root.classList.add("ns-editor-mount--cabinet");
      }

      this.root.dataset.editorSurface = this.surfaceType;
      this.root.innerHTML = this.buildShellMarkup();

      this.refs = {
        shell: this.root.querySelector(".ns-editor-shell"),
        headerDraftCount: this.root.querySelector('[data-role="header-draft-count"]'),
        sidebarDraftCount: this.root.querySelector('[data-role="sidebar-draft-count"]'),
        statusBadge: this.root.querySelector('[data-role="status-badge"]'),
        draftList: this.root.querySelector('[data-role="draft-list"]'),
        leftTemplates: this.root.querySelector('[data-role="left-templates"]'),
        leftSources: this.root.querySelector('[data-role="left-sources"]'),
        writeMount: this.root.querySelector('[data-role="write-mount"]'),
        previewLive: this.root.querySelector('[data-role="preview-live"]'),
        previewMeta: this.root.querySelector('[data-role="preview-meta"]'),
        deployMount: this.root.querySelector('[data-role="deploy-mount"]'),
        contextDraft: this.root.querySelector('[data-role="context-draft"]'),
        contextOutput: this.root.querySelector('[data-role="context-output"]'),
        settingsMount: this.root.querySelector('[data-role="settings-mount"]'),
        leftDrawer: this.root.querySelector('[data-role="left-drawer"]'),
        rightDrawer: this.root.querySelector('[data-role="right-drawer"]'),
        pickerBackdrop: this.root.querySelector('[data-role="picker-backdrop"]'),
        pickerGrid: this.root.querySelector('[data-role="picker-grid"]')
      };

      this.applyEditorThemeState(this.currentDraft?.write?.theme || STABLE_EDITOR_THEME);
      this.bindRootEvents();
      this.renderPickerGrid();
      this.renderDraftList();
      this.renderLeftTemplates();
      this.renderLeftSources();
      this.renderContextRail();
      this.renderEmptyPanels();
      const initialTab = options && options.initialTab ? options.initialTab : (this.surfaceType === "cabinet" ? "write" : "draft");
      this.switchTab(initialTab);
      this.syncHeaderState();
      this.syncDrawerState();

      const activeDraftId = this.store.state.activeDraftId;
      if (activeDraftId) {
        const draft = this.store.getDraft(activeDraftId);
        if (draft) {
          this.openDraft(draft.id, false, false);
        }
      }

      this.setupResponsiveObserver();

      requestAnimationFrame(() => {
        this.updateResponsiveState();
        this.refs.shell?.classList.remove("ns-editor-shell--booting");
      });
    }

    setupResponsiveObserver() {
      if (!this.refs.shell) return;

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }

      if (typeof ResizeObserver === "function") {
        this.resizeObserver = new ResizeObserver(() => {
          this.updateResponsiveState();
        });
        this.resizeObserver.observe(this.root);
      } else {
        window.addEventListener("resize", () => this.updateResponsiveState(), { passive: true });
      }

      this.updateResponsiveState();
    }

    updateResponsiveState() {
      const shell = this.refs.shell;
      if (!shell) return;

      const width = Math.max(this.root.clientWidth || 0, shell.clientWidth || 0);
      const compact = width > 0 && width < 1380;
      const stacked = width > 0 && width < 980;

      shell.classList.toggle("ns-editor-shell--compact", compact);
      shell.classList.toggle("ns-editor-shell--stacked", stacked);
    }

    buildShellMarkup() {
      const isCabinet = this.surfaceType === "cabinet";
      const shellTheme = normalizeWriteTheme(this.currentDraft?.write?.theme || STABLE_EDITOR_THEME);
      const shellClass = [
        "ns-editor-shell",
        "ns-editor-shell--booting",
        isCabinet ? "ns-editor-shell--surface-cabinet" : "ns-editor-shell--surface-workspace",
        shellTheme === "dark" ? "ns-editor-shell--editor-dark" : "ns-editor-shell--editor-light"
      ].join(" ");

      const tabs = isCabinet
        ? [
            { id: "write", label: t("Write","Письмо") },
            { id: "preview", label: t("Preview","Превью") },
            { id: "deploy", label: t("Publish","Публикация") }
          ]
        : [
            { id: "draft", label: t("Draft","Черновик") },
            { id: "preview", label: t("Preview","Превью") },
            { id: "deploy", label: t("Publish","Публикация") }
          ];

      const mainMarkup = `
        <section class="ns-editor-shell__main">
          <div class="ns-editor-shell__tabs" data-role="tabs">
            ${tabs.map((tab) => this.buildTabButton(tab.id, tab.label)).join("")}
          </div>

          <div class="ns-editor-shell__panel">
            <div class="ns-editor-shell__tab-panels">
              <section class="ns-editor-shell__tab-panel" data-tab-panel="${isCabinet ? "write" : "draft"}">
                <div class="ns-editor-shell__content-mount" data-role="write-mount"></div>
              </section>

              <section class="ns-editor-shell__tab-panel ns-editor-shell__tab-panel--preview" data-tab-panel="preview">
                <div class="ns-editor-shell__preview-live" data-role="preview-live"></div>
                <div class="ns-editor-shell__preview-meta" data-role="preview-meta"></div>
              </section>

              <section class="ns-editor-shell__tab-panel ns-editor-shell__tab-panel--publish" data-tab-panel="deploy">
                <div data-role="deploy-mount"></div>
              </section>
            </div>
          </div>
        </section>
      `;

      const leftMarkup = `
        <aside class="ns-editor-shell__drawer ns-editor-shell__drawer--left" data-role="left-drawer" aria-hidden="true">
          <div class="ns-editor-shell__drawer-head">
            <div>
              <div class="ns-editor-shell__drawer-title">${t("Drafts & templates","Черновики и шаблоны")}</div>
              <div class="ns-editor-shell__drawer-subtitle">${t("Open the draft you need or create a new one from a template.","Откройте нужный черновик или создайте новый из шаблона.")}</div>
            </div>
            <button class="ns-editor-shell__button" type="button" data-action="toggle-left-panel">${t("Close","Закрыть")}</button>
          </div>
          <div class="ns-editor-shell__drawer-body">
            <section class="ns-editor-shell__side-card">
              <div class="ns-editor-shell__side-card-header ns-editor-shell__side-card-header--stacked">
                <div>
                  <div class="ns-editor-shell__side-card-title">${t("Drafts","Черновики")}</div>
                  <span class="ns-editor-shell__count" data-role="sidebar-draft-count">${t("0 drafts","0 черновиков")}</span>
                </div>
                <div class="ns-editor-shell__side-card-actions">
                  <button class="ns-editor-shell__button" type="button" data-action="clear-old-drafts">${t("Clear old","Очистить старые")}</button>
                  <button class="ns-editor-shell__button ns-editor-shell__button--danger" type="button" data-action="clear-all-drafts">${t('Delete all','Удалить всё')}</button>
                </div>
              </div>
              <div class="ns-editor-shell__side-card-body" data-role="draft-list"></div>
            </section>

            <section class="ns-editor-shell__side-card">
              <div class="ns-editor-shell__side-card-header">
                <div class="ns-editor-shell__side-card-title">${t("Templates","Шаблоны")}</div>
                <button class="ns-editor-shell__button" type="button" data-action="open-picker">${t("Open","Открыть")}</button>
              </div>
              <div class="ns-editor-shell__side-card-body" data-role="left-templates"></div>
            </section>
          </div>
        </aside>
      `;

      const rightMarkup = `
        <aside class="ns-editor-shell__drawer ns-editor-shell__drawer--right" data-role="right-drawer" aria-hidden="true">
          <div class="ns-editor-shell__drawer-head">
            <div>
              <div class="ns-editor-shell__drawer-title">${t("Panel","Панель")}</div>
              <div class="ns-editor-shell__drawer-subtitle">${t("Context, SEO, site identity, and publishing are gathered in one quiet place.","Контекст, SEO, идентичность сайта и публикация собраны в одном месте без лишнего шума.")}</div>
            </div>
            <button class="ns-editor-shell__button" type="button" data-action="toggle-right-panel">${t("Close","Закрыть")}</button>
          </div>
          <div class="ns-editor-shell__drawer-body">
            <section class="ns-editor-shell__side-card">
              <div class="ns-editor-shell__side-card-header">
                <div class="ns-editor-shell__side-card-title">${t("Draft context","Контекст черновика")}</div>
              </div>
              <div class="ns-editor-shell__side-card-body" data-role="context-draft"></div>
            </section>

            <section class="ns-editor-shell__side-card">
              <div class="ns-editor-shell__side-card-header">
                <div class="ns-editor-shell__side-card-title">${t("Publishing & output","Публикация и вывод")}</div>
              </div>
              <div class="ns-editor-shell__side-card-body" data-role="context-output"></div>
            </section>

            <section class="ns-editor-shell__side-card">
              <div class="ns-editor-shell__side-card-header">
                <div class="ns-editor-shell__side-card-title">${t("Fields & settings","Поля и настройки")}</div>
              </div>
              <div class="ns-editor-shell__side-card-body ns-editor-shell__side-card-body--settings" data-role="settings-mount"></div>
            </section>
          </div>
        </aside>
      `;

      const bodyMarkup = `
        <div class="ns-editor-shell__body">
          ${mainMarkup}
          <button class="ns-editor-shell__drawer-scrim ns-editor-shell__drawer-scrim--left" type="button" aria-label="${t("Close draft list","Закрыть список черновиков")}" data-action="close-left-panel"></button>
          <button class="ns-editor-shell__drawer-scrim ns-editor-shell__drawer-scrim--right" type="button" aria-label="${t("Close editor panel","Закрыть панель редактора")}" data-action="close-right-panel"></button>
          ${leftMarkup}
          ${rightMarkup}
        </div>
      `;

      const title = isCabinet ? t("Cabinet Editor","Редактор кабинета") : t("Author Studio v2.0","Авторская студия v2.0");
      const subtitle = isCabinet
        ? t("Writing stays centered while drafts and service panels live in the editor grid.","Письмо и предпросмотр вынесены в центр, а черновики и служебные панели открываются по запросу.")
        : t("The canvas opens first, while drafts and settings stay in calm side columns.","Сначала открывается сам холст, а черновики и настройки вынесены в боковые drawer-панели.");

      return `
        <div class="ns-editor-shell-host" data-editor-theme="${escapeHtml(shellTheme)}">
          <div class="${shellClass}" data-editor-theme="${escapeHtml(shellTheme)}">
            <header class="ns-editor-shell__header">
              <div class="ns-editor-shell__headline">
                <div class="ns-editor-shell__eyebrow">${t("Editor Cabinet","Редактор кабинета")}</div>
                <div class="ns-editor-shell__title-row">
                  <h2>${title}</h2>
                  <span class="ns-editor-shell__badge">${isCabinet ? t("Cabinet","Кабинет") : t("Workspace","Рабочее пространство")}</span>
                </div>
                <div class="ns-editor-shell__header-subtitle">${subtitle}</div>
              </div>

              <div class="ns-editor-shell__header-meta">
                <span class="ns-editor-shell__count" data-role="header-draft-count">${t("0 drafts","0 черновиков")}</span>
                <span class="ns-editor-shell__status" data-role="status-badge">${t("No active draft","Нет активного черновика")}</span>
              </div>

              <div class="ns-editor-shell__header-actions">
                <button class="ns-editor-shell__button" type="button" data-action="toggle-left-panel">${t("Drafts","Черновики")}</button>
                <button class="ns-editor-shell__button" type="button" data-action="toggle-right-panel">${t("Panel","Панель")}</button>
                <button class="ns-editor-shell__button" type="button" data-action="toggle-focus-mode">${t("Focus","Фокус")}</button>
                <button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="new-draft">${t('New draft','Новый черновик')}</button>
                <button class="ns-editor-shell__button" type="button" data-action="open-picker">${t("Templates","Шаблоны")}</button>
                <button class="ns-editor-shell__button" type="button" data-action="save-draft">${t("Save","Сохранить")}</button>
                <button class="ns-editor-shell__button ns-editor-shell__button--danger" type="button" data-action="delete-draft">${t('Delete','Удалить')}</button>
              </div>
            </header>

            ${bodyMarkup}

            <div class="ns-editor-shell__picker-backdrop" data-role="picker-backdrop">
              <div class="ns-editor-shell__picker" role="dialog" aria-modal="true" aria-label="${t("Choose template","Выбор шаблона")}">
                <div class="ns-editor-shell__picker-header">
                  <div>
                    <div class="ns-editor-shell__picker-title">${t("Choose template","Выбор шаблона")}</div>
                    <div class="ns-editor-shell__picker-subtitle">${t("Choose a template and open the draft immediately in the ","Выберите шаблон и сразу откройте черновик во вкладке ")} ${isCabinet ? t("Write","Письмо") : t("Draft","Черновик")}.</div>
                  </div>
                  <button class="ns-editor-shell__button" type="button" data-action="close-picker">${t("Close","Закрыть")}</button>
                </div>
                <div class="ns-editor-shell__picker-grid" data-role="picker-grid"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    buildTabButton(tabId, label) {
      return `<button class="ns-editor-shell__tab" type="button" data-tab="${escapeHtml(tabId)}">${escapeHtml(label)}</button>`;
    }

    bindRootEvents() {
      if (this.boundRootEvents) {
        return;
      }

      this.rootClickHandler = (event) => {
        if (this.refs.pickerBackdrop && event.target === this.refs.pickerBackdrop) {
          this.closePicker();
          return;
        }

        const actionEl = event.target.closest("[data-action]");

        // pass40: theme toggle is a stable top-level editor action.
        // Handle it before write/drawer branching so the Light/Dark buttons
        // cannot be swallowed by Jodit, side panels, or host layout changes.
        if (actionEl && (actionEl.dataset.action || "") === "set-write-theme") {
          event.preventDefault();
          event.stopPropagation();
          this.setWriteTheme(actionEl.dataset.value || STABLE_EDITOR_THEME);
          return;
        }

        const isInsideWriteMount = Boolean(this.refs.writeMount && actionEl && this.refs.writeMount.contains(actionEl));

        if (actionEl && isInsideWriteMount) {
          const action = actionEl.dataset.action || "";
          const value = actionEl.dataset.value;
          const blockId = actionEl.dataset.blockId;

          if (action === "toggle-focus-mode") {
            event.preventDefault();
            this.toggleFocusMode();
            return;
          }

          if (action === "set-write-theme") {
            event.preventDefault();
            this.setWriteTheme(value || STABLE_EDITOR_THEME);
            return;
          }

          if (action && action.startsWith("format-")) {
            event.preventDefault();
            this.handleVisualToolbarAction(action);
            return;
          }

          if (action === "clear-site-logo") {
            event.preventDefault();
            const profile = this.updateSiteIdentityFields({ ...getSiteProfile(), logoPath: "" });
            const nextProfile = this.syncSiteProfileFromForm();
            this.refreshSiteIdentityEverywhere({ ...nextProfile, logoPath: "" }, {
              remountWrite: true,
              keepIdentityOpen: true,
              message: t("Logo cleared.", "Логотип очищен.")
            });
            return;
          }

          if (action === "clear-site-favicon") {
            event.preventDefault();
            const nextProfile = this.updateSiteIdentityFields({ ...getSiteProfile(), faviconPath: "" });
            this.syncSiteProfileFromForm();
            this.refreshSiteIdentityEverywhere({ ...nextProfile, faviconPath: "" }, {
              remountWrite: false,
              keepIdentityOpen: true,
              message: t("Favicon cleared.", "Favicon очищен.")
            });
            return;
          }

          if (action === "generate-site-favicon") {
            event.preventDefault();
            this.generateSiteFaviconFromForm();
            return;
          }

          if (action === "reset-site-identity") {
            event.preventDefault();
            const profile = resetSiteProfile();
            this.updateSiteIdentityFields(profile);
            this.refreshSiteIdentityEverywhere(profile, {
              remountWrite: true,
              keepIdentityOpen: true,
              message: t("Site identity reset.", "Идентичность сайта сброшена.")
            });
            return;
          }


          if (action === "add-block") {
            event.preventDefault();
            this.addBlock();
            return;
          }

          if (action === "remove-block") {
            event.preventDefault();
            this.removeBlock(blockId);
            return;
          }

          if (action === "move-block-up") {
            event.preventDefault();
            this.moveBlock(blockId, -1);
            return;
          }

          if (action === "move-block-down") {
            event.preventDefault();
            this.moveBlock(blockId, 1);
            return;
          }

          if (action === "link-active-file") {
            event.preventDefault();
            this.linkActiveFile();
            return;
          }

          if (action === "link-active-note") {
            event.preventDefault();
            this.linkActiveNote();
            return;
          }

          if (action === "detach-linked-file") {
            event.preventDefault();
            this.detachLinkedFile(actionEl.dataset.fileId);
            return;
          }

          if (action === "detach-linked-note") {
            event.preventDefault();
            this.detachLinkedNote(actionEl.dataset.noteId);
            return;
          }

          if (action === "open-linked-file") {
            event.preventDefault();
            this.openLinkedFile(actionEl.dataset.fileId);
            return;
          }

          if (action === "open-linked-note") {
            event.preventDefault();
            this.openLinkedNote(actionEl.dataset.noteId);
            return;
          }

          if (action === "open-current-project") {
            event.preventDefault();
            this.openCurrentProject();
            return;
          }

          if (action === "open-projects") {
            event.preventDefault();
            this.openSection("projects");
            return;
          }

          if (action === "open-files") {
            event.preventDefault();
            this.openSection("files");
            return;
          }

          if (action === "open-notes") {
            event.preventDefault();
            this.openSection("notes");
            return;
          }
        }

        if (actionEl && !isInsideWriteMount) {
          const action = actionEl.dataset.action;

          if (action === "clear-site-logo") {
            event.preventDefault();
            const profile = this.updateSiteIdentityFields({ ...getSiteProfile(), logoPath: "" });
            const nextProfile = this.syncSiteProfileFromForm();
            this.refreshSiteIdentityEverywhere({ ...nextProfile, logoPath: "" }, {
              remountWrite: true,
              keepIdentityOpen: true,
              message: t("Logo cleared.", "Логотип очищен.")
            });
            return;
          }

          if (action === "clear-site-favicon") {
            event.preventDefault();
            const nextProfile = this.updateSiteIdentityFields({ ...getSiteProfile(), faviconPath: "" });
            this.syncSiteProfileFromForm();
            this.refreshSiteIdentityEverywhere({ ...nextProfile, faviconPath: "" }, {
              remountWrite: false,
              keepIdentityOpen: true,
              message: t("Favicon cleared.", "Favicon очищен.")
            });
            return;
          }

          if (action === "generate-site-favicon") {
            event.preventDefault();
            this.generateSiteFaviconFromForm();
            return;
          }

          if (action === "reset-site-identity") {
            event.preventDefault();
            const profile = resetSiteProfile();
            this.updateSiteIdentityFields(profile);
            this.refreshSiteIdentityEverywhere(profile, {
              remountWrite: true,
              keepIdentityOpen: true,
              message: t("Site identity reset.", "Идентичность сайта сброшена.")
            });
            return;
          }

          if (action === "open-picker") {
            this.openPicker();
            return;
          }

          if (action === "toggle-left-panel") {
            this.toggleLeftPanel();
            return;
          }

          if (action === "close-left-panel") {
            this.toggleLeftPanel(false);
            return;
          }

          if (action === "toggle-right-panel") {
            this.toggleRightPanel();
            return;
          }

          if (action === "close-right-panel") {
            this.toggleRightPanel(false);
            return;
          }

          if (action === "close-picker") {
            this.closePicker();
            return;
          }

          if (action === "new-draft") {
            this.createDraftFromTemplate(DEFAULT_TEMPLATE_ID);
            return;
          }

          if (action === "save-draft") {
            this.saveCurrentDraft(true);
            return;
          }

          if (action === "delete-draft") {
            this.deleteCurrentDraft();
            return;
          }

          if (action === "toggle-focus-mode") {
            this.toggleFocusMode();
            return;
          }

          if (action === "set-write-theme") {
            this.setWriteTheme(value || STABLE_EDITOR_THEME);
            return;
          }

          if (action === "delete-draft-item") {
            const draftId = actionEl.dataset.draftId || '';
            if (draftId) this.deleteDraftById(draftId);
            return;
          }

          if (action === "clear-old-drafts") {
            this.clearOldDrafts();
            return;
          }

          if (action === "clear-all-drafts") {
            this.clearAllDrafts();
            return;
          }

          if (action === "open-preview-browser") {
            this.openPreviewInBrowserShell();
            return;
          }

          if (action === "open-preview-external") {
            this.openPreviewInExternalBrowser();
            return;
          }

          if (action === "copy-preview-path") {
            this.copyPreviewPath();
            return;
          }

          if (action === "export-site-zip") {
            this.exportCurrentZip();
            return;
          }

          if (action === "open-current-project") {
            this.openCurrentProject();
            return;
          }

          if (action === "open-projects") {
            this.openSection("projects");
            return;
          }

          if (action === "open-files") {
            this.openSection("files");
            return;
          }

          if (action === "open-notes") {
            this.openSection("notes");
            return;
          }

          if (action === "link-active-file") {
            this.linkActiveFile();
            return;
          }

          if (action === "link-active-note") {
            this.linkActiveNote();
            return;
          }

          if (action === "open-linked-file") {
            this.openLinkedFile(actionEl.dataset.fileId);
            return;
          }

          if (action === "open-linked-note") {
            this.openLinkedNote(actionEl.dataset.noteId);
            return;
          }

          if (action === "detach-linked-file") {
            this.detachLinkedFile(actionEl.dataset.fileId);
            return;
          }

          if (action === "detach-linked-note") {
            this.detachLinkedNote(actionEl.dataset.noteId);
            return;
          }
        }

        const tabEl = event.target.closest("[data-tab]");
        if (tabEl) {
          this.switchTab(tabEl.dataset.tab);
          return;
        }

        const templateEl = event.target.closest("[data-template-id]");
        if (templateEl) {
          this.createDraftFromTemplate(templateEl.dataset.templateId);
          return;
        }

        const draftEl = event.target.closest("[data-draft-id]");
        if (draftEl) {
          this.openDraft(draftEl.dataset.draftId, true, true);
        }
      };

      this.siteIdentityToggleHandler = (event) => {
        const target = event.target;
        if (target && target.matches && target.matches('[data-editor-section="site-identity"]')) {
          this.siteIdentityPanelOpen = Boolean(target.open);
        }
      };

      this.storeUpdateHandler = (event) => {
        if (event.detail?.source === this.instanceId) {
          return;
        }

        this.store.state = this.store.read();
        this.renderDraftList();
        this.renderLeftTemplates();
        this.renderLeftSources();

        const desiredId = this.currentDraft?.id || this.store.state.activeDraftId;
        if (desiredId) {
          const next = this.store.getDraft(desiredId);
          if (next) {
            this.currentDraft = deepClone(next);
            this.mountWriteSurface(this.currentDraft);
            this.renderDynamicPanels(this.currentDraft);
            this.renderLeftSources();
            this.syncHeaderState();
            this.updateResponsiveState();
            return;
          }
        }

        this.currentDraft = null;
        this.renderContextRail();
        this.renderLeftSources();
        this.renderEmptyPanels();
        this.syncHeaderState();
        this.updateResponsiveState();
      };

      this.root.addEventListener("click", this.rootClickHandler);
      this.root.addEventListener("toggle", this.siteIdentityToggleHandler, true);
      window.addEventListener("ns-editor-store-updated", this.storeUpdateHandler);
      this.boundRootEvents = true;
    }

    applyEditorThemeState(theme) {
      const nextTheme = normalizeWriteTheme(theme || this.currentDraft?.write?.theme || STABLE_EDITOR_THEME);
      const shell = this.refs?.shell || this.root?.querySelector?.('.ns-editor-shell') || null;
      const host = this.root?.querySelector?.('.ns-editor-shell-host') || null;
      const dark = nextTheme === 'dark';

      if (this.root) {
        this.root.dataset.editorTheme = nextTheme;
        this.root.classList.toggle('ns-editor-theme-dark', dark);
        this.root.classList.toggle('ns-editor-theme-light', !dark);
      }

      if (host) {
        host.dataset.editorTheme = nextTheme;
        host.classList.toggle('ns-editor-theme-dark', dark);
        host.classList.toggle('ns-editor-theme-light', !dark);
      }

      if (shell) {
        shell.dataset.editorTheme = nextTheme;
        shell.classList.toggle('ns-editor-shell--editor-dark', dark);
        shell.classList.toggle('ns-editor-shell--editor-light', !dark);
        shell.classList.toggle('ns-editor-theme-dark', dark);
        shell.classList.toggle('ns-editor-theme-light', !dark);
      }

      if (this.refs?.writeMount) {
        const writeRoot = this.refs.writeMount.querySelector('.ns-editor-write-root');
        if (writeRoot) {
          writeRoot.dataset.editorWriteTheme = nextTheme;
          writeRoot.classList.toggle('ns-editor-write-theme--dark', dark);
          writeRoot.classList.toggle('ns-editor-write-theme--light', !dark);
        }
      }
    }

    syncDrawerState() {
      const shell = this.refs?.shell;
      if (!shell) return;
      const theme = normalizeWriteTheme(this.currentDraft?.write?.theme || STABLE_EDITOR_THEME);
      shell.classList.toggle('ns-editor-shell--left-open', !!this.leftPanelOpen);
      shell.classList.toggle('ns-editor-shell--right-open', !!this.rightPanelOpen);
      shell.classList.toggle('ns-editor-shell--focus-mode', !!this.focusMode);
      this.applyEditorThemeState(theme);
      if (this.refs.leftDrawer) {
        this.refs.leftDrawer.setAttribute('aria-hidden', this.leftPanelOpen ? 'false' : 'true');
      }
      if (this.refs.rightDrawer) {
        this.refs.rightDrawer.setAttribute('aria-hidden', this.rightPanelOpen ? 'false' : 'true');
      }
    }

    getScrollHost(node) {
      let current = node && node.parentElement ? node.parentElement : null;
      while (current) {
        try {
          const style = window.getComputedStyle(current);
          const overflowY = `${style.overflowY || ''} ${style.overflow || ''}`;
          if (/(auto|scroll|overlay)/i.test(overflowY)) {
            return current;
          }
        } catch (error) {
          break;
        }
        current = current.parentElement;
      }
      return null;
    }

    captureScrollState() {
      const shell = this.refs?.shell || this.root;
      const host = shell ? this.getScrollHost(shell) : null;
      return {
        host,
        top: host ? host.scrollTop : (typeof window !== "undefined" ? window.scrollY : 0)
      };
    }

    restoreScrollState(state) {
      if (!state) return;
      requestAnimationFrame(() => {
        try {
          if (state.host) {
            state.host.scrollTop = state.top;
          } else if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            window.scrollTo({ top: state.top, behavior: "auto" });
          }
        } catch (error) {}
      });
    }

    scrollShellTopIntoView() {
      const shell = this.refs?.shell || this.root;
      if (!shell) return;
      requestAnimationFrame(() => {
        try {
          shell.scrollIntoView({ block: 'start', behavior: 'auto' });
        } catch (error) {
          try {
            shell.scrollIntoView(true);
          } catch (nestedError) {}
        }

        const host = this.getScrollHost(shell);
        if (host) {
          const offset = Math.max(0, shell.offsetTop - 10);
          try {
            host.scrollTop = offset;
          } catch (error) {}
        }
      });
    }

    scrollPrimaryIntoView() {
      const target = this.refs?.writeMount?.querySelector('.ns-editor-writer-stage')
        || this.refs?.writeMount?.querySelector('.ns-editor-write-root')
        || this.refs?.previewLive
        || this.refs?.deployMount;
      if (!target || typeof target.scrollIntoView !== 'function') return;
      requestAnimationFrame(() => {
        try {
          target.scrollIntoView({ block: 'start', behavior: 'auto' });
        } catch (error) {
          target.scrollIntoView(true);
        }
      });
    }

    toggleLeftPanel(force) {
      const next = typeof force === 'boolean' ? force : !this.leftPanelOpen;
      this.leftPanelOpen = next;
      if (next) {
        this.rightPanelOpen = false;
      }
      this.syncDrawerState();
      if (next) {
        this.scrollShellTopIntoView();
      }
    }

    toggleRightPanel(force) {
      const next = typeof force === 'boolean' ? force : !this.rightPanelOpen;
      this.rightPanelOpen = next;
      if (next) {
        this.leftPanelOpen = false;
      }
      this.syncDrawerState();
      if (next) {
        this.scrollShellTopIntoView();
      }
    }

    openPicker() {
      this.refs.pickerBackdrop?.classList.add("is-open");
    }

    closePicker() {
      this.refs.pickerBackdrop?.classList.remove("is-open");
    }

    broadcast() {
      window.dispatchEvent(
        new CustomEvent("ns-editor-store-updated", {
          detail: { source: this.instanceId }
        })
      );
    }

    switchTab(tabId) {
      const allowedTabs = this.surfaceType === "cabinet" ? CABINET_TABS : WORKSPACE_TABS;
      if (!allowedTabs.includes(tabId)) {
        return;
      }

      this.activeTab = tabId;

      this.root.querySelectorAll("[data-tab]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.tab === tabId);
      });

      this.root.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === tabId);
      });
    }

    createDraftFromTemplate(templateId, options) {
      const draft = createDraft(templateId, { locale: normalizeLocale(options && options.locale ? options.locale : getUiLanguage()) });
      const saved = this.store.saveDraft(draft);
      this.currentDraft = deepClone(saved);
      this.lastSavedAt = saved.updatedAt || this.lastSavedAt || "";

      this.lastCreatedTemplateId = saved.templateId || templateId || "";
      this.renderDraftList();
      this.renderPickerGrid();
      this.renderLeftTemplates();
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderContextRail();
      this.renderLeftSources();
      this.syncHeaderState();
      this.switchTab(this.surfaceType === "cabinet" ? "write" : "draft");
      this.closePicker();
      this.toggleLeftPanel(false);
      this.updateResponsiveState();
      this.scrollPrimaryIntoView();
      this.flashStatus(t("Template added and opened.", "Шаблон добавлен и открыт."));
      this.broadcast();
    }

    renderPickerGrid() {
      if (!this.refs || !this.refs.pickerGrid) return;

      const templates = getCurrentTemplates();
      this.refs.pickerGrid.innerHTML = templates.map((template) => {
        const meta = getTemplateUiMeta(template);
        const isActiveTemplate = Boolean(this.currentDraft && String(this.currentDraft.templateId) === String(template.id));
        const stateText = isActiveTemplate
          ? t("Added · opened", "Добавлен · открыт")
          : t("Click to add and open", "Нажмите, чтобы добавить и открыть");
        return `
          <button class="ns-editor-shell__picker-card ${isActiveTemplate ? "is-active" : ""}" type="button" data-template-id="${escapeHtml(template.id)}" aria-pressed="${isActiveTemplate ? "true" : "false"}">
            <div class="ns-editor-shell__picker-card-title">${escapeHtml(meta.name)}</div>
            <div class="ns-editor-shell__picker-card-desc">${escapeHtml(meta.description)}</div>
            <div class="ns-editor-shell__list-subtitle">${escapeHtml(translateTemplateCategory(template.category))}</div>
            <div class="ns-editor-shell__template-state">${escapeHtml(stateText)}</div>
          </button>
        `;
      }).join("");
    }

    renderLeftTemplates() {
      if (!this.refs || !this.refs.leftTemplates) return;

      const templates = getCurrentTemplates();
      this.refs.leftTemplates.innerHTML = templates.map((template) => {
        const meta = getTemplateUiMeta(template);
        const isActiveTemplate = Boolean(this.currentDraft && String(this.currentDraft.templateId) === String(template.id));
        return `
          <button class="ns-editor-shell__list-button ${isActiveTemplate ? "is-active" : ""}" type="button" data-template-id="${escapeHtml(template.id)}" aria-pressed="${isActiveTemplate ? "true" : "false"}">
            <span class="ns-editor-shell__list-title">${escapeHtml(meta.name)}</span>
            <span class="ns-editor-shell__list-subtitle">${escapeHtml(meta.description)}</span>
            <span class="ns-editor-shell__template-state">${escapeHtml(isActiveTemplate ? t("Added · opened", "Добавлен · открыт") : t("Add and open", "Добавить и открыть"))}</span>
          </button>
        `;
      }).join("");
    }

    renderLeftSources() {
      if (!this.refs.leftSources) return;

      const activeFile = getActiveLibraryItem();
      const activeNote = getActiveNote();
      const activeProject = this.currentDraft && this.currentDraft.projectId ? getProjectById(this.currentDraft.projectId) : null;

      this.refs.leftSources.innerHTML = `
        <div class="ns-editor-shell__mini-source">
          <strong>${t("Active file","Активный файл")}</strong><br />
          ${activeFile ? escapeHtml(activeFile.name || activeFile.id) : t("No active file","Нет активного файла")}
        </div>
        <div class="ns-editor-shell__mini-source">
          <strong>${t("Active note","Активная заметка")}</strong><br />
          ${activeNote ? escapeHtml(activeNote.title || activeNote.id) : t("No active note","Нет активной заметки")}
        </div>
        <div class="ns-editor-shell__mini-source">
          <strong>${t("Project","Проект")}</strong><br />
          ${activeProject ? escapeHtml(activeProject.title || activeProject.id) : (this.currentDraft && this.currentDraft.projectId ? escapeHtml(this.currentDraft.projectId) : t("No project linked","Проект не привязан"))}
        </div>
      `;
    }

    renderDraftList() {
      const drafts = this.store.getDrafts();
      const label = `${drafts.length} ${t("drafts","черновиков")}`;

      if (this.refs.headerDraftCount) {
        this.refs.headerDraftCount.textContent = label;
      }

      if (this.refs.sidebarDraftCount) {
        this.refs.sidebarDraftCount.textContent = label;
      }

      const listRoot = this.refs.draftList;
      if (!listRoot) return;

      if (!drafts.length) {
        listRoot.innerHTML = `<div class="ns-editor-shell__mini-empty">${t("No drafts yet.","Черновиков пока нет.")}</div>`;
        return;
      }

      listRoot.innerHTML = drafts.map((draft) => {
        const active = this.currentDraft?.id === draft.id ? "is-active" : "";
        const template = getTemplate(draft.templateId);

        return `
          <div class="ns-editor-shell__list-row ${active}">
            <button class="ns-editor-shell__list-button ${active}" type="button" data-draft-id="${escapeHtml(draft.id)}">
              <span class="ns-editor-shell__list-title">${escapeHtml(draft.meta.title || t("Untitled draft","Черновик без названия"))}</span>
              <span class="ns-editor-shell__list-subtitle">${escapeHtml(getTemplateUiMeta(template).name)} · ${escapeHtml(formatDateTime(draft.updatedAt))}</span>
            </button>
            <button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete" type="button" data-action="delete-draft-item" data-draft-id="${escapeHtml(draft.id)}">${t('Delete','Удалить')}</button>
          </div>
        `;
      }).join("");
    }

    syncHeaderState() {
      if (!this.refs.statusBadge) return;

      if (!this.currentDraft) {
        this.refs.statusBadge.textContent = t("No active draft","Нет активного черновика");
        return;
      }

      this.refs.statusBadge.textContent = `${t("Editing:","Редактируется:")} ${this.currentDraft.meta.title || t("Untitled draft","Черновик без названия")}`;
    }

    openDraft(draftId, focusContent, shouldBroadcast, targetTab) {
      const draft = this.store.getDraft(draftId);
      if (!draft) return;

      this.store.setActiveDraft(draft.id);
      this.currentDraft = deepClone(draft);
      this.lastSavedAt = draft.updatedAt || this.lastSavedAt || "";

      this.renderDraftList();
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderContextRail();
      this.renderLeftSources();
      this.syncHeaderState();

      if (focusContent) {
        this.switchTab(targetTab || (this.surfaceType === "cabinet" ? "write" : "draft"));
        this.toggleLeftPanel(false);
      }

      this.syncDrawerState();
      this.updateResponsiveState();
      this.scrollPrimaryIntoView();

      if (shouldBroadcast) {
        this.broadcast();
      }
    }

    mountWriteSurface(draft) {
      const mount = this.refs.writeMount;
      if (!mount) return;

      this.slugEdited = false;

      if (this.formInputHandler) {
        mount.removeEventListener("input", this.formInputHandler);
        this.refs.settingsMount?.removeEventListener("input", this.formInputHandler);
        this.formInputHandler = null;
      }

      if (this.formChangeHandler) {
        mount.removeEventListener("change", this.formChangeHandler);
        this.refs.settingsMount?.removeEventListener("change", this.formChangeHandler);
        this.formChangeHandler = null;
      }

      if (this.writeInputHandler) {
        mount.removeEventListener("input", this.writeInputHandler);
        mount.removeEventListener("click", this.writeInputHandler);
        mount.removeEventListener("change", this.writeInputHandler);
        this.refs.settingsMount?.removeEventListener("input", this.writeInputHandler);
        this.refs.settingsMount?.removeEventListener("click", this.writeInputHandler);
        this.refs.settingsMount?.removeEventListener("change", this.writeInputHandler);
        this.writeInputHandler = null;
      }

      if (this.writeMouseDownHandler) {
        mount.removeEventListener("mousedown", this.writeMouseDownHandler);
        this.refs.settingsMount?.removeEventListener("mousedown", this.writeMouseDownHandler);
        this.writeMouseDownHandler = null;
      }

      this.savedVisualRange = null;

      draft.write = draft.write || {};
      if (!String(draft.write.visualHtml || "").trim()) {
        draft.write.visualHtml = String(draft.write.markdown || "").trim() ? markdownToHtml(draft.write.markdown) : blocksToHtml(draft.write.blocks || []);
      }
      draft.write.mode = STABLE_EDITOR_MODE;
      draft.write.theme = normalizeWriteTheme(draft.write.theme || STABLE_EDITOR_THEME);
      const mode = STABLE_EDITOR_MODE;
      const theme = normalizeWriteTheme(draft.write.theme || STABLE_EDITOR_THEME);
      const activeFile = getActiveLibraryItem();
      const activeNote = getActiveNote();
      const linkedFiles = uniqueIds(draft.linkedFileIds).map((fileId) => getLibraryItemById(fileId)).filter(Boolean);
      const linkedNotes = uniqueIds(draft.linkedNoteIds).map((noteId) => getNoteById(noteId)).filter(Boolean);
      const siteProfile = getSiteProfile();
      const template = getTemplate(draft.templateId);
      const canvasPreset = getEditorCanvasPreset(draft);

      mount.innerHTML = `
        <div class="ns-editor-write-root ns-editor-write-root--visual-only ns-editor-write-theme--${theme} ${this.focusMode ? "is-focus-mode" : ""}" data-editor-write-theme="${escapeHtml(theme)}">
          <input type="hidden" name="writeTheme" value="${escapeHtml(theme)}" />
          <section class="ns-editor-writer-stage">
            <div class="ns-editor-writer-stage__head ns-editor-writer-stage__head--stable">
              <div class="ns-editor-writer-stage__intro">
                <div class="ns-editor-writer-stage__eyebrow">${escapeHtml(getTemplateUiMeta(template).name)} · ${escapeHtml(translateTemplateCategory(template.category))}</div>
                <div class="ns-editor-writer-stage__copy">${t("The document stays in the center. Drafts and settings live in side columns, not above the letter.","Документ находится в центре. Черновики и настройки живут в боковых колонках, а не поверх письма.")}</div>
              </div>
              <div class="ns-editor-writer-stage__stable-actions">
                <button class="ns-editor-shell__button ${this.focusMode ? "is-active" : ""}" type="button" data-action="toggle-focus-mode">${this.focusMode ? t("Exit focus","Выйти из фокуса") : t("Focus","Фокус")}</button>
              </div>
            </div>

            <div class="ns-editor-write-stable-row">
              <div class="ns-editor-write-stable-chip">${t("Mode","Режим")}: ${t("Visual writing","Визуальное письмо")}</div>
              <div class="ns-editor-write-stable-chip">${t("Canvas","Холст")}: ${escapeHtml(theme === 'dark' ? t('Dark cabinet','Тёмный кабинет') : t('Light cabinet','Светлый кабинет'))}</div>
              <div class="ns-editor-theme-toggle" role="group" aria-label="${t("Editor theme","Тема редактора")}">
                <button class="ns-editor-theme-button ${theme === 'light' ? 'is-active' : ''}" type="button" data-action="set-write-theme" data-value="light">${t("Light","Светлая")}</button>
                <button class="ns-editor-theme-button ${theme === 'dark' ? 'is-active' : ''}" type="button" data-action="set-write-theme" data-value="dark">${t("Dark","Тёмная")}</button>
              </div>
            </div>

            <div class="ns-editor-write-surfaces">
              <section class="ns-editor-write-surface is-active" data-write-surface="visual">
                <div class="ns-editor-document-canvas ${canvasPreset.frameClass}">
                  <div class="ns-editor-document-canvas__bar">
                    <div class="ns-editor-document-canvas__meta">
                      <div class="ns-editor-document-canvas__eyebrow">${escapeHtml(canvasPreset.typeLabel)}</div>
                      <div class="ns-editor-document-canvas__title">${escapeHtml(getTemplateUiMeta(template).name)}</div>
                      <div class="ns-editor-document-canvas__note">${escapeHtml(canvasPreset.note)}</div>
                    </div>
                    <div class="ns-editor-document-canvas__chips">
                      <span class="ns-editor-document-canvas__chip ns-editor-document-canvas__chip--label" title="${t('Template type','Тип шаблона')}">${escapeHtml(canvasPreset.widthLabel)}</span>
                      <span class="ns-editor-document-canvas__chip ns-editor-document-canvas__chip--label" title="${t('Canvas theme','Тема холста')}">${escapeHtml(theme === 'dark' ? t('Dark cabinet','Тёмный кабинет') : t('Light cabinet','Светлый кабинет'))}</span>
                      <span class="ns-editor-document-canvas__chip ns-editor-document-canvas__chip--label" title="${t('Editor engine','Движок редактора')}">${t("Full editor","Полный редактор")}</span>
                    </div>
                  </div>
                  <div class="ns-editor-document-canvas__viewport">
                    <div class="ns-editor-visual-engine-host" data-role="visual-engine-host">
                      <div class="ns-editor-engine-banner" data-role="visual-engine-hint">${t("Loading the full editor… If Jodit is not installed yet, the safe fallback surface will stay active.","Загружается полноценный редактор… Если Jodit ещё не установлен, останется безопасная резервная поверхность.")}</div>
                      <div class="ns-editor-visual ns-editor-visual--fallback" contenteditable="true" spellcheck="true" data-write-input="visual">${draft.write.visualHtml}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div class="ns-editor-writer-stage__stats" data-role="writer-stats"></div>

            <details class="ns-editor-disclosure ns-editor-disclosure--document-meta">
              <summary>${t("Document header and metadata","Заголовок и метаданные документа")}</summary>
              <div class="ns-editor-disclosure__body">
                <div class="ns-editor-field full ns-editor-field--hero-title ns-editor-field--stage-title">
                  <label>${t("Title","Заголовок")}</label>
                  <textarea class="ns-editor-textarea ns-editor-textarea--title" name="title" rows="2">${escapeHtml(draft.meta.title)}</textarea>
                </div>

                <div class="ns-editor-field full ns-editor-field--stage-summary">
                  <label>${t("Lead / Short summary","Лид / Краткое описание")}</label>
                  <textarea class="ns-editor-textarea ns-editor-textarea--lead" name="summary">${escapeHtml(draft.meta.summary)}</textarea>
                </div>

                <div class="ns-editor-form-grid ns-editor-form-grid--writer-top ns-editor-form-grid--writer-meta">
                  <div class="ns-editor-field">
                    <label>${t("Kicker","Кикер")}</label>
                    <input class="ns-editor-input" name="kicker" value="${escapeHtml(draft.meta.kicker)}" />
                  </div>

                  <div class="ns-editor-field">
                    <label>${t("Author","Автор")}</label>
                    <input class="ns-editor-input" name="author" value="${escapeHtml(draft.meta.author)}" />
                  </div>

                  <div class="ns-editor-field">
                    <label>${t("Category","Категория")}</label>
                    <input class="ns-editor-input" name="category" value="${escapeHtml(draft.meta.category)}" />
                  </div>
                </div>
              </div>
            </details>
          </section>

          <details class="ns-editor-disclosure ns-editor-disclosure--site-identity" data-editor-section="site-identity"${this.siteIdentityPanelOpen ? " open" : ""}>
            <summary>${t("Site identity","Идентичность сайта")}</summary>
            <div class="ns-editor-disclosure__body">
              <div class="ns-editor-form-grid ns-editor-form-grid--meta-compact">
                <div class="ns-editor-field full">
                  <label>${t("Site name","Название сайта")}</label>
                  <input class="ns-editor-input" name="siteProfileSiteName" value="${escapeHtml(siteProfile.siteName)}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Tagline","Слоган")}</label>
                  <input class="ns-editor-input" name="siteProfileTagline" value="${escapeHtml(siteProfile.tagline)}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Logo path or Data URL","Путь к логотипу или Data URL")}</label>
                  <input class="ns-editor-input" name="siteProfileLogoPath" value="${escapeHtml(siteProfile.logoPath)}" placeholder="${t('assets/branding/logo.svg or pasted Data URL','assets/branding/logo.svg или вставленный data URL')}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Favicon / site icon","Favicon / иконка сайта")}</label>
                  <input class="ns-editor-input" name="siteProfileFaviconPath" value="${escapeHtml(siteProfile.faviconPath)}" placeholder="${t('favicon.ico, favicon.svg, PNG, or pasted Data URL','favicon.ico, favicon.svg, PNG или вставленный Data URL')}" />
                  <p class="ns-editor-field-hint">${t("Use ICO for compatibility, SVG for sharp modern browsers and search services. You can upload an icon or generate one from letters below.", "ICO нужен для совместимости, SVG — для чёткого отображения в современных браузерах и поисковых сервисах. Ниже можно загрузить иконку или создать её из букв.")}</p>
                </div>

                <div class="ns-editor-field">
                  <label>${t("Contact email","Контактная почта")}</label>
                  <input class="ns-editor-input" name="siteProfileContactEmail" value="${escapeHtml(siteProfile.contactEmail)}" placeholder="hello@example.com" />
                </div>

                <div class="ns-editor-field">
                  <label>${t("Footer text","Текст подвала")}</label>
                  <input class="ns-editor-input" name="siteProfileFooterText" value="${escapeHtml(siteProfile.footerText)}" placeholder="${t('Built with IRGEZTNE','Сделано в IRGEZTNE')}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Menu items (comma-separated)","Пункты меню (через запятую)")}</label>
                  <input class="ns-editor-input" name="siteProfileNavItems" value="${escapeHtml((siteProfile.navItems || []).join(", "))}" placeholder="${t('Overview, Stories, Contact','Обзор, Истории, Контакт')}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Logo upload","Загрузка логотипа")}</label>
                  <div class="ns-editor-relations-actions ns-editor-branding-actions">
                    <input class="ns-editor-input" type="file" accept="image/*" data-role="site-logo-file" />
                    <button class="ns-editor-shell__button" type="button" data-action="clear-site-logo">${t("Clear logo","Очистить логотип")}</button>
                    <button class="ns-editor-shell__button" type="button" data-action="reset-site-identity">${t("Reset identity","Сбросить идентичность")}</button>
                  </div>
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Favicon upload","Загрузка favicon")}</label>
                  <div class="ns-editor-relations-actions ns-editor-branding-actions">
                    <input class="ns-editor-input" type="file" accept=".ico,.svg,.png,.jpg,.jpeg,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/png,image/jpeg,image/*" data-role="site-favicon-file" />
                    <button class="ns-editor-shell__button" type="button" data-action="clear-site-favicon">${t("Clear favicon","Очистить favicon")}</button>
                  </div>
                </div>

                <div class="ns-editor-field full ns-editor-favicon-generator">
                  <label>${t("Generate favicon from letters","Создать favicon из букв")}</label>
                  <div class="ns-editor-favicon-generator__row">
                    <input class="ns-editor-input ns-editor-favicon-generator__letters" name="siteFaviconLetters" maxlength="3" value="${escapeHtml(getInitials(siteProfile.siteName))}" aria-label="${t('Favicon letters','Буквы favicon')}" />
                    <input class="ns-editor-input ns-editor-favicon-generator__color" name="siteFaviconBackground" type="color" value="${escapeHtml(siteProfile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor)}" aria-label="${t('Favicon background','Фон favicon')}" />
                    <input class="ns-editor-input ns-editor-favicon-generator__color" name="siteFaviconForeground" type="color" value="#ffffff" aria-label="${t('Favicon text color','Цвет букв favicon')}" />
                    <select class="ns-editor-input ns-editor-favicon-generator__shape" name="siteFaviconShape" aria-label="${t('Favicon shape','Форма favicon')}">
                      <option value="rounded" selected>${t("Round","Скругл.")}</option>
                      <option value="square">${t("Square","Квадрат")}</option>
                      <option value="circle">${t("Circle","Круг")}</option>
                    </select>
                    <button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="generate-site-favicon">${t("Generate","Создать")}</button>
                  </div>
                  <p class="ns-editor-field-hint">${t("The first version stores the generated icon as an SVG Data URL, so it travels with the draft preview/export without extra files.", "Первая версия сохраняет созданную иконку как SVG Data URL, поэтому она работает в предпросмотре/экспорте без отдельного файла.")}</p>
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Current site identity preview","Текущий предпросмотр идентичности сайта")}</label>
                  <div data-role="site-identity-preview">${renderSiteIdentityPreview(siteProfile)}</div>
                </div>
              </div>
            </div>
          </details>

          <details class="ns-editor-disclosure">
            <summary>${t("Article settings","Настройки статьи")}</summary>
            <div class="ns-editor-disclosure__body">
              <div class="ns-editor-form-grid ns-editor-form-grid--meta-compact">
                <div class="ns-editor-field">
                  <label>${t("Slug","Слаг")}</label>
                  <input class="ns-editor-input" name="slug" value="${escapeHtml(draft.meta.slug)}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Short excerpt","Краткая выжимка")}</label>
                  <textarea class="ns-editor-textarea" name="excerpt">${escapeHtml(draft.meta.excerpt || "")}</textarea>
                </div>

                <div class="ns-editor-field full">
                  <label>${t("SEO title","SEO-заголовок")}</label>
                  <input class="ns-editor-input" name="seoTitle" value="${escapeHtml(draft.meta.seoTitle || draft.meta.title || "")}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("SEO description","SEO-описание")}</label>
                  <textarea class="ns-editor-textarea" name="seoDescription">${escapeHtml(draft.meta.seoDescription || draft.meta.summary || siteHeaderMeta || "")}</textarea>
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Keywords (comma-separated)","Ключевые слова (через запятую)")}</label>
                  <input class="ns-editor-input" name="keywords" value="${escapeHtml(tagsToString(draft.meta.keywords))}" />
                </div>

                <div class="ns-editor-field full">
                  <label>${t("Tags (comma-separated)","Теги (через запятую)")}</label>
                  <input class="ns-editor-input" name="tags" value="${escapeHtml(tagsToString(draft.meta.tags))}" />
                </div>
              </div>
            </div>
          </details>

          <details class="ns-editor-disclosure" ${this.focusMode ? "" : ""}>
            <summary>${t("Project and related context","Проект и связанный контекст")}</summary>
            <div class="ns-editor-disclosure__body">
              <section class="ns-editor-relations-card ns-editor-relations-card--compact">
                <div class="ns-editor-relations-head">
                  <div class="ns-editor-write-mode-label">${t("Links","Связи")}</div>
                  <div class="ns-editor-relations-actions">
                    <button class="ns-editor-shell__button" type="button" data-action="open-projects">${t("Projects","Проекты")}</button>
                    <button class="ns-editor-shell__button" type="button" data-action="open-files">${t("Files","Файлы")}</button>
                    <button class="ns-editor-shell__button" type="button" data-action="open-notes">${t("Notes","Заметки")}</button>
                  </div>
                </div>

                <div class="ns-editor-form-grid ns-editor-form-grid--relations">
                  <div class="ns-editor-field">
                    <label>${t("Project","Проект")}</label>
                    <select class="ns-editor-input" name="projectId">${getProjectOptions(draft.projectId)}</select>
                  </div>

                  <div class="ns-editor-field full">
                    <label>${t("Link current context","Привязать текущий контекст")}</label>
                    <div class="ns-editor-relations-actions">
                      ${draft.projectId ? `<button class="ns-editor-shell__button" type="button" data-action="open-current-project">${t("Open project","Открыть проект")}</button>` : `<span class="ns-editor-shell__mini-empty">${t("There is no project yet","Проекта пока нет")}</span>`}
                      ${activeFile ? `<button class="ns-editor-shell__button" type="button" data-action="link-active-file">${t("Link active file","Привязать активный файл")}</button>` : `<span class="ns-editor-shell__mini-empty">${t("There is no active file","Нет активного файла")}</span>`}
                      ${activeNote ? `<button class="ns-editor-shell__button" type="button" data-action="link-active-note">${t("Link active note","Привязать активную заметку")}</button>` : `<span class="ns-editor-shell__mini-empty">${t("There is no active note","Нет активной заметки")}</span>`}
                    </div>
                    <input type="hidden" name="linkedFileIds" value="${escapeHtml(uniqueIds(draft.linkedFileIds).join(","))}" />
                    <input type="hidden" name="linkedNoteIds" value="${escapeHtml(uniqueIds(draft.linkedNoteIds).join(","))}" />
                  </div>
                </div>

                <div class="ns-editor-relations-lists">
                  <section class="ns-editor-relations-group">
                    <div class="ns-editor-relations-title">${t("Linked files","Связанные файлы")}</div>
                    ${linkedFiles.length ? linkedFiles.map((item) => `
                      <div class="ns-editor-relations-row">
                        <div class="ns-editor-relations-main">
                          <strong>${escapeHtml(item.name || item.id)}</strong>
                          <span>${escapeHtml(item.category || item.type || t("file","файл"))}</span>
                        </div>
                        <div class="ns-editor-relations-buttons">
                          <button class="ns-editor-shell__button" type="button" data-action="open-linked-file" data-file-id="${escapeHtml(item.id)}">${t("Open","Открыть")}</button>
                          <button class="ns-editor-shell__button ns-editor-shell__button--danger" type="button" data-action="detach-linked-file" data-file-id="${escapeHtml(item.id)}">${t("Detach","Отвязать")}</button>
                        </div>
                      </div>
                    `).join("") : '<div class="ns-editor-shell__mini-empty">${t("No files are linked to this draft.","К этому черновику нет привязанных файлов.")}</div>'}
                  </section>

                  <section class="ns-editor-relations-group">
                    <div class="ns-editor-relations-title">${t("Linked notes","Связанные заметки")}</div>
                    ${linkedNotes.length ? linkedNotes.map((note) => `
                      <div class="ns-editor-relations-row">
                        <div class="ns-editor-relations-main">
                          <strong>${escapeHtml(note.title || note.id)}</strong>
                          <span>${escapeHtml(note.type || t("note","заметка"))}</span>
                        </div>
                        <div class="ns-editor-relations-buttons">
                          <button class="ns-editor-shell__button" type="button" data-action="open-linked-note" data-note-id="${escapeHtml(note.id)}">${t("Open","Открыть")}</button>
                          <button class="ns-editor-shell__button ns-editor-shell__button--danger" type="button" data-action="detach-linked-note" data-note-id="${escapeHtml(note.id)}">${t("Detach","Отвязать")}</button>
                        </div>
                      </div>
                    `).join("") : '<div class="ns-editor-shell__mini-empty">${t("No notes are linked to this draft.","К этому черновику нет привязанных заметок.")}</div>'}
                  </section>
                </div>
              </section>
            </div>
          </details>
        </div>
      `;

      this.lastSavedAt = draft.updatedAt || this.lastSavedAt || "";

      const titleInput = mount.querySelector('[name="title"]');
      const slugInput = mount.querySelector('[name="slug"]');

      if (titleInput && slugInput) {
        titleInput.addEventListener("input", () => {
          if (!this.slugEdited) {
            slugInput.value = slugify(titleInput.value);
          }
        });

        slugInput.addEventListener("input", () => {
          this.slugEdited = true;
        });
      }

      if (this.refs.settingsMount) {
        const disclosures = Array.from(mount.querySelectorAll(".ns-editor-disclosure"));
        this.refs.settingsMount.innerHTML = "";
        disclosures.forEach((node) => {
          node.classList.add("ns-editor-disclosure--side-panel");
          this.refs.settingsMount.appendChild(node);
        });
      }

      const blocksList = mount.querySelector('[data-role="blocks-list"]');
      if (blocksList) {
        this.renderBlocksList(blocksList, draft.write.blocks);
      }

      this.renderWriterMetrics(draft);

      const visualEditor = mount.querySelector('[data-write-input="visual"]');
      if (visualEditor) {
        ["mouseup", "keyup", "focus", "input"].forEach((eventName) => {
          visualEditor.addEventListener(eventName, () => this.captureVisualSelection());
        });
      }

      this.destroyVisualEngine();
      this.detachFormHandlers();

      this.formInputHandler = (event) => {
        this.syncSiteProfileFromForm(event && event.target ? event.target : null);
        this.currentDraft = this.readForm();
        this.renderDynamicPanels(this.currentDraft);
        this.renderWriterMetrics(this.currentDraft);
        this.syncHeaderState();
        this.updateResponsiveState();
        this.scheduleAutosave();
      };

      this.formChangeHandler = (event) => {
        if (event && event.target && event.target.matches('[data-role="site-logo-file"], [data-role="site-favicon-file"]')) {
          return;
        }
        this.syncSiteProfileFromForm(event && event.target ? event.target : null);
        this.currentDraft = this.readForm();
        this.renderDynamicPanels(this.currentDraft);
        this.renderWriterMetrics(this.currentDraft);
        this.syncHeaderState();
        this.updateResponsiveState();
        this.scheduleAutosave();
      };

      this.writeMouseDownHandler = (event) => {
        const actionTarget = event.target.closest("[data-action]");
        if (!actionTarget) return;
        const action = actionTarget.dataset.action || "";
        if (action.startsWith("format-")) {
          event.preventDefault();
        }
      };

      this.writeInputHandler = (event) => {
        if (event.type === "click") {
          return;
        }

        if (event.target.matches('[data-role="site-logo-file"]')) {
          const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
          if (file) {
            event.preventDefault();
            this.handleSiteLogoFile(file);
          }
          return;
        }

        if (event.target.matches('[data-role="site-favicon-file"]')) {
          const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
          if (file) {
            event.preventDefault();
            this.handleSiteFaviconFile(file);
          }
          return;
        }

        if (event.target.matches('[data-block-field="type"]') || event.target.matches('[data-block-field="text"]')) {
          this.currentDraft = this.readForm();
          this.renderDynamicPanels(this.currentDraft);
          this.renderWriterMetrics(this.currentDraft);
          this.scheduleAutosave();
        }
      };

      this.formHosts = [mount, this.refs.settingsMount].filter(Boolean);
      this.formHosts.forEach((host) => {
        host.addEventListener("input", this.formInputHandler);
        host.addEventListener("change", this.formChangeHandler);
        host.addEventListener("mousedown", this.writeMouseDownHandler);
        host.addEventListener("change", this.writeInputHandler);
        host.addEventListener("input", this.writeInputHandler);
      });

      this.syncDrawerState();
      this.mountVisualEngine(draft);
    }

    detachFormHandlers() {
      if (!Array.isArray(this.formHosts) || !this.formHosts.length) return;
      this.formHosts.forEach((host) => {
        host.removeEventListener("input", this.formInputHandler);
        host.removeEventListener("change", this.formChangeHandler);
        host.removeEventListener("mousedown", this.writeMouseDownHandler);
        host.removeEventListener("change", this.writeInputHandler);
        host.removeEventListener("input", this.writeInputHandler);
      });
      this.formHosts = [];
    }

    getVisualInput() {
      return this.refs?.writeMount?.querySelector('[data-write-input="visual"]') || null;
    }

    captureVisualSelection() {
      const visualInput = this.getVisualInput();
      const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
      if (!visualInput || !selection || !selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const anchorNode = selection.anchorNode;
      if (!anchorNode || !visualInput.contains(anchorNode)) return;

      this.savedVisualRange = range.cloneRange();
    }

    restoreVisualSelection() {
      const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
      if (!selection || !this.savedVisualRange) return;

      selection.removeAllRanges();
      selection.addRange(this.savedVisualRange);
    }

    refreshAfterVisualToolbar() {
      this.currentDraft = this.readForm();
      this.renderDynamicPanels(this.currentDraft);
      this.syncHeaderState();
      this.updateResponsiveState();
      this.scheduleAutosave();
      this.captureVisualSelection();
    }

    applyVisualCommand(command, value) {
      const visualInput = this.getVisualInput();
      if (!visualInput || typeof document.execCommand !== "function") return false;

      visualInput.focus();
      this.restoreVisualSelection();

      try {
        document.execCommand("styleWithCSS", false, false);
      } catch (error) {
        // ignore: not all environments expose styleWithCSS
      }

      const ok = document.execCommand(command, false, value);
      this.refreshAfterVisualToolbar();
      return ok;
    }

    handleVisualToolbarAction(action) {
      const visualInput = this.getVisualInput();
      if (!visualInput) return;

      if (action === "format-link") {
        const rawUrl = window.prompt(t("Enter link URL","Введите адрес ссылки"), "https://");
        const url = normalizeLinkUrl(rawUrl);
        if (!url) return;
        this.applyVisualCommand("createLink", url);
        return;
      }

      if (action === "format-bold") {
        this.applyVisualCommand("bold");
        return;
      }

      if (action === "format-italic") {
        this.applyVisualCommand("italic");
        return;
      }

      if (action === "format-underline") {
        this.applyVisualCommand("underline");
        return;
      }

      if (action === "format-h1") {
        this.applyVisualCommand("formatBlock", "<h1>");
        return;
      }

      if (action === "format-h2") {
        this.applyVisualCommand("formatBlock", "<h2>");
        return;
      }

      if (action === "format-h3") {
        this.applyVisualCommand("formatBlock", "<h3>");
        return;
      }

      if (action === "format-paragraph") {
        this.applyVisualCommand("formatBlock", "<p>");
        return;
      }

      if (action === "format-ul") {
        this.applyVisualCommand("insertUnorderedList");
        return;
      }

      if (action === "format-ol") {
        this.applyVisualCommand("insertOrderedList");
        return;
      }

      if (action === "format-quote") {
        this.applyVisualCommand("formatBlock", "<blockquote>");
        return;
      }

      if (action === "format-divider") {
        this.applyVisualCommand("insertHorizontalRule");
        return;
      }

      if (action === "format-undo") {
        this.applyVisualCommand("undo");
        return;
      }

      if (action === "format-redo") {
        this.applyVisualCommand("redo");
        return;
      }

      if (action === "format-unlink") {
        this.applyVisualCommand("unlink");
        return;
      }

      if (action === "format-clear") {
        this.applyVisualCommand("removeFormat");
        this.applyVisualCommand("unlink");
      }
    }

    renderBlocksList(root, blocks) {
      root.innerHTML = normalizeBlocks(blocks, getTemplate(this.currentDraft?.templateId || DEFAULT_TEMPLATE_ID)).map((block, index, list) => {
        return `
          <div class="ns-editor-block">
            <div class="ns-editor-block__header">
              <div class="ns-editor-block__badge">${t("Block","Блок")} ${index + 1}</div>
              <div class="ns-editor-block__toolbar">
                <select class="ns-editor-input" data-block-id="${escapeHtml(block.id)}" data-block-field="type">
                  ${VALID_BLOCK_TYPES.map((type) => `<option value="${type}" ${type === block.type ? "selected" : ""}>${translateBlockTypeLabel(type)}</option>`).join("")}
                </select>
                <button class="ns-editor-shell__button" type="button" data-action="move-block-up" data-block-id="${escapeHtml(block.id)}" ${index === 0 ? "disabled" : ""}>${t("Up","Вверх")}</button>
                <button class="ns-editor-shell__button" type="button" data-action="move-block-down" data-block-id="${escapeHtml(block.id)}" ${index === list.length - 1 ? "disabled" : ""}>${t("Down","Вниз")}</button>
                <button class="ns-editor-shell__button ns-editor-shell__button--danger" type="button" data-action="remove-block" data-block-id="${escapeHtml(block.id)}">${t('Delete','Удалить')}</button>
              </div>
            </div>
            <textarea class="ns-editor-textarea ns-editor-textarea--block" data-block-id="${escapeHtml(block.id)}" data-block-field="text" placeholder="${t("Write block content...","Напишите содержимое блока...")}">${escapeHtml(block.text)}</textarea>
          </div>
        `;
      }).join("");
    }

    syncSiteProfileFromForm(target) {
      const mount = this.root;
      if (!mount) return getSiteProfile();
      if (target && target.name && !String(target.name).startsWith("siteProfile")) {
        return getSiteProfile();
      }

      const current = getSiteProfile();
      const nextPatch = {
        siteName: mount.querySelector('[name="siteProfileSiteName"]')?.value.trim() || current.siteName,
        tagline: mount.querySelector('[name="siteProfileTagline"]')?.value.trim() || "",
        logoPath: mount.querySelector('[name="siteProfileLogoPath"]')?.value.trim() || "",
        logoAlt: mount.querySelector('[name="siteProfileSiteName"]')?.value.trim() || current.logoAlt,
        faviconPath: mount.querySelector('[name="siteProfileFaviconPath"]')?.value.trim() || "",
        contactEmail: mount.querySelector('[name="siteProfileContactEmail"]')?.value.trim() || "",
        footerText: mount.querySelector('[name="siteProfileFooterText"]')?.value.trim() || "",
        navItems: String(mount.querySelector('[name="siteProfileNavItems"]')?.value || "")
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      };

      if (
        nextPatch.siteName === current.siteName &&
        nextPatch.tagline === current.tagline &&
        nextPatch.logoPath === current.logoPath &&
        nextPatch.logoAlt === current.logoAlt &&
        nextPatch.faviconPath === current.faviconPath &&
        nextPatch.contactEmail === current.contactEmail &&
        nextPatch.footerText === current.footerText &&
        JSON.stringify(nextPatch.navItems) === JSON.stringify(current.navItems)
      ) {
        return current;
      }

      const profile = updateSiteProfile(nextPatch);
      this.updateSiteIdentityPreview(profile);
      return profile;
    }

    refreshSiteIdentityEverywhere(profile, options = {}) {
      const scrollState = this.captureScrollState ? this.captureScrollState() : null;
      if (options.keepIdentityOpen !== false) {
        this.siteIdentityPanelOpen = true;
      }
      const nextProfile = normalizeSiteProfile(profile || getSiteProfile());
      this.updateSiteIdentityPreview(nextProfile);

      if (!this.currentDraft) {
        this.renderDynamicPanels(null);
        if (options.keepIdentityOpen !== false) {
          this.setSiteIdentityOpen(true, { sticky: true });
        }
        this.restoreScrollState?.(scrollState);
        return;
      }

      const shouldRemount = options.remountWrite !== false;
      const draft = this.readForm() || deepClone(this.currentDraft);
      draft.write = draft.write || {};
      draft.write.visualHtml = applySiteIdentityToProjectLanding(
        draft.write.visualHtml,
        nextProfile,
        nextProfile.siteName,
        nextProfile.tagline
      );
      draft.content = draft.content || {};
      draft.content.body = buildBodyFromWrite(draft.write);

      const saved = this.store.saveDraft(draft);
      this.currentDraft = deepClone(saved);
      this.lastSavedAt = saved.updatedAt || this.lastSavedAt || "";

      if (shouldRemount) {
        this.mountWriteSurface(this.currentDraft);
      }

      this.renderDynamicPanels(this.currentDraft);
      this.renderContextRail();
      this.syncHeaderState();
      this.updateResponsiveState();
      if (options.keepIdentityOpen !== false) {
        this.setSiteIdentityOpen(true, { sticky: true });
      }
      this.restoreScrollState?.(scrollState);

      if (options.message) {
        this.flashStatus(options.message);
      }
    }

    setSiteIdentityOpen(open, options = {}) {
      const value = Boolean(open);
      this.siteIdentityPanelOpen = value;

      const apply = () => {
        const nodes = Array.from(this.root?.querySelectorAll('[data-editor-section="site-identity"]') || []);
        nodes.forEach((node) => {
          node.open = value;
        });
      };

      apply();

      if (options.sticky !== false) {
        requestAnimationFrame(apply);
        setTimeout(apply, 60);
        setTimeout(apply, 180);
        setTimeout(apply, 360);
      }
    }

    updateSiteIdentityPreview(profile) {
      const mount = this.root;
      if (!mount) return;
      const host = mount.querySelector('[data-role="site-identity-preview"]');
      if (host) {
        host.innerHTML = renderSiteIdentityPreview(profile || getSiteProfile());
      }
    }

    updateSiteIdentityFields(profile) {
      const mount = this.root;
      const next = normalizeSiteProfile(profile || getSiteProfile());
      if (!mount) return next;
      const nameInput = mount.querySelector('[name="siteProfileSiteName"]');
      const taglineInput = mount.querySelector('[name="siteProfileTagline"]');
      const logoInput = mount.querySelector('[name="siteProfileLogoPath"]');
      const faviconInput = mount.querySelector('[name="siteProfileFaviconPath"]');
      const contactInput = mount.querySelector('[name="siteProfileContactEmail"]');
      const footerInput = mount.querySelector('[name="siteProfileFooterText"]');
      const navInput = mount.querySelector('[name="siteProfileNavItems"]');
      const fileInput = mount.querySelector('[data-role="site-logo-file"]');
      const faviconFileInput = mount.querySelector('[data-role="site-favicon-file"]');
      const faviconLettersInput = mount.querySelector('[name="siteFaviconLetters"]');
      if (nameInput) nameInput.value = next.siteName;
      if (taglineInput) taglineInput.value = next.tagline;
      if (logoInput) logoInput.value = next.logoPath;
      if (faviconInput) faviconInput.value = next.faviconPath;
      if (contactInput) contactInput.value = next.contactEmail;
      if (footerInput) footerInput.value = next.footerText;
      if (navInput) navInput.value = Array.isArray(next.navItems) ? next.navItems.join(', ') : '';
      if (fileInput) fileInput.value = "";
      if (faviconFileInput) faviconFileInput.value = "";
      if (faviconLettersInput && !faviconLettersInput.value.trim()) faviconLettersInput.value = getInitials(next.siteName);
      this.updateSiteIdentityPreview(next);
      return next;
    }

    handleSiteLogoFile(file) {
      if (!file) return;
      this.siteIdentityPanelOpen = true;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const profile = this.updateSiteIdentityFields({ ...getSiteProfile(), logoPath: result, logoAlt: file.name || getSiteProfile().siteName });
        const nextProfile = this.syncSiteProfileFromForm();
        this.refreshSiteIdentityEverywhere({ ...nextProfile, logoPath: result, logoAlt: file.name || nextProfile.logoAlt }, {
          remountWrite: true,
          keepIdentityOpen: true,
          message: t("Logo added to the template.", "Логотип добавлен в шаблон.")
        });
      };
      reader.onerror = () => {
        this.flashStatus(t("Could not load logo","Не удалось загрузить логотип"));
      };
      reader.readAsDataURL(file);
    }

    handleSiteFaviconFile(file) {
      if (!file) return;
      this.siteIdentityPanelOpen = true;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const profile = this.updateSiteIdentityFields({ ...getSiteProfile(), faviconPath: result });
        this.syncSiteProfileFromForm();
        this.refreshSiteIdentityEverywhere({ ...profile, faviconPath: result }, {
          remountWrite: false,
          keepIdentityOpen: true,
          message: t("Favicon added. It appears in the browser tab and exported HTML.", "Favicon добавлен. Он появится во вкладке браузера и в экспортированном HTML.")
        });
      };
      reader.onerror = () => {
        this.flashStatus(t("Could not load favicon", "Не удалось загрузить favicon"));
      };
      reader.readAsDataURL(file);
    }

    generateSiteFaviconFromForm() {
      const mount = this.root;
      if (!mount) return;
      const profile = getSiteProfile();
      const lettersInput = mount.querySelector('[name="siteFaviconLetters"]');
      const backgroundInput = mount.querySelector('[name="siteFaviconBackground"]');
      const foregroundInput = mount.querySelector('[name="siteFaviconForeground"]');
      const shapeInput = mount.querySelector('[name="siteFaviconShape"]');
      const dataUrl = buildGeneratedFaviconDataUrl({
        letters: lettersInput?.value || getInitials(profile.siteName),
        background: backgroundInput?.value || profile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor,
        foreground: foregroundInput?.value || "#ffffff",
        shape: shapeInput?.value || "rounded"
      });
      const nextProfile = this.updateSiteIdentityFields({ ...profile, faviconPath: dataUrl });
      this.syncSiteProfileFromForm();
      this.refreshSiteIdentityEverywhere({ ...nextProfile, faviconPath: dataUrl }, {
        remountWrite: false,
        keepIdentityOpen: true,
        message: t("Favicon generated from letters.", "Favicon создан из букв.")
      });
    }

    readForm() {

      if (!this.currentDraft) {
        return this.currentDraft;
      }

      const formRoot = this.root;
      const next = deepClone(this.currentDraft);
      const template = getTemplate(next.templateId);

      const title = formRoot.querySelector('[name="title"]')?.value.trim() || "";
      const slug = formRoot.querySelector('[name="slug"]')?.value.trim() || slugify(title) || uid("draft");

      next.meta.title = title || template.defaults.title;
      next.meta.slug = slug;
      next.meta.author = formRoot.querySelector('[name="author"]')?.value.trim() || template.defaults.author;
      next.meta.category = formRoot.querySelector('[name="category"]')?.value.trim() || template.category;
      next.meta.kicker = formRoot.querySelector('[name="kicker"]')?.value.trim() || template.defaults.kicker;
      next.meta.summary = formRoot.querySelector('[name="summary"]')?.value.trim() || "";
      next.meta.excerpt = formRoot.querySelector('[name="excerpt"]')?.value.trim() || next.meta.summary;
      next.meta.seoTitle = formRoot.querySelector('[name="seoTitle"]')?.value.trim() || next.meta.title;
      next.meta.seoDescription = formRoot.querySelector('[name="seoDescription"]')?.value.trim() || next.meta.summary;
      next.meta.keywords = parseTags(formRoot.querySelector('[name="keywords"]')?.value || "");
      next.meta.tags = parseTags(formRoot.querySelector('[name="tags"]')?.value || "");
      next.project.name = next.meta.title;
      next.project.slug = next.meta.slug;
      next.projectId = formRoot.querySelector('[name="projectId"]')?.value || "";
      next.linkedFileIds = uniqueIds(String(formRoot.querySelector('[name="linkedFileIds"]')?.value || "").split(",").map((item) => item.trim()).filter(Boolean));
      next.linkedNoteIds = uniqueIds(String(formRoot.querySelector('[name="linkedNoteIds"]')?.value || "").split(",").map((item) => item.trim()).filter(Boolean));

      next.write.mode = STABLE_EDITOR_MODE;
      next.write.theme = normalizeWriteTheme(formRoot.querySelector('[name="writeTheme"]')?.value || next.write.theme || STABLE_EDITOR_THEME);

      const visualInput = formRoot.querySelector('[data-write-input="visual"]');
      const markdownInput = formRoot.querySelector('[data-write-input="markdown"]');
      const blockTypeInputs = Array.from(formRoot.querySelectorAll('[data-block-field="type"]'));
      const blockTextInputs = Array.from(formRoot.querySelectorAll('[data-block-field="text"]'));

      next.write.visualHtml = this.getVisualEditorHtml() || (visualInput ? visualInput.innerHTML : next.write.visualHtml || '');

      if (markdownInput) {
        next.write.markdown = markdownInput.value;
      } else {
        next.write.markdown = htmlToPlainText(next.write.visualHtml).trim();
      }

      if (blockTextInputs.length) {
        next.write.blocks = blockTextInputs.map((input, index) => {
          const blockId = input.dataset.blockId || uid("block");
          const typeInput = blockTypeInputs[index];
          return {
            id: blockId,
            type: normalizeBlockType(typeInput?.value || "paragraph"),
            text: input.value || ""
          };
        });
      } else if (!Array.isArray(next.write.blocks) || !next.write.blocks.length) {
        next.write.blocks = textToBlocks(next.write.markdown || htmlToPlainText(next.write.visualHtml));
      }

      next.content.body = buildBodyFromWrite(next.write);
      next.deploy.manual.fileName = next.deploy?.manual?.fileName || `${next.meta.slug}.html`;
      next.deploy.sftp.remotePath = next.deploy?.sftp?.remotePath || `/public_html/${next.meta.slug}/`;

      return next;
    }

    setWriteMode(mode) {
      if (!this.currentDraft) return;
      this.flashStatus(t("Visual mode is fixed for v1 stability.", "Для стабильности v1 включён только визуальный режим."));
    }

    setWriteTheme(theme) {
      if (!this.currentDraft) return;
      const nextTheme = normalizeWriteTheme(theme);
      const activeTab = this.activeTab;
      const scrollState = this.captureScrollState();
      const keepLeftPanel = this.leftPanelOpen;
      const keepRightPanel = this.rightPanelOpen;
      const keepFocusMode = this.focusMode;

      const draft = this.readForm() || deepClone(this.currentDraft);
      draft.write = draft.write || {};
      draft.write.theme = nextTheme;
      draft.write.mode = STABLE_EDITOR_MODE;

      const saved = this.store.saveDraft(draft);
      this.currentDraft = deepClone(saved);
      this.lastSavedAt = saved.updatedAt || this.lastSavedAt || '';
      this.leftPanelOpen = keepLeftPanel;
      this.rightPanelOpen = keepRightPanel;
      this.focusMode = keepFocusMode;

      // Rebuild the isolated editor shell so the dark/light class is present from
      // the top-level markup, not only on the small status chips. This is safer
      // with Jodit because it also remounts the editor with the requested theme.
      this.render({ initialTab: activeTab });
      this.applyEditorThemeState(nextTheme);
      this.syncDrawerState();
      this.updateResponsiveState();
      this.restoreScrollState(scrollState);
      this.broadcast();
      this.flashStatus(nextTheme === 'dark' ? t('Dark editor theme enabled','Включена тёмная тема редактора') : t('Light editor theme enabled','Включена светлая тема редактора'));
    }

    addBlock() {
      if (!this.currentDraft) return;
      const draft = this.readForm();
      draft.write.blocks.push({ id: uid("block"), type: "paragraph", text: "" });
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.scheduleAutosave();
    }

    removeBlock(blockId) {
      if (!this.currentDraft) return;
      const draft = this.readForm();
      draft.write.blocks = draft.write.blocks.filter((block) => block.id !== blockId);
      if (!draft.write.blocks.length) {
        draft.write.blocks = [{ id: uid("block"), type: "paragraph", text: "" }];
      }
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.scheduleAutosave();
    }

    moveBlock(blockId, direction) {
      if (!this.currentDraft) return;
      const draft = this.readForm();
      const index = draft.write.blocks.findIndex((block) => block.id === blockId);
      if (index < 0) return;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= draft.write.blocks.length) return;
      const temp = draft.write.blocks[index];
      draft.write.blocks[index] = draft.write.blocks[targetIndex];
      draft.write.blocks[targetIndex] = temp;
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.scheduleAutosave();
    }

    scheduleAutosave() {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => {
        this.saveCurrentDraft(false);
      }, 300);
    }

    saveCurrentDraft(announce) {
      if (!this.currentDraft) return;

      const draftToSave = this.refs.writeMount?.querySelector('[name="title"]')
        ? this.readForm()
        : this.currentDraft;
      const previousDraft = this.store.getDraft(draftToSave.id);

      const saved = this.store.saveDraft(draftToSave);
      this.syncExternalRelations(previousDraft, saved);
      this.currentDraft = deepClone(saved);
      this.lastSavedAt = saved.updatedAt || nowIso();

      this.renderDraftList();
      this.renderDynamicPanels(this.currentDraft);
      this.renderContextRail();
      this.renderLeftSources();
      this.syncHeaderState();
      this.updateResponsiveState();
      this.renderWriterMetrics(this.currentDraft);
      this.broadcast();

      if (announce) {
        this.flashStatus(t('Draft saved','Черновик сохранён'));
        console.log("[NSEditorV1] Draft saved:", saved.id);
      }
    }

    buildWriterStatsMarkup(draft) {
      const sourceText = buildBodyFromWrite(draft?.write || {});
      const wordCount = countWords(sourceText);
      const charCount = countCharacters(sourceText);
      const readMinutes = estimateReadingMinutes(wordCount);
      const savedLabel = this.lastSavedAt ? `${t('Saved','Сохранено')} ${formatClock(this.lastSavedAt)}` : t('Autosave is enabled','Автосохранение включено');
      return [
        `<span class="ns-editor-stat"><strong>${wordCount}</strong> ${t('words','слов')}</span>`,
        `<span class="ns-editor-stat"><strong>${charCount}</strong> ${t('chars','симв.')}</span>`,
        `<span class="ns-editor-stat"><strong>${readMinutes || 0}</strong> ${t('min read','мин чтения')}</span>`,
        `<span class="ns-editor-stat ns-editor-stat--soft">${escapeHtml(savedLabel)}</span>`
      ].join("");
    }

    renderWriterMetrics(draft) {
      const statsRoot = this.refs?.writeMount?.querySelector('[data-role="writer-stats"]');
      if (!statsRoot || !draft) return;
      statsRoot.innerHTML = this.buildWriterStatsMarkup(draft);
    }


    ensureJoditReady() {
      if (root.Jodit && typeof root.Jodit.make === 'function') {
        return Promise.resolve(true);
      }
      if (this.joditReadyPromise) {
        return this.joditReadyPromise;
      }
      this.joditReadyPromise = new Promise((resolve) => {
        loadJoditAssets((ok) => resolve(Boolean(ok)));
      });
      return this.joditReadyPromise;
    }

    destroyVisualEngine() {
      if (this.visualEngine && typeof this.visualEngine.destruct === 'function') {
        try {
          this.visualEngine.destruct();
        } catch (error) {
          console.warn('[NSEditorV1] visual engine destroy failed:', error);
        }
      }
      this.visualEngine = null;
      this.visualEngineType = 'fallback';
    }

    handleVisualEngineUpdated() {
      if (!this.currentDraft) return;
      this.currentDraft = this.readForm();
      this.renderDynamicPanels(this.currentDraft);
      this.renderWriterMetrics(this.currentDraft);
      this.syncHeaderState();
      this.syncDrawerState();
      this.updateResponsiveState();
      this.scheduleAutosave();
    }

    getVisualEditorHtml() {
      if (this.visualEngine && typeof this.visualEngine.value === 'string') {
        return this.visualEngine.value;
      }
      const visualInput = this.getVisualInput();
      return visualInput ? visualInput.innerHTML : '';
    }

    async mountVisualEngine(draft) {
      const host = this.refs?.writeMount?.querySelector('[data-role="visual-engine-host"]');
      const hint = this.refs?.writeMount?.querySelector('[data-role="visual-engine-hint"]');
      const fallback = host?.querySelector('[data-write-input="visual"]');
      if (!draft || !host || !fallback) return;

      this.destroyVisualEngine();
      this.visualEngineType = 'fallback';
      host.classList.remove('is-jodit');
      fallback.hidden = false;
      if (hint) {
        hint.textContent = t('Loading the full editor… If Jodit is not installed yet, the safe fallback surface will stay active.','Загружается полноценный редактор… Если Jodit ещё не установлен, останется безопасная резервная поверхность.');
      }

      const ready = await this.ensureJoditReady();
      if (!ready || !this.currentDraft || this.currentDraft.id !== draft.id || !root.Jodit || typeof root.Jodit.make !== 'function') {
        if (hint) {
          hint.textContent = t('Full editor not loaded. Run npm install jodit, then restart IRGEZTNE to enable the real writing toolbar.','Полный редактор не загружен. Выполните npm install jodit и перезапустите IRGEZTNE, чтобы включить настоящий writing-toolbar.');
        }
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.className = 'ns-editor-visual-source';
      textarea.value = String(draft.write.visualHtml || fallback.innerHTML || '');
      host.appendChild(textarea);

      const theme = normalizeWriteTheme(draft.write.theme || STABLE_EDITOR_THEME) === 'dark' ? 'dark' : 'default';
      const config = {
        theme,
        toolbarButtonSize: 'small',
        toolbarAdaptive: false,
        statusbar: false,
        askBeforePasteHTML: false,
        askBeforePasteFromWord: false,
        defaultActionOnPaste: 'insert_as_html',
        showXPathInStatusbar: false,
        showCharsCounter: false,
        showWordsCounter: false,
        showPlaceholder: false,
        beautifyHTML: false,
        useSearch: true,
        sourceEditor: 'area',
        sourceMirror: false,
        useSplitMode: true,
        removeButtons: ['fullsize'],
        disabledPlugins: ['fullsize'],
        minHeight: 560,
        height: 'auto',
        editorClassName: 'ns-editor-jodit-content',
        className: 'ns-editor-jodit-shell',
        buttons: [
          'source', '|',
          'bold', 'italic', 'underline', 'strikethrough', '|',
          'ul', 'ol', 'outdent', 'indent', '|',
          'font', 'fontsize', 'brush', 'paragraph', '|',
          'table', 'link', 'hr', '|',
          'align', 'undo', 'redo', '|',
          'eraser', 'copyformat'
        ],
        buttonsMD: [
          'source', '|', 'bold', 'italic', 'underline', '|',
          'ul', 'ol', '|', 'paragraph', 'link', 'table', '|', 'undo', 'redo'
        ],
        buttonsSM: [
          'bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'link', 'undo', 'redo', 'source'
        ],
        buttonsXS: [
          'bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'undo', 'redo', 'source'
        ],
        events: {
          change: () => this.handleVisualEngineUpdated(),
          blur: () => this.handleVisualEngineUpdated()
        },
        uploader: {
          insertImageAsBase64URI: true
        }
      };

      try {
        this.visualEngine = root.Jodit.make(textarea, config);
        this.visualEngineType = 'jodit';
        host.classList.add('is-jodit');
        fallback.hidden = true;
        if (hint) {
          hint.textContent = t('Full editor loaded: Jodit. The unstable fullscreen tool is disabled for safety.','Полный редактор загружен: Jodit. Нестабильный fullscreen-инструмент отключён для безопасности.');
        }
      } catch (error) {
        console.warn('[NSEditorV1] Jodit init failed:', error);
        this.destroyVisualEngine();
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
        if (hint) {
          hint.textContent = t('Jodit failed to initialize. The safe fallback surface remains active.','Не удалось инициализировать Jodit. Остаётся безопасная резервная поверхность.');
        }
      }
    }

    toggleFocusMode() {
      if (!this.currentDraft) return;
      const draft = this.readForm();
      this.focusMode = !this.focusMode;
      if (this.focusMode) {
        this.leftPanelOpen = false;
        this.rightPanelOpen = false;
      }
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderWriterMetrics(this.currentDraft);
      this.syncHeaderState();
      this.syncDrawerState();
      this.updateResponsiveState();
      this.scrollPrimaryIntoView();
    }

    deleteDraftById(draftId) {
      const draft = this.store.getDraft(draftId);
      if (!draft) return;
      const title = draft.meta && draft.meta.title ? draft.meta.title : t('Untitled draft','Черновик без названия');
      const confirmed = window.confirm(t(`Delete draft “${title}”?`,`Удалить черновик «${title}»?`));
      if (!confirmed) return;
      this.clearExternalRelations(draft);
      this.store.deleteDraft(draftId);
      this.renderDraftList();
      const nextId = this.store.state.activeDraftId;
      if (nextId) {
        this.openDraft(nextId, false, false);
      } else {
        this.currentDraft = null;
        this.syncHeaderState();
        this.renderContextRail();
        this.renderLeftSources();
        this.renderEmptyPanels();
        if (this.refs.writeMount) {
          this.refs.writeMount.innerHTML = `<div class="ns-editor-shell__mini-empty">${t('There are no drafts left. Create a new one.','Черновиков больше нет. Создайте новый.')}</div>`;
        }
      }
    }

    clearOldDrafts() {
      const currentId = this.currentDraft && this.currentDraft.id ? this.currentDraft.id : this.store.state.activeDraftId;
      const drafts = this.store.getDrafts();
      const removable = drafts.filter((draft) => draft.id !== currentId).map((draft) => draft.id);
      if (!removable.length) {
        window.alert(t('There are no old drafts to remove.','Старых черновиков для удаления нет.'));
        return;
      }
      const confirmed = window.confirm(t(`Delete ${removable.length} old drafts and keep only the current one?`,`Удалить ${removable.length} старых черновиков и оставить только текущий?`));
      if (!confirmed) return;
      removable.forEach((draftId) => {
        const draft = this.store.getDraft(draftId);
        if (draft) this.clearExternalRelations(draft);
      });
      this.store.deleteDrafts(removable);
      this.renderDraftList();
      const nextId = this.store.state.activeDraftId;
      if (nextId) {
        this.openDraft(nextId, false, false);
      }
    }

    clearAllDrafts() {
      const drafts = this.store.getDrafts();
      if (!drafts.length) {
        window.alert(t('There is nothing to delete.','Удалять нечего.'));
        return;
      }
      const confirmed = window.confirm(t(`Delete all ${drafts.length} drafts? This action cannot be undone.`,`Удалить все ${drafts.length} черновиков? Это действие нельзя отменить.`));
      if (!confirmed) return;
      drafts.forEach((draft) => this.clearExternalRelations(draft));
      this.store.clearDrafts();
      this.currentDraft = null;
      this.renderDraftList();
      this.syncHeaderState();
      if (this.refs.writeMount) {
        this.refs.writeMount.innerHTML = `<div class="ns-editor-shell__mini-empty">${t('Drafts were cleared. Create a new one.','Черновики очищены. Создайте новый.')}</div>`;
      }
      this.renderDynamicPanels(null);
      this.renderContextRail();
      this.renderLeftSources();
    }

    deleteCurrentDraft() {

      if (!this.currentDraft) return;

      const draftId = this.currentDraft.id;
      const title = this.currentDraft.meta && this.currentDraft.meta.title ? this.currentDraft.meta.title : t('Untitled draft','Черновик без названия');
      const confirmed = window.confirm(t(`Delete draft “${title}”?`,`Удалить черновик «${title}»?`));
      if (!confirmed) return;

      const previousDraft = this.store.getDraft(draftId);
      this.clearExternalRelations(previousDraft);
      this.store.deleteDraft(draftId);
      this.store.state = this.store.read();

      clearTimeout(this.autosaveTimer);

      const nextId = this.store.state.activeDraftId;
      if (nextId) {
        this.currentDraft = null;
        this.renderDraftList();
        this.openDraft(nextId, false, false);
        this.broadcast();
        return;
      }

      this.currentDraft = null;
      this.renderDraftList();
      this.renderContextRail();
      this.renderLeftSources();
      this.renderEmptyPanels();
      if (this.refs.writeMount) {
        this.refs.writeMount.innerHTML = `<div class="ns-editor-shell__mini-empty">${t('There are no drafts left. Create a new one.','Черновиков больше нет. Создайте новый.')}</div>`;
      }
      this.syncHeaderState();
      this.updateResponsiveState();
      this.broadcast();
    }

    renderDynamicPanels(draft) {
      if (!draft) {
        this.renderEmptyPanels();
        this.renderContextRail();
        return;
      }
      this.renderPreviewPanel(draft);
      this.renderPreviewMeta(draft);
      this.renderDeployPanel(draft);
      this.renderContextRail();
    }

    renderEmptyPanels() {
      if (this.refs.writeMount) {
        this.refs.writeMount.innerHTML = `
          <div class="ns-editor-shell__empty-state">
            <div class="ns-editor-shell__empty-title">${t("No active draft","Нет активного черновика")}</div>
            <div class="ns-editor-shell__empty-copy">${t("Open templates to create a new draft.","Откройте шаблоны, чтобы создать новый черновик.")}</div>
          </div>
        `;
      }

      if (this.refs.previewLive) {
        this.refs.previewLive.innerHTML = `
          <div class="ns-editor-shell__empty-state">
            <div class="ns-editor-shell__empty-title">${t("Preview","Превью")}</div>
            <div class="ns-editor-shell__empty-copy">${t("Open a draft to see a live preview.","Откройте черновик, чтобы увидеть живой предпросмотр.")}</div>
          </div>
        `;
      }

      if (this.refs.previewMeta) {
        this.refs.previewMeta.innerHTML = "";
      }

      if (this.refs.deployMount) {
        this.refs.deployMount.innerHTML = `
          <div class="ns-editor-shell__empty-state">
            <div class="ns-editor-shell__empty-title">${t("Publishing panel v1","Панель публикации v1")}</div>
            <div class="ns-editor-shell__empty-copy">${t("Open a draft to export a ZIP now. SFTP, GitHub Pages, Netlify, and Vercel are planned next.","Откройте черновик, чтобы экспортировать ZIP сейчас. SFTP, GitHub Pages, Netlify и Vercel запланированы дальше.")}</div>
          </div>
        `;
      }

      if (this.refs.settingsMount) {
        this.refs.settingsMount.innerHTML = `<div class="ns-editor-shell__mini-empty">${t("Open a draft to configure site identity, SEO, and related context.","Откройте черновик, чтобы настроить идентичность сайта, SEO и связанный контекст.")}</div>`;
      }
    }

    renderPreviewPanel(draft) {
      if (!this.refs.previewLive) return;
      const inlineDoc = buildInlinePreviewDocument(draft);
      const previewSlug = draft && draft.meta && draft.meta.slug ? draft.meta.slug : "draft";
      const template = getTemplate(draft.templateId);
      this.refs.previewLive.innerHTML = `
        <div class="ns-editor-preview-stage">
          <div class="ns-editor-preview-stage__bar">
            <div class="ns-editor-preview-stage__bar-left">
              <div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div>
              <div class="ns-editor-preview-stage__label">${t("Live site preview","Живой предпросмотр сайта")}</div>
            </div>
            <div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static" aria-label="${t("Preview mode","Режим предпросмотра")}">
              <span class="ns-editor-preview-stage__device is-active">${t("Desktop preview","Десктоп-предпросмотр")}</span>
            </div>
          </div>
          <div class="ns-editor-preview-stage__viewport">
            <div class="ns-editor-preview-stage__canvas">
              <div class="ns-editor-preview-stage__canvas-head">
                <div class="ns-editor-preview-stage__canvas-site">${escapeHtml(getTemplateUiMeta(template).name)} · ${t("local site","локальный сайт")}</div>
                <div class="ns-editor-preview-stage__canvas-url">https://preview.local/${escapeHtml(previewSlug)}/</div>
              </div>
              <iframe class="ns-editor-preview-frame" title="${t("Live preview","Живой предпросмотр")}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin" srcdoc='${escapeHtml(inlineDoc)}'></iframe>
            </div>
          </div>
        </div>
      `;
    }

    renderPreviewMeta(draft) {
      if (!this.refs.previewMeta) return;

      const previewPath = this.previewMaterialized && this.previewMaterialized.slug === draft.meta.slug
        ? this.previewMaterialized.indexPath
        : "";

      this.refs.previewMeta.innerHTML = `
        <div class="ns-editor-preview-actions">
          <button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="open-preview-browser">${t("Open in workspace browser","Открыть в браузере пространства")}</button>
          <button class="ns-editor-shell__button" type="button" data-action="open-preview-external">${t("Open in browser","Открыть в браузере")}</button>
          <button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">${t("Copy preview path","Копировать путь к предпросмотру")}</button>
        </div>
        <div class="ns-editor-shell__meta-grid">
          <div class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">${t("Template","Шаблон")}</div>
            <div class="ns-editor-shell__mini-card-value">${escapeHtml(getTemplateUiMeta(getTemplate(draft.templateId)).name)}</div>
          </div>
          <div class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">${t("Write mode","Режим письма")}</div>
            <div class="ns-editor-shell__mini-card-value">${escapeHtml(translateWriteModeLabel(draft.write.mode))}</div>
          </div>
          <div class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">SEO Title</div>
            <div class="ns-editor-shell__mini-card-value">${escapeHtml(draft.meta.seoTitle)}</div>
          </div>
          <div class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">SEO Description</div>
            <div class="ns-editor-shell__mini-card-value">${escapeHtml(draft.meta.seoDescription)}</div>
          </div>
          <div class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">${t("Keywords","Ключевые слова")}</div>
            <div class="ns-editor-shell__mini-card-value">${escapeHtml(tagsToString(draft.meta.keywords))}</div>
          </div>
          <div class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">${t("Preview path","Путь к предпросмотру")}</div>
            <div class="ns-editor-shell__mini-card-value">${escapeHtml(previewPath || t('Build preview to get a local path.','Соберите предпросмотр, чтобы получить локальный путь.'))}</div>
          </div>
        </div>
      `;
    }

    renderDeployPanel(draft) {
      if (!this.refs.deployMount) return;

      const output = buildOutputPackage(draft);
      const previewPath = this.previewMaterialized && this.previewMaterialized.slug === draft.meta.slug
        ? this.previewMaterialized.indexPath
        : "";
      this.refs.deployMount.innerHTML = `
        <div class="ns-editor-deploy-actions">
          <button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="open-preview-browser">${t("Open in workspace browser","Открыть в браузере пространства")}</button>
          <button class="ns-editor-shell__button" type="button" data-action="open-preview-external">${t("Open in browser","Открыть в браузере")}</button>
          <button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">${t("Copy preview path","Копировать путь к предпросмотру")}</button>
          <div class="ns-editor-shell__mini-source">${escapeHtml(previewPath || t("The preview path appears after the first build.","Путь к предпросмотру появится после первой сборки."))}</div>
        </div>

        <div class="ns-editor-deploy-grid">
          <section class="ns-editor-shell__mini-card">
            <h3>${t("Manual export","Ручной экспорт")} <span style="display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:#e8f5df;color:#2f7d32;font-size:11px;font-weight:800;vertical-align:middle;">${t("Ready now","Готово сейчас")}</span></h3>
            <label class="ns-editor-field-label">${t("File name","Имя файла")}</label>
            <input class="ns-editor-input" data-deploy-field="manual.fileName" value="${escapeHtml(draft.deploy.manual.fileName)}" />
            <div class="ns-editor-deploy-actions ns-editor-deploy-actions--compact ns-editor-deploy-actions--export">
              <button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="export-site-zip">${t("Export ZIP","Экспорт ZIP")}</button>
            </div>
            <div class="ns-editor-shell__mini-source">${t("Files","Файлы")}: ${OUTPUT_FILES.join(", ")}</div>
            ${this.lastExportZipPath ? `<div class="ns-editor-shell__mini-source">${t("Last export","Последний экспорт")}: ${escapeHtml(this.lastExportZipPath)}</div><div class="ns-editor-shell__mini-source">${t("If the file manager opened, the ZIP was saved there.","Если открылся файловый менеджер, ZIP сохранён там.")}</div>` : ""}
          </section>

          <section class="ns-editor-shell__mini-card">
            <h3>SFTP <span style="display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:#f1e4cf;color:#8a5a2c;font-size:11px;font-weight:800;vertical-align:middle;">${t("Next","Далее")}</span></h3>
            <label class="ns-editor-field-label">${t("Host","Хост")}</label>
            <input class="ns-editor-input" data-deploy-field="sftp.host" value="${escapeHtml(draft.deploy.sftp.host)}" />
            <label class="ns-editor-field-label">${t("Port","Порт")}</label>
            <input class="ns-editor-input" data-deploy-field="sftp.port" value="${escapeHtml(draft.deploy.sftp.port)}" />
            <label class="ns-editor-field-label">${t("Username","Имя пользователя")}</label>
            <input class="ns-editor-input" data-deploy-field="sftp.username" value="${escapeHtml(draft.deploy.sftp.username)}" />
            <label class="ns-editor-field-label">${t("Remote path","Удаленный путь")}</label>
            <input class="ns-editor-input" data-deploy-field="sftp.remotePath" value="${escapeHtml(draft.deploy.sftp.remotePath)}" />
          </section>

          <section class="ns-editor-shell__mini-card">
            <h3>GitHub Pages <span style="display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:#f1e4cf;color:#8a5a2c;font-size:11px;font-weight:800;vertical-align:middle;">${t("Next","Далее")}</span></h3>
            <label class="ns-editor-field-label">${t("Repository","Репозиторий")}</label>
            <input class="ns-editor-input" data-deploy-field="github.repo" value="${escapeHtml(draft.deploy.github.repo)}" />
            <label class="ns-editor-field-label">${t("Branch","Ветка")}</label>
            <input class="ns-editor-input" data-deploy-field="github.branch" value="${escapeHtml(draft.deploy.github.branch)}" />
            <label class="ns-editor-field-label">${t("Folder","Папка")}</label>
            <input class="ns-editor-input" data-deploy-field="github.folder" value="${escapeHtml(draft.deploy.github.folder)}" />
            <label class="ns-editor-field-label">${t("Custom domain","Свой домен")}</label>
            <input class="ns-editor-input" data-deploy-field="github.customDomain" value="${escapeHtml(draft.deploy.github.customDomain)}" />
          </section>

          <section class="ns-editor-shell__mini-card">
            <h3>Netlify <span style="display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:#f1e4cf;color:#8a5a2c;font-size:11px;font-weight:800;vertical-align:middle;">${t("Next","Далее")}</span></h3>
            <label class="ns-editor-field-label">${t("Site","Сайт")}</label>
            <input class="ns-editor-input" data-deploy-field="netlify.siteName" value="${escapeHtml(draft.deploy.netlify.siteName)}" />
            <label class="ns-editor-field-label">${t("Publish directory","Папка публикации")}</label>
            <input class="ns-editor-input" data-deploy-field="netlify.publishDir" value="${escapeHtml(draft.deploy.netlify.publishDir)}" />
            <label class="ns-editor-field-label">${t("Custom domain","Свой домен")}</label>
            <input class="ns-editor-input" data-deploy-field="netlify.customDomain" value="${escapeHtml(draft.deploy.netlify.customDomain)}" />
          </section>

          <section class="ns-editor-shell__mini-card">
            <h3>Vercel <span style="display:inline-flex;margin-left:8px;padding:4px 8px;border-radius:999px;background:#f1e4cf;color:#8a5a2c;font-size:11px;font-weight:800;vertical-align:middle;">${t("Next","Далее")}</span></h3>
            <label class="ns-editor-field-label">${t("Project","Проект")}</label>
            <input class="ns-editor-input" data-deploy-field="vercel.projectName" value="${escapeHtml(draft.deploy.vercel.projectName)}" />
            <label class="ns-editor-field-label">${t("Output directory","Папка вывода")}</label>
            <input class="ns-editor-input" data-deploy-field="vercel.outputDir" value="${escapeHtml(draft.deploy.vercel.outputDir)}" />
            <label class="ns-editor-field-label">${t("Custom domain","Свой домен")}</label>
            <input class="ns-editor-input" data-deploy-field="vercel.customDomain" value="${escapeHtml(draft.deploy.vercel.customDomain)}" />
          </section>
        </div>

        <div class="ns-editor-deploy-output-grid">
          <section class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">index.html</div>
            <textarea class="ns-editor-textarea ns-editor-textarea--mono">${escapeHtml(output["index.html"])}</textarea>
          </section>
          <section class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">styles.css</div>
            <textarea class="ns-editor-textarea ns-editor-textarea--mono">${escapeHtml(output["styles.css"])}</textarea>
          </section>
          <section class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">content/page.json</div>
            <textarea class="ns-editor-textarea ns-editor-textarea--mono">${escapeHtml(output["content/page.json"])}</textarea>
          </section>
          <section class="ns-editor-shell__mini-card">
            <div class="ns-editor-shell__mini-card-title">meta.json</div>
            <textarea class="ns-editor-textarea ns-editor-textarea--mono">${escapeHtml(output["meta.json"])}</textarea>
          </section>
        </div>
      `;

      this.refs.deployMount.querySelectorAll("[data-deploy-field]").forEach((input) => {
        input.addEventListener("input", () => {
          if (!this.currentDraft) return;
          const draft = this.readForm();
          const path = input.dataset.deployField;
          const value = input.value;

          if (path === "manual.fileName") {
            draft.deploy.manual.fileName = value;
          }
          if (path === "sftp.host") {
            draft.deploy.sftp.host = value;
          }
          if (path === "sftp.port") {
            draft.deploy.sftp.port = value;
          }
          if (path === "sftp.username") {
            draft.deploy.sftp.username = value;
          }
          if (path === "sftp.remotePath") {
            draft.deploy.sftp.remotePath = value;
          }
          if (path === "github.repo") {
            draft.deploy.github.repo = value;
          }
          if (path === "github.branch") {
            draft.deploy.github.branch = value;
          }
          if (path === "github.folder") {
            draft.deploy.github.folder = value;
          }
          if (path === "github.customDomain") {
            draft.deploy.github.customDomain = value;
          }
          if (path === "netlify.siteName") {
            draft.deploy.netlify.siteName = value;
          }
          if (path === "netlify.publishDir") {
            draft.deploy.netlify.publishDir = value;
          }
          if (path === "netlify.customDomain") {
            draft.deploy.netlify.customDomain = value;
          }
          if (path === "vercel.projectName") {
            draft.deploy.vercel.projectName = value;
          }
          if (path === "vercel.outputDir") {
            draft.deploy.vercel.outputDir = value;
          }
          if (path === "vercel.customDomain") {
            draft.deploy.vercel.customDomain = value;
          }

          this.currentDraft = draft;
          this.renderDynamicPanels(this.currentDraft);
          this.scheduleAutosave();
        });
      });
    }

    flashStatus(message) {
      if (!this.refs.statusBadge) return;
      this.refs.statusBadge.textContent = String(message || '');
      clearTimeout(this.statusTimeout);
      this.statusTimeout = setTimeout(() => this.syncHeaderState(), 2200);
    }

    async ensureMaterializedPreview() {
      if (!this.currentDraft) return null;
      const draft = this.readForm();
      const output = buildOutputPackage(draft);
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== 'function') {
        this.flashStatus(t('Preview bridge unavailable','Мост предпросмотра недоступен'));
        return null;
      }

      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta.title,
          slug: draft.meta.slug,
          package: output
        });
        if (result && result.ok) {
          this.currentDraft = draft;
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn('[NSEditorV1] preview materialization failed:', error);
        this.flashStatus(t('Preview build failed','Сборка предпросмотра не удалась'));
      } finally {
        this.previewBusy = false;
      }
      return null;
    }

    async exportCurrentZip() {
      if (this.exportZipBusy) return;
      if (!this.currentDraft) {
        this.flashStatus(t('Open a draft first','Сначала откройте черновик'));
        return;
      }

      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.exportSiteZip !== 'function') {
        this.flashStatus(t('ZIP export bridge unavailable','Мост ZIP-экспорта недоступен'));
        return;
      }

      this.exportZipBusy = true;
      try {
        const draft = this.readForm();
        const output = buildOutputPackage(draft);
        const result = await bridge.exportSiteZip({
          title: draft.meta.title,
          slug: draft.meta.slug,
          fileName: draft.deploy.manual.fileName,
          package: output
        });

        if (result && result.canceled) {
          this.flashStatus(t('ZIP export canceled','ZIP-экспорт отменён'));
          return;
        }

        if (result && result.ok) {
          this.currentDraft = draft;
          this.lastExportZipPath = result.zipPath || "";
          this.store.saveDraft(this.currentDraft);
          this.flashStatus(t('ZIP exported. The folder was opened.','ZIP экспортирован. Папка открыта.'));
          this.renderDynamicPanels(this.currentDraft);
          return;
        }

        this.flashStatus(t('ZIP export failed','ZIP-экспорт не удался'));
      } catch (error) {
        console.warn('[NSEditorV1] ZIP export failed:', error);
        this.flashStatus(t('ZIP export failed','ZIP-экспорт не удался'));
      } finally {
        this.exportZipBusy = false;
      }
    }

    async openPreviewInBrowserShell() {
      if (this.previewShellOpening) return;
      this.previewShellOpening = true;
      try {
        const preview = await this.ensureMaterializedPreview();
        if (!preview || !preview.indexUrl) return;
        const shell = window.NSWorkspaceShell || null;
        if (shell && typeof shell.openPreviewTab === 'function') {
          shell.openPreviewTab({
            url: preview.indexUrl,
            displayUrl: preview.indexPath || preview.indexUrl,
            title: (this.currentDraft && this.currentDraft.meta && this.currentDraft.meta.title) || t('Site Preview','Предпросмотр сайта')
          });
          this.flashStatus(t('Preview opened in workspace browser','Предпросмотр открыт в браузере пространства'));
          this.renderDynamicPanels(this.currentDraft);
        } else {
          this.flashStatus(t('Browser preview unavailable','Предпросмотр в браузере недоступен'));
        }
      } finally {
        this.previewShellOpening = false;
      }
    }

    async openPreviewInExternalBrowser() {
      if (this.previewExternalOpening) return;
      this.previewExternalOpening = true;
      try {
        const preview = await this.ensureMaterializedPreview();
        if (!preview) return;
        const bridge = getPreviewBridge();
        if (!bridge || typeof bridge.openSitePreviewExternal !== 'function') {
          this.flashStatus(t('External preview bridge unavailable','Внешний предпросмотр недоступен'));
          return;
        }
        const result = await bridge.openSitePreviewExternal(preview);
        this.flashStatus(result && result.target === 'chrome' ? t('Preview opened in Chrome','Предпросмотр открыт в Chrome') : t('Preview opened in browser','Предпросмотр открыт в браузере'));
        this.renderDynamicPanels(this.currentDraft);
      } catch (error) {
        console.warn('[NSEditorV1] external preview open failed:', error);
        this.flashStatus(t('External preview failed','Не удалось открыть внешний предпросмотр'));
      } finally {
        this.previewExternalOpening = false;
      this.exportZipBusy = false;
      this.lastExportZipPath = "";
      }
    }

    async copyPreviewPath() {
      const preview = await this.ensureMaterializedPreview();
      if (!preview || !preview.indexPath) return;
      const bridge = getPreviewBridge();
      let copied = false;
      if (bridge && typeof bridge.writeClipboardText === 'function') {
        try {
          copied = await bridge.writeClipboardText(preview.indexPath);
        } catch (error) {
          console.warn('[NSEditorV1] preview path copy failed:', error);
        }
      }
      if (!copied && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(preview.indexPath);
          copied = true;
        } catch (error) {
          console.warn('[NSEditorV1] navigator preview path copy failed:', error);
        }
      }
      this.flashStatus(copied ? t('Preview path copied','Путь к предпросмотру скопирован') : t('Copy failed','Не удалось скопировать'));
      this.renderDynamicPanels(this.currentDraft);
    }

    openSection(section) {
      const normalized = String(section || "").trim();
      if (!normalized) return;

      if (this.surfaceType === "cabinet") {
        const cabinetButton = document.querySelector(`.cabinet-inner-nav-btn[data-section="${normalized}"]`);
        if (cabinetButton) {
          cabinetButton.click();
          return;
        }
      }

      const workspaceToggle = document.getElementById("workspaceToggle");
      if (workspaceToggle && workspaceToggle.getAttribute("aria-pressed") !== "true") {
        workspaceToggle.click();
      }

      const workspaceButton = document.querySelector(`.workspace-nav-btn[data-section="${normalized}"]`);
      if (workspaceButton) {
        workspaceButton.click();
      }
    }

    openCurrentProject() {
      const draft = this.currentDraft ? this.readForm() : null;
      const projectId = draft?.projectId || this.currentDraft?.projectId || "";
      if (projectId && window.NSProjectsV1 && typeof window.NSProjectsV1.setCurrentProject === "function") {
        window.NSProjectsV1.setCurrentProject(projectId);
      }
      this.openSection("projects");
    }

    openLinkedFile(fileId) {
      if (!fileId) return;
      if (window.NSLibraryStore && typeof window.NSLibraryStore.setActiveItem === "function") {
        window.NSLibraryStore.setActiveItem(fileId);
      }
      this.openSection("files");
    }

    openLinkedNote(noteId) {
      if (!noteId) return;
      if (window.NSNotesV1 && typeof window.NSNotesV1.openNoteById === "function") {
        window.NSNotesV1.openNoteById(noteId);
      }
      this.openSection("notes");
    }

    linkActiveFile() {
      const fileId = getActiveLibraryFileId();
      if (!this.currentDraft || !fileId) return;
      const draft = this.readForm();
      draft.linkedFileIds = uniqueIds([...(draft.linkedFileIds || []), fileId]);
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderLeftSources();
      this.scheduleAutosave();
    }

    linkActiveNote() {
      const noteId = getActiveNoteId();
      if (!this.currentDraft || !noteId) return;
      const draft = this.readForm();
      draft.linkedNoteIds = uniqueIds([...(draft.linkedNoteIds || []), noteId]);
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderLeftSources();
      this.scheduleAutosave();
    }

    detachLinkedFile(fileId) {
      if (!this.currentDraft || !fileId) return;
      const draft = this.readForm();
      draft.linkedFileIds = uniqueIds(draft.linkedFileIds).filter((item) => item !== fileId);
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderLeftSources();
      this.scheduleAutosave();
    }

    detachLinkedNote(noteId) {
      if (!this.currentDraft || !noteId) return;
      const draft = this.readForm();
      draft.linkedNoteIds = uniqueIds(draft.linkedNoteIds).filter((item) => item !== noteId);
      this.currentDraft = draft;
      this.mountWriteSurface(this.currentDraft);
      this.renderDynamicPanels(this.currentDraft);
      this.renderLeftSources();
      this.scheduleAutosave();
    }

    syncExternalRelations(previousDraft, nextDraft) {
      const prevDraft = previousDraft || null;
      const next = nextDraft || null;
      const draftId = next?.id || prevDraft?.id || "";
      if (!draftId) return;

      const projectStore = getProjectStore();
      const prevProjectId = prevDraft?.projectId || "";
      const nextProjectId = next?.projectId || "";

      if (projectStore) {
        if (prevProjectId && prevProjectId !== nextProjectId && typeof projectStore.detachDraft === "function") {
          projectStore.detachDraft(prevProjectId, draftId);
        }
        if (nextProjectId && prevProjectId !== nextProjectId && typeof projectStore.attachDraft === "function") {
          projectStore.attachDraft(nextProjectId, draftId);
        }
      }

      const noteStore = getNotesStore();
      if (noteStore) {
        diffRemoved(prevDraft?.linkedNoteIds, next?.linkedNoteIds).forEach((noteId) => {
          if (typeof noteStore.detachDraft === "function") {
            noteStore.detachDraft(noteId, draftId);
          }
        });
        diffAdded(prevDraft?.linkedNoteIds, next?.linkedNoteIds).forEach((noteId) => {
          if (typeof noteStore.attachDraft === "function") {
            noteStore.attachDraft(noteId, draftId);
          }
        });
      }
    }

    clearExternalRelations(draft) {
      const payload = draft || this.currentDraft;
      if (!payload || !payload.id) return;
      const projectStore = getProjectStore();
      if (projectStore && payload.projectId && typeof projectStore.detachDraft === "function") {
        projectStore.detachDraft(payload.projectId, payload.id);
      }
      const noteStore = getNotesStore();
      if (noteStore && typeof noteStore.detachDraft === "function") {
        uniqueIds(payload.linkedNoteIds).forEach((noteId) => {
          noteStore.detachDraft(noteId, payload.id);
        });
      }
    }

    renderContextRail() {
      if (this.refs.contextDraft) {
        if (!this.currentDraft) {
          this.refs.contextDraft.innerHTML = `<div class="ns-editor-shell__mini-empty">${t("No active draft.","Нет активного черновика.")}</div>`;
        } else {
          const project = this.currentDraft.projectId ? getProjectById(this.currentDraft.projectId) : null;
          this.refs.contextDraft.innerHTML = `
            <div class="ns-editor-shell__mini-card">
              <div class="ns-editor-shell__mini-card-title">${t("Title","Заголовок")}</div>
              <div class="ns-editor-shell__mini-card-value">${escapeHtml(this.currentDraft.meta.title)}</div>
            </div>
            <div class="ns-editor-shell__mini-card">
              <div class="ns-editor-shell__mini-card-title">${t("Template","Шаблон")}</div>
              <div class="ns-editor-shell__mini-card-value">${escapeHtml(getTemplateUiMeta(getTemplate(this.currentDraft.templateId)).name)}</div>
            </div>
            <div class="ns-editor-shell__mini-card">
              <div class="ns-editor-shell__mini-card-title">${t("Project","Проект")}</div>
              <div class="ns-editor-shell__mini-card-value">${escapeHtml(project ? project.title : (this.currentDraft.projectId || t("No project","Без проекта")))}</div>
            </div>
            <div class="ns-editor-shell__mini-card">
              <div class="ns-editor-shell__mini-card-title" >${t("Links","Связи")}</div>
              <div class="ns-editor-shell__mini-card-value">${t("Files","Файлы")} ${uniqueIds(this.currentDraft.linkedFileIds).length} · ${t("Notes","Заметки")} ${uniqueIds(this.currentDraft.linkedNoteIds).length}</div>
            </div>
            <div class="ns-editor-relations-actions ns-editor-relations-actions--tight">
              <button class="ns-editor-shell__button" type="button" data-action="open-projects">${t("Projects","Проекты")}</button>
              <button class="ns-editor-shell__button" type="button" data-action="open-files">${t("Files","Файлы")}</button>
              <button class="ns-editor-shell__button" type="button" data-action="open-notes">${t("Notes","Заметки")}</button>
            </div>
          `;
        }
      }

      if (this.refs.contextOutput) {
        if (!this.currentDraft) {
          this.refs.contextOutput.innerHTML = `<div class="ns-editor-shell__mini-empty">${t("No output bundle is active.","Нет активного пакета вывода.")}</div>`;
        } else {
          this.refs.contextOutput.innerHTML = `
            <div class="ns-editor-shell__mini-card">
              <div class="ns-editor-shell__mini-card-title">${t("Output","Вывод")}</div>
              <div class="ns-editor-shell__mini-card-value">${OUTPUT_FILES.join(", ")}</div>
            </div>
            <div class="ns-editor-shell__mini-card">
              <div class="ns-editor-shell__mini-card-title" >${t("Publishing panel v1","Панель публикации v1")}</div>
              <div class="ns-editor-shell__mini-card-value" >${t("Manual ZIP export now / deploy integrations next","Ручной ZIP-экспорт сейчас / деплой-интеграции дальше")}</div>
            </div>
          `;
        }
      }
    }
  }

  function initEditorV1() {
    ensureEditorDocumentCanvasStyles();
    const mounts = [
      document.getElementById("nsEditorCabinetMount"),
      document.getElementById("nsEditorWorkspaceMount")
    ].filter(Boolean);

    if (!mounts.length) {
      return null;
    }

    const store = new EditorStore();
    const surfaces = mounts.map((mount) => new EditorSurface(mount, store));

    const api = {
      store,
      surfaces,
      createDraftFromTemplate(templateId, options) {
        const draft = createDraft(templateId || DEFAULT_TEMPLATE_ID, { locale: normalizeLocale(options && options.locale ? options.locale : getUiLanguage()) });
        const saved = store.saveDraft(draft);
        const targetTab = options && options.initialTab ? options.initialTab : null;
        surfaces.forEach((surface) => {
          if (!surface.currentDraft || surface.currentDraft.id !== saved.id) return;
          surface.switchTab(targetTab || (surface.surfaceType === "cabinet" ? "write" : "draft"));
        });
        window.dispatchEvent(new CustomEvent("ns-editor-store-updated", { detail: { source: "api" } }));
        return saved;
      },
      getDrafts() {
        return store.getDrafts();
      },
      getActiveDraft() {
        return store.getDraft(store.state.activeDraftId);
      },
      openDraftById(draftId, surfaceType, targetTab) {
        surfaces.forEach((surface) => {
          if (!draftId) return;
          if (!surfaceType || surface.surfaceType === surfaceType) {
            surface.openDraft(draftId, true, false, targetTab);
          }
        });
      },
      async openDraftPreviewExternal(draftId, surfaceType) {
        for (const surface of surfaces) {
          if (!draftId) continue;
          if (surfaceType && surface.surfaceType !== surfaceType) continue;
          surface.openDraft(draftId, true, false, 'preview');
          if (typeof surface.openPreviewInExternalBrowser === 'function') {
            await surface.openPreviewInExternalBrowser();
            return true;
          }
        }
        return false;
      }
    };
    window.__nsEditorV1Instance = api;
    return api;
  }

  window.NSEditorV1 = {
  init: initEditorV1,
  createDraft,
  get templates() { return getCurrentTemplates(); },
  WRITE_MODES,
  CABINET_TABS,
  WORKSPACE_TABS,
  createDraftFromTemplate(templateId, options) {
    if (window.__nsEditorV1Instance && typeof window.__nsEditorV1Instance.createDraftFromTemplate === "function") {
      return window.__nsEditorV1Instance.createDraftFromTemplate(templateId, options);
    }
    return createDraft(templateId || getDefaultTemplateId(), { locale: getUiLanguage() });
  },
  getDrafts() {
    if (window.__nsEditorV1Instance && typeof window.__nsEditorV1Instance.getDrafts === "function") {
      return window.__nsEditorV1Instance.getDrafts();
    }
    return [];
  },
  getActiveDraft() {
    if (window.__nsEditorV1Instance && typeof window.__nsEditorV1Instance.getActiveDraft === "function") {
      return window.__nsEditorV1Instance.getActiveDraft();
    }
    return null;
  },
  openDraftById(draftId, surfaceType, targetTab) {
    if (window.__nsEditorV1Instance && typeof window.__nsEditorV1Instance.openDraftById === "function") {
      window.__nsEditorV1Instance.openDraftById(draftId, surfaceType, targetTab);
    }
  },
  async openDraftPreviewExternal(draftId, surfaceType) {
    if (window.__nsEditorV1Instance && typeof window.__nsEditorV1Instance.openDraftPreviewExternal === "function") {
      return window.__nsEditorV1Instance.openDraftPreviewExternal(draftId, surfaceType);
    }
    return false;
  }
};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initEditorV1();
    }, { once: true });
  } else {
    initEditorV1();
  }
  }

  loadTemplateLibrary(() => loadSiteProfileStore(boot));
})(window);

