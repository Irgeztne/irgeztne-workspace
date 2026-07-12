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
  const FAVICON_PACKAGE_FILES = [
    "favicon.ico",
    "assets/icons/favicon.ico",
    "assets/icons/favicon.svg",
    "assets/icons/favicon-16x16.png",
    "assets/icons/favicon-32x32.png",
    "assets/icons/apple-touch-icon.png",
    "assets/icons/android-chrome-192x192.png",
    "assets/icons/android-chrome-512x512.png",
    "assets/icons/site.webmanifest"
  ];
  const EXPORT_PACKAGE_FILES = [...OUTPUT_FILES, ...FAVICON_PACKAGE_FILES];
  const IRGEZTNE_EXPORT_VERSION = "1.0.0-preview.3";
  const TEMPLATE_PACKAGE_FORMAT = "irgeztne-template-package";
  const TEMPLATE_PACKAGE_FORMAT_VERSION = "0.1.0";

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

  const BRAND_FONT_OPTIONS = [
    { id: "inter", label: "Inter", stack: "Inter, Arial, sans-serif" },
    { id: "manrope", label: "Manrope", stack: "Manrope, Inter, Arial, sans-serif" },
    { id: "montserrat", label: "Montserrat", stack: "Montserrat, Inter, Arial, sans-serif" },
    { id: "poppins", label: "Poppins", stack: "Poppins, Inter, Arial, sans-serif" },
    { id: "raleway", label: "Raleway", stack: "Raleway, Inter, Arial, sans-serif" },
    { id: "playfair", label: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
    { id: "merriweather", label: "Merriweather", stack: "Merriweather, Georgia, serif" },
    { id: "jetbrains", label: "JetBrains Mono", stack: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace" },
    { id: "system-sans", label: "System Sans", stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
    { id: "system-serif", label: "System Serif", stack: "Georgia, 'Times New Roman', serif" },
    { id: "system-mono", label: "System Mono", stack: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace" }
  ];

  const BRAND_FONT_WEIGHTS = [
    { value: "500", label: "Medium" },
    { value: "600", label: "Semi Bold" },
    { value: "700", label: "Bold" },
    { value: "800", label: "Extra Bold" },
    { value: "900", label: "Black" }
  ];

  function normalizeBrandFont(value) {
    const raw = String(value || "").trim().toLowerCase();
    return BRAND_FONT_OPTIONS.find((item) => item.id === raw) || BRAND_FONT_OPTIONS[0];
  }

  function normalizeBrandWeight(value) {
    const raw = String(value || "").trim();
    return BRAND_FONT_WEIGHTS.some((item) => item.value === raw) ? raw : "800";
  }

  function getBrandFontLabel(item) {
    const labels = {
      "system-sans": t("System Sans", "Системный Sans"),
      "system-serif": t("System Serif", "Системный Serif"),
      "system-mono": t("System Mono", "Системный Mono")
    };
    return labels[String(item && item.id || "")] || String(item && item.label || "");
  }

  function renderBrandFontOptions(selected) {
    const active = normalizeBrandFont(selected).id;
    return BRAND_FONT_OPTIONS.map((item) => `<option value="${escapeHtml(item.id)}"${item.id === active ? " selected" : ""}>${escapeHtml(getBrandFontLabel(item))}</option>`).join("");
  }

  function getBrandWeightLabel(item) {
    const labels = {
      "500": t("Medium", "Средний"),
      "600": t("Semi Bold", "Полужирный"),
      "700": t("Bold", "Жирный"),
      "800": t("Extra Bold", "Очень жирный"),
      "900": t("Black", "Чёрный")
    };
    return labels[String(item && item.value || "")] || String(item && item.label || "");
  }

  function renderBrandWeightOptions(selected) {
    const active = normalizeBrandWeight(selected);
    return BRAND_FONT_WEIGHTS.map((item) => `<option value="${escapeHtml(item.value)}"${item.value === active ? " selected" : ""}>${escapeHtml(getBrandWeightLabel(item))}</option>`).join("");
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
    const font = normalizeBrandFont(options.fontFamily || options.font || "inter");
    const fontWeight = normalizeBrandWeight(options.fontWeight || options.weight || "800");
    const fontSize = letters.length > 2 ? 92 : letters.length > 1 ? 108 : 128;
    const letterSpacing = letters.length > 2 ? "-7" : letters.length > 1 ? "-6" : "0";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="${radius}" fill="${background}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="${escapeHtml(font.stack)}" font-size="${fontSize}" font-weight="${escapeHtml(fontWeight)}" letter-spacing="${letterSpacing}" fill="${foreground}">${escapeHtml(letters)}</text></svg>`;
  }

  function svgToDataUrl(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(String(svg || ""))}`;
  }

  function buildGeneratedFaviconDataUrl(options = {}) {
    return svgToDataUrl(buildLetterFaviconSvg(options));
  }

  function buildGeneratedLogoDataUrl(options = {}) {
    // Keep the generated logo visually aligned with the favicon generator.
    // For 1.0.0 this is a compact SVG brand mark stored as a Data URL,
    // so users can create a matching logo/favicon set without external tools.
    return svgToDataUrl(buildLetterFaviconSvg(options));
  }

  function isDataUrl(value) {
    return /^data:/i.test(String(value || "").trim());
  }

  function parseDataUrl(value) {
    const raw = String(value || "").trim();
    const match = raw.match(/^data:([^;,]+)?(;charset=[^;,]+)?(;base64)?,(.*)$/i);
    if (!match) return null;
    const mimeType = (match[1] || "text/plain").toLowerCase();
    const isBase64 = Boolean(match[3]);
    const data = match[4] || "";
    try {
      return {
        mimeType,
        isBase64,
        data,
        text: isBase64 ? atob(data) : decodeURIComponent(data)
      };
    } catch (error) {
      return { mimeType, isBase64, data, text: "" };
    }
  }

  function dataUrlToZipBinary(value) {
    const parsed = parseDataUrl(value);
    if (!parsed) return null;
    if (parsed.isBase64) {
      return { contentBase64: parsed.data, encoding: "base64", mimeType: parsed.mimeType };
    }
    try {
      return { contentBase64: btoa(unescape(encodeURIComponent(parsed.text || ""))), encoding: "base64", mimeType: parsed.mimeType };
    } catch (error) {
      return null;
    }
  }

  function decodeSvgDataUrl(value) {
    const parsed = parseDataUrl(value);
    if (!parsed || parsed.mimeType !== "image/svg+xml") return "";
    return parsed.text || "";
  }

  function buildFaviconPackageLinkMarkup() {
    return [
      '<link rel="icon" href="./favicon.ico" sizes="any" />',
      '<link rel="icon" type="image/svg+xml" href="./assets/icons/favicon.svg" />',
      '<link rel="icon" type="image/png" sizes="32x32" href="./assets/icons/favicon-32x32.png" />',
      '<link rel="icon" type="image/png" sizes="16x16" href="./assets/icons/favicon-16x16.png" />',
      '<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png" />',
      '<link rel="manifest" href="./assets/icons/site.webmanifest" />'
    ].join("\n  ");
  }

  function zipTextEntry(content, mimeType = "text/plain") {
    return { content: String(content || ""), mimeType };
  }

  function sanitizeManifestName(value, fallback) {
    return String(value || fallback || "IRGEZTNE Site")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || String(fallback || "IRGEZTNE Site");
  }

  function buildSiteWebManifest(siteName, themeColor) {
    const name = sanitizeManifestName(siteName, "IRGEZTNE Site");
    const shortName = sanitizeManifestName(name, "IRGEZTNE").slice(0, 32) || "IRGEZTNE";
    const color = sanitizeHexColor(themeColor, "#2f74ff");
    return JSON.stringify({
      name,
      short_name: shortName,
      icons: [
        { src: "./favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { src: "./favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { src: "./apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        { src: "./android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "./android-chrome-512x512.png", sizes: "512x512", type: "image/png" }
      ],
      theme_color: color,
      background_color: "#ffffff",
      display: "standalone"
    }, null, 2);
  }

  function imageDataUrlToPngDataUrl(sourceDataUrl, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas unavailable");
          ctx.clearRect(0, 0, size, size);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          const sourceWidth = img.naturalWidth || img.width || size;
          const sourceHeight = img.naturalHeight || img.height || size;
          const scale = Math.min(size / sourceWidth, size / sourceHeight);
          const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
          const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
          const drawX = Math.round((size - drawWidth) / 2);
          const drawY = Math.round((size - drawHeight) / 2);
          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          resolve(canvas.toDataURL("image/png"));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error("Could not render favicon image"));
      img.src = sourceDataUrl;
    });
  }

  function dataUrlToBytes(value) {
    const parsed = parseDataUrl(value);
    if (!parsed) return new Uint8Array();
    const binary = parsed.isBase64 ? atob(parsed.data) : parsed.text || "";
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index) & 0xff;
    }
    return bytes;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
    }
    return btoa(binary);
  }

  function buildIcoEntryFromPngDataUrl(pngDataUrl, size = 32) {
    const pngBytes = dataUrlToBytes(pngDataUrl);
    const headerSize = 22;
    const bytes = new Uint8Array(headerSize + pngBytes.length);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    bytes[6] = size >= 256 ? 0 : size;
    bytes[7] = size >= 256 ? 0 : size;
    bytes[8] = 0;
    bytes[9] = 0;
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
    view.setUint32(14, pngBytes.length, true);
    view.setUint32(18, headerSize, true);
    bytes.set(pngBytes, headerSize);
    return { contentBase64: bytesToBase64(bytes), encoding: "base64", mimeType: "image/x-icon" };
  }

  function getFaviconSourceForPackage(siteProfile, fallbackName) {
    const profile = normalizeSiteProfile(siteProfile || getSiteProfile());
    const rawPath = String(profile.faviconPath || "").trim();
    if (isDataUrl(rawPath) && /^data:image\/(svg\+xml|png|jpe?g|webp)/i.test(rawPath)) {
      return {
        dataUrl: rawPath,
        svg: decodeSvgDataUrl(rawPath) || buildLetterFaviconSvg({
          letters: getInitials(fallbackName || profile.siteName || DEFAULT_SITE_PROFILE.siteName),
          background: profile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor,
          foreground: "#ffffff",
          shape: "rounded"
        })
      };
    }
    const svg = buildLetterFaviconSvg({
      letters: getInitials(fallbackName || profile.siteName || DEFAULT_SITE_PROFILE.siteName),
      background: profile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor,
      foreground: "#ffffff",
      shape: "rounded"
    });
    return { dataUrl: svgToDataUrl(svg), svg };
  }

  async function buildFaviconPackageFiles(siteProfile, siteName) {
    const profile = normalizeSiteProfile(siteProfile || getSiteProfile());
    const source = getFaviconSourceForPackage(profile, siteName);
    const png16 = await imageDataUrlToPngDataUrl(source.dataUrl, 16);
    const png32 = await imageDataUrlToPngDataUrl(source.dataUrl, 32);
    const png180 = await imageDataUrlToPngDataUrl(source.dataUrl, 180);
    const png192 = await imageDataUrlToPngDataUrl(source.dataUrl, 192);
    const png512 = await imageDataUrlToPngDataUrl(source.dataUrl, 512);
    const ico = buildIcoEntryFromPngDataUrl(png32, 32);
    return {
      "favicon.ico": ico,
      "assets/icons/favicon.ico": ico,
      "assets/icons/favicon.svg": zipTextEntry(source.svg, "image/svg+xml"),
      "assets/icons/favicon-16x16.png": dataUrlToZipBinary(png16),
      "assets/icons/favicon-32x32.png": dataUrlToZipBinary(png32),
      "assets/icons/apple-touch-icon.png": dataUrlToZipBinary(png180),
      "assets/icons/android-chrome-192x192.png": dataUrlToZipBinary(png192),
      "assets/icons/android-chrome-512x512.png": dataUrlToZipBinary(png512),
      "assets/icons/site.webmanifest": zipTextEntry(buildSiteWebManifest(siteName || profile.siteName, profile.primaryColor), "application/manifest+json")
    };
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
      sitePageId: "",
      output: {
        files: [...OUTPUT_FILES]
      }
    };
  }

  // 1.0.0: Site pages are edited from Editor, while Site / Pages stays an internal structure engine.
  const SITE_PAGES_EDITOR_STORAGE_KEY = "irgeztne.sitePages.v0";

  function normalizeEditorSitePage(raw, index) {
    const source = raw && typeof raw === "object" ? raw : {};
    const title = String(source.title || (index === 0 ? "Home" : "Untitled page"));
    const createdAt = source.createdAt || nowIso();
    return {
      id: String(source.id || uid("page")),
      title,
      slug: slugify(source.slug || title) || "page",
      status: ["draft", "published", "archived"].includes(String(source.status || "").toLowerCase()) ? String(source.status).toLowerCase() : "draft",
      type: String(source.type || (index === 0 ? "home" : "page")),
      menu: source.menu !== false,
      summary: String(source.summary || ""),
      draftId: String(source.draftId || ""),
      createdAt,
      updatedAt: source.updatedAt || createdAt
    };
  }

  function defaultEditorSitePagesState() {
    const time = nowIso();
    const defaults = [
      { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, summary: "Main landing page for this local site." },
      { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, summary: "Project, team, or product description." },
      { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, summary: "Contact and next action page." }
    ];
    return {
      version: 1,
      activePageId: "page_index",
      createdAt: time,
      updatedAt: time,
      publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
      pages: defaults.map((page, index) => normalizeEditorSitePage({ ...page, createdAt: time, updatedAt: time }, index))
    };
  }

  function readEditorSitePagesState() {
    try {
      const raw = localStorage.getItem(SITE_PAGES_EDITOR_STORAGE_KEY);
      const fallback = defaultEditorSitePagesState();
      const parsed = raw ? JSON.parse(raw) : fallback;
      const source = parsed && typeof parsed === "object" ? parsed : fallback;
      const pages = Array.isArray(source.pages) && source.pages.length
        ? source.pages.map((page, index) => normalizeEditorSitePage(page, index))
        : fallback.pages;
      const activePageId = source.activePageId && pages.some((page) => page.id === source.activePageId)
        ? source.activePageId
        : (pages[0] && pages[0].id) || "";
      return {
        version: 1,
        activePageId,
        createdAt: source.createdAt || fallback.createdAt,
        updatedAt: source.updatedAt || fallback.updatedAt,
        publishConfig: { ...fallback.publishConfig, ...(source.publishConfig || {}) },
        pages
      };
    } catch (error) {
      console.warn("[NSEditorV1] Could not read Site Pages state:", error);
      return defaultEditorSitePagesState();
    }
  }

  function writeEditorSitePagesState(state) {
    const next = { ...(state || readEditorSitePagesState()), updatedAt: nowIso() };
    try {
      localStorage.setItem(SITE_PAGES_EDITOR_STORAGE_KEY, JSON.stringify(next, null, 2));
    } catch (error) {
      console.warn("[NSEditorV1] Could not write Site Pages state:", error);
    }
    window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { state: deepClone(next), source: "editor" } }));
    return next;
  }

  function uniqueEditorSitePageSlug(pages, slug, currentId) {
    const base = slugify(slug || "page") || "page";
    let next = base;
    let i = 2;
    while ((pages || []).some((page) => page.id !== currentId && page.slug === next)) {
      next = base + "-" + i;
      i += 1;
    }
    return next;
  }

  function getEditorSitePageByDraftId(draftId) {
    if (!draftId) return null;
    const state = readEditorSitePagesState();
    return (state.pages || []).find((page) => String(page.draftId || "") === String(draftId)) || null;
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
      sitePageId: draft?.sitePageId ? String(draft.sitePageId) : "",
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

  function normalizeStringList(values, fallback = []) {
    const source = Array.isArray(values) ? values : fallback;
    return Array.from(new Set(source
      .map((item) => String(item || "").trim())
      .filter(Boolean)));
  }

  function getTemplateVersion(template) {
    return String(
      (template && (template.version || template.templateVersion)) ||
      (template && template.meta && template.meta.version) ||
      "0.1.0"
    );
  }

  function getTemplateAuthor(template, draft) {
    return String(
      (template && (template.author || template.creator)) ||
      (template && template.meta && (template.meta.author || template.meta.creator)) ||
      (draft && draft.meta && draft.meta.author) ||
      "IRGEZTNE"
    );
  }

  function getTemplateTags(template, draft) {
    const category = String((template && template.category) || (draft && draft.meta && draft.meta.category) || "website");
    const defaults = template && template.defaults && typeof template.defaults === "object" ? template.defaults : {};
    return normalizeStringList(
      [
        ...(Array.isArray(template && template.tags) ? template.tags : []),
        ...(Array.isArray(defaults.tags) ? defaults.tags : []),
        ...(Array.isArray(draft && draft.meta && draft.meta.tags) ? draft.meta.tags : []),
        category
      ],
      [category]
    );
  }

  function buildExportFileManifest() {
    const fileTypes = {
      "index.html": "html",
      "styles.css": "css",
      "content/page.json": "content-json",
      "meta.json": "package-meta",
      "favicon.ico": "favicon-root",
      "assets/icons/favicon.ico": "icon",
      "assets/icons/favicon.svg": "icon",
      "assets/icons/favicon-16x16.png": "icon",
      "assets/icons/favicon-32x32.png": "icon",
      "assets/icons/apple-touch-icon.png": "icon",
      "assets/icons/android-chrome-192x192.png": "icon",
      "assets/icons/android-chrome-512x512.png": "icon",
      "assets/icons/site.webmanifest": "webmanifest"
    };
    return EXPORT_PACKAGE_FILES.map((file) => ({
      path: file,
      role: fileTypes[file] || "asset"
    }));
  }

  function inspectExportSecurity(draft) {
    const html = String(buildPreviewHtmlFromWrite(draft && draft.write || {}) || "");
    const hasScriptTag = /<script/i.test(html);
    const hasExternalScript = /<script[^>]*src=["']https?:\/\//i.test(html);
    const hasExternalRuntime = /(src|href)=["']https?:\/\/[^"']*(cdn|cdnjs|jsdelivr|unpkg|googleapis|gstatic)/i.test(html);
    const hasInlineEventHandlers = /\son[a-z]+\s*=/i.test(html);
    return {
      noCdn: !hasExternalRuntime,
      externalScripts: hasExternalScript,
      inlineScripts: hasScriptTag && !hasExternalScript,
      inlineEventHandlers: hasInlineEventHandlers,
      notes: [
        "Official templates should remain CDN-free and use local assets.",
        "Community packages with JavaScript should be reviewed before publishing."
      ]
    };
  }

  function buildMetaJson(draft) {
    const template = getTemplate(draft.templateId) || {};
    const category = String(template.category || draft?.meta?.category || "website");
    const tags = getTemplateTags(template, draft);
    const author = getTemplateAuthor(template, draft);
    const templateVersion = getTemplateVersion(template);
    const security = inspectExportSecurity(draft);
    const faviconPackage = {
      ico: "favicon.ico",
      svg: "assets/icons/favicon.svg",
      png16: "assets/icons/favicon-16x16.png",
      png32: "assets/icons/favicon-32x32.png",
      appleTouchIcon: "assets/icons/apple-touch-icon.png",
      android192: "assets/icons/android-chrome-192x192.png",
      android512: "assets/icons/android-chrome-512x512.png",
      manifest: "assets/icons/site.webmanifest"
    };

    return {
      version: 2,
      package: {
        type: "template",
        format: TEMPLATE_PACKAGE_FORMAT,
        formatVersion: TEMPLATE_PACKAGE_FORMAT_VERSION,
        exportedBy: "IRGEZTNE Workspace",
        exportedWith: IRGEZTNE_EXPORT_VERSION,
        localFirst: true,
        generatedAt: nowIso()
      },
      projectId: draft.projectId || "",
      status: draft.status,
      locale: draft.locale || "ru",
      template: {
        id: String(template.id || draft.templateId || "project-landing"),
        name: String(template.name || draft?.meta?.title || "IRGEZTNE Template"),
        version: templateVersion,
        type: "template",
        author,
        category,
        tags,
        pages: [
          {
            path: "index.html",
            content: "content/page.json",
            title: draft?.meta?.title || "Untitled page",
            slug: draft?.meta?.slug || "index",
            locale: draft.locale || "ru"
          }
        ],
        supports: {
          logo: true,
          favicon: true,
          faviconPackage: true,
          colors: true,
          exportZip: true,
          staticHtml: true,
          localAssets: true,
          ipfsSafeFolder: true,
          singleHtml: false,
          multiPage: false
        },
        compatibility: {
          irgeztneVersion: IRGEZTNE_EXPORT_VERSION,
          minIrgeztneVersion: "1.0.0-preview.3",
          packageFormat: TEMPLATE_PACKAGE_FORMAT_VERSION,
          editor: "v1",
          codehubReady: true
        },
        security
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
        meta: "meta.json",
        faviconPackage,
        files: [...EXPORT_PACKAGE_FILES],
        fileManifest: buildExportFileManifest()
      },
      publishing: {
        readyForZip: true,
        readyForStaticHosting: true,
        readyForIpfsFolder: true,
        requiresServer: false,
        relativePathsOnly: true
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

  function buildIndexHtml(draft, options = {}) {
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
  ${options && options.useFaviconPackage ? buildFaviconPackageLinkMarkup() : buildFaviconLinkMarkup(siteFaviconPath)}
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
    const siteProfile = getSiteProfile();
    const siteName = draft?.meta?.title || siteProfile.siteName || DEFAULT_SITE_PROFILE.siteName;
    const faviconSource = getFaviconSourceForPackage(siteProfile, siteName);
    return {
      "index.html": buildIndexHtml(draft, { useFaviconPackage: true }),
      "styles.css": buildStylesCss(),
      "content/page.json": JSON.stringify(buildPageJson(draft), null, 2),
      "meta.json": JSON.stringify(buildMetaJson(draft), null, 2),
      "assets/icons/favicon.svg": zipTextEntry(faviconSource.svg, "image/svg+xml"),
      "assets/icons/site.webmanifest": zipTextEntry(buildSiteWebManifest(siteName, siteProfile.primaryColor), "application/manifest+json")
    };
  }

  async function buildOutputPackageWithAssets(draft) {
    const siteProfile = getSiteProfile();
    const siteName = draft?.meta?.title || siteProfile.siteName || DEFAULT_SITE_PROFILE.siteName;
    return {
      ...buildOutputPackage(draft),
      ...(await buildFaviconPackageFiles(siteProfile, siteName))
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
            { id: "write", label: t("Edit","Редактировать") },
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
              <div class="ns-editor-shell__drawer-title">${t("Pages, drafts & templates","Страницы, черновики и шаблоны")}</div>
              <div class="ns-editor-shell__drawer-subtitle">${t("Open site pages, drafts, or template starters without leaving Editor.","Открывайте страницы сайта, черновики и шаблоны, не выходя из Editor.")}</div>
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
                <button class="ns-editor-shell__button ns-editor-shell__button--primary ns-editor-shell__button--site-page" type="button" data-action="new-site-page">${t('+ Site page','+ Страница сайта')}</button>
                <button class="ns-editor-shell__button ns-editor-shell__button--primary ir-site-studio-v5-toolbar-btn" type="button" data-action="open-site-studio-safe-v5">${t("Site Studio","Студия сайта")}</button>
                <button class="ns-editor-shell__button ns-editor-shell__button--site-preview" type="button" data-action="open-site-preview">${t('Site preview','К сайту')}</button>
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

        // 1.0.0 repair: reliable site-page action handler.
        if (actionEl && (actionEl.dataset.action || "") === "new-site-page") {
          event.preventDefault();
          event.stopPropagation();
          if (typeof this.createEditorSitePageDraft === "function") {
            this.createEditorSitePageDraft();
          } else if (typeof this.createSitePageDraft === "function") {
            this.createSitePageDraft();
          } else {
            this.createDraftFromTemplate(DEFAULT_TEMPLATE_ID);
          }
          return;
        }

        // pass40: theme toggle is a stable top-level editor action.
        // Handle it before write/drawer branching so the Light/Dark buttons
        // cannot be swallowed by Jodit, side panels, or host layout changes.
        if (actionEl && (actionEl.dataset.action || "") === "set-write-theme") {
          event.preventDefault();
          event.stopPropagation();
          this.setWriteTheme(actionEl.dataset.value || STABLE_EDITOR_THEME);
          return;
        }


        // 1.0.0: global new-site-page click bridge.
        // Keep page creation inside Editor, regardless of drawer/write/header placement.
        if (actionEl && (actionEl.dataset.action || "") === "new-site-page") {
          event.preventDefault();
          event.stopPropagation();
          if (typeof this.createSitePageDraft === "function") {
            this.createSitePageDraft();
          } else {
            this.createDraftFromTemplate(DEFAULT_TEMPLATE_ID);
            this.flashStatus(t("Site page flow is not ready yet; a draft was created.", "Поток страниц сайта ещё не готов; создан обычный черновик."));
          }
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

          if (action === "generate-site-logo") {
            event.preventDefault();
            this.generateSiteLogoFromForm(false);
            return;
          }

          if (action === "generate-site-logo-set") {
            event.preventDefault();
            this.generateSiteLogoFromForm(true);
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

          if (action === "generate-site-logo") {
            event.preventDefault();
            this.generateSiteLogoFromForm(false);
            return;
          }

          if (action === "generate-site-logo-set") {
            event.preventDefault();
            this.generateSiteLogoFromForm(true);
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

          if (action === "new-site-page") {
            this.createSitePageDraft();
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



    // 1.0.0 v7: safe template id fallback for site-page creation

    // 1.0.0 v8: site page RU/EN label polish
    getSitePageUiLabels() {
      const locale = normalizeLocale(getUiLanguage());
      const isRu = String(locale || "").startsWith("ru");
      return {
        title: isRu ? "Новая страница сайта" : "New site page",
        kicker: isRu ? "Страница сайта" : "Site page",
        content: isRu ? "Контент" : "Content",
        summary: isRu
          ? "Напишите эту страницу в редакторе. Slug, меню и статус можно настроить в структуре сайта позже."
          : "Write this site page in Editor. Slug, menu and status can be managed in the site structure later.",
        start: isRu ? "Начните писать страницу сайта здесь." : "Start writing this site page here.",
        created: isRu ? "Страница сайта создана и открыта." : "Site page created and opened."
      };
    }

    getSafeSitePageTemplateId() {
      try {
        if (typeof DEFAULT_TEMPLATE_ID !== "undefined" && DEFAULT_TEMPLATE_ID) {
          return DEFAULT_TEMPLATE_ID;
        }
      } catch (_) {}
      try {
        const templates = typeof getCurrentTemplates === "function" ? getCurrentTemplates() : [];
        if (Array.isArray(templates) && templates.length && templates[0] && templates[0].id) {
          return templates[0].id;
        }
      } catch (_) {}
      try {
        const templates = typeof getTemplates === "function" ? getTemplates() : [];
        if (Array.isArray(templates) && templates.length && templates[0] && templates[0].id) {
          return templates[0].id;
        }
      } catch (_) {}
      return "project-landing";
    }

    createEditorSitePageDraft() {
      const locale = normalizeLocale(getUiLanguage());
      const stateKey = "irgeztne.sitePages.v0";
      const time = nowIso();
      const labels = this.getSitePageUiLabels();
      const baseTitle = labels.title;
      const summary = labels.summary;

      const fallbackState = {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: [
          { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
        ]
      };

      let state = fallbackState;
      try {
        const raw = localStorage.getItem(stateKey);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === "object") {
          state = {
            ...fallbackState,
            ...parsed,
            publishConfig: { ...fallbackState.publishConfig, ...(parsed.publishConfig || {}) },
            pages: Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallbackState.pages
          };
        }
      } catch (error) {
        console.warn("[NSEditorV1] Could not read Site Pages state:", error);
      }

      const existingNewPages = (state.pages || []).filter((page) => String(page.title || "").startsWith(baseTitle)).length;
      const title = existingNewPages ? baseTitle + " " + (existingNewPages + 1) : baseTitle;
      const baseSlug = slugify(title) || "site-page";
      let slug = baseSlug;
      let i = 2;
      while ((state.pages || []).some((page) => String(page.slug || "") === slug)) {
        slug = baseSlug + "-" + i;
        i += 1;
      }

      const page = {
        id: uid("page"),
        title,
        slug,
        status: "draft",
        type: "page",
        menu: true,
        summary,
        draftId: "",
        createdAt: time,
        updatedAt: time
      };

      const draft = createDraft(this.getSafeSitePageTemplateId(), { locale });
      const visualHtml = '<section class="ns-page-section ns-page-hero ns-page-hero--split"><div class="ns-page-hero__content"><div class="ns-page-kicker">' + escapeHtml(labels.kicker) + '</div><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(summary) + '</p></div></section><section class="ns-page-section"><h2>' + escapeHtml(labels.content) + '</h2><p>' + escapeHtml(labels.start) + '</p></section>';
      const nextDraft = {
        ...draft,
        status: "draft",
        project: { ...(draft.project || {}), name: title, slug },
        meta: {
          ...(draft.meta || {}),
          title,
          slug,
          category: "website",
          kicker: labels ? labels.kicker : t("Site page", "Страница сайта"),
          summary,
          excerpt: summary,
          seoTitle: title,
          seoDescription: summary,
          tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
        },
        write: {
          ...(draft.write || {}),
          visualHtml,
          markdown: "# " + title + "\n\n" + summary + "\n",
          activeWorkspaceTab: "draft",
          activeCabinetTab: "write"
        },
        sitePageId: page.id,
        updatedAt: time
      };

      const saved = this.store.saveDraft(nextDraft);
      page.draftId = saved.id;
      state.pages = [page, ...(state.pages || [])];
      state.activePageId = page.id;
      state.updatedAt = nowIso();
      try {
        localStorage.setItem(stateKey, JSON.stringify(state, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] Could not write Site Pages state:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { state: deepClone(state), source: "editor", pageId: page.id, draftId: saved.id } }));

      this.currentDraft = deepClone(saved);
      this.lastSavedAt = saved.updatedAt || this.lastSavedAt || "";
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
      this.flashStatus(labels.created);
      this.broadcast();
      return deepClone(saved);
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
      return deepClone(saved);
    }

    createSitePageDraft() {
      const locale = normalizeLocale(getUiLanguage());
      const labels = this.getSitePageUiLabels();
      const baseTitle = labels.title;
      const state = readEditorSitePagesState();
      const nextNumber = (state.pages || []).filter((page) => String(page.type || "") === "page").length + 1;
      const title = nextNumber > 1 ? baseTitle + " " + nextNumber : baseTitle;
      const slug = uniqueEditorSitePageSlug(state.pages, slugify(title) || "site-page");
      const time = nowIso();
      const page = normalizeEditorSitePage({
        id: uid("page"),
        title,
        slug,
        status: "draft",
        type: "page",
        menu: true,
        summary: labels.summary,
        createdAt: time,
        updatedAt: time
      }, state.pages.length);

      const draft = createDraft(this.getSafeSitePageTemplateId(), { locale });
      const visualHtml = '<section class="ns-page-section ns-page-hero ns-page-hero--split"><div class="ns-page-hero__content"><div class="ns-page-kicker">' + escapeHtml(labels.kicker) + '</div><h1>' + escapeHtml(page.title) + '</h1><p>' + escapeHtml(page.summary) + '</p></div></section><section class="ns-page-section"><h2>' + escapeHtml(labels.content) + '</h2><p>' + escapeHtml(labels.start) + '</p></section>';
      const nextDraft = {
        ...draft,
        status: "draft",
        project: { ...(draft.project || {}), name: page.title, slug: page.slug },
        meta: {
          ...(draft.meta || {}),
          title: page.title,
          slug: page.slug,
          category: "website",
          kicker: labels ? labels.kicker : t("Site page", "Страница сайта"),
          summary: page.summary,
          excerpt: page.summary,
          seoTitle: page.title,
          seoDescription: page.summary,
          tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
        },
        write: {
          ...(draft.write || {}),
          visualHtml,
          markdown: "# " + page.title + "\n\n" + page.summary + "\n",
          activeWorkspaceTab: "draft",
          activeCabinetTab: "write"
        },
        sitePageId: page.id,
        updatedAt: time
      };

      const saved = this.store.saveDraft(nextDraft);
      page.draftId = saved.id;
      state.pages.unshift(page);
      state.activePageId = page.id;
      writeEditorSitePagesState(state);

      this.currentDraft = deepClone(saved);
      this.lastSavedAt = saved.updatedAt || this.lastSavedAt || "";
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
      this.flashStatus(labels ? labels.created : t("Site page created and opened.", "Страница сайта создана и открыта."));
      this.broadcast();
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor", draftId: saved.id, pageId: page.id } }));
      return deepClone(saved);
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
      const label = drafts.length + " " + t("drafts","черновиков");

      if (this.refs.headerDraftCount) {
        this.refs.headerDraftCount.textContent = label;
      }

      if (this.refs.sidebarDraftCount) {
        this.refs.sidebarDraftCount.textContent = label;
      }

      const listRoot = this.refs.draftList;
      if (!listRoot) return;

      if (!drafts.length) {
        listRoot.innerHTML = '<div class="ns-editor-shell__mini-empty">' + t("No drafts yet.","Черновиков пока нет.") + '</div>';
        return;
      }

      const state = readEditorSitePagesState();
      const sitePageDrafts = drafts.filter((draft) => draft.sitePageId || getEditorSitePageByDraftId(draft.id));
      const regularDrafts = drafts.filter((draft) => !draft.sitePageId && !getEditorSitePageByDraftId(draft.id));

      const row = (draft, kind) => {
        const active = this.currentDraft?.id === draft.id ? "is-active" : "";
        const template = getTemplate(draft.templateId);
        const page = draft.sitePageId ? (state.pages || []).find((item) => item.id === draft.sitePageId) : getEditorSitePageByDraftId(draft.id);
        const kindText = kind === "page" ? t("Site page", "Страница сайта") : t("Draft", "Черновик");
        const detail = kind === "page"
          ? kindText + (page && page.slug ? " · /" + page.slug : "") + " · " + formatDateTime(draft.updatedAt)
          : getTemplateUiMeta(template).name + " · " + formatDateTime(draft.updatedAt);
        return '<div class="ns-editor-shell__list-row ' + active + '" data-draft-kind="' + (kind === "page" ? "site-page" : "draft") + '">' +
          '<button class="ns-editor-shell__list-button ' + active + '" type="button" data-draft-id="' + escapeHtml(draft.id) + '">' +
            '<span class="ns-editor-shell__list-title">' + escapeHtml(draft.meta.title || t("Untitled draft","Черновик без названия")) + '</span>' +
            '<span class="ns-editor-shell__list-subtitle">' + escapeHtml(detail) + '</span>' +
            (kind === "page" ? '<span class="ns-editor-shell__site-page-pill">' + escapeHtml(t("Site page", "Страница сайта")) + '</span>' : '') +
          '</button>' +
          '<button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete" type="button" data-action="delete-draft-item" data-draft-id="' + escapeHtml(draft.id) + '">' + t('Delete','Удалить') + '</button>' +
        '</div>';
      };

      const sections = [];
      if (sitePageDrafts.length) {
        sections.push('<div class="ns-editor-shell__list-section"><div class="ns-editor-shell__list-section-title">' + escapeHtml(t("Site pages", "Страницы сайта")) + '</div>' + sitePageDrafts.map((draft) => row(draft, "page")).join("") + '</div>');
      }
      if (regularDrafts.length) {
        sections.push('<div class="ns-editor-shell__list-section"><div class="ns-editor-shell__list-section-title">' + escapeHtml(t("Drafts", "Черновики")) + '</div>' + regularDrafts.map((draft) => row(draft, "draft")).join("") + '</div>');
      }
      listRoot.innerHTML = sections.join("");
    }

    syncHeaderState() {

      if (!this.refs.statusBadge) return;

      if (!this.currentDraft) {
        this.refs.statusBadge.textContent = t("No active draft","Нет активного черновика");
        return;
      }

      const page = this.currentDraft.sitePageId ? (readEditorSitePagesState().pages || []).find((item) => item.id === this.currentDraft.sitePageId) : getEditorSitePageByDraftId(this.currentDraft.id);
      const prefix = page ? t("Site page:", "Страница сайта:") : t("Editing:","Редактируется:");
      this.refs.statusBadge.textContent = `${prefix} ${this.currentDraft.meta.title || t("Untitled draft","Черновик без названия")}`;
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

                <div class="ns-editor-field full ns-editor-favicon-generator ns-editor-logo-generator">
                  <label>${t("Generate logo from letters","Создать логотип из букв")}</label>
                  <div class="ns-editor-favicon-generator__row">
                    <input class="ns-editor-input ns-editor-favicon-generator__letters" name="siteLogoLetters" maxlength="3" value="${escapeHtml(getInitials(siteProfile.siteName))}" aria-label="${t('Logo letters','Буквы логотипа')}" />
                    <input class="ns-editor-input ns-editor-favicon-generator__color" name="siteLogoBackground" type="color" value="${escapeHtml(siteProfile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor)}" aria-label="${t('Logo background','Фон логотипа')}" />
                    <input class="ns-editor-input ns-editor-favicon-generator__color" name="siteLogoForeground" type="color" value="#ffffff" aria-label="${t('Logo text color','Цвет букв логотипа')}" />
                    <select class="ns-editor-input ns-editor-favicon-generator__shape" name="siteLogoFont" aria-label="${t('Logo font','Шрифт логотипа')}">

                      ${renderBrandFontOptions("inter")}

                    </select>

                    <select class="ns-editor-input ns-editor-favicon-generator__shape" name="siteLogoWeight" aria-label="${t('Logo font weight','Толщина логотипа')}">

                      ${renderBrandWeightOptions("800")}

                    </select>

                    <select class="ns-editor-input ns-editor-favicon-generator__shape" name="siteLogoShape" aria-label="${t('Logo shape','Форма логотипа')}">
                      <option value="rounded" selected>${t("Round","Скругл.")}</option>
                      <option value="square">${t("Square","Квадрат")}</option>
                      <option value="circle">${t("Circle","Круг")}</option>
                    </select>
                    <button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="generate-site-logo">${t("Generate logo","Создать логотип")}</button>
                    <button class="ns-editor-shell__button" type="button" data-action="generate-site-logo-set">${t("Generate logo + favicon","Создать логотип + favicon")}</button>
                  </div>
                  <p class="ns-editor-field-hint">${t("Create a matching SVG Data URL logo for the site header. Use the second button when the favicon should match the logo exactly.", "Создаёт совпадающий SVG Data URL логотип для шапки сайта. Вторая кнопка создаёт favicon из тех же букв, цветов и формы.")}</p>
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
                    <select class="ns-editor-input ns-editor-favicon-generator__shape" name="siteFaviconFont" aria-label="${t('Favicon font','Шрифт favicon')}">

                      ${renderBrandFontOptions("inter")}

                    </select>

                    <select class="ns-editor-input ns-editor-favicon-generator__shape" name="siteFaviconWeight" aria-label="${t('Favicon font weight','Толщина favicon')}">

                      ${renderBrandWeightOptions("800")}

                    </select>

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
      const logoLettersInput = mount.querySelector('[name="siteLogoLetters"]');
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
      if (logoLettersInput && !logoLettersInput.value.trim()) logoLettersInput.value = getInitials(next.siteName);
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

    generateSiteLogoFromForm(includeFavicon = false) {
      const mount = this.root;
      if (!mount) return;
      const profile = getSiteProfile();
      const lettersInput = mount.querySelector('[name="siteLogoLetters"]');
      const backgroundInput = mount.querySelector('[name="siteLogoBackground"]');
      const foregroundInput = mount.querySelector('[name="siteLogoForeground"]');
      const shapeInput = mount.querySelector('[name="siteLogoShape"]');
      const fontInput = mount.querySelector('[name="siteLogoFont"]');
      const weightInput = mount.querySelector('[name="siteLogoWeight"]');
      const options = {
        letters: lettersInput?.value || getInitials(profile.siteName),
        background: backgroundInput?.value || profile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor,
        foreground: foregroundInput?.value || "#ffffff",
        shape: shapeInput?.value || "rounded",
        fontFamily: fontInput?.value || "inter",
        fontWeight: weightInput?.value || "800"
      };
      const logoDataUrl = buildGeneratedLogoDataUrl(options);
      const faviconDataUrl = includeFavicon ? buildGeneratedFaviconDataUrl(options) : profile.faviconPath;
      const patch = {
        ...profile,
        logoPath: logoDataUrl,
        logoAlt: profile.siteName || profile.logoAlt || DEFAULT_SITE_PROFILE.logoAlt
      };
      if (includeFavicon) {
        patch.faviconPath = faviconDataUrl;
      }
      const nextProfile = this.updateSiteIdentityFields(patch);
      this.syncSiteProfileFromForm();
      this.refreshSiteIdentityEverywhere({
        ...nextProfile,
        logoPath: logoDataUrl,
        logoAlt: patch.logoAlt,
        ...(includeFavicon ? { faviconPath: faviconDataUrl } : {})
      }, {
        remountWrite: true,
        keepIdentityOpen: true,
        message: includeFavicon
          ? t("Logo and favicon generated from the same letters.", "Логотип и favicon созданы из одинаковых букв.")
          : t("Logo generated from letters.", "Логотип создан из букв.")
      });
    }

    generateSiteFaviconFromForm() {
      const mount = this.root;
      if (!mount) return;
      const profile = getSiteProfile();
      const lettersInput = mount.querySelector('[name="siteFaviconLetters"]');
      const backgroundInput = mount.querySelector('[name="siteFaviconBackground"]');
      const foregroundInput = mount.querySelector('[name="siteFaviconForeground"]');
      const shapeInput = mount.querySelector('[name="siteFaviconShape"]');
      const fontInput = mount.querySelector('[name="siteFaviconFont"]');
      const weightInput = mount.querySelector('[name="siteFaviconWeight"]');
      const dataUrl = buildGeneratedFaviconDataUrl({
        letters: lettersInput?.value || getInitials(profile.siteName),
        background: backgroundInput?.value || profile.primaryColor || DEFAULT_SITE_PROFILE.primaryColor,
        foreground: foregroundInput?.value || "#ffffff",
        shape: shapeInput?.value || "rounded",
        fontFamily: fontInput?.value || "inter",
        fontWeight: weightInput?.value || "800"
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
              <iframe class="ns-editor-preview-frame" title="${t("Live preview","Живой предпросмотр")}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc='${escapeHtml(inlineDoc)}'></iframe>
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
      const output = await buildOutputPackageWithAssets(draft);
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
        const output = await buildOutputPackageWithAssets(draft);
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

  // 1.0.0 v9: Editor Pages Manager v1
  // Keeps site pages inside Editor: pages list, click-to-open, separate drafts.
  (function installEditorPagesManagerV1() {
    if (EditorSurface.prototype.__irgeztnePagesManagerV1) return;
    EditorSurface.prototype.__irgeztnePagesManagerV1 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function sitePageLocale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function sitePageIsRu() {
      return String(sitePageLocale() || "").startsWith("ru");
    }

    function pageLabels() {
      const ru = sitePageIsRu();
      return {
        pagesTitle: ru ? "Страницы сайта" : "Site pages",
        draftsTitle: ru ? "Черновики" : "Drafts",
        noPages: ru ? "Страниц пока нет." : "No site pages yet.",
        noDrafts: ru ? "Обычных черновиков пока нет." : "No regular drafts yet.",
        newPage: ru ? "+ Новая страница" : "+ New page",
        sitePage: ru ? "Страница сайта" : "Site page",
        linked: ru ? "черновик связан" : "draft linked",
        noDraft: ru ? "нет черновика" : "no draft",
        inMenu: ru ? "в меню" : "in menu",
        hidden: ru ? "не в меню" : "hidden",
        draft: ru ? "черновик" : "draft",
        published: ru ? "опубликовано" : "published",
        content: ru ? "Контент" : "Content",
        summary: ru
          ? "Напишите эту страницу в редакторе. Slug, меню, порядок и подстраницы позже управляются в структуре сайта."
          : "Write this page in Editor. Slug, menu, order and subpages are managed in site structure later.",
        start: ru ? "Начните писать страницу сайта здесь." : "Start writing this site page here.",
        opened: ru ? "Страница сайта открыта." : "Site page opened.",
        created: ru ? "Страница сайта создана и открыта." : "Site page created and opened."
      };
    }

    function defaultPagesState() {
      const time = nowIso();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: [
          { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
        ]
      };
    }

    function readPagesStateV1() {
      const fallback = defaultPagesState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map((page, index) => ({
            id: page.id || uid("page"),
            title: page.title || page.label || "Untitled page",
            slug: page.slug || slugify(page.title || page.label || "page"),
            status: page.status || "draft",
            type: page.type || "page",
            menu: page.menu !== false,
            parentId: page.parentId || "",
            order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
            summary: page.summary || page.description || "",
            draftId: page.draftId || "",
            createdAt: page.createdAt || fallback.createdAt,
            updatedAt: page.updatedAt || fallback.updatedAt
          }))
        };
      } catch (error) {
        console.warn("[NSEditorV1] Could not read pages state:", error);
        return fallback;
      }
    }

    function writePagesStateV1(state) {
      const next = { ...state, updatedAt: nowIso() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] Could not write pages state:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor-pages-manager-v1", state: deepClone(next) } }));
      return next;
    }

    function safeSiteTemplateIdV1(surface) {
      if (surface && typeof surface.getSafeSitePageTemplateId === "function") return surface.getSafeSitePageTemplateId();
      try {
        if (typeof DEFAULT_TEMPLATE_ID !== "undefined" && DEFAULT_TEMPLATE_ID) return DEFAULT_TEMPLATE_ID;
      } catch (_) {}
      try {
        const templates = typeof getCurrentTemplates === "function" ? getCurrentTemplates() : [];
        if (Array.isArray(templates) && templates[0] && templates[0].id) return templates[0].id;
      } catch (_) {}
      return "project-landing";
    }

    function makeSitePageDraftV1(surface, page, state) {
      const labels = pageLabels();
      const locale = sitePageLocale();
      const time = nowIso();
      const title = page.title || labels.sitePage;
      const summary = page.summary || labels.summary;
      let draft = createDraft(safeSiteTemplateIdV1(surface), { locale });
      const visualHtml = [
        '<section class="ns-page-section ns-page-hero ns-page-hero--split">',
        '<div class="ns-page-hero__content">',
        '<div class="ns-page-kicker">' + escapeHtml(labels.sitePage) + '</div>',
        '<h1>' + escapeHtml(title) + '</h1>',
        '<p>' + escapeHtml(summary) + '</p>',
        '</div>',
        '</section>',
        '<section class="ns-page-section">',
        '<h2>' + escapeHtml(labels.content) + '</h2>',
        '<p>' + escapeHtml(labels.start) + '</p>',
        '</section>'
      ].join("");

      draft = {
        ...draft,
        status: "draft",
        updatedAt: time,
        sitePageId: page.id,
        project: { ...(draft.project || {}), name: title, slug: page.slug || slugify(title) },
        meta: {
          ...(draft.meta || {}),
          title,
          slug: page.slug || slugify(title),
          category: "website",
          kicker: labels.sitePage,
          summary,
          excerpt: summary,
          seoTitle: title,
          seoDescription: summary,
          tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
        },
        write: {
          ...(draft.write || {}),
          visualHtml,
          markdown: "# " + title + "\n\n" + summary + "\n",
          activeWorkspaceTab: "draft",
          activeCabinetTab: "write"
        },
        content: {
          ...(draft.content || {}),
          body: visualHtml
        },
        deploy: {
          ...(draft.deploy || {}),
          manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: (page.slug || slugify(title) || "page") + ".html" }
        }
      };

      const saved = surface.store.saveDraft(draft);
      page.draftId = saved.id;
      page.updatedAt = time;
      state.activePageId = page.id;
      writePagesStateV1(state);
      return saved;
    }

    EditorSurface.prototype.openEditorSitePageById = function openEditorSitePageById(pageId) {
      const labels = pageLabels();
      const state = readPagesStateV1();
      const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
      if (!page) {
        this.flashStatus(labels.noPages);
        return null;
      }

      let draft = page.draftId ? this.store.getDraft(page.draftId) : null;
      if (!draft) {
        draft = makeSitePageDraftV1(this, page, state);
      } else {
        state.activePageId = page.id;
        writePagesStateV1(state);
      }

      this.openDraft(draft.id, true, false, this.surfaceType === "cabinet" ? "write" : "draft");
      this.toggleLeftPanel(false);
      this.flashStatus(labels.opened);
      return draft;
    };

    const originalSyncHeaderState = EditorSurface.prototype.syncHeaderState;
    EditorSurface.prototype.syncHeaderState = function syncHeaderStatePagesManagerV1() {
      if (!this.refs.statusBadge) return originalSyncHeaderState.call(this);
      if (this.currentDraft && this.currentDraft.sitePageId) {
        const state = readPagesStateV1();
        const page = (state.pages || []).find((item) => String(item.id) === String(this.currentDraft.sitePageId));
        this.refs.statusBadge.textContent = (sitePageIsRu() ? "Страница сайта: " : "Site page: ") + escapeHtml(page?.title || this.currentDraft.meta?.title || "");
        return;
      }
      return originalSyncHeaderState.call(this);
    };

    EditorSurface.prototype.renderDraftList = function renderDraftListPagesManagerV1() {
      const drafts = this.store.getDrafts();
      const labels = pageLabels();
      const label = drafts.length + " " + t("drafts","черновиков");

      if (this.refs.headerDraftCount) this.refs.headerDraftCount.textContent = label;
      if (this.refs.sidebarDraftCount) this.refs.sidebarDraftCount.textContent = label;

      const listRoot = this.refs.draftList;
      if (!listRoot) return;

      const state = readPagesStateV1();
      const pages = (state.pages || []).slice().sort((a, b) => {
        const parentA = a.parentId || "";
        const parentB = b.parentId || "";
        if (parentA !== parentB) return parentA.localeCompare(parentB);
        return Number(a.order || 0) - Number(b.order || 0);
      });
      const pageDraftIds = new Set(pages.map((page) => String(page.draftId || "")).filter(Boolean));
      const regularDrafts = drafts.filter((draft) => {
        if (!draft) return false;
        if (draft.sitePageId) return false;
        if (pageDraftIds.has(String(draft.id || ""))) return false;
        const tags = draft.meta && Array.isArray(draft.meta.tags) ? draft.meta.tags : [];
        if (tags.includes("site-page")) return false;
        return true;
      });

      const pageRows = pages.map((page) => {
        const isActive = Boolean(this.currentDraft && (
          String(this.currentDraft.sitePageId || "") === String(page.id) ||
          (page.draftId && String(this.currentDraft.id || "") === String(page.draftId))
        ));
        const active = isActive ? "is-active" : "";
        const level = page.parentId ? " ns-editor-shell__site-page-row--child" : "";
        const status = page.status === "published" ? labels.published : labels.draft;
        const menu = page.menu !== false ? labels.inMenu : labels.hidden;
        const linked = page.draftId ? labels.linked : labels.noDraft;
        return '<div class="ns-editor-shell__list-row ns-editor-shell__site-page-row ' + active + level + '">' +
          '<button class="ns-editor-shell__list-button ' + active + '" type="button" data-site-page-id="' + escapeHtml(page.id) + '">' +
            '<span class="ns-editor-shell__list-title">' + escapeHtml(page.title || labels.sitePage) + '</span>' +
            '<span class="ns-editor-shell__list-subtitle">/' + escapeHtml(page.slug || "") + ' · ' + escapeHtml(status) + ' · ' + escapeHtml(menu) + '</span>' +
            '<span class="ns-editor-shell__site-page-pill">' + escapeHtml(linked) + '</span>' +
          '</button>' +
        '</div>';
      }).join("");

      const draftRows = regularDrafts.map((draft) => {
        const active = this.currentDraft?.id === draft.id ? "is-active" : "";
        const template = getTemplate(draft.templateId);
        return '<div class="ns-editor-shell__list-row ' + active + '">' +
          '<button class="ns-editor-shell__list-button ' + active + '" type="button" data-draft-id="' + escapeHtml(draft.id) + '">' +
            '<span class="ns-editor-shell__list-title">' + escapeHtml(draft.meta.title || t("Untitled draft","Черновик без названия")) + '</span>' +
            '<span class="ns-editor-shell__list-subtitle">' + escapeHtml(getTemplateUiMeta(template).name) + ' · ' + escapeHtml(formatDateTime(draft.updatedAt)) + '</span>' +
          '</button>' +
          '<button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete" type="button" data-action="delete-draft-item" data-draft-id="' + escapeHtml(draft.id) + '">' + t("Delete","Удалить") + '</button>' +
        '</div>';
      }).join("");

      listRoot.innerHTML =
        '<div class="ns-editor-shell__list-section ns-editor-shell__pages-section">' +
          '<div class="ns-editor-shell__list-section-head">' +
            '<div class="ns-editor-shell__list-section-title">' + escapeHtml(labels.pagesTitle) + '</div>' +
            '<button class="ns-editor-shell__button ns-editor-shell__button--primary ns-editor-shell__list-new-page" type="button" data-action="new-site-page">' + escapeHtml(labels.newPage) + '</button>' +
          '</div>' +
          (pageRows || '<div class="ns-editor-shell__mini-empty">' + escapeHtml(labels.noPages) + '</div>') +
        '</div>' +
        '<div class="ns-editor-shell__list-section ns-editor-shell__drafts-section">' +
          '<div class="ns-editor-shell__list-section-title">' + escapeHtml(labels.draftsTitle) + '</div>' +
          (draftRows || '<div class="ns-editor-shell__mini-empty">' + escapeHtml(labels.noDrafts) + '</div>') +
        '</div>';
    };

    document.addEventListener("click", (event) => {
      const pageButton = event.target && event.target.closest ? event.target.closest("[data-site-page-id]") : null;
      if (!pageButton) return;
      const shell = pageButton.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface || typeof surface.openEditorSitePageById !== "function") return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      surface.openEditorSitePageById(pageButton.dataset.sitePageId);
    }, true);
  })();


  // 1.0.0 v10: Site Page Template Bridge v1
  // Bridges Editor site pages to a real page-aware preview template.
  // This is foundation only: no cloud deploy, no public marketplace, no Map changes.
  (function installSitePageTemplateBridgeV1() {
    if (EditorSurface.prototype.__irgeztneSitePageTemplateBridgeV1) return;
    EditorSurface.prototype.__irgeztneSitePageTemplateBridgeV1 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function bridgeLocale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function bridgeIsRu() {
      return String(bridgeLocale() || "").startsWith("ru");
    }

    function bridgeText(en, ru) {
      return bridgeIsRu() ? ru : en;
    }

    function bridgeDefaultPagesState() {
      const time = nowIso();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: [
          { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
        ]
      };
    }

    function bridgeReadPagesState() {
      const fallback = bridgeDefaultPagesState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map((page, index) => ({
            id: page.id || uid("page"),
            title: page.title || page.label || "Untitled page",
            slug: page.slug || slugify(page.title || page.label || "page"),
            status: page.status || "draft",
            type: page.type || "page",
            menu: page.menu !== false,
            parentId: page.parentId || "",
            order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
            summary: page.summary || page.description || "",
            seoTitle: page.seoTitle || "",
            seoDescription: page.seoDescription || "",
            contentHtml: page.contentHtml || "",
            draftId: page.draftId || "",
            createdAt: page.createdAt || fallback.createdAt,
            updatedAt: page.updatedAt || fallback.updatedAt
          }))
        };
      } catch (error) {
        console.warn("[NSEditorV1] Bridge could not read pages state:", error);
        return fallback;
      }
    }

    function bridgeWritePagesState(state) {
      const next = { ...state, updatedAt: nowIso() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] Bridge could not write pages state:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "site-page-template-bridge-v1", state: deepClone(next) } }));
      return next;
    }

    function bridgeCurrentPage(draft) {
      if (!draft || !draft.sitePageId) return null;
      const state = bridgeReadPagesState();
      const page = (state.pages || []).find((item) => String(item.id) === String(draft.sitePageId));
      return page ? { state, page } : { state, page: null };
    }

    function bridgeSyncDraftToPage(draft) {
      if (!draft || !draft.sitePageId) return null;
      const found = bridgeCurrentPage(draft);
      if (!found) return null;
      const state = found.state;
      const pages = Array.isArray(state.pages) ? state.pages : [];
      const index = pages.findIndex((item) => String(item.id) === String(draft.sitePageId));
      if (index === -1) return null;

      const meta = draft.meta || {};
      const page = { ...pages[index] };
      const title = String(meta.title || page.title || bridgeText("Untitled page", "Страница без названия")).trim();
      const slug = slugify(meta.slug || page.slug || title) || page.slug || "page";
      const contentHtml = buildPreviewHtmlFromWrite(draft.write || {});
      page.title = title;
      page.slug = slug;
      page.summary = String(meta.summary || meta.excerpt || page.summary || "").trim();
      page.seoTitle = String(meta.seoTitle || title).trim();
      page.seoDescription = String(meta.seoDescription || page.summary || "").trim();
      page.contentHtml = contentHtml;
      page.draftId = draft.id || page.draftId || "";
      page.status = draft.status || page.status || "draft";
      page.updatedAt = nowIso();

      pages[index] = page;
      state.pages = pages;
      state.activePageId = page.id;
      bridgeWritePagesState(state);
      return page;
    }

    function bridgeGetPageContentHtml(draft, page) {
      const fromDraft = draft && draft.write ? buildPreviewHtmlFromWrite(draft.write) : "";
      if (String(fromDraft || "").trim()) return fromDraft;
      if (page && String(page.contentHtml || "").trim()) return page.contentHtml;
      const title = page?.title || draft?.meta?.title || bridgeText("Untitled page", "Страница без названия");
      const summary = page?.summary || draft?.meta?.summary || "";
      return '<section class="irgeztne-site-page__section"><h1>' + escapeHtml(title) + '</h1><p>' + escapeHtml(summary) + '</p></section>';
    }

    function bridgeRenderSitePageHtml(draft) {
      const locale = bridgeLocale();
      const siteProfile = getSiteProfile();
      const found = bridgeCurrentPage(draft);
      const state = found?.state || bridgeReadPagesState();
      const page = found?.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || bridgeText("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || draft?.meta?.title || "",
        seoDescription: draft?.meta?.seoDescription || draft?.meta?.summary || "",
        menu: true
      };

      const pages = (state.pages || []).filter((item) => item && item.menu !== false);
      const orderedPages = pages.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = orderedPages.length ? orderedPages : [page];
      const pageTitle = page.seoTitle || page.title || draft?.meta?.seoTitle || draft?.meta?.title || siteProfile.siteName;
      const pageDescription = page.seoDescription || page.summary || draft?.meta?.seoDescription || draft?.meta?.summary || siteProfile.tagline;
      const contentHtml = bridgeGetPageContentHtml(draft, page);
      const primary = siteProfile.primaryColor || "#4278e8";
      const accent = siteProfile.accentColor || primary;
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const logo = siteProfile.logoPath
        ? '<span class="irgeztne-site-preview__logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="irgeztne-site-preview__mark">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navMarkup = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--accent:${accent};--ink:#142034;--muted:#667085;--paper:#ffffff;--soft:#f6f7fb;--line:rgba(20,32,52,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf5ec 0%,#fff 52%,#f1f5ff 100%);min-height:100vh}
        .irgeztne-site-preview{min-height:100vh;display:flex;flex-direction:column}
        .irgeztne-site-preview__shell{width:min(1180px,calc(100% - 48px));margin:0 auto}
        .irgeztne-site-preview__header{position:sticky;top:0;z-index:2;backdrop-filter:blur(20px);background:rgba(255,255,255,.78);border-bottom:1px solid var(--line)}
        .irgeztne-site-preview__navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .irgeztne-site-preview__brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
        .irgeztne-site-preview__mark,.irgeztne-site-preview__logo{width:42px;height:42px;border-radius:16px;display:grid;place-items:center;background:var(--primary);color:#fff;font-weight:900;box-shadow:0 12px 30px rgba(66,120,232,.22);overflow:hidden}
        .irgeztne-site-preview__logo img{width:100%;height:100%;object-fit:cover}
        .irgeztne-site-preview__brand strong{display:block;font-size:1rem;letter-spacing:-.02em}
        .irgeztne-site-preview__brand span span{display:block;color:var(--muted);font-size:.82rem}
        .irgeztne-site-preview__menu{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        .irgeztne-site-preview__menu a{padding:9px 12px;border-radius:999px;text-decoration:none;color:#334155;font-weight:800;font-size:.88rem;border:1px solid transparent}
        .irgeztne-site-preview__menu a:hover,.irgeztne-site-preview__menu a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        .irgeztne-site-preview__main{flex:1;padding:44px 0 64px}
        .irgeztne-site-preview__page{background:rgba(255,255,255,.76);border:1px solid var(--line);border-radius:32px;padding:clamp(24px,5vw,64px);box-shadow:0 24px 80px rgba(15,23,42,.10)}
        .irgeztne-site-preview__kicker{color:var(--primary);text-transform:uppercase;letter-spacing:.14em;font-size:.76rem;font-weight:900;margin-bottom:12px}
        .irgeztne-site-preview__page h1{font-size:clamp(2.4rem,6vw,5.6rem);line-height:.96;letter-spacing:-.075em;margin:0 0 20px}
        .irgeztne-site-preview__summary{font-size:clamp(1rem,2vw,1.26rem);line-height:1.7;color:var(--muted);max-width:760px;margin:0 0 32px}
        .irgeztne-site-preview__content{font-size:1.03rem;line-height:1.72}
        .irgeztne-site-preview__content h1,.irgeztne-site-preview__content h2,.irgeztne-site-preview__content h3{letter-spacing:-.035em}
        .irgeztne-site-preview__content p{margin:0 0 1rem}
        .irgeztne-site-preview__content img{max-width:100%;border-radius:20px}
        .irgeztne-site-preview__footer{border-top:1px solid var(--line);background:rgba(255,255,255,.62);padding:24px 0;color:var(--muted);font-size:.9rem}
        @media(max-width:760px){.irgeztne-site-preview__navrow{align-items:flex-start;flex-direction:column}.irgeztne-site-preview__shell{width:min(100% - 28px,1180px)}.irgeztne-site-preview__page{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(locale) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><div class="irgeztne-site-preview"><header class="irgeztne-site-preview__header"><div class="irgeztne-site-preview__shell irgeztne-site-preview__navrow"><a class="irgeztne-site-preview__brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><span>' + escapeHtml(tagline) + '</span></span></a><nav class="irgeztne-site-preview__menu">' + navMarkup + '</nav></div></header><main class="irgeztne-site-preview__main"><article class="irgeztne-site-preview__shell irgeztne-site-preview__page"><div class="irgeztne-site-preview__kicker">' + escapeHtml(bridgeText("Site page", "Страница сайта")) + '</div><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="irgeztne-site-preview__summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="irgeztne-site-preview__content">' + contentHtml + '</div></article></main><footer class="irgeztne-site-preview__footer"><div class="irgeztne-site-preview__shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></div></body></html>';
    }

    function bridgeOpenSitePreview(surface) {
      if (!surface || !surface.currentDraft) return;
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(surface.currentDraft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(surface.currentDraft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    const originalSaveCurrentDraft = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftBridgeV1(showToast) {
      const result = originalSaveCurrentDraft.call(this, showToast);
      const draft = this.currentDraft || result;
      if (draft && draft.sitePageId) {
        const page = bridgeSyncDraftToPage(draft);
        if (page && showToast) {
          this.flashStatus(bridgeText("Site page saved.", "Страница сайта сохранена."));
        }
        this.renderDraftList();
        this.syncHeaderState();
      }
      return result;
    };

    const originalRenderPreviewPanel = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelBridgeV1(draft) {
      if (!draft || !draft.sitePageId) {
        return originalRenderPreviewPanel.call(this, draft);
      }
      if (!this.refs.previewLive) return;
      const currentDraft = this.currentDraft && this.currentDraft.id === draft.id ? (this.readForm ? this.readForm() : draft) : draft;
      if (currentDraft && currentDraft.sitePageId) bridgeSyncDraftToPage(currentDraft);
      const inlineDoc = bridgeRenderSitePageHtml(currentDraft || draft);
      const slug = (currentDraft?.meta?.slug || draft.meta?.slug || "page");
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page">' +
        '<div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(bridgeText("Site page preview", "Предпросмотр страницы сайта")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div>' +
        '<div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page" title="' + escapeHtml(bridgeText("Site page preview", "Предпросмотр страницы сайта")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(inlineDoc) + '\'></iframe></div></div>' +
      '</div>';
    };

    const originalRenderPreviewMeta = EditorSurface.prototype.renderPreviewMeta;
    EditorSurface.prototype.renderPreviewMeta = function renderPreviewMetaBridgeV1(draft) {
      originalRenderPreviewMeta.call(this, draft);
      if (!draft || !draft.sitePageId || !this.refs.previewMeta) return;
      const found = bridgeCurrentPage(draft);
      const page = found?.page || null;
      const title = page?.title || draft.meta?.title || "";
      const slug = page?.slug || draft.meta?.slug || "";
      const seoTitle = page?.seoTitle || draft.meta?.seoTitle || title;
      const seoDescription = page?.seoDescription || draft.meta?.seoDescription || page?.summary || draft.meta?.summary || "";
      this.refs.previewMeta.insertAdjacentHTML("afterbegin", '<div class="ns-editor-shell__mini-card ns-editor-site-page-bridge-card"><h3>' + escapeHtml(bridgeText("Site page", "Страница сайта")) + '</h3><div class="ns-editor-shell__mini-source">/' + escapeHtml(slug) + '</div><div class="ns-editor-shell__mini-source">SEO title: ' + escapeHtml(seoTitle) + '</div><div class="ns-editor-shell__mini-source">SEO description: ' + escapeHtml(seoDescription) + '</div><div class="ns-editor-preview-actions"><button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="open-site-preview">' + escapeHtml(bridgeText("Refresh site preview", "Обновить предпросмотр сайта")) + '</button></div></div>');
    };

    const originalSyncHeaderState = EditorSurface.prototype.syncHeaderState;
    EditorSurface.prototype.syncHeaderState = function syncHeaderStateBridgeV1() {
      originalSyncHeaderState.call(this);
      if (this.currentDraft && this.currentDraft.sitePageId && this.refs.statusBadge) {
        const found = bridgeCurrentPage(this.currentDraft);
        const page = found?.page || null;
        this.refs.statusBadge.textContent = (bridgeIsRu() ? "Страница сайта: " : "Site page: ") + (page?.title || this.currentDraft.meta?.title || "");
      }
    };

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-action="open-site-preview"]') : null;
      if (!button) return;
      const shell = button.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      if (surface.currentDraft && surface.currentDraft.sitePageId) {
        const next = surface.readForm ? surface.readForm() : surface.currentDraft;
        surface.currentDraft = next;
        bridgeSyncDraftToPage(next);
        if (surface.store && typeof surface.store.saveDraft === "function") {
          surface.store.saveDraft(next);
        }
      }
      if (typeof window.IRGEZTNEOpenSitePagePreviewV15 === "function") { window.IRGEZTNEOpenSitePagePreviewV15(surface); } else if (typeof window.IRGEZTNEOpenSitePagePreviewV15 === "function") { if (typeof window.IRGEZTNEOpenSitePagePreviewV15 === "function") { window.IRGEZTNEOpenSitePagePreviewV15(surface); } else { window.IRGEZTNEOpenSitePagePreviewV15(surface); } } else { bridgeOpenSitePreview(surface); }
    }, true);
  })();


  // 1.0.0 v11b: Site Page Settings + Preview v2 fixed
  // Adds proper page settings for site-page drafts and routes browser preview
  // through a page-aware template instead of raw content.
  (function installSitePageSettingsPreviewV2() {
    if (EditorSurface.prototype.__irgeztneSitePageSettingsPreviewV2) return;
    EditorSurface.prototype.__irgeztneSitePageSettingsPreviewV2 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function spLocale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function spRu() {
      return String(spLocale() || "").startsWith("ru");
    }

    function spText(en, ru) {
      return spRu() ? ru : en;
    }

    function spDefaultState() {
      const time = nowIso();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: [
          { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
        ]
      };
    }

    function spReadState() {
      const fallback = spDefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map((page, index) => ({
            id: page.id || uid("page"),
            title: page.title || page.label || "Untitled page",
            slug: page.slug || slugify(page.title || page.label || "page"),
            status: page.status || "draft",
            type: page.type || "page",
            menu: page.menu !== false,
            parentId: page.parentId || "",
            order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
            summary: page.summary || page.description || "",
            seoTitle: page.seoTitle || "",
            seoDescription: page.seoDescription || "",
            contentHtml: page.contentHtml || "",
            draftId: page.draftId || "",
            createdAt: page.createdAt || fallback.createdAt,
            updatedAt: page.updatedAt || fallback.updatedAt
          }))
        };
      } catch (error) {
        console.warn("[NSEditorV1] Could not read Site Pages state:", error);
        return fallback;
      }
    }

    function spWriteState(state) {
      const next = { ...state, updatedAt: nowIso() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] Could not write Site Pages state:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "site-page-settings-preview-v2", state: deepClone(next) } }));
      return next;
    }

    function spFindPage(draft) {
      const state = spReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function spPatchPageFromDraft(draft, state, index, extra = {}) {
      if (!draft || !draft.sitePageId || index < 0) return null;
      const pages = Array.isArray(state.pages) ? state.pages.slice() : [];
      const oldPage = pages[index] || {};
      const meta = draft.meta || {};
      const title = String(extra.title ?? meta.title ?? oldPage.title ?? spText("Untitled page", "Страница без названия")).trim();
      const slug = slugify(String(extra.slug ?? meta.slug ?? oldPage.slug ?? title).trim()) || "page";
      const summary = String(extra.summary ?? meta.summary ?? meta.excerpt ?? oldPage.summary ?? "").trim();
      const seoTitle = String(extra.seoTitle ?? meta.seoTitle ?? oldPage.seoTitle ?? title).trim();
      const seoDescription = String(extra.seoDescription ?? meta.seoDescription ?? oldPage.seoDescription ?? summary).trim();
      const status = String(extra.status ?? oldPage.status ?? draft.status ?? "draft");
      const menu = typeof extra.menu === "boolean" ? extra.menu : oldPage.menu !== false;

      const nextPage = {
        ...oldPage,
        id: oldPage.id || draft.sitePageId,
        title,
        slug,
        summary,
        seoTitle,
        seoDescription,
        status,
        menu,
        contentHtml: buildPreviewHtmlFromWrite(draft.write || {}),
        draftId: draft.id || oldPage.draftId || "",
        updatedAt: nowIso()
      };
      pages[index] = nextPage;
      state.pages = pages;
      state.activePageId = nextPage.id;
      spWriteState(state);
      return nextPage;
    }

    function spSyncDraftFromSettings(surface, options = {}) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const get = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = spFindPage(draft);
      const currentPage = found.page || {};
      const title = get("title")?.value.trim() || draft.meta?.title || currentPage.title || spText("Untitled page", "Страница без названия");
      const slug = slugify(get("slug")?.value.trim() || draft.meta?.slug || currentPage.slug || title) || "page";
      const summary = get("summary")?.value.trim() || draft.meta?.summary || currentPage.summary || "";
      const seoTitle = get("seoTitle")?.value.trim() || title;
      const seoDescription = get("seoDescription")?.value.trim() || summary;
      const status = get("status")?.value || currentPage.status || draft.status || "draft";
      const menu = Boolean(get("menu")?.checked);

      draft.status = status;
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: spText("Site page", "Страница сайта")
      };
      draft.deploy = {
        ...(draft.deploy || {}),
        manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" }
      };
      draft.updatedAt = nowIso();

      const page = spPatchPageFromDraft(draft, found.state, found.index, { title, slug, summary, seoTitle, seoDescription, status, menu });
      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);

      if (options.remount) {
        surface.mountWriteSurface(surface.currentDraft);
      }
      surface.renderDraftList();
      surface.syncHeaderState();
      surface.renderDynamicPanels(surface.currentDraft);
      return { draft: saved, page };
    }

    function spRenderPageSettings(surface) {
      const draft = surface.currentDraft;
      if (!draft || !draft.sitePageId) return "";
      const found = spFindPage(draft);
      const page = found.page || {};
      const meta = draft.meta || {};
      const title = page.title || meta.title || "";
      const slug = page.slug || meta.slug || slugify(title);
      const summary = page.summary || meta.summary || meta.excerpt || "";
      const seoTitle = page.seoTitle || meta.seoTitle || title;
      const seoDescription = page.seoDescription || meta.seoDescription || summary;
      const status = page.status || draft.status || "draft";
      const menu = page.menu !== false;
      return '<div class="ns-editor-shell__mini-card ns-editor-site-page-settings-card">' +
        '<h3>' + escapeHtml(spText("Page settings", "Настройки страницы")) + '</h3>' +
        '<label class="ns-editor-field-label">' + escapeHtml(spText("Page title", "Название страницы")) + '</label>' +
        '<input class="ns-editor-input" data-site-page-field="title" value="' + escapeHtml(title) + '" />' +
        '<label class="ns-editor-field-label">Slug / URL</label>' +
        '<input class="ns-editor-input" data-site-page-field="slug" value="' + escapeHtml(slug) + '" />' +
        '<label class="ns-editor-field-label">' + escapeHtml(spText("Short description", "Краткое описание")) + '</label>' +
        '<textarea class="ns-editor-textarea ns-editor-site-page-settings-card__textarea" data-site-page-field="summary">' + escapeHtml(summary) + '</textarea>' +
        '<label class="ns-editor-field-label">SEO title</label>' +
        '<input class="ns-editor-input" data-site-page-field="seoTitle" value="' + escapeHtml(seoTitle) + '" />' +
        '<label class="ns-editor-field-label">SEO description</label>' +
        '<textarea class="ns-editor-textarea ns-editor-site-page-settings-card__textarea" data-site-page-field="seoDescription">' + escapeHtml(seoDescription) + '</textarea>' +
        '<label class="ns-editor-field-label">' + escapeHtml(spText("Status", "Статус")) + '</label>' +
        '<select class="ns-editor-input" data-site-page-field="status">' +
          '<option value="draft" ' + (status === "draft" ? "selected" : "") + '>' + escapeHtml(spText("Draft", "Черновик")) + '</option>' +
          '<option value="published" ' + (status === "published" ? "selected" : "") + '>' + escapeHtml(spText("Published", "Опубликовано")) + '</option>' +
        '</select>' +
        '<label class="ns-editor-checkbox-line"><input type="checkbox" data-site-page-field="menu" ' + (menu ? "checked" : "") + ' /> <span>' + escapeHtml(spText("Show in menu", "Показывать в меню")) + '</span></label>' +
        '<div class="ns-editor-preview-actions ns-editor-preview-actions--compact">' +
          '<button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="sync-site-page-settings">' + escapeHtml(spText("Apply page settings", "Применить настройки")) + '</button>' +
          '<button class="ns-editor-shell__button" type="button" data-action="open-site-preview">' + escapeHtml(spText("Site preview", "К сайту")) + '</button>' +
        '</div>' +
      '</div>';
    }

    function spRenderSiteHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = spFindPage(draft);
      const state = found.state || spReadState();
      const page = found.page || {
        title: draft?.meta?.title || spText("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || draft?.meta?.title || "",
        seoDescription: draft?.meta?.seoDescription || draft?.meta?.summary || "",
        menu: true
      };
      const contentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {});
      const title = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const description = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const navPages = (state.pages || []).filter((item) => item && item.menu !== false).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];
      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';
      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#657084;--paper:#fff;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1200px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.82);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:white;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.78);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,66px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        .kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--primary);font-weight:900;font-size:.76rem;margin-bottom:14px}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:780px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1200px)}article{border-radius:24px}}
      `;
      return '<!doctype html><html lang="' + escapeHtml(spLocale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(title) + '</title><meta name="description" content="' + escapeHtml(description) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><div class="kicker">' + escapeHtml(spText("Site page", "Страница сайта")) + '</div><h1>' + escapeHtml(page.title || title) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    function spOpenPreview(surface) {
      if (!surface || !surface.currentDraft) return;
      const draft = surface.readForm ? surface.readForm() : surface.currentDraft;
      surface.currentDraft = draft;
      const found = spFindPage(draft);
      if (found.index >= 0) spPatchPageFromDraft(draft, found.state, found.index);
      if (surface.store && typeof surface.store.saveDraft === "function") surface.store.saveDraft(draft);
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(draft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(draft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    const oldRenderContextRail = EditorSurface.prototype.renderContextRail;
    EditorSurface.prototype.renderContextRail = function renderContextRailSettingsPreviewV2() {
      oldRenderContextRail.call(this);
      if (!this.currentDraft || !this.currentDraft.sitePageId || !this.refs.contextDraft) return;
      this.refs.contextDraft.innerHTML = spRenderPageSettings(this) + this.refs.contextDraft.innerHTML;
    };

    const oldSaveCurrentDraft = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftSettingsPreviewV2(showToast) {
      if (this.currentDraft && this.currentDraft.sitePageId) {
        spSyncDraftFromSettings(this, { remount: false });
      }
      const result = oldSaveCurrentDraft.call(this, showToast);
      if (this.currentDraft && this.currentDraft.sitePageId) {
        const found = spFindPage(this.currentDraft);
        if (found.index >= 0) spPatchPageFromDraft(this.currentDraft, found.state, found.index);
        this.renderDraftList();
        this.syncHeaderState();
        this.renderDynamicPanels(this.currentDraft);
      }
      return result;
    };

    const oldRenderPreviewPanel = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelSettingsPreviewV2(draft) {
      if (!draft || !draft.sitePageId) return oldRenderPreviewPanel.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id && this.readForm ? this.readForm() : draft;
      const found = spFindPage(current);
      if (found.index >= 0) spPatchPageFromDraft(current, found.state, found.index);
      const html = spRenderSiteHtml(current);
      const slug = current.meta?.slug || "page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-v2"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(spText("Site preview", "Предпросмотр сайта")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-v2" title="' + escapeHtml(spText("Site preview", "Предпросмотр сайта")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const oldEnsureMaterializedPreview = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewSettingsPreviewV2() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) {
        return oldEnsureMaterializedPreview.call(this);
      }
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = this.readForm ? this.readForm() : this.currentDraft;
      this.currentDraft = draft;
      const found = spFindPage(draft);
      if (found.index >= 0) spPatchPageFromDraft(draft, found.state, found.index);
      if (this.store && typeof this.store.saveDraft === "function") this.store.saveDraft(draft);
      const html = spRenderSiteHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || spText("Site preview","Предпросмотр сайта"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] site page preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    document.addEventListener("irgeztne-disabled-site-page-live-input-v14", (event) => {}, true);

    document.addEventListener("change", (event) => {
      const field = event.target && event.target.closest ? event.target.closest("[data-site-page-field]") : null;
      if (!field) return;
      const shell = field.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return;
      spSyncDraftFromSettings(surface, { remount: false });
    }, true);

    document.addEventListener("click", (event) => {
      const actionButton = event.target && event.target.closest ? event.target.closest('[data-action="sync-site-page-settings"], [data-action="open-site-preview"]') : null;
      if (!actionButton) return;
      const shell = actionButton.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface) return;
      if (actionButton.dataset.action === "sync-site-page-settings") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        spSyncDraftFromSettings(surface, { remount: false });
        surface.flashStatus(spText("Page settings applied.", "Настройки страницы применены."));
        return;
      }
      if (actionButton.dataset.action === "open-site-preview" && surface.currentDraft && surface.currentDraft.sitePageId) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        if (typeof window.IRGEZTNEOpenSitePagePreviewV15 === "function") { window.IRGEZTNEOpenSitePagePreviewV15(surface); } else if (typeof window.IRGEZTNEOpenSitePagePreviewV15 === "function") { if (typeof window.IRGEZTNEOpenSitePagePreviewV15 === "function") { window.IRGEZTNEOpenSitePagePreviewV15(surface); } else { window.IRGEZTNEOpenSitePagePreviewV15(surface); } } else { spOpenPreview(surface); }
      }
    }, true);
  })();


  // 1.0.0 v12: Site Page Preview/Delete Fix v3
  // Makes Site Page preview/browser output page-aware and adds per-page delete.
  (function installSitePagePreviewDeleteFixV3() {
    if (EditorSurface.prototype.__irgeztneSitePagePreviewDeleteFixV3) return;
    EditorSurface.prototype.__irgeztneSitePagePreviewDeleteFixV3 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function v12Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function v12Ru() {
      return String(v12Locale() || "").startsWith("ru");
    }

    function v12Text(en, ru) {
      return v12Ru() ? ru : en;
    }

    function v12DefaultState() {
      const time = nowIso();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        pages: [
          { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
        ],
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" }
      };
    }

    function v12ReadState() {
      const fallback = v12DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map((page, index) => ({
            id: page.id || uid("page"),
            title: page.title || page.label || "Untitled page",
            slug: page.slug || slugify(page.title || page.label || "page"),
            status: page.status || "draft",
            type: page.type || "page",
            menu: page.menu !== false,
            parentId: page.parentId || "",
            order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
            summary: page.summary || page.description || "",
            seoTitle: page.seoTitle || "",
            seoDescription: page.seoDescription || "",
            contentHtml: page.contentHtml || "",
            draftId: page.draftId || "",
            createdAt: page.createdAt || fallback.createdAt,
            updatedAt: page.updatedAt || fallback.updatedAt
          }))
        };
      } catch (error) {
        console.warn("[NSEditorV1] v12 could not read site pages:", error);
        return fallback;
      }
    }

    function v12WriteState(state) {
      const next = { ...state, updatedAt: nowIso() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] v12 could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "site-page-preview-delete-fix-v3", state: deepClone(next) } }));
      return next;
    }

    function v12FindPage(draft) {
      const state = v12ReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function v12PatchPageFromDraft(draft, state, index) {
      if (!draft || !draft.sitePageId || index < 0) return null;
      const pages = Array.isArray(state.pages) ? state.pages.slice() : [];
      const oldPage = pages[index] || {};
      const meta = draft.meta || {};
      const title = String(meta.title || oldPage.title || v12Text("Untitled page", "Страница без названия")).trim();
      const slug = slugify(String(meta.slug || oldPage.slug || title).trim()) || "page";
      const summary = String(meta.summary || meta.excerpt || oldPage.summary || "").trim();
      const seoTitle = String(meta.seoTitle || oldPage.seoTitle || title).trim();
      const seoDescription = String(meta.seoDescription || oldPage.seoDescription || summary).trim();
      const contentHtml = buildPreviewHtmlFromWrite(draft.write || {});
      const nextPage = {
        ...oldPage,
        id: oldPage.id || draft.sitePageId,
        title,
        slug,
        summary,
        seoTitle,
        seoDescription,
        status: draft.status || oldPage.status || "draft",
        menu: oldPage.menu !== false,
        contentHtml,
        draftId: draft.id || oldPage.draftId || "",
        updatedAt: nowIso()
      };
      pages[index] = nextPage;
      state.pages = pages;
      state.activePageId = nextPage.id;
      v12WriteState(state);
      return nextPage;
    }

    function v12SyncFromPanel(surface) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const field = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = v12FindPage(draft);
      const page = found.page || {};
      const title = field("title")?.value.trim() || draft.meta?.title || page.title || v12Text("Untitled page", "Страница без названия");
      const slug = slugify(field("slug")?.value.trim() || draft.meta?.slug || page.slug || title) || "page";
      const summary = field("summary")?.value.trim() || draft.meta?.summary || page.summary || "";
      const seoTitle = field("seoTitle")?.value.trim() || title;
      const seoDescription = field("seoDescription")?.value.trim() || summary;
      const status = field("status")?.value || draft.status || page.status || "draft";
      const menuField = field("menu");
      const menu = menuField ? Boolean(menuField.checked) : page.menu !== false;

      draft.status = status;
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: v12Text("Site page", "Страница сайта")
      };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = {
        ...(draft.deploy || {}),
        manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" }
      };
      draft.updatedAt = nowIso();

      const pages = Array.isArray(found.state.pages) ? found.state.pages.slice() : [];
      if (found.index >= 0) {
        pages[found.index] = {
          ...page,
          title,
          slug,
          summary,
          seoTitle,
          seoDescription,
          status,
          menu,
          contentHtml: buildPreviewHtmlFromWrite(draft.write || {}),
          draftId: draft.id || page.draftId || "",
          updatedAt: nowIso()
        };
        found.state.pages = pages;
        found.state.activePageId = draft.sitePageId;
        v12WriteState(found.state);
      }

      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);
      return saved;
    }

    function v12RenderHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = v12FindPage(draft);
      const state = found.state || v12ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || v12Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const pageDescription = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const contentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {}) || page.contentHtml || "";
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";
      const navPages = (state.pages || [])
        .filter((item) => item && item.menu !== false)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--paper:#fff;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.80);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        .kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--primary);font-weight:900;font-size:.76rem;margin-bottom:14px}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(v12Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><div class="kicker">' + escapeHtml(v12Text("Site page", "Страница сайта")) + '</div><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    function v12OpenPreview(surface) {
      if (!surface || !surface.currentDraft) return;
      const draft = v12SyncFromPanel(surface) || (surface.readForm ? surface.readForm() : surface.currentDraft);
      surface.currentDraft = draft;
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(draft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(draft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    window.IRGEZTNEOpenSitePagePreviewV15 = v12OpenPreview;

    const oldRenderPreviewPanel = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelV12(draft) {
      if (!draft || !draft.sitePageId) return oldRenderPreviewPanel.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (v12SyncFromPanel(this) || draft) : draft;
      const html = v12RenderHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-v12"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(v12Text("Site preview", "Предпросмотр сайта")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-v12" title="' + escapeHtml(v12Text("Site preview", "Предпросмотр сайта")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const oldRenderPreviewMeta = EditorSurface.prototype.renderPreviewMeta;
    EditorSurface.prototype.renderPreviewMeta = function renderPreviewMetaV12(draft) {
      if (!draft || !draft.sitePageId || !this.refs.previewMeta) return oldRenderPreviewMeta.call(this, draft);
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (v12SyncFromPanel(this) || draft) : draft;
      const found = v12FindPage(current);
      const page = found.page || {};
      const slug = page.slug || current.meta?.slug || "";
      const seoTitle = page.seoTitle || current.meta?.seoTitle || page.title || current.meta?.title || "";
      const seoDescription = page.seoDescription || current.meta?.seoDescription || page.summary || current.meta?.summary || "";
      this.refs.previewMeta.innerHTML = '<div class="ns-editor-shell__mini-card ns-editor-site-page-preview-card"><h3>' + escapeHtml(v12Text("Site page", "Страница сайта")) + '</h3><div class="ns-editor-shell__mini-source">/' + escapeHtml(slug) + '</div><div class="ns-editor-shell__mini-source">SEO title: ' + escapeHtml(seoTitle) + '</div><div class="ns-editor-shell__mini-source">SEO description: ' + escapeHtml(seoDescription) + '</div><button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="open-site-preview">' + escapeHtml(v12Text("Refresh site preview", "Обновить предпросмотр сайта")) + '</button></div><div class="ns-editor-preview-actions"><button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-action="open-preview-browser">' + escapeHtml(t("Open in workspace browser","Открыть в браузере пространства")) + '</button><button class="ns-editor-shell__button" type="button" data-action="open-preview-external">' + escapeHtml(t("Open in browser","Открыть в браузере")) + '</button><button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">' + escapeHtml(t("Copy preview path","Копировать путь к предпросмотру")) + '</button></div>';
    };

    const oldEnsureMaterializedPreview = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewV12() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) {
        return oldEnsureMaterializedPreview.call(this);
      }
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = v12SyncFromPanel(this) || (this.readForm ? this.readForm() : this.currentDraft);
      this.currentDraft = draft;
      const found = v12FindPage(draft);
      const html = v12RenderHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || v12Text("Site preview","Предпросмотр сайта"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] v12 preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    const oldSaveCurrentDraft = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftV12(showToast) {
      if (this.currentDraft && this.currentDraft.sitePageId) {
        v12SyncFromPanel(this);
      }
      const result = oldSaveCurrentDraft.call(this, showToast);
      if (this.currentDraft && this.currentDraft.sitePageId) {
        const found = v12FindPage(this.currentDraft);
        if (found.index >= 0) v12PatchPageFromDraft(this.currentDraft, found.state, found.index);
        this.renderDraftList();
        this.syncHeaderState();
        this.renderDynamicPanels(this.currentDraft);
      }
      return result;
    };

    const oldRenderDraftList = EditorSurface.prototype.renderDraftList;
    EditorSurface.prototype.renderDraftList = function renderDraftListV12() {
      oldRenderDraftList.call(this);
      const listRoot = this.refs && this.refs.draftList ? this.refs.draftList : null;
      if (!listRoot) return;
      const state = v12ReadState();
      const pages = Array.isArray(state.pages) ? state.pages : [];
      listRoot.querySelectorAll("[data-site-page-id]").forEach((button) => {
        const id = button.dataset.sitePageId || "";
        if (!id || button.closest(".ns-editor-shell__list-row")?.querySelector('[data-action="delete-site-page"]')) return;
        const page = pages.find((item) => String(item.id) === String(id));
        const row = button.closest(".ns-editor-shell__list-row") || button.parentElement;
        if (!row || !page) return;
        row.insertAdjacentHTML("beforeend", '<button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete ns-editor-shell__site-page-delete" type="button" data-action="delete-site-page" data-site-page-id="' + escapeHtml(page.id) + '">' + escapeHtml(t("Delete","Удалить")) + '</button>');
      });
    };

    document.addEventListener("click", (event) => {
      const deleteButton = event.target && event.target.closest ? event.target.closest('[data-action="delete-site-page"]') : null;
      if (!deleteButton) return;
      const shell = deleteButton.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

      const pageId = deleteButton.dataset.sitePageId || "";
      const state = v12ReadState();
      const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
      if (!page) return;
      const confirmed = window.confirm(v12Text('Delete site page "' + (page.title || page.slug || "Page") + '"?', 'Удалить страницу сайта «' + (page.title || page.slug || "Страница") + '»?'));
      if (!confirmed) return;

      state.pages = (state.pages || []).filter((item) => String(item.id) !== String(pageId));
      if (state.activePageId === pageId) state.activePageId = state.pages[0]?.id || "";
      v12WriteState(state);

      if (page.draftId && surface.store && typeof surface.store.deleteDraft === "function") {
        surface.store.deleteDraft(page.draftId);
      }

      const wasCurrent = surface.currentDraft && String(surface.currentDraft.sitePageId || "") === String(pageId);
      if (wasCurrent) {
        surface.currentDraft = null;
        if (typeof surface.renderEmptyPanels === "function") surface.renderEmptyPanels();
        if (surface.refs && surface.refs.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(v12Text("Site page deleted. Choose another page or create a new one.", "Страница сайта удалена. Выберите другую страницу или создайте новую.")) + '</div>';
        }
      }
      surface.renderDraftList();
      surface.syncHeaderState();
      surface.renderDynamicPanels(surface.currentDraft);
      surface.flashStatus(v12Text("Site page deleted.", "Страница сайта удалена."));
    }, true);

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-action="open-site-preview"]') : null;
      if (!button) return;
      const shell = button.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      v12OpenPreview(surface);
    }, true);
  })();


  // 1.0.0 v13: Site Pages Clean + Preview Fix v4
  // Adds a safe reset/cleanup for test pages, improves page-aware preview,
  // and prevents generated page hero content from appearing twice in the site view.
  (function installSitePagesCleanPreviewFixV4() {
    if (EditorSurface.prototype.__irgeztneSitePagesCleanPreviewFixV4) return;
    EditorSurface.prototype.__irgeztneSitePagesCleanPreviewFixV4 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function v13Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function v13Ru() {
      return String(v13Locale() || "").startsWith("ru");
    }

    function v13Text(en, ru) {
      return v13Ru() ? ru : en;
    }

    function v13DefaultPages() {
      const time = nowIso();
      return [
        { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
      ];
    }

    function v13DefaultState() {
      const time = nowIso();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        pages: v13DefaultPages(),
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" }
      };
    }

    function v13ReadState() {
      const fallback = v13DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map((page, index) => ({
            id: page.id || uid("page"),
            title: page.title || page.label || "Untitled page",
            slug: page.slug || slugify(page.title || page.label || "page"),
            status: page.status || "draft",
            type: page.type || "page",
            menu: page.menu !== false,
            parentId: page.parentId || "",
            order: Number.isFinite(Number(page.order)) ? Number(page.order) : index,
            summary: page.summary || page.description || "",
            seoTitle: page.seoTitle || "",
            seoDescription: page.seoDescription || "",
            contentHtml: page.contentHtml || "",
            draftId: page.draftId || "",
            createdAt: page.createdAt || fallback.createdAt,
            updatedAt: page.updatedAt || fallback.updatedAt
          }))
        };
      } catch (error) {
        console.warn("[NSEditorV1] v13 could not read site pages:", error);
        return fallback;
      }
    }

    function v13WriteState(state) {
      const next = { ...state, updatedAt: nowIso() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] v13 could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "site-pages-clean-preview-fix-v4", state: deepClone(next) } }));
      return next;
    }

    function v13FindPage(draft) {
      const state = v13ReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function v13PatchPageFromDraft(draft, state, index) {
      if (!draft || !draft.sitePageId || index < 0) return null;
      const pages = Array.isArray(state.pages) ? state.pages.slice() : [];
      const oldPage = pages[index] || {};
      const meta = draft.meta || {};
      const title = String(meta.title || oldPage.title || v13Text("Untitled page", "Страница без названия")).trim();
      const slug = slugify(String(meta.slug || oldPage.slug || title).trim()) || "page";
      const summary = String(meta.summary || meta.excerpt || oldPage.summary || "").trim();
      const seoTitle = String(meta.seoTitle || oldPage.seoTitle || title).trim();
      const seoDescription = String(meta.seoDescription || oldPage.seoDescription || summary).trim();
      const nextPage = {
        ...oldPage,
        id: oldPage.id || draft.sitePageId,
        title,
        slug,
        summary,
        seoTitle,
        seoDescription,
        status: draft.status || oldPage.status || "draft",
        menu: oldPage.menu !== false,
        contentHtml: buildPreviewHtmlFromWrite(draft.write || {}),
        draftId: draft.id || oldPage.draftId || "",
        updatedAt: nowIso()
      };
      pages[index] = nextPage;
      state.pages = pages;
      state.activePageId = nextPage.id;
      v13WriteState(state);
      return nextPage;
    }

    function v13SyncFromPanel(surface) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const field = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = v13FindPage(draft);
      const page = found.page || {};
      const title = field("title")?.value.trim() || draft.meta?.title || page.title || v13Text("Untitled page", "Страница без названия");
      const slug = slugify(field("slug")?.value.trim() || draft.meta?.slug || page.slug || title) || "page";
      const summary = field("summary")?.value.trim() || draft.meta?.summary || page.summary || "";
      const seoTitle = field("seoTitle")?.value.trim() || title;
      const seoDescription = field("seoDescription")?.value.trim() || summary;

      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: v13Text("Site page", "Страница сайта")
      };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = {
        ...(draft.deploy || {}),
        manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" }
      };
      draft.updatedAt = nowIso();

      if (found.index >= 0) v13PatchPageFromDraft(draft, found.state, found.index);
      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);
      return saved;
    }

    function v13CleanContentHtml(rawHtml) {
      let html = String(rawHtml || "").trim();
      if (!html) return "";

      // Site page drafts generated by the early patches contain their own
      // hero/title block. The template now owns page title/header, so remove
      // that generated hero block to avoid duplicate titles in browser preview.
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<\/section>/i, "").trim();

      // Remove empty starter wrappers if they only repeat the default content header.
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-section[^"']*["']\s*>\s*<h2>\s*(Content|Контент)\s*<\/h2>\s*<p>\s*(Start writing this site page here\.|Начните писать страницу сайта здесь\.)\s*<\/p>\s*<\/section>/i, function(match) {
        return '<p>' + (v13Ru() ? 'Начните писать страницу сайта здесь.' : 'Start writing this site page here.') + '</p>';
      }).trim();

      return html;
    }

    function v13RenderHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = v13FindPage(draft);
      const state = found.state || v13ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || v13Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const pageDescription = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const rawContentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {}) || page.contentHtml || "";
      const contentHtml = v13CleanContentHtml(rawContentHtml);
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";

      // Keep menu readable: root pages first, published/home first, then order.
      const navPages = (state.pages || [])
        .filter((item) => item && item.menu !== false)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--paper:#fff;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:760px}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800;white-space:nowrap}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.80);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        .kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--primary);font-weight:900;font-size:.76rem;margin-bottom:14px}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(v13Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><div class="kicker">' + escapeHtml(v13Text("Site page", "Страница сайта")) + '</div><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    function v13OpenPreview(surface) {
      if (!surface || !surface.currentDraft) return;
      const draft = v13SyncFromPanel(surface) || (surface.readForm ? surface.readForm() : surface.currentDraft);
      surface.currentDraft = draft;
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(draft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(draft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    window.IRGEZTNEOpenSitePagePreviewV15 = v13OpenPreview;

    const oldRenderPreviewPanel = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelV13(draft) {
      if (!draft || !draft.sitePageId) return oldRenderPreviewPanel.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (v13SyncFromPanel(this) || draft) : draft;
      const html = v13RenderHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-v13"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(v13Text("Site preview", "Предпросмотр сайта")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-v13" title="' + escapeHtml(v13Text("Site preview", "Предпросмотр сайта")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const oldEnsureMaterializedPreview = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewV13() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) {
        return oldEnsureMaterializedPreview.call(this);
      }
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = v13SyncFromPanel(this) || (this.readForm ? this.readForm() : this.currentDraft);
      this.currentDraft = draft;
      const found = v13FindPage(draft);
      const html = v13RenderHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || v13Text("Site preview","Предпросмотр сайта"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] v13 preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    const oldRenderDraftList = EditorSurface.prototype.renderDraftList;
    EditorSurface.prototype.renderDraftList = function renderDraftListV13() {
      oldRenderDraftList.call(this);
      const listRoot = this.refs && this.refs.draftList ? this.refs.draftList : null;
      if (!listRoot) return;

      const pagesHead = listRoot.querySelector(".ns-editor-shell__pages-section .ns-editor-shell__list-section-head");
      if (pagesHead && !pagesHead.querySelector('[data-action="reset-site-pages"]')) {
        pagesHead.insertAdjacentHTML("beforeend", '<button class="ns-editor-shell__button ns-editor-shell__button--warning ns-editor-shell__reset-pages" type="button" data-action="reset-site-pages">' + escapeHtml(v13Text("Clear test pages", "Очистить тестовые")) + '</button>');
      }

      const state = v13ReadState();
      const pages = Array.isArray(state.pages) ? state.pages : [];
      listRoot.querySelectorAll("[data-site-page-id]").forEach((button) => {
        const id = button.dataset.sitePageId || "";
        if (!id) return;
        const row = button.closest(".ns-editor-shell__list-row") || button.parentElement;
        if (!row || row.querySelector('[data-action="delete-site-page"]')) return;
        const page = pages.find((item) => String(item.id) === String(id));
        if (!page) return;
        row.insertAdjacentHTML("beforeend", '<button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete ns-editor-shell__site-page-delete" type="button" data-action="delete-site-page" data-site-page-id="' + escapeHtml(page.id) + '">' + escapeHtml(t("Delete","Удалить")) + '</button>');
      });
    };

    function v13DeletePage(surface, pageId, options = {}) {
      const state = v13ReadState();
      const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
      if (!page) return false;
      state.pages = (state.pages || []).filter((item) => String(item.id) !== String(pageId));
      if (state.activePageId === pageId) state.activePageId = state.pages[0]?.id || "";
      v13WriteState(state);

      if (page.draftId && surface?.store && typeof surface.store.deleteDraft === "function") {
        surface.store.deleteDraft(page.draftId);
      }

      if (surface && surface.currentDraft && String(surface.currentDraft.sitePageId || "") === String(pageId)) {
        surface.currentDraft = null;
      }

      if (!options.silent && surface) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        surface.flashStatus(v13Text("Site page deleted.", "Страница сайта удалена."));
      }
      return true;
    }

    function v13ResetTestPages(surface) {
      const state = v13ReadState();
      const oldPages = Array.isArray(state.pages) ? state.pages : [];
      const oldDraftIds = oldPages.map((page) => page.draftId).filter(Boolean);

      if (surface?.store && typeof surface.store.getDrafts === "function" && typeof surface.store.deleteDraft === "function") {
        const drafts = surface.store.getDrafts();
        drafts.forEach((draft) => {
          const tags = draft?.meta && Array.isArray(draft.meta.tags) ? draft.meta.tags : [];
          if (draft?.sitePageId || tags.includes("site-page") || oldDraftIds.includes(draft?.id)) {
            surface.store.deleteDraft(draft.id);
          }
        });
      }

      const next = v13DefaultState();
      next.createdAt = state.createdAt || next.createdAt;
      next.updatedAt = nowIso();
      next.publishConfig = { ...(state.publishConfig || next.publishConfig) };
      v13WriteState(next);

      if (surface) {
        surface.currentDraft = null;
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        if (surface.refs && surface.refs.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(v13Text("Test pages cleared. Choose Home/About/Contact or create a new page.", "Тестовые страницы очищены. Выберите Home/About/Contact или создайте новую страницу.")) + '</div>';
        }
        surface.flashStatus(v13Text("Test site pages cleared.", "Тестовые страницы сайта очищены."));
      }
    }

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-action="reset-site-pages"], [data-action="delete-site-page"], [data-action="open-site-preview"]') : null;
      if (!button) return;

      const shell = button.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface) return;

      const action = button.dataset.action || "";
      if (action === "reset-site-pages") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const ok = window.confirm(v13Text(
          "Clear all test site pages and their site-page drafts? Home/About/Contact will remain as a clean foundation.",
          "Очистить все тестовые страницы сайта и связанные page-draft? Home/About/Contact останутся как чистая основа."
        ));
        if (ok) v13ResetTestPages(surface);
        return;
      }

      if (action === "delete-site-page") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const pageId = button.dataset.sitePageId || "";
        const state = v13ReadState();
        const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
        if (!page) return;
        const ok = window.confirm(v13Text(
          'Delete site page "' + (page.title || page.slug || "Page") + '"?',
          'Удалить страницу сайта «' + (page.title || page.slug || "Страница") + '»?'
        ));
        if (ok) v13DeletePage(surface, pageId);
        return;
      }

      if (action === "open-site-preview" && surface.currentDraft && surface.currentDraft.sitePageId) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        v13OpenPreview(surface);
      }
    }, true);
  })();


  // 1.0.0 v14: Site Pages Stabilize v5
  // Stabilizes the new CMS-like site page flow after the preview/page patches.
  (function installSitePagesStabilizeV5() {
    if (EditorSurface.prototype.__irgeztneSitePagesStabilizeV5) return;
    EditorSurface.prototype.__irgeztneSitePagesStabilizeV5 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function v14Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function v14Ru() {
      return String(v14Locale() || "").startsWith("ru");
    }

    function v14Text(en, ru) {
      return v14Ru() ? ru : en;
    }

    function v14Time() {
      try { return nowIso(); } catch (_) { return new Date().toISOString(); }
    }

    function v14DefaultPages() {
      const time = v14Time();
      return [
        { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
      ];
    }

    function v14DefaultState() {
      const time = v14Time();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        pages: v14DefaultPages(),
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" }
      };
    }

    function v14NormalizePage(page, index) {
      return {
        id: page?.id || uid("page"),
        title: page?.title || page?.label || "Untitled page",
        slug: page?.slug || slugify(page?.title || page?.label || "page"),
        status: page?.status || "draft",
        type: page?.type || "page",
        menu: page?.menu !== false,
        parentId: page?.parentId || "",
        order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
        summary: page?.summary || page?.description || "",
        seoTitle: page?.seoTitle || "",
        seoDescription: page?.seoDescription || "",
        contentHtml: page?.contentHtml || "",
        draftId: page?.draftId || "",
        createdAt: page?.createdAt || v14Time(),
        updatedAt: page?.updatedAt || v14Time()
      };
    }

    function v14ReadState() {
      const fallback = v14DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map(v14NormalizePage)
        };
      } catch (error) {
        console.warn("[NSEditorV1] v14 could not read site pages:", error);
        return fallback;
      }
    }

    function v14WriteState(state) {
      const next = { ...state, updatedAt: v14Time() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] v14 could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "site-pages-stabilize-v5", state: deepClone(next) } }));
      return next;
    }

    function v14DedupPages(pages) {
      const seen = new Set();
      const out = [];
      (pages || []).forEach((raw, index) => {
        const page = v14NormalizePage(raw, index);
        const key = String(page.slug || page.id || page.title || index).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ ...page, order: out.length });
      });
      return out;
    }

    function v14CleanContentHtml(rawHtml) {
      let html = String(rawHtml || "").trim();
      if (!html) return "";

      // Remove generated early page hero; the site template owns page title.
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<\/section>/ig, "").trim();

      // Remove the default starter "Content" block only when it is untouched.
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-section[^"']*["']\s*>\s*<h2>\s*(Content|Контент)\s*<\/h2>\s*<p>\s*(Start writing this site page here\.|Начните писать страницу сайта здесь\.)\s*<\/p>\s*<\/section>/ig, "").trim();

      // If nothing remains, do not duplicate default text below the page summary.
      return html;
    }

    function v14FindPage(draft) {
      const state = v14ReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function v14SyncFromPanel(surface, options = {}) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const field = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = v14FindPage(draft);
      const page = found.page || {};

      const title = field("title")?.value.trim() || draft.meta?.title || page.title || v14Text("Untitled page", "Страница без названия");
      const slug = slugify(field("slug")?.value.trim() || draft.meta?.slug || page.slug || title) || "page";
      const summary = field("summary")?.value.trim() || draft.meta?.summary || page.summary || "";
      const seoTitle = field("seoTitle")?.value.trim() || title;
      const seoDescription = field("seoDescription")?.value.trim() || summary;
      const status = field("status")?.value || draft.status || page.status || "draft";
      const menuField = field("menu");
      const menu = menuField ? Boolean(menuField.checked) : page.menu !== false;

      draft.status = status;
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: v14Text("Site page", "Страница сайта")
      };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = {
        ...(draft.deploy || {}),
        manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" }
      };
      draft.updatedAt = v14Time();

      if (found.index >= 0) {
        const pages = Array.isArray(found.state.pages) ? found.state.pages.slice() : [];
        pages[found.index] = {
          ...page,
          id: page.id || draft.sitePageId,
          title,
          slug,
          summary,
          seoTitle,
          seoDescription,
          status,
          menu,
          contentHtml: buildPreviewHtmlFromWrite(draft.write || {}),
          draftId: draft.id || page.draftId || "",
          updatedAt: v14Time()
        };
        found.state.pages = v14DedupPages(pages);
        found.state.activePageId = draft.sitePageId;
        v14WriteState(found.state);
      }

      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);

      if (options.rerender) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
      }
      return saved;
    }

    function v14RenderHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = v14FindPage(draft);
      const state = found.state || v14ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || v14Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const pageDescription = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const rawContentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {}) || page.contentHtml || "";
      const contentHtml = v14CleanContentHtml(rawContentHtml);
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";

      const navPages = v14DedupPages((state.pages || []).filter((item) => item && item.menu !== false))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--paper:#fff;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:760px}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800;white-space:nowrap}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.80);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        .kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--primary);font-weight:900;font-size:.76rem;margin-bottom:14px}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content:empty{display:none}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(v14Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><div class="kicker">' + escapeHtml(v14Text("Site page", "Страница сайта")) + '</div><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    function v14OpenPreview(surface) {
      if (!surface || !surface.currentDraft) return;
      const draft = v14SyncFromPanel(surface, { rerender: false }) || (surface.readForm ? surface.readForm() : surface.currentDraft);
      surface.currentDraft = draft;
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(draft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(draft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    window.IRGEZTNEOpenSitePagePreviewV15 = v14OpenPreview;

    const oldRenderPreviewPanel = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelV14(draft) {
      if (!draft || !draft.sitePageId) return oldRenderPreviewPanel.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (v14SyncFromPanel(this, { rerender: false }) || draft) : draft;
      const html = v14RenderHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-v14"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(v14Text("Site preview", "Предпросмотр сайта")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-v14" title="' + escapeHtml(v14Text("Site preview", "Предпросмотр сайта")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const oldEnsureMaterializedPreview = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewV14() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) {
        return oldEnsureMaterializedPreview.call(this);
      }
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = v14SyncFromPanel(this, { rerender: false }) || (this.readForm ? this.readForm() : this.currentDraft);
      this.currentDraft = draft;
      const found = v14FindPage(draft);
      const html = v14RenderHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || v14Text("Site preview","Предпросмотр сайта"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] v14 preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    function v14DeletePage(surface, pageId, options = {}) {
      const state = v14ReadState();
      const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
      if (!page) return false;
      state.pages = (state.pages || []).filter((item) => String(item.id) !== String(pageId));
      state.pages = v14DedupPages(state.pages);
      if (state.activePageId === pageId) state.activePageId = state.pages[0]?.id || "";
      v14WriteState(state);

      if (page.draftId && surface?.store && typeof surface.store.deleteDraft === "function") {
        surface.store.deleteDraft(page.draftId);
      }

      if (surface && surface.currentDraft && String(surface.currentDraft.sitePageId || "") === String(pageId)) {
        surface.currentDraft = null;
      }

      if (!options.silent && surface) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        surface.flashStatus(v14Text("Site page deleted.", "Страница сайта удалена."));
      }
      return true;
    }

    function v14ResetTestPages(surface) {
      const state = v14ReadState();
      const oldPages = Array.isArray(state.pages) ? state.pages : [];
      const oldDraftIds = oldPages.map((page) => page.draftId).filter(Boolean);

      if (surface?.store && typeof surface.store.getDrafts === "function" && typeof surface.store.deleteDraft === "function") {
        const drafts = surface.store.getDrafts();
        drafts.forEach((draft) => {
          const tags = draft?.meta && Array.isArray(draft.meta.tags) ? draft.meta.tags : [];
          if (draft?.sitePageId || tags.includes("site-page") || oldDraftIds.includes(draft?.id)) {
            surface.store.deleteDraft(draft.id);
          }
        });
      }

      const next = v14DefaultState();
      next.createdAt = state.createdAt || next.createdAt;
      next.updatedAt = v14Time();
      next.publishConfig = { ...(state.publishConfig || next.publishConfig) };
      v14WriteState(next);

      if (surface) {
        surface.currentDraft = null;
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        if (surface.refs && surface.refs.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(v14Text("Test pages cleared. Choose Home/About/Contact or create a new page.", "Тестовые страницы очищены. Выберите Home/About/Contact или создайте новую страницу.")) + '</div>';
        }
        surface.flashStatus(v14Text("Test site pages cleared.", "Тестовые страницы сайта очищены."));
      }
    }

    const oldRenderDraftList = EditorSurface.prototype.renderDraftList;
    EditorSurface.prototype.renderDraftList = function renderDraftListV14() {
      oldRenderDraftList.call(this);
      const listRoot = this.refs && this.refs.draftList ? this.refs.draftList : null;
      if (!listRoot) return;

      const pagesHead = listRoot.querySelector(".ns-editor-shell__pages-section .ns-editor-shell__list-section-head");
      if (pagesHead && !pagesHead.querySelector('[data-action="reset-site-pages-v14"]')) {
        pagesHead.insertAdjacentHTML("beforeend", '<button class="ns-editor-shell__button ns-editor-shell__button--warning ns-editor-shell__reset-pages" type="button" data-action="reset-site-pages-v14">' + escapeHtml(v14Text("Clear test pages", "Очистить тестовые")) + '</button>');
      }

      // Previous patches placed data-site-page-id directly on Delete buttons.
      // That made the old page-open handler open the page instead of deleting it.
      // Move the id to data-delete-site-page-id so click routing is unambiguous.
      listRoot.querySelectorAll('[data-action="delete-site-page"][data-site-page-id]').forEach((button) => {
        button.dataset.deleteSitePageId = button.dataset.sitePageId || "";
        button.removeAttribute("data-site-page-id");
      });
    };

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-action="reset-site-pages-v14"], [data-action="delete-site-page"], [data-action="open-site-preview"]') : null;
      if (!button) return;
      const shell = button.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface) return;

      const action = button.dataset.action || "";

      if (action === "reset-site-pages-v14") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const ok = window.confirm(v14Text(
          "Clear all test site pages and their site-page drafts? Home/About/Contact will remain as a clean foundation.",
          "Очистить все тестовые страницы сайта и связанные page-draft? Home/About/Contact останутся как чистая основа."
        ));
        if (ok) v14ResetTestPages(surface);
        return;
      }

      if (action === "delete-site-page") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const pageId = button.dataset.deleteSitePageId || button.dataset.sitePageId || "";
        const state = v14ReadState();
        const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
        if (!page) return;
        const ok = window.confirm(v14Text(
          'Delete site page "' + (page.title || page.slug || "Page") + '"?',
          'Удалить страницу сайта «' + (page.title || page.slug || "Страница") + '»?'
        ));
        if (ok) v14DeletePage(surface, pageId);
        return;
      }

      if (action === "open-site-preview" && surface.currentDraft && surface.currentDraft.sitePageId) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        v14OpenPreview(surface);
      }
    }, true);

    document.addEventListener("change", (event) => {
      const field = event.target && event.target.closest ? event.target.closest("[data-site-page-field]") : null;
      if (!field) return;
      const shell = field.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return;
      v14SyncFromPanel(surface, { rerender: false });
    }, true);
  })();


  // 1.0.0 v15: Editor Site Pages Cleanup v1
  // Cleans the CMS-like page flow:
  // - Preview tab is the single page/site preview;
  // - top Site preview button is hidden;
  // - page delete/cleanup no longer triggers page-open;
  // - settings sync on Apply/Save/change, not every input character.
  (function installEditorSitePagesCleanupV1() {
    if (EditorSurface.prototype.__irgeztneEditorSitePagesCleanupV1) return;
    EditorSurface.prototype.__irgeztneEditorSitePagesCleanupV1 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function c15Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function c15Ru() {
      return String(c15Locale() || "").startsWith("ru");
    }

    function c15Text(en, ru) {
      return c15Ru() ? ru : en;
    }

    function c15Now() {
      try { return nowIso(); } catch (_) { return new Date().toISOString(); }
    }

    function c15DefaultPages() {
      const time = c15Now();
      return [
        { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
      ];
    }

    function c15DefaultState() {
      const time = c15Now();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        pages: c15DefaultPages(),
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" }
      };
    }

    function c15NormalizePage(page, index) {
      return {
        id: page?.id || uid("page"),
        title: page?.title || page?.label || "Untitled page",
        slug: page?.slug || slugify(page?.title || page?.label || "page"),
        status: page?.status || "draft",
        type: page?.type || "page",
        menu: page?.menu !== false,
        parentId: page?.parentId || "",
        order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
        summary: page?.summary || page?.description || "",
        seoTitle: page?.seoTitle || "",
        seoDescription: page?.seoDescription || "",
        contentHtml: page?.contentHtml || "",
        draftId: page?.draftId || "",
        createdAt: page?.createdAt || c15Now(),
        updatedAt: page?.updatedAt || c15Now()
      };
    }

    function c15ReadState() {
      const fallback = c15DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: pages.map(c15NormalizePage)
        };
      } catch (error) {
        console.warn("[NSEditorV1] cleanup could not read site pages:", error);
        return fallback;
      }
    }

    function c15WriteState(state) {
      const next = { ...state, updatedAt: c15Now() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] cleanup could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor-site-pages-cleanup-v1", state: deepClone(next) } }));
      return next;
    }

    function c15DedupPages(pages) {
      const seen = new Set();
      const out = [];
      (pages || []).forEach((raw, index) => {
        const page = c15NormalizePage(raw, index);
        const key = String(page.slug || page.id || page.title || index).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ ...page, order: out.length });
      });
      return out;
    }

    function c15FindPage(draft) {
      const state = c15ReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function c15CleanContentHtml(rawHtml) {
      let html = String(rawHtml || "").trim();
      if (!html) return "";
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<\/section>/ig, "").trim();
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-section[^"']*["']\s*>\s*<h2>\s*(Content|Контент)\s*<\/h2>\s*<p>\s*(Start writing this site page here\.|Начните писать страницу сайта здесь\.)\s*<\/p>\s*<\/section>/ig, "").trim();
      return html;
    }

    function c15SyncSettings(surface, options = {}) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const field = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = c15FindPage(draft);
      const page = found.page || {};

      const title = field("title")?.value.trim() || draft.meta?.title || page.title || c15Text("Untitled page", "Страница без названия");
      const slug = slugify(field("slug")?.value.trim() || draft.meta?.slug || page.slug || title) || "page";
      const summary = field("summary")?.value.trim() || draft.meta?.summary || page.summary || "";
      const seoTitle = field("seoTitle")?.value.trim() || title;
      const seoDescription = field("seoDescription")?.value.trim() || summary;
      const status = field("status")?.value || draft.status || page.status || "draft";
      const menuField = field("menu");
      const menu = menuField ? Boolean(menuField.checked) : page.menu !== false;

      draft.status = status;
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website"
      };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = {
        ...(draft.deploy || {}),
        manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" }
      };
      draft.updatedAt = c15Now();

      if (found.index >= 0) {
        const pages = Array.isArray(found.state.pages) ? found.state.pages.slice() : [];
        pages[found.index] = {
          ...page,
          id: page.id || draft.sitePageId,
          title,
          slug,
          summary,
          seoTitle,
          seoDescription,
          status,
          menu,
          contentHtml: buildPreviewHtmlFromWrite(draft.write || {}),
          draftId: draft.id || page.draftId || "",
          updatedAt: c15Now()
        };
        found.state.pages = c15DedupPages(pages);
        found.state.activePageId = draft.sitePageId;
        c15WriteState(found.state);
      }

      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);
      if (options.rerender) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
      }
      return saved;
    }

    function c15RenderHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = c15FindPage(draft);
      const state = found.state || c15ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || c15Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const pageDescription = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const rawContentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {}) || page.contentHtml || "";
      const contentHtml = c15CleanContentHtml(rawContentHtml);
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";

      const navPages = c15DedupPages((state.pages || []).filter((item) => item && item.menu !== false))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.88);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:760px}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800;white-space:nowrap}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.80);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content:empty{display:none}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(c15Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    function c15OpenPreview(surface) {
      if (!surface || !surface.currentDraft) return;
      const draft = c15SyncSettings(surface, { rerender: false }) || (surface.readForm ? surface.readForm() : surface.currentDraft);
      surface.currentDraft = draft;
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(draft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(draft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    window.IRGEZTNEOpenSitePagePreviewV15 = c15OpenPreview;

    const oldRenderPreviewPanel = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelCleanupV1(draft) {
      if (!draft || !draft.sitePageId) return oldRenderPreviewPanel.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (c15SyncSettings(this, { rerender: false }) || draft) : draft;
      const html = c15RenderHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-cleanup"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(c15Text("Preview", "Предпросмотр")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-cleanup" title="' + escapeHtml(c15Text("Preview", "Предпросмотр")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const oldRenderPreviewMeta = EditorSurface.prototype.renderPreviewMeta;
    EditorSurface.prototype.renderPreviewMeta = function renderPreviewMetaCleanupV1(draft) {
      if (!draft || !draft.sitePageId || !this.refs.previewMeta) return oldRenderPreviewMeta.call(this, draft);
      this.refs.previewMeta.innerHTML = '<div class="ns-editor-preview-actions ns-editor-preview-actions--compact ns-editor-preview-actions--site-cleanup"><button class="ns-editor-shell__button" type="button" data-action="open-preview-browser">' + escapeHtml(t("Open in workspace browser","Открыть в браузере пространства")) + '</button><button class="ns-editor-shell__button" type="button" data-action="open-preview-external">' + escapeHtml(t("Open in browser","Открыть в браузере")) + '</button><button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">' + escapeHtml(t("Copy preview path","Копировать путь")) + '</button></div>';
    };

    const oldEnsureMaterializedPreview = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewCleanupV1() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) return oldEnsureMaterializedPreview.call(this);
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = c15SyncSettings(this, { rerender: false }) || (this.readForm ? this.readForm() : this.currentDraft);
      this.currentDraft = draft;
      const found = c15FindPage(draft);
      const html = c15RenderHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || c15Text("Preview","Предпросмотр"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] cleanup preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    const oldSaveCurrentDraft = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftCleanupV1(showToast) {
      if (this.currentDraft && this.currentDraft.sitePageId) c15SyncSettings(this, { rerender: false });
      const result = oldSaveCurrentDraft.call(this, showToast);
      if (this.currentDraft && this.currentDraft.sitePageId) {
        c15SyncSettings(this, { rerender: false });
        this.renderDraftList();
        this.syncHeaderState();
        this.renderDynamicPanels(this.currentDraft);
      }
      return result;
    };

    function c15NormalizeListButtons(root) {
      if (!root) return;
      root.querySelectorAll('[data-action="delete-site-page"]').forEach((button) => {
        const id = button.dataset.deleteSitePageId || button.dataset.sitePageId || "";
        if (id) button.dataset.deleteSitePageId = id;
        button.removeAttribute("data-site-page-id");
      });
      root.querySelectorAll('[data-action="reset-site-pages"], [data-action="reset-site-pages-v14"]').forEach((button) => {
        button.dataset.action = "reset-site-pages-cleanup";
      });
      root.querySelectorAll('[data-action="open-site-preview"]').forEach((button) => {
        button.setAttribute("hidden", "hidden");
        button.setAttribute("aria-hidden", "true");
      });
    }

    function c15DeletePage(surface, pageId) {
      const state = c15ReadState();
      const pages = Array.isArray(state.pages) ? state.pages : [];
      if (pages.length <= 1) {
        surface?.flashStatus?.(c15Text("At least one site page is required.", "Нужна хотя бы одна страница сайта."));
        return false;
      }
      const page = pages.find((item) => String(item.id) === String(pageId));
      if (!page) return false;

      state.pages = c15DedupPages(pages.filter((item) => String(item.id) !== String(pageId)));
      if (state.activePageId === pageId) state.activePageId = state.pages[0]?.id || "";
      c15WriteState(state);

      if (page.draftId && surface?.store && typeof surface.store.deleteDraft === "function") {
        surface.store.deleteDraft(page.draftId);
      }

      if (surface && surface.currentDraft && String(surface.currentDraft.sitePageId || "") === String(pageId)) {
        surface.currentDraft = null;
      }

      if (surface) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        if (!surface.currentDraft && surface.refs?.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(c15Text("Page deleted. Choose another page or create a new one.", "Страница удалена. Выберите другую страницу или создайте новую.")) + '</div>';
        }
        surface.flashStatus(c15Text("Site page deleted.", "Страница сайта удалена."));
      }
      return true;
    }

    function c15ResetPages(surface) {
      const state = c15ReadState();
      const oldPages = Array.isArray(state.pages) ? state.pages : [];
      const oldDraftIds = oldPages.map((page) => page.draftId).filter(Boolean);

      if (surface?.store && typeof surface.store.getDrafts === "function" && typeof surface.store.deleteDraft === "function") {
        const drafts = surface.store.getDrafts();
        drafts.forEach((draft) => {
          const tags = draft?.meta && Array.isArray(draft.meta.tags) ? draft.meta.tags : [];
          if (draft?.sitePageId || tags.includes("site-page") || oldDraftIds.includes(draft?.id)) {
            surface.store.deleteDraft(draft.id);
          }
        });
      }

      const next = c15DefaultState();
      next.createdAt = state.createdAt || next.createdAt;
      next.updatedAt = c15Now();
      next.publishConfig = { ...(state.publishConfig || next.publishConfig) };
      c15WriteState(next);

      if (surface) {
        surface.currentDraft = null;
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        if (surface.refs?.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(c15Text("Pages reset. Choose Home/About/Contact or create a new page.", "Страницы сброшены. Выберите Home/About/Contact или создайте новую страницу.")) + '</div>';
        }
        surface.flashStatus(c15Text("Site pages reset.", "Страницы сайта сброшены."));
      }
    }

    const oldRenderDraftList = EditorSurface.prototype.renderDraftList;
    EditorSurface.prototype.renderDraftList = function renderDraftListCleanupV1() {
      oldRenderDraftList.call(this);
      const listRoot = this.refs?.draftList || null;
      c15NormalizeListButtons(listRoot);

      const pagesHead = listRoot?.querySelector(".ns-editor-shell__pages-section .ns-editor-shell__list-section-head");
      if (pagesHead && !pagesHead.querySelector('[data-action="reset-site-pages-cleanup"]')) {
        pagesHead.insertAdjacentHTML("beforeend", '<button class="ns-editor-shell__button ns-editor-shell__button--warning ns-editor-shell__reset-pages" type="button" data-action="reset-site-pages-cleanup">' + escapeHtml(c15Text("Reset pages", "Сбросить страницы")) + '</button>');
      }
      c15NormalizeListButtons(listRoot);
    };

    document.addEventListener("pointerdown", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-action="delete-site-page"], [data-action="reset-site-pages"], [data-action="reset-site-pages-v14"], [data-action="reset-site-pages-cleanup"]') : null;
      if (button) c15NormalizeListButtons(button.closest(".ns-editor-shell") || document);
    }, true);

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-action="delete-site-page"], [data-action="reset-site-pages-cleanup"], [data-action="sync-site-page-settings"], [data-action="open-site-preview"]') : null;
      if (!button) return;

      const shell = button.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface) return;

      const action = button.dataset.action || "";

      if (action === "open-site-preview") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        if (surface.currentDraft?.sitePageId) c15OpenPreview(surface);
        return;
      }

      if (action === "sync-site-page-settings") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        c15SyncSettings(surface, { rerender: true });
        surface.flashStatus(c15Text("Page settings applied.", "Настройки страницы применены."));
        return;
      }

      if (action === "reset-site-pages-cleanup") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        const ok = window.confirm(c15Text(
          "Reset site pages to clean Home/About/Contact and delete site-page drafts?",
          "Сбросить страницы сайта к чистым Home/About/Contact и удалить page-draft?"
        ));
        if (ok) c15ResetPages(surface);
        return;
      }

      if (action === "delete-site-page") {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        c15NormalizeListButtons(shell);
        const pageId = button.dataset.deleteSitePageId || "";
        const state = c15ReadState();
        const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
        if (!page) return;
        const ok = window.confirm(c15Text(
          'Delete site page "' + (page.title || page.slug || "Page") + '"?',
          'Удалить страницу сайта «' + (page.title || page.slug || "Страница") + '»?'
        ));
        if (ok) c15DeletePage(surface, pageId);
      }
    }, true);

    document.addEventListener("change", (event) => {
      const field = event.target && event.target.closest ? event.target.closest("[data-site-page-field]") : null;
      if (!field) return;
      const shell = field.closest(".ns-editor-shell");
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return;
      const surface = api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean);
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return;
      c15SyncSettings(surface, { rerender: false });
    }, true);
  })();


  // 1.0.0 v16: Editor Site Pages Cleanup v2
  // Hard stabilizes the Editor Site Pages drawer and Preview:
  // custom page list avoids old data-site-page-id click conflicts,
  // delete/reset use clean data attributes, and Preview uses one compact flow.
  (function installEditorSitePagesCleanupV2() {
    if (EditorSurface.prototype.__irgeztneEditorSitePagesCleanupV2) return;
    EditorSurface.prototype.__irgeztneEditorSitePagesCleanupV2 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function c16Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function c16Ru() {
      return String(c16Locale() || "").startsWith("ru");
    }

    function c16Text(en, ru) {
      return c16Ru() ? ru : en;
    }

    function c16Now() {
      try { return nowIso(); } catch (_) { return new Date().toISOString(); }
    }

    function c16DefaultPages() {
      const time = c16Now();
      return [
        { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
      ];
    }

    function c16DefaultState() {
      const time = c16Now();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: c16DefaultPages()
      };
    }

    function c16NormalizePage(page, index) {
      const title = page?.title || page?.label || "Untitled page";
      return {
        id: page?.id || uid("page"),
        title,
        slug: page?.slug || slugify(title || "page"),
        status: page?.status || "draft",
        type: page?.type || "page",
        menu: page?.menu !== false,
        parentId: page?.parentId || "",
        order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
        summary: page?.summary || page?.description || "",
        seoTitle: page?.seoTitle || "",
        seoDescription: page?.seoDescription || "",
        contentHtml: page?.contentHtml || "",
        draftId: page?.draftId || "",
        createdAt: page?.createdAt || c16Now(),
        updatedAt: page?.updatedAt || c16Now()
      };
    }

    function c16ReadState() {
      const fallback = c16DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: c16DedupPages(pages.map(c16NormalizePage))
        };
      } catch (error) {
        console.warn("[NSEditorV1] cleanup v2 could not read site pages:", error);
        return fallback;
      }
    }

    function c16WriteState(state) {
      const next = { ...state, pages: c16DedupPages(state.pages || []), updatedAt: c16Now() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] cleanup v2 could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor-site-pages-cleanup-v2", state: deepClone(next) } }));
      return next;
    }

    function c16DedupPages(pages) {
      const seen = new Set();
      const out = [];
      (Array.isArray(pages) ? pages : []).forEach((raw, index) => {
        const page = c16NormalizePage(raw, index);
        const key = String(page.slug || page.id || page.title || index).toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push({ ...page, order: out.length });
      });
      return out;
    }

    function c16PageLabels() {
      return {
        pagesTitle: c16Text("Site pages", "Страницы сайта"),
        draftsTitle: c16Text("Drafts", "Черновики"),
        noPages: c16Text("No site pages yet.", "Страниц пока нет."),
        noDrafts: c16Text("No regular drafts yet.", "Обычных черновиков пока нет."),
        newPage: c16Text("+ New page", "+ Новая страница"),
        resetPages: c16Text("Reset pages", "Сбросить страницы"),
        delete: c16Text("Delete", "Удалить"),
        linked: c16Text("draft linked", "черновик связан"),
        noDraft: c16Text("no draft", "нет черновика"),
        inMenu: c16Text("in menu", "в меню"),
        hidden: c16Text("hidden", "не в меню"),
        draft: c16Text("draft", "черновик"),
        published: c16Text("published", "опубликовано")
      };
    }

    function c16FindPage(draft) {
      const state = c16ReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function c16IsSitePageDraft(draft, pageDraftIds) {
      if (!draft) return false;
      if (draft.sitePageId) return true;
      if (pageDraftIds && pageDraftIds.has(String(draft.id || ""))) return true;
      const tags = draft.meta && Array.isArray(draft.meta.tags) ? draft.meta.tags : [];
      return tags.includes("site-page");
    }

    function c16CleanContentHtml(rawHtml) {
      let html = String(rawHtml || "").trim();
      if (!html) return "";
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<\/section>/ig, "").trim();
      html = html.replace(/<section\b[^>]*class=["'][^"']*ns-page-section[^"']*["']\s*>\s*<h2>\s*(Content|Контент)\s*<\/h2>\s*<p>\s*(Start writing this site page here\.|Начните писать страницу сайта здесь\.)\s*<\/p>\s*<\/section>/ig, "").trim();
      return html;
    }

    function c16UpdateStarterContent(draft, pageLike) {
      if (!draft || !draft.write) return draft;
      let html = String(draft.write.visualHtml || "");
      if (!html || !draft.sitePageId) return draft;
      const title = escapeHtml(pageLike?.title || draft.meta?.title || c16Text("Untitled page", "Страница без названия"));
      const summary = escapeHtml(pageLike?.summary || draft.meta?.summary || draft.meta?.excerpt || "");
      if (/ns-page-hero/i.test(html)) {
        html = html.replace(/(<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<h1>)([\s\S]*?)(<\/h1>)/i, "$1" + title + "$3");
        html = html.replace(/(<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<h1>[\s\S]*?<\/h1>[\s\S]*?<p>)([\s\S]*?)(<\/p>)/i, "$1" + summary + "$3");
        draft.write.visualHtml = html;
        draft.content = { ...(draft.content || {}), body: html };
      }
      draft.write.markdown = "# " + (pageLike?.title || draft.meta?.title || "") + "\n\n" + (pageLike?.summary || draft.meta?.summary || "") + "\n";
      return draft;
    }

    function c16SyncSettings(surface, options = {}) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const field = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = c16FindPage(draft);
      const page = found.page || {};

      const title = field("title")?.value.trim() || draft.meta?.title || page.title || c16Text("Untitled page", "Страница без названия");
      const slug = slugify(field("slug")?.value.trim() || draft.meta?.slug || page.slug || title) || "page";
      const summary = field("summary")?.value.trim() || draft.meta?.summary || page.summary || "";
      const seoTitle = field("seoTitle")?.value.trim() || title;
      const seoDescription = field("seoDescription")?.value.trim() || summary;
      const status = field("status")?.value || draft.status || page.status || "draft";
      const menuField = field("menu");
      const menu = menuField ? Boolean(menuField.checked) : page.menu !== false;

      const pagePayload = {
        ...page,
        id: page.id || draft.sitePageId,
        title,
        slug,
        summary,
        seoTitle,
        seoDescription,
        status,
        menu,
        contentHtml: buildPreviewHtmlFromWrite(draft.write || {}),
        draftId: draft.id || page.draftId || "",
        updatedAt: c16Now()
      };

      draft.status = status;
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: c16Text("Site page", "Страница сайта"),
        tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
      };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = { ...(draft.deploy || {}), manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" } };
      draft.sitePageId = pagePayload.id;
      draft.updatedAt = c16Now();
      c16UpdateStarterContent(draft, pagePayload);

      if (found.index >= 0) {
        const pages = Array.isArray(found.state.pages) ? found.state.pages.slice() : [];
        pages[found.index] = pagePayload;
        found.state.pages = c16DedupPages(pages);
        found.state.activePageId = pagePayload.id;
        c16WriteState(found.state);
      }

      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);

      if (options.remount) surface.mountWriteSurface(surface.currentDraft);
      if (options.rerender) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
      }
      return saved;
    }

    function c16RenderSiteHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = c16FindPage(draft);
      const state = found.state || c16ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || c16Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const pageDescription = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const rawContentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {}) || page.contentHtml || "";
      const contentHtml = c16CleanContentHtml(rawContentHtml);
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";
      const navPages = c16DedupPages((state.pages || []).filter((item) => item && item.menu !== false))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.90);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:760px}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800;white-space:nowrap}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content:empty{display:none}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(c16Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    function c16OpenPreview(surface) {
      if (!surface || !surface.currentDraft) return;
      const draft = c16SyncSettings(surface, { rerender: false }) || (surface.readForm ? surface.readForm() : surface.currentDraft);
      surface.currentDraft = draft;
      if (typeof surface.switchTab === "function") surface.switchTab("preview");
      if (typeof surface.renderPreviewPanel === "function") surface.renderPreviewPanel(draft);
      if (typeof surface.renderPreviewMeta === "function") surface.renderPreviewMeta(draft);
      if (typeof surface.scrollPrimaryIntoView === "function") surface.scrollPrimaryIntoView();
    }

    window.IRGEZTNEOpenSitePagePreviewV16 = c16OpenPreview;
    window.IRGEZTNEOpenSitePagePreviewV15 = c16OpenPreview;
    window.IRGEZTNEOpenSitePagePreviewV14 = c16OpenPreview;
    window.IRGEZTNEOpenSitePagePreviewV13 = c16OpenPreview;
    window.IRGEZTNEOpenSitePagePreviewV12 = c16OpenPreview;

    const originalRenderDraftListV16 = EditorSurface.prototype.renderDraftList;
    EditorSurface.prototype.renderDraftList = function renderDraftListCleanupV2() {
      const drafts = this.store.getDrafts();
      const labels = c16PageLabels();
      const label = drafts.length + " " + t("drafts","черновиков");

      if (this.refs.headerDraftCount) this.refs.headerDraftCount.textContent = label;
      if (this.refs.sidebarDraftCount) this.refs.sidebarDraftCount.textContent = label;

      const listRoot = this.refs.draftList;
      if (!listRoot) return;

      const state = c16ReadState();
      const pages = c16DedupPages(state.pages || []).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const pageDraftIds = new Set(pages.map((page) => String(page.draftId || "")).filter(Boolean));
      const regularDrafts = drafts.filter((draft) => !c16IsSitePageDraft(draft, pageDraftIds));

      const pageRows = pages.map((page) => {
        const isActive = Boolean(this.currentDraft && (
          String(this.currentDraft.sitePageId || "") === String(page.id) ||
          (page.draftId && String(this.currentDraft.id || "") === String(page.draftId))
        ));
        const active = isActive ? "is-active" : "";
        const status = page.status === "published" ? labels.published : labels.draft;
        const menu = page.menu !== false ? labels.inMenu : labels.hidden;
        const linked = page.draftId ? labels.linked : labels.noDraft;
        return '<div class="ns-editor-shell__list-row ns-editor-shell__site-page-row ns-editor-shell__site-page-row--cleanup ' + active + '">' +
          '<button class="ns-editor-shell__list-button ' + active + '" type="button" data-clean-open-site-page="' + escapeHtml(page.id) + '">' +
            '<span class="ns-editor-shell__list-title">' + escapeHtml(page.title || labels.pagesTitle) + '</span>' +
            '<span class="ns-editor-shell__list-subtitle">/' + escapeHtml(page.slug || "") + ' · ' + escapeHtml(status) + ' · ' + escapeHtml(menu) + '</span>' +
            '<span class="ns-editor-shell__site-page-pill">' + escapeHtml(linked) + '</span>' +
          '</button>' +
          '<button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete ns-editor-shell__site-page-delete" type="button" data-clean-delete-site-page="' + escapeHtml(page.id) + '">' + escapeHtml(labels.delete) + '</button>' +
        '</div>';
      }).join("");

      const draftRows = regularDrafts.map((draft) => {
        const active = this.currentDraft?.id === draft.id ? "is-active" : "";
        const template = getTemplate(draft.templateId);
        return '<div class="ns-editor-shell__list-row ' + active + '">' +
          '<button class="ns-editor-shell__list-button ' + active + '" type="button" data-draft-id="' + escapeHtml(draft.id) + '">' +
            '<span class="ns-editor-shell__list-title">' + escapeHtml(draft.meta.title || t("Untitled draft","Черновик без названия")) + '</span>' +
            '<span class="ns-editor-shell__list-subtitle">' + escapeHtml(getTemplateUiMeta(template).name) + ' · ' + escapeHtml(formatDateTime(draft.updatedAt)) + '</span>' +
          '</button>' +
          '<button class="ns-editor-shell__button ns-editor-shell__button--danger ns-editor-shell__list-delete" type="button" data-action="delete-draft-item" data-draft-id="' + escapeHtml(draft.id) + '">' + t("Delete","Удалить") + '</button>' +
        '</div>';
      }).join("");

      listRoot.innerHTML =
        '<div class="ns-editor-shell__list-section ns-editor-shell__pages-section ns-editor-shell__pages-section--cleanup">' +
          '<div class="ns-editor-shell__list-section-head ns-editor-shell__list-section-head--cleanup">' +
            '<div class="ns-editor-shell__list-section-title">' + escapeHtml(labels.pagesTitle) + '</div>' +
            '<div class="ns-editor-shell__list-section-actions">' +
              '<button class="ns-editor-shell__button ns-editor-shell__button--primary ns-editor-shell__list-new-page" type="button" data-action="new-site-page">' + escapeHtml(labels.newPage) + '</button>' +
              '<button class="ns-editor-shell__button ns-editor-shell__reset-pages" type="button" data-clean-reset-site-pages>' + escapeHtml(labels.resetPages) + '</button>' +
            '</div>' +
          '</div>' +
          (pageRows || '<div class="ns-editor-shell__mini-empty">' + escapeHtml(labels.noPages) + '</div>') +
        '</div>' +
        '<div class="ns-editor-shell__list-section ns-editor-shell__drafts-section">' +
          '<div class="ns-editor-shell__list-section-title">' + escapeHtml(labels.draftsTitle) + '</div>' +
          (draftRows || '<div class="ns-editor-shell__mini-empty">' + escapeHtml(labels.noDrafts) + '</div>') +
        '</div>';
    };

    const originalRenderPreviewPanelV16 = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelCleanupV2(draft) {
      if (!draft || !draft.sitePageId) return originalRenderPreviewPanelV16.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (c16SyncSettings(this, { rerender: false }) || draft) : draft;
      const html = c16RenderSiteHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-cleanup-v2"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(c16Text("Preview", "Предпросмотр")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-cleanup-v2" title="' + escapeHtml(c16Text("Preview", "Предпросмотр")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const originalRenderPreviewMetaV16 = EditorSurface.prototype.renderPreviewMeta;
    EditorSurface.prototype.renderPreviewMeta = function renderPreviewMetaCleanupV2(draft) {
      if (!draft || !draft.sitePageId || !this.refs.previewMeta) return originalRenderPreviewMetaV16.call(this, draft);
      this.refs.previewMeta.innerHTML = '<div class="ns-editor-preview-actions ns-editor-preview-actions--compact ns-editor-preview-actions--site-cleanup-v2"><button class="ns-editor-shell__button" type="button" data-action="open-preview-external">' + escapeHtml(t("Open in browser","Открыть в браузере")) + '</button><button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">' + escapeHtml(t("Copy preview path","Копировать путь")) + '</button></div>';
    };

    const originalEnsureMaterializedPreviewV16 = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewCleanupV2() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) return originalEnsureMaterializedPreviewV16.call(this);
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = c16SyncSettings(this, { rerender: false }) || (this.readForm ? this.readForm() : this.currentDraft);
      this.currentDraft = draft;
      const found = c16FindPage(draft);
      const html = c16RenderSiteHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || c16Text("Preview","Предпросмотр"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] cleanup v2 preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    const originalSaveCurrentDraftV16 = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftCleanupV2(showToast) {
      if (this.currentDraft && this.currentDraft.sitePageId) c16SyncSettings(this, { remount: true, rerender: false });
      const result = originalSaveCurrentDraftV16.call(this, showToast);
      if (this.currentDraft && this.currentDraft.sitePageId) {
        c16SyncSettings(this, { remount: true, rerender: false });
        this.renderDraftList();
        this.syncHeaderState();
        this.renderDynamicPanels(this.currentDraft);
      }
      return result;
    };

    function c16DeleteSitePage(surface, pageId) {
      const state = c16ReadState();
      const pages = c16DedupPages(state.pages || []);
      if (pages.length <= 1) {
        surface?.flashStatus?.(c16Text("At least one site page is required.", "Нужна хотя бы одна страница сайта."));
        return false;
      }
      const page = pages.find((item) => String(item.id) === String(pageId));
      if (!page) return false;

      const nextPages = pages.filter((item) => String(item.id) !== String(pageId));
      state.pages = c16DedupPages(nextPages);
      if (state.activePageId === pageId) state.activePageId = state.pages[0]?.id || "";
      c16WriteState(state);

      if (page.draftId && surface?.store && typeof surface.store.deleteDraft === "function") {
        surface.store.deleteDraft(page.draftId);
      }

      if (surface && surface.currentDraft && String(surface.currentDraft.sitePageId || "") === String(pageId)) {
        surface.currentDraft = null;
        if (surface.store?.state) {
          surface.store.state.activeDraftId = null;
          if (typeof surface.store.write === "function") surface.store.write();
        }
      }

      if (surface) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
        if (!surface.currentDraft && surface.refs?.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(c16Text("Page deleted. Choose another page or create a new one.", "Страница удалена. Выберите другую страницу или создайте новую.")) + '</div>';
        }
        surface.flashStatus(c16Text("Site page deleted.", "Страница сайта удалена."));
      }
      return true;
    }

    function c16ResetPages(surface) {
      const state = c16ReadState();
      const oldPages = Array.isArray(state.pages) ? state.pages : [];
      const oldDraftIds = new Set(oldPages.map((page) => String(page.draftId || "")).filter(Boolean));

      if (surface?.store && typeof surface.store.getDrafts === "function" && typeof surface.store.deleteDrafts === "function") {
        const ids = surface.store.getDrafts()
          .filter((draft) => c16IsSitePageDraft(draft, oldDraftIds))
          .map((draft) => draft.id)
          .filter(Boolean);
        surface.store.deleteDrafts(ids);
      } else if (surface?.store && typeof surface.store.getDrafts === "function" && typeof surface.store.deleteDraft === "function") {
        surface.store.getDrafts().forEach((draft) => {
          if (c16IsSitePageDraft(draft, oldDraftIds)) surface.store.deleteDraft(draft.id);
        });
      }

      const next = c16DefaultState();
      next.createdAt = state.createdAt || next.createdAt;
      next.updatedAt = c16Now();
      next.publishConfig = { ...(state.publishConfig || next.publishConfig) };
      c16WriteState(next);

      if (surface?.store?.state) {
        surface.store.state.activeDraftId = null;
        if (typeof surface.store.write === "function") surface.store.write();
      }

      if (surface) {
        surface.currentDraft = null;
        surface.renderDraftList();
        surface.renderContextRail();
        surface.renderDynamicPanels(surface.currentDraft);
        surface.syncHeaderState();
        if (surface.refs?.writeMount) {
          surface.refs.writeMount.innerHTML = '<div class="ns-editor-shell__mini-empty">' + escapeHtml(c16Text("Pages reset. Choose Home/About/Contact or create one new page.", "Страницы сброшены. Выберите Home/About/Contact или создайте одну новую страницу.")) + '</div>';
        }
        surface.flashStatus(c16Text("Site pages reset.", "Страницы сайта сброшены."));
      }
    }

    function c16SurfaceFromEvent(event) {
      const shell = event.target?.closest ? event.target.closest(".ns-editor-shell") : null;
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return null;
      return api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean) || null;
    }

    document.addEventListener("click", (event) => {
      const deleteButton = event.target?.closest ? event.target.closest("[data-clean-delete-site-page]") : null;
      const resetButton = event.target?.closest ? event.target.closest("[data-clean-reset-site-pages]") : null;
      const openButton = event.target?.closest ? event.target.closest("[data-clean-open-site-page]") : null;
      const applyButton = event.target?.closest ? event.target.closest('[data-action="sync-site-page-settings"]') : null;
      const oldSitePreviewButton = event.target?.closest ? event.target.closest('[data-action="open-site-preview"]') : null;

      if (!deleteButton && !resetButton && !openButton && !applyButton && !oldSitePreviewButton) return;

      const surface = c16SurfaceFromEvent(event);
      if (!surface) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

      if (deleteButton) {
        const pageId = deleteButton.getAttribute("data-clean-delete-site-page") || "";
        const state = c16ReadState();
        const page = (state.pages || []).find((item) => String(item.id) === String(pageId));
        if (!page) return;
        const ok = window.confirm(c16Text(
          'Delete site page "' + (page.title || page.slug || "Page") + '"?',
          'Удалить страницу сайта «' + (page.title || page.slug || "Страница") + '»?'
        ));
        if (ok) c16DeleteSitePage(surface, pageId);
        return;
      }

      if (resetButton) {
        const ok = window.confirm(c16Text(
          "Reset site pages to clean Home/About/Contact and delete all site-page drafts?",
          "Сбросить страницы сайта к чистым Home/About/Contact и удалить все page-draft?"
        ));
        if (ok) c16ResetPages(surface);
        return;
      }

      if (openButton) {
        const pageId = openButton.getAttribute("data-clean-open-site-page") || "";
        if (typeof surface.openEditorSitePageById === "function") {
          surface.openEditorSitePageById(pageId);
        }
        return;
      }

      if (applyButton) {
        c16SyncSettings(surface, { remount: true, rerender: true });
        surface.flashStatus(c16Text("Page settings applied.", "Настройки страницы применены."));
        return;
      }

      if (oldSitePreviewButton) {
        if (surface.currentDraft?.sitePageId) c16OpenPreview(surface);
      }
    }, true);

    document.addEventListener("change", (event) => {
      const field = event.target?.closest ? event.target.closest("[data-site-page-field]") : null;
      if (!field) return;
      const surface = c16SurfaceFromEvent(event);
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return;
      c16SyncSettings(surface, { remount: false, rerender: false });
    }, true);
  })();


  // 1.0.0 v17: Editor Site Page Model UI Fix v1
  // Separates page metadata from page body:
  // - page title/slug/SEO live in Panel/settings;
  // - Editor canvas keeps only page body/content;
  // - Preview renders template header + page title + body without WordPress-like duplicated title blocks.
  (function installEditorSitePageModelUiFixV1() {
    if (EditorSurface.prototype.__irgeztneEditorSitePageModelUiFixV1) return;
    EditorSurface.prototype.__irgeztneEditorSitePageModelUiFixV1 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function m17Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function m17Ru() {
      return String(m17Locale() || "").startsWith("ru");
    }

    function m17Text(en, ru) {
      return m17Ru() ? ru : en;
    }

    function m17Now() {
      try { return nowIso(); } catch (_) { return new Date().toISOString(); }
    }

    function m17DefaultPages() {
      const time = m17Now();
      return [
        { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
        { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
      ];
    }

    function m17DefaultState() {
      const time = m17Now();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: m17DefaultPages()
      };
    }

    function m17NormalizePage(page, index) {
      const title = page?.title || page?.label || "Untitled page";
      return {
        id: page?.id || uid("page"),
        title,
        slug: page?.slug || slugify(title || "page"),
        status: page?.status || "draft",
        type: page?.type || "page",
        menu: page?.menu !== false,
        parentId: page?.parentId || "",
        order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
        summary: page?.summary || page?.description || "",
        seoTitle: page?.seoTitle || "",
        seoDescription: page?.seoDescription || "",
        contentHtml: page?.contentHtml || "",
        draftId: page?.draftId || "",
        createdAt: page?.createdAt || m17Now(),
        updatedAt: page?.updatedAt || m17Now()
      };
    }

    function m17DedupPages(pages) {
      const seen = new Set();
      const out = [];
      (Array.isArray(pages) ? pages : []).forEach((raw, index) => {
        const page = m17NormalizePage(raw, index);
        const key = String(page.slug || page.id || page.title || index).toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push({ ...page, order: out.length });
      });
      return out;
    }

    function m17ReadState() {
      const fallback = m17DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: m17DedupPages(pages.map(m17NormalizePage))
        };
      } catch (error) {
        console.warn("[NSEditorV1] model-ui-fix could not read site pages:", error);
        return fallback;
      }
    }

    function m17WriteState(state) {
      const next = { ...state, pages: m17DedupPages(state.pages || []), updatedAt: m17Now() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] model-ui-fix could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor-site-page-model-ui-fix-v1", state: deepClone(next) } }));
      return next;
    }

    function m17FindPage(draft) {
      const state = m17ReadState();
      if (!draft || !draft.sitePageId) return { state, page: null, index: -1 };
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(draft.sitePageId));
      return { state, page: index >= 0 ? state.pages[index] : null, index };
    }

    function m17StarterBodyHtml() {
      return '<section class="ns-page-section ns-site-page-body-only"><p class="ns-site-page-body-placeholder">' +
        escapeHtml(m17Text("Start writing the page content here. The page title, slug and SEO are controlled from Panel.", "Начните писать контент страницы здесь. Название, slug и SEO управляются из панели.")) +
        '</p></section>';
    }

    function m17StripGeneratedHero(html) {
      let next = String(html || "").trim();
      if (!next) return "";
      // Remove early generated site-page hero/title section.
      next = next.replace(/<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<\/section>/ig, "").trim();
      // Remove duplicated default Content heading if it is untouched.
      next = next.replace(/<section\b[^>]*class=["'][^"']*ns-page-section[^"']*["']\s*>\s*<h2>\s*(Content|Контент)\s*<\/h2>\s*<p>\s*(Start writing this site page here\.|Начните писать страницу сайта здесь\.)\s*<\/p>\s*<\/section>/ig, "").trim();
      // Remove h1-only duplicated title blocks accidentally saved as body.
      next = next.replace(/^\s*<h1[^>]*>\s*(New site page|Новая страница сайта)(\s+\d+)?\s*<\/h1>\s*/i, "").trim();
      return next;
    }

    function m17LooksLikeOnlyOldStarter(html) {
      const text = String(html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!text) return true;
      const starterBits = [
        "site page",
        "страница сайта",
        "new site page",
        "новая страница сайта",
        "content",
        "контент",
        "start writing this site page here",
        "начните писать страницу сайта здесь",
        "write this site page in editor",
        "напишите эту страницу в редакторе",
        "slug",
        "seo"
      ];
      const withoutStarter = starterBits.reduce((acc, bit) => acc.replaceAll(bit, ""), text).replace(/[0-9\-–—.,:;!?()«»"']/g, "").trim();
      return withoutStarter.length < 4;
    }

    function m17EnsureBodyOnlyDraft(draft, pageLike, options = {}) {
      if (!draft || !draft.sitePageId) return draft;
      draft.write = draft.write || {};
      const currentHtml = String(draft.write.visualHtml || draft.content?.body || "");
      const cleaned = m17StripGeneratedHero(currentHtml);
      const bodyHtml = (!cleaned || m17LooksLikeOnlyOldStarter(cleaned)) ? m17StarterBodyHtml() : cleaned;

      if (bodyHtml !== currentHtml || options.force) {
        draft.write.visualHtml = bodyHtml;
        draft.content = { ...(draft.content || {}), body: bodyHtml };
      }

      const bodyText = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      draft.write.markdown = bodyText ? bodyText + "\n" : "";
      draft.meta = {
        ...(draft.meta || {}),
        title: pageLike?.title || draft.meta?.title || m17Text("Untitled page", "Страница без названия"),
        summary: pageLike?.summary || draft.meta?.summary || "",
        excerpt: pageLike?.summary || draft.meta?.excerpt || draft.meta?.summary || "",
        seoTitle: pageLike?.seoTitle || draft.meta?.seoTitle || pageLike?.title || draft.meta?.title || "",
        seoDescription: pageLike?.seoDescription || draft.meta?.seoDescription || pageLike?.summary || draft.meta?.summary || "",
        category: "website",
        tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
      };
      draft.updatedAt = m17Now();
      return draft;
    }

    function m17SyncSettings(surface, options = {}) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      const root = surface.root || document;
      const field = (name) => root.querySelector('[data-site-page-field="' + name + '"]');
      const draft = surface.readForm ? surface.readForm() : deepClone(surface.currentDraft);
      const found = m17FindPage(draft);
      const page = found.page || {};

      const title = field("title")?.value.trim() || draft.meta?.title || page.title || m17Text("Untitled page", "Страница без названия");
      const slug = slugify(field("slug")?.value.trim() || draft.meta?.slug || page.slug || title) || "page";
      const summary = field("summary")?.value.trim() || draft.meta?.summary || page.summary || "";
      const seoTitle = field("seoTitle")?.value.trim() || title;
      const seoDescription = field("seoDescription")?.value.trim() || summary;
      const status = field("status")?.value || draft.status || page.status || "draft";
      const menuField = field("menu");
      const menu = menuField ? Boolean(menuField.checked) : page.menu !== false;

      const cleanBody = m17StripGeneratedHero(buildPreviewHtmlFromWrite(draft.write || {}));
      const bodyHtml = (!cleanBody || m17LooksLikeOnlyOldStarter(cleanBody)) ? m17StarterBodyHtml() : cleanBody;

      const pagePayload = {
        ...page,
        id: page.id || draft.sitePageId,
        title,
        slug,
        summary,
        seoTitle,
        seoDescription,
        status,
        menu,
        contentHtml: bodyHtml,
        draftId: draft.id || page.draftId || "",
        updatedAt: m17Now()
      };

      draft.status = status;
      draft.sitePageId = pagePayload.id;
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: m17Text("Page content", "Контент страницы"),
        tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
      };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = { ...(draft.deploy || {}), manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" } };
      draft.write = { ...(draft.write || {}), visualHtml: bodyHtml, markdown: bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() + "\n" };
      draft.content = { ...(draft.content || {}), body: bodyHtml };
      draft.updatedAt = m17Now();

      if (found.index >= 0) {
        const pages = Array.isArray(found.state.pages) ? found.state.pages.slice() : [];
        pages[found.index] = pagePayload;
        found.state.pages = m17DedupPages(pages);
        found.state.activePageId = pagePayload.id;
        m17WriteState(found.state);
      }

      const saved = surface.store && typeof surface.store.saveDraft === "function" ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);

      if (options.remount && typeof surface.mountWriteSurface === "function") surface.mountWriteSurface(surface.currentDraft);
      if (options.rerender) {
        surface.renderDraftList();
        surface.syncHeaderState();
        surface.renderDynamicPanels(surface.currentDraft);
      }
      return saved;
    }

    function m17RenderSiteHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = m17FindPage(draft);
      const state = found.state || m17ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || m17Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteProfile.siteName || "Site";
      const pageDescription = page.seoDescription || draft?.meta?.seoDescription || page.summary || siteProfile.tagline || "";
      const rawContentHtml = buildPreviewHtmlFromWrite((draft && draft.write) || {}) || page.contentHtml || "";
      const cleanedContent = m17StripGeneratedHero(rawContentHtml);
      const contentHtml = (!cleanedContent || m17LooksLikeOnlyOldStarter(cleanedContent)) ? "" : cleanedContent;

      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";
      const navPages = m17DedupPages((state.pages || []).filter((item) => item && item.menu !== false))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
      const nav = navPages.length ? navPages : [page];

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = nav.map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.90);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:760px}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800;white-space:nowrap}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.84);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        .page-kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--primary);font-size:.74rem;font-weight:900;margin:0 0 14px}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content:empty{display:none}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      return '<!doctype html><html lang="' + escapeHtml(m17Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(pageDescription) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><div class="page-kicker">' + escapeHtml(m17Text("Page", "Страница")) + '</div><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + contentHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "IRGEZTNE") + '</div></footer></body></html>';
    }

    const originalMountWriteSurfaceM17 = EditorSurface.prototype.mountWriteSurface;
    EditorSurface.prototype.mountWriteSurface = function mountWriteSurfaceModelUiFixV1(draft) {
      if (draft && draft.sitePageId) {
        const found = m17FindPage(draft);
        draft = m17EnsureBodyOnlyDraft(deepClone(draft), found.page || null);
        this.currentDraft = draft;
      }
      return originalMountWriteSurfaceM17.call(this, draft);
    };

    const originalRenderPreviewPanelM17 = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelModelUiFixV1(draft) {
      if (!draft || !draft.sitePageId) return originalRenderPreviewPanelM17.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = this.currentDraft && this.currentDraft.id === draft.id ? (m17SyncSettings(this, { rerender: false }) || draft) : draft;
      const html = m17RenderSiteHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--site-page-model-v1"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(m17Text("Preview", "Предпросмотр")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--site-page-model-v1" title="' + escapeHtml(m17Text("Preview", "Предпросмотр")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const originalRenderPreviewMetaM17 = EditorSurface.prototype.renderPreviewMeta;
    EditorSurface.prototype.renderPreviewMeta = function renderPreviewMetaModelUiFixV1(draft) {
      if (!draft || !draft.sitePageId || !this.refs.previewMeta) return originalRenderPreviewMetaM17.call(this, draft);
      this.refs.previewMeta.innerHTML = '<div class="ns-editor-preview-actions ns-editor-preview-actions--compact ns-editor-preview-actions--site-model-v1"><button class="ns-editor-shell__button" type="button" data-action="open-preview-external">' + escapeHtml(t("Open in browser","Открыть в браузере")) + '</button><button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">' + escapeHtml(t("Copy preview path","Копировать путь")) + '</button></div>';
    };

    const originalEnsureMaterializedPreviewM17 = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewModelUiFixV1() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) return originalEnsureMaterializedPreviewM17.call(this);
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = m17SyncSettings(this, { rerender: false }) || (this.readForm ? this.readForm() : this.currentDraft);
      this.currentDraft = draft;
      const found = m17FindPage(draft);
      const html = m17RenderSiteHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || m17Text("Preview","Предпросмотр"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: found.page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] model-ui-fix preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    const originalSaveCurrentDraftM17 = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftModelUiFixV1(showToast) {
      if (this.currentDraft && this.currentDraft.sitePageId) m17SyncSettings(this, { remount: true, rerender: false });
      const result = originalSaveCurrentDraftM17.call(this, showToast);
      if (this.currentDraft && this.currentDraft.sitePageId) {
        m17SyncSettings(this, { remount: true, rerender: false });
        this.renderDraftList();
        this.syncHeaderState();
        this.renderDynamicPanels(this.currentDraft);
      }
      return result;
    };

    function m17SurfaceFromEvent(event) {
      const shell = event.target?.closest ? event.target.closest(".ns-editor-shell") : null;
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return null;
      return api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean) || null;
    }

    document.addEventListener("click", (event) => {
      const applyButton = event.target?.closest ? event.target.closest('[data-action="sync-site-page-settings"]') : null;
      if (!applyButton) return;
      const surface = m17SurfaceFromEvent(event);
      if (!surface || !surface.currentDraft?.sitePageId) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      m17SyncSettings(surface, { remount: true, rerender: true });
      surface.flashStatus(m17Text("Page settings applied.", "Настройки страницы применены."));
    }, true);

    document.addEventListener("change", (event) => {
      const field = event.target?.closest ? event.target.closest("[data-site-page-field]") : null;
      if (!field) return;
      const surface = m17SurfaceFromEvent(event);
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return;
      m17SyncSettings(surface, { remount: false, rerender: false });
    }, true);
  })();


  // 1.0.0 v18: Editor Page Mode v1
  // Separate CMS-like Page Editor mode:
  // Pages are records; body is a clean content editor; templates are visible in Preview only.
  (function installEditorPageModeV1() {
    if (EditorSurface.prototype.__irgeztneEditorPageModeV1) return;
    EditorSurface.prototype.__irgeztneEditorPageModeV1 = true;

    const SITE_PAGES_KEY = "irgeztne.sitePages.v0";

    function ep18Locale() {
      try { return normalizeLocale(getUiLanguage()); } catch (_) {}
      return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
    }

    function ep18Ru() {
      return String(ep18Locale() || "").startsWith("ru");
    }

    function ep18Text(en, ru) {
      return ep18Ru() ? ru : en;
    }

    function ep18Now() {
      try { return nowIso(); } catch (_) { return new Date().toISOString(); }
    }

    function ep18DefaultPages() {
      const time = ep18Now();
      return [
        { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, parentId: "", order: 0, summary: "Main landing page for this local site.", draftId: "", contentHtml: "", createdAt: time, updatedAt: time },
        { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, parentId: "", order: 1, summary: "Project, team, or product description.", draftId: "", contentHtml: "", createdAt: time, updatedAt: time },
        { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, parentId: "", order: 2, summary: "Contact and next action page.", draftId: "", contentHtml: "", createdAt: time, updatedAt: time }
      ];
    }

    function ep18DefaultState() {
      const time = ep18Now();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: ep18DefaultPages()
      };
    }

    function ep18NormalizePage(page, index) {
      const title = page?.title || page?.label || ep18Text("Untitled page", "Страница без названия");
      return {
        id: page?.id || uid("page"),
        title,
        slug: page?.slug || slugify(title || "page"),
        status: page?.status || "draft",
        type: page?.type || "page",
        menu: page?.menu !== false,
        parentId: page?.parentId || "",
        order: Number.isFinite(Number(page?.order)) ? Number(page.order) : index,
        summary: page?.summary || page?.description || "",
        seoTitle: page?.seoTitle || "",
        seoDescription: page?.seoDescription || "",
        contentHtml: page?.contentHtml || "",
        draftId: page?.draftId || "",
        createdAt: page?.createdAt || ep18Now(),
        updatedAt: page?.updatedAt || ep18Now()
      };
    }

    function ep18DedupPages(pages) {
      const seen = new Set();
      const out = [];
      (Array.isArray(pages) ? pages : []).forEach((raw, index) => {
        const page = ep18NormalizePage(raw, index);
        const key = String(page.id || page.slug || page.title || index).toLowerCase().trim();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push({ ...page, order: out.length });
      });
      return out;
    }

    function ep18ReadState() {
      const fallback = ep18DefaultState();
      try {
        const raw = localStorage.getItem(SITE_PAGES_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== "object") return fallback;
        const pages = Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages;
        return {
          ...fallback,
          ...parsed,
          publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
          pages: ep18DedupPages(pages.map(ep18NormalizePage))
        };
      } catch (error) {
        console.warn("[NSEditorV1] Page Mode could not read site pages:", error);
        return fallback;
      }
    }

    function ep18WriteState(state) {
      const next = { ...state, pages: ep18DedupPages(state.pages || []), updatedAt: ep18Now() };
      try {
        localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] Page Mode could not write site pages:", error);
      }
      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor-page-mode-v1", state: deepClone(next) } }));
      return next;
    }

    function ep18FindPageById(pageId) {
      const state = ep18ReadState();
      const index = (state.pages || []).findIndex((page) => String(page.id) === String(pageId));
      return { state, index, page: index >= 0 ? state.pages[index] : null };
    }

    function ep18FindPageByDraft(draft) {
      if (!draft || !draft.sitePageId) return { state: ep18ReadState(), index: -1, page: null };
      return ep18FindPageById(draft.sitePageId);
    }

    function ep18DefaultTemplateId(surface) {
      try {
        const drafts = surface?.store?.getDrafts ? surface.store.getDrafts() : [];
        const fromDraft = drafts.find((draft) => draft && draft.templateId)?.templateId;
        if (fromDraft) return fromDraft;
      } catch (_) {}
      if (surface?.currentDraft?.templateId) return surface.currentDraft.templateId;
      return "project-landing";
    }

    function ep18CleanBodyHtml(html) {
      let next = String(html || "").trim();
      if (!next) return "";
      next = next.replace(/<section\b[^>]*class=["'][^"']*ns-page-hero[^"']*["'][\s\S]*?<\/section>/ig, "").trim();
      next = next.replace(/<section\b[^>]*class=["'][^"']*ns-page-section[^"']*["']\s*>\s*<h2>\s*(Content|Контент)\s*<\/h2>\s*<p>\s*(Start writing this site page here\.|Начните писать страницу сайта здесь\.)\s*<\/p>\s*<\/section>/ig, "").trim();
      next = next.replace(/^\s*<h1[^>]*>\s*(New site page|Новая страница сайта)(\s+\d+)?\s*<\/h1>\s*/i, "").trim();
      next = next.replace(/<p[^>]*class=["'][^"']*ns-site-page-body-placeholder[^"']*["'][\s\S]*?<\/p>/ig, "").trim();
      return next;
    }

    function ep18DraftBodyHtml(draft) {
      return ep18CleanBodyHtml(draft?.write?.visualHtml || draft?.content?.body || "");
    }

    function ep18MakePageDraft(surface, page) {
      const templateId = ep18DefaultTemplateId(surface);
      const body = ep18CleanBodyHtml(page.contentHtml || "");
      const draft = {
        id: uid("draft"),
        templateId,
        status: page.status || "draft",
        sitePageId: page.id,
        projectId: "",
        createdAt: ep18Now(),
        updatedAt: ep18Now(),
        meta: {
          title: page.title || ep18Text("Untitled page", "Страница без названия"),
          slug: page.slug || slugify(page.title || "page"),
          summary: page.summary || "",
          excerpt: page.summary || "",
          seoTitle: page.seoTitle || page.title || "",
          seoDescription: page.seoDescription || page.summary || "",
          category: "website",
          kicker: ep18Text("Page", "Страница"),
          tags: ["site-page"]
        },
        write: {
          markdown: body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          visualHtml: body
        },
        content: { body },
        project: { name: page.title || "", slug: page.slug || "" },
        deploy: { manual: { fileName: (page.slug || "page") + ".html" } }
      };
      const saved = surface?.store?.saveDraft ? surface.store.saveDraft(draft) : draft;
      return deepClone(saved);
    }

    function ep18EnsureDraftForPage(surface, pageId) {
      const found = ep18FindPageById(pageId);
      if (!found.page) return null;
      const drafts = surface?.store?.getDrafts ? surface.store.getDrafts() : [];
      let draft = found.page.draftId ? drafts.find((item) => String(item.id) === String(found.page.draftId)) : null;
      if (!draft) draft = drafts.find((item) => String(item.sitePageId || "") === String(found.page.id));
      if (!draft) {
        draft = ep18MakePageDraft(surface, found.page);
        found.page.draftId = draft.id;
        found.page.updatedAt = ep18Now();
        found.state.pages[found.index] = found.page;
        found.state.activePageId = found.page.id;
        ep18WriteState(found.state);
      }
      return deepClone(draft);
    }

    function ep18CreateNewPage(surface) {
      const state = ep18ReadState();
      const existing = Array.isArray(state.pages) ? state.pages : [];
      const base = ep18Text("New page", "Новая страница");
      let n = 1;
      let title = base;
      const titles = new Set(existing.map((page) => String(page.title || "").toLowerCase()));
      while (titles.has(title.toLowerCase())) {
        n += 1;
        title = base + " " + n;
      }
      const slugBase = slugify(title) || "page";
      let slug = slugBase;
      let s = 1;
      const slugs = new Set(existing.map((page) => String(page.slug || "").toLowerCase()));
      while (slugs.has(slug.toLowerCase())) {
        s += 1;
        slug = slugBase + "-" + s;
      }
      const page = {
        id: uid("page"),
        title,
        slug,
        status: "draft",
        type: "page",
        menu: true,
        parentId: "",
        order: existing.length,
        summary: "",
        seoTitle: title,
        seoDescription: "",
        contentHtml: "",
        draftId: "",
        createdAt: ep18Now(),
        updatedAt: ep18Now()
      };
      const draft = ep18MakePageDraft(surface, page);
      page.draftId = draft.id;
      state.pages = ep18DedupPages([...(state.pages || []), page]);
      state.activePageId = page.id;
      ep18WriteState(state);

      surface.currentDraft = draft;
      if (surface.store?.state) {
        surface.store.state.activeDraftId = draft.id;
        if (typeof surface.store.write === "function") surface.store.write();
      }
      surface.renderDraftList?.();
      surface.syncHeaderState?.();
      surface.mountWriteSurface?.(draft);
      surface.renderDynamicPanels?.(draft);
      surface.flashStatus?.(ep18Text("Page created.", "Страница создана."));
      return draft;
    }

    function ep18ReadPageMode(surface) {
      const draft = deepClone(surface.currentDraft || {});
      if (!draft || !draft.sitePageId) return draft;
      const root = surface.root || document;
      const titleField = root.querySelector('[data-page-mode-field="title"]');
      const slugField = root.querySelector('[data-page-mode-field="slug"]');
      const summaryField = root.querySelector('[data-page-mode-field="summary"]');
      const seoTitleField = root.querySelector('[data-page-mode-field="seoTitle"]');
      const seoDescriptionField = root.querySelector('[data-page-mode-field="seoDescription"]');
      const statusField = root.querySelector('[data-page-mode-field="status"]');
      const menuField = root.querySelector('[data-page-mode-field="menu"]');
      const parentField = root.querySelector('[data-page-mode-field="parentId"]');
      const body = root.querySelector('[data-page-mode-body]');

      const found = ep18FindPageByDraft(draft);
      const page = found.page || {};
      const title = (titleField?.value || page.title || draft.meta?.title || ep18Text("Untitled page", "Страница без названия")).trim();
      const slug = slugify((slugField?.value || page.slug || draft.meta?.slug || title).trim()) || "page";
      const summary = (summaryField?.value || page.summary || draft.meta?.summary || "").trim();
      const seoTitle = (seoTitleField?.value || page.seoTitle || draft.meta?.seoTitle || title).trim();
      const seoDescription = (seoDescriptionField?.value || page.seoDescription || draft.meta?.seoDescription || summary).trim();
      const status = statusField?.value || page.status || draft.status || "draft";
      const menu = menuField ? Boolean(menuField.checked) : page.menu !== false;
      const parentId = parentField?.value || page.parentId || "";
      const contentHtml = ep18CleanBodyHtml(body ? body.innerHTML : ep18DraftBodyHtml(draft));

      draft.status = status;
      draft.sitePageId = draft.sitePageId || page.id;
      draft.meta = {
        ...(draft.meta || {}),
        title,
        slug,
        summary,
        excerpt: summary,
        seoTitle,
        seoDescription,
        category: "website",
        kicker: ep18Text("Page", "Страница"),
        tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
      };
      draft.write = { ...(draft.write || {}), visualHtml: contentHtml, markdown: contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
      draft.content = { ...(draft.content || {}), body: contentHtml };
      draft.project = { ...(draft.project || {}), name: title, slug };
      draft.deploy = { ...(draft.deploy || {}), manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" } };
      draft.updatedAt = ep18Now();

      draft.__pageModePayload = { title, slug, summary, seoTitle, seoDescription, status, menu, parentId, contentHtml };
      return draft;
    }

    function ep18SavePageMode(surface, options = {}) {
      if (!surface || !surface.currentDraft || !surface.currentDraft.sitePageId) return null;
      let draft = ep18ReadPageMode(surface);
      const payload = draft.__pageModePayload || {};
      delete draft.__pageModePayload;

      const found = ep18FindPageByDraft(draft);
      if (found.index >= 0) {
        const page = {
          ...found.page,
          ...payload,
          id: found.page.id,
          draftId: draft.id,
          updatedAt: ep18Now()
        };
        found.state.pages[found.index] = page;
        found.state.activePageId = page.id;
        ep18WriteState(found.state);
      }

      const saved = surface.store?.saveDraft ? surface.store.saveDraft(draft) : draft;
      surface.currentDraft = deepClone(saved);
      if (surface.store?.state) {
        surface.store.state.activeDraftId = saved.id;
        if (typeof surface.store.write === "function") surface.store.write();
      }

      if (options.remount) surface.mountWriteSurface?.(surface.currentDraft);
      if (options.rerender) {
        surface.renderDraftList?.();
        surface.renderDynamicPanels?.(surface.currentDraft);
        surface.syncHeaderState?.();
      }
      if (options.toast !== false) surface.flashStatus?.(ep18Text("Page saved.", "Страница сохранена."));
      return surface.currentDraft;
    }

    function ep18SurfaceFromEvent(event) {
      const shell = event.target?.closest ? event.target.closest(".ns-editor-shell") : null;
      const api = window.__nsEditorV1Instance;
      if (!shell || !api || !Array.isArray(api.surfaces)) return null;
      return api.surfaces.find((item) => item && item.root && item.root.contains(shell)) || api.surfaces.find(Boolean) || null;
    }

    function ep18PageSelectOptions(activeId, selectedId) {
      const pages = ep18DedupPages(ep18ReadState().pages || []);
      const options = ['<option value="">' + escapeHtml(ep18Text("No parent", "Без родителя")) + '</option>'];
      pages.forEach((page) => {
        if (String(page.id) === String(activeId)) return;
        options.push('<option value="' + escapeHtml(page.id) + '"' + (String(page.id) === String(selectedId || "") ? " selected" : "") + '>' + escapeHtml(page.title || page.slug || "Page") + '</option>');
      });
      return options.join("");
    }

    function ep18RenderPageEditor(surface, draft) {
      const found = ep18FindPageByDraft(draft);
      const page = found.page || {};
      const title = draft.meta?.title || page.title || ep18Text("Untitled page", "Страница без названия");
      const slug = draft.meta?.slug || page.slug || slugify(title) || "page";
      const summary = draft.meta?.summary || page.summary || "";
      const seoTitle = draft.meta?.seoTitle || page.seoTitle || title;
      const seoDescription = draft.meta?.seoDescription || page.seoDescription || summary;
      const status = draft.status || page.status || "draft";
      const menu = page.menu !== false;
      const contentHtml = ep18DraftBodyHtml(draft) || ep18CleanBodyHtml(page.contentHtml || "");

      const bodyPlaceholder = ep18Text("Start writing page content here…", "Начните писать контент страницы здесь…");
      const pageTitleLabel = ep18Text("Page title", "Название страницы");
      const backLabel = ep18Text("Pages", "Страницы");
      const saveLabel = ep18Text("Save page", "Сохранить страницу");
      const previewLabel = ep18Text("Preview", "Предпросмотр");

      return '<div class="irgeztne-page-mode" data-page-mode-root>' +
        '<div class="irgeztne-page-mode__top">' +
          '<button class="ns-editor-shell__button irgeztne-page-mode__back" type="button" data-page-mode-action="back-pages">← ' + escapeHtml(backLabel) + '</button>' +
          '<div class="irgeztne-page-mode__crumb">' + escapeHtml(ep18Text("Editor / Page", "Редактор / Страница")) + '</div>' +
          '<div class="irgeztne-page-mode__top-actions">' +
            '<button class="ns-editor-shell__button" type="button" data-page-mode-action="preview">' + escapeHtml(previewLabel) + '</button>' +
            '<button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-page-mode-action="save">' + escapeHtml(saveLabel) + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="irgeztne-page-mode__layout">' +
          '<main class="irgeztne-page-mode__main">' +
            '<label class="irgeztne-page-mode__title-label">' + escapeHtml(pageTitleLabel) + '</label>' +
            '<input class="irgeztne-page-mode__title-input" data-page-mode-field="title" value="' + escapeHtml(title) + '" placeholder="' + escapeHtml(pageTitleLabel) + '" />' +
            '<div class="irgeztne-page-mode__toolbar" role="toolbar" aria-label="' + escapeHtml(ep18Text("Text tools", "Инструменты текста")) + '">' +
              '<button type="button" data-page-command="bold"><strong>B</strong></button>' +
              '<button type="button" data-page-command="italic"><em>I</em></button>' +
              '<button type="button" data-page-command="underline"><u>U</u></button>' +
              '<button type="button" data-page-command="formatBlock" data-page-command-value="h2">H2</button>' +
              '<button type="button" data-page-command="formatBlock" data-page-command-value="p">P</button>' +
              '<button type="button" data-page-command="insertUnorderedList">• List</button>' +
              '<button type="button" data-page-command="createLink">Link</button>' +
              '<button type="button" data-page-command="removeFormat">' + escapeHtml(ep18Text("Clear", "Очистить")) + '</button>' +
            '</div>' +
            '<section class="irgeztne-page-mode__body-wrap">' +
              '<div class="irgeztne-page-mode__body" data-page-mode-body contenteditable="true" spellcheck="true" data-placeholder="' + escapeHtml(bodyPlaceholder) + '">' + contentHtml + '</div>' +
            '</section>' +
          '</main>' +
          '<aside class="irgeztne-page-mode__settings">' +
            '<div class="irgeztne-page-mode__settings-title">' + escapeHtml(ep18Text("Page settings", "Настройки страницы")) + '</div>' +
            '<label>' + escapeHtml(ep18Text("Slug / URL", "Slug / URL")) + '<input data-page-mode-field="slug" value="' + escapeHtml(slug) + '" /></label>' +
            '<label>' + escapeHtml(ep18Text("Short description", "Краткое описание")) + '<textarea data-page-mode-field="summary" rows="3">' + escapeHtml(summary) + '</textarea></label>' +
            '<label>' + escapeHtml(ep18Text("SEO title", "SEO title")) + '<input data-page-mode-field="seoTitle" value="' + escapeHtml(seoTitle) + '" /></label>' +
            '<label>' + escapeHtml(ep18Text("SEO description", "SEO description")) + '<textarea data-page-mode-field="seoDescription" rows="4">' + escapeHtml(seoDescription) + '</textarea></label>' +
            '<label>' + escapeHtml(ep18Text("Status", "Статус")) + '<select data-page-mode-field="status"><option value="draft"' + (status === "draft" ? " selected" : "") + '>' + escapeHtml(ep18Text("Draft", "Черновик")) + '</option><option value="published"' + (status === "published" ? " selected" : "") + '>' + escapeHtml(ep18Text("Published", "Опубликовано")) + '</option></select></label>' +
            '<label>' + escapeHtml(ep18Text("Parent page", "Родительская страница")) + '<select data-page-mode-field="parentId">' + ep18PageSelectOptions(page.id, page.parentId) + '</select></label>' +
            '<label class="irgeztne-page-mode__check"><input data-page-mode-field="menu" type="checkbox" ' + (menu ? "checked" : "") + ' /> <span>' + escapeHtml(ep18Text("Show in menu", "Показывать в меню")) + '</span></label>' +
            '<div class="irgeztne-page-mode__settings-actions">' +
              '<button class="ns-editor-shell__button ns-editor-shell__button--primary" type="button" data-page-mode-action="save">' + escapeHtml(saveLabel) + '</button>' +
              '<button class="ns-editor-shell__button" type="button" data-page-mode-action="preview">' + escapeHtml(previewLabel) + '</button>' +
            '</div>' +
          '</aside>' +
        '</div>' +
      '</div>';
    }

    function ep18RenderSiteHtml(draft) {
      const siteProfile = getSiteProfile();
      const found = ep18FindPageByDraft(draft);
      const state = found.state || ep18ReadState();
      const page = found.page || {
        id: draft?.sitePageId || "page_preview",
        title: draft?.meta?.title || ep18Text("Untitled page", "Страница без названия"),
        slug: draft?.meta?.slug || "page",
        summary: draft?.meta?.summary || "",
        seoTitle: draft?.meta?.seoTitle || "",
        seoDescription: draft?.meta?.seoDescription || "",
        menu: true
      };

      const bodyHtml = ep18CleanBodyHtml(draft?.write?.visualHtml || page.contentHtml || "");
      const siteName = siteProfile.siteName || "Project Studio";
      const tagline = siteProfile.tagline || "";
      const primary = siteProfile.primaryColor || "#4278e8";
      const navPages = ep18DedupPages((state.pages || []).filter((item) => item && item.menu !== false))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

      const logo = siteProfile.logoPath
        ? '<span class="spv-logo"><img src="' + escapeHtml(normalizeAppAssetPath(siteProfile.logoPath)) + '" alt="" /></span>'
        : '<span class="spv-logo">' + escapeHtml(getInitials(siteName).slice(0, 2)) + '</span>';

      const navHtml = (navPages.length ? navPages : [page]).map((item) => {
        const active = String(item.id || "") === String(page.id || "");
        const href = item.slug === "index" ? "./index.html" : "./" + escapeHtml(item.slug || "page") + ".html";
        return '<a class="' + (active ? 'is-active' : '') + '" href="' + href + '">' + escapeHtml(item.title || item.slug || "Page") + '</a>';
      }).join("");

      const css = `
        :root{--primary:${primary};--ink:#141b2b;--muted:#667085;--line:rgba(20,27,43,.12)}
        *{box-sizing:border-box}
        body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:linear-gradient(135deg,#fbf3e8 0%,#fff 54%,#f4f7ff 100%);min-height:100vh}
        .spv-shell{width:min(1220px,calc(100% - 48px));margin:0 auto}
        header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.92);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
        .spv-navrow{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 0}
        .spv-brand{display:flex;align-items:center;gap:12px;color:inherit;text-decoration:none;min-width:220px}
        .spv-logo{width:44px;height:44px;border-radius:16px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:900;overflow:hidden;box-shadow:0 16px 34px rgba(66,120,232,.22)}
        .spv-logo img{width:100%;height:100%;object-fit:cover}
        .spv-brand strong{display:block;font-size:1rem}
        .spv-brand small{display:block;color:var(--muted);font-size:.82rem;line-height:1.2}
        nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;max-width:760px}
        nav a{padding:9px 12px;border:1px solid transparent;border-radius:999px;color:#334155;text-decoration:none;font-size:.88rem;font-weight:800;white-space:nowrap}
        nav a:hover,nav a.is-active{border-color:rgba(66,120,232,.18);background:rgba(66,120,232,.10);color:#1d4ed8}
        main{padding:52px 0 76px}
        article{background:rgba(255,255,255,.84);border:1px solid var(--line);border-radius:32px;padding:clamp(28px,5vw,68px);box-shadow:0 28px 90px rgba(15,23,42,.10)}
        .page-kicker{text-transform:uppercase;letter-spacing:.16em;color:var(--primary);font-size:.74rem;font-weight:900;margin:0 0 14px}
        h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.96;letter-spacing:-.075em;margin:0 0 22px}
        .summary{max-width:800px;color:var(--muted);font-size:clamp(1rem,1.7vw,1.22rem);line-height:1.7;margin:0 0 34px}
        .content{font-size:1.04rem;line-height:1.72}
        .content:empty{display:none}
        .content h1,.content h2,.content h3{letter-spacing:-.035em}
        .content img{max-width:100%;border-radius:20px}
        footer{border-top:1px solid var(--line);padding:26px 0;color:var(--muted);background:rgba(255,255,255,.64)}
        @media(max-width:760px){.spv-navrow{align-items:flex-start;flex-direction:column}.spv-shell{width:min(100% - 28px,1220px)}article{border-radius:24px}}
      `;

      const pageTitle = page.seoTitle || draft?.meta?.seoTitle || page.title || siteName;
      const description = page.seoDescription || draft?.meta?.seoDescription || page.summary || tagline || "";
      return '<!doctype html><html lang="' + escapeHtml(ep18Locale()) + '"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>' + escapeHtml(pageTitle) + '</title><meta name="description" content="' + escapeHtml(description) + '"/><style>' + css + '</style></head><body><header><div class="spv-shell spv-navrow"><a class="spv-brand" href="./index.html">' + logo + '<span><strong>' + escapeHtml(siteName) + '</strong><small>' + escapeHtml(tagline) + '</small></span></a><nav>' + navHtml + '</nav></div></header><main><article class="spv-shell"><div class="page-kicker">' + escapeHtml(ep18Text("Page", "Страница")) + '</div><h1>' + escapeHtml(page.title || pageTitle) + '</h1>' + (page.summary ? '<p class="summary">' + escapeHtml(page.summary) + '</p>' : '') + '<div class="content">' + bodyHtml + '</div></article></main><footer><div class="spv-shell">' + escapeHtml(siteProfile.footerText || "Built with IRGEZTNE") + '</div></footer></body></html>';
    }

    const oldReadForm18 = EditorSurface.prototype.readForm;
    EditorSurface.prototype.readForm = function readFormPageModeV1() {
      if (this.currentDraft && this.currentDraft.sitePageId && this.root?.querySelector?.("[data-page-mode-root]")) {
        return ep18ReadPageMode(this);
      }
      return oldReadForm18.call(this);
    };

    const oldMountWriteSurface18 = EditorSurface.prototype.mountWriteSurface;
    EditorSurface.prototype.mountWriteSurface = function mountWriteSurfacePageModeV1(draft) {
      if (draft && draft.sitePageId && this.refs?.writeMount) {
        const cleanDraft = deepClone(draft);
        cleanDraft.write = cleanDraft.write || {};
        cleanDraft.write.visualHtml = ep18DraftBodyHtml(cleanDraft);
        cleanDraft.content = { ...(cleanDraft.content || {}), body: cleanDraft.write.visualHtml };
        this.currentDraft = cleanDraft;
        this.refs.writeMount.innerHTML = ep18RenderPageEditor(this, cleanDraft);
        this.refs.writeMount.dataset.pageMode = "site-page";
        try {
          const titleInput = this.refs.writeMount.querySelector('[data-page-mode-field="title"]');
          titleInput?.focus();
          titleInput?.select?.();
        } catch (_) {}
        return;
      }
      if (this.refs?.writeMount) delete this.refs.writeMount.dataset.pageMode;
      return oldMountWriteSurface18.call(this, draft);
    };

    const oldSaveCurrentDraft18 = EditorSurface.prototype.saveCurrentDraft;
    EditorSurface.prototype.saveCurrentDraft = function saveCurrentDraftPageModeV1(showToast) {
      if (this.currentDraft && this.currentDraft.sitePageId && this.root?.querySelector?.("[data-page-mode-root]")) {
        return ep18SavePageMode(this, { remount: false, rerender: true, toast: showToast !== false });
      }
      return oldSaveCurrentDraft18.call(this, showToast);
    };

    const oldOpenSitePage18 = EditorSurface.prototype.openEditorSitePageById;
    EditorSurface.prototype.openEditorSitePageById = function openEditorSitePageByIdPageModeV1(pageId) {
      const draft = ep18EnsureDraftForPage(this, pageId);
      if (!draft) {
        this.flashStatus?.(ep18Text("Page not found.", "Страница не найдена."));
        return;
      }
      this.currentDraft = draft;
      if (this.store?.state) {
        this.store.state.activeDraftId = draft.id;
        if (typeof this.store.write === "function") this.store.write();
      }
      if (typeof this.switchTab === "function") this.switchTab("write");
      this.mountWriteSurface?.(draft);
      this.renderDraftList?.();
      this.renderDynamicPanels?.(draft);
      this.syncHeaderState?.();
      this.flashStatus?.(ep18Text("Page opened.", "Страница открыта."));
    };

    const oldRenderPreviewPanel18 = EditorSurface.prototype.renderPreviewPanel;
    EditorSurface.prototype.renderPreviewPanel = function renderPreviewPanelPageModeV1(draft) {
      if (!draft || !draft.sitePageId) return oldRenderPreviewPanel18.call(this, draft);
      if (!this.refs.previewLive) return;
      const current = (this.currentDraft && this.currentDraft.id === draft.id) ? (ep18SavePageMode(this, { remount: false, rerender: false, toast: false }) || draft) : draft;
      const html = ep18RenderSiteHtml(current);
      const slug = current.meta?.slug || "site-page";
      this.refs.previewLive.innerHTML = '<div class="ns-editor-preview-stage ns-editor-preview-stage--page-mode-v1"><div class="ns-editor-preview-stage__bar"><div class="ns-editor-preview-stage__bar-left"><div class="ns-editor-preview-stage__dots" aria-hidden="true"><span></span><span></span><span></span></div><div class="ns-editor-preview-stage__label">' + escapeHtml(ep18Text("Site preview", "Предпросмотр сайта")) + '</div></div><div class="ns-editor-preview-stage__devices ns-editor-preview-stage__devices--static"><span class="ns-editor-preview-stage__device is-active">Desktop</span></div></div><div class="ns-editor-preview-stage__viewport"><div class="ns-editor-preview-stage__canvas"><div class="ns-editor-preview-stage__canvas-head"><div class="ns-editor-preview-stage__canvas-site">' + escapeHtml(getSiteProfile().siteName || "Project Studio") + '</div><div class="ns-editor-preview-stage__canvas-url">https://preview.local/' + escapeHtml(slug) + '/</div></div><iframe class="ns-editor-preview-frame ns-editor-preview-frame--page-mode-v1" title="' + escapeHtml(ep18Text("Site preview", "Предпросмотр сайта")) + '" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts" srcdoc=\'' + escapeHtml(html) + '\'></iframe></div></div></div>';
    };

    const oldRenderPreviewMeta18 = EditorSurface.prototype.renderPreviewMeta;
    EditorSurface.prototype.renderPreviewMeta = function renderPreviewMetaPageModeV1(draft) {
      if (!draft || !draft.sitePageId || !this.refs.previewMeta) return oldRenderPreviewMeta18.call(this, draft);
      this.refs.previewMeta.innerHTML = '<div class="ns-editor-preview-actions ns-editor-preview-actions--compact ns-editor-preview-actions--page-mode-v1"><button class="ns-editor-shell__button" type="button" data-action="open-preview-external">' + escapeHtml(t("Open in browser","Открыть в браузере")) + '</button><button class="ns-editor-shell__button" type="button" data-action="copy-preview-path">' + escapeHtml(t("Copy preview path","Копировать путь")) + '</button></div>';
    };

    const oldEnsureMaterializedPreview18 = EditorSurface.prototype.ensureMaterializedPreview;
    EditorSurface.prototype.ensureMaterializedPreview = async function ensureMaterializedPreviewPageModeV1() {
      if (!this.currentDraft || !this.currentDraft.sitePageId) return oldEnsureMaterializedPreview18.call(this);
      const bridge = getPreviewBridge();
      if (!bridge || typeof bridge.materializeSitePreview !== "function") {
        this.flashStatus(t("Preview bridge unavailable","Мост предпросмотра недоступен"));
        return null;
      }
      const draft = ep18SavePageMode(this, { remount: false, rerender: false, toast: false }) || this.currentDraft;
      const html = ep18RenderSiteHtml(draft);
      const slug = draft.meta?.slug || "site-page";
      this.previewBusy = true;
      try {
        const result = await bridge.materializeSitePreview({
          title: draft.meta?.title || ep18Text("Preview","Предпросмотр"),
          slug,
          package: {
            "index.html": html,
            "styles.css": "",
            "content/page.json": JSON.stringify({ page: ep18FindPageByDraft(draft).page || null, draft: { id: draft.id, sitePageId: draft.sitePageId } }, null, 2),
            "meta.json": JSON.stringify({ title: draft.meta?.title || "", slug, sitePageId: draft.sitePageId }, null, 2)
          }
        });
        if (result && result.ok) {
          this.previewMaterialized = result;
          return result;
        }
      } catch (error) {
        console.warn("[NSEditorV1] Page Mode preview materialization failed:", error);
        this.flashStatus(t("Preview build failed","Сборка предпросмотра не удалась"));
      } finally {
        this.previewBusy = false;
      }
      return null;
    };

    window.IRGEZTNECreateEditorSitePage = function createEditorSitePagePageModeV1() {
      const api = window.__nsEditorV1Instance;
      const surface = api?.surfaces?.find((item) => item && item.root) || null;
      if (!surface) return;
      ep18CreateNewPage(surface);
    };

    window.IRGEZTNECreateEditorSitePageV18 = window.IRGEZTNECreateEditorSitePage;

    document.addEventListener("click", (event) => {
      const button = event.target?.closest ? event.target.closest("[data-page-mode-action], [data-page-command]") : null;
      if (!button) return;
      const surface = ep18SurfaceFromEvent(event);
      if (!surface) return;

      const command = button.getAttribute("data-page-command");
      const action = button.getAttribute("data-page-mode-action");

      if (command) {
        event.preventDefault();
        event.stopPropagation();
        const body = surface.root?.querySelector?.("[data-page-mode-body]");
        body?.focus();
        if (command === "createLink") {
          const url = window.prompt(ep18Text("Link URL", "URL ссылки"), "https://");
          if (url) document.execCommand("createLink", false, url);
        } else {
          const value = button.getAttribute("data-page-command-value") || null;
          document.execCommand(command, false, value);
        }
        return;
      }

      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

      if (action === "save") {
        ep18SavePageMode(surface, { remount: false, rerender: true, toast: true });
      } else if (action === "preview") {
        ep18SavePageMode(surface, { remount: false, rerender: true, toast: false });
        surface.switchTab?.("preview");
        surface.renderPreviewPanel?.(surface.currentDraft);
        surface.renderPreviewMeta?.(surface.currentDraft);
      } else if (action === "back-pages") {
        ep18SavePageMode(surface, { remount: false, rerender: true, toast: false });
        if (typeof surface.openLeftPanel === "function") {
          surface.openLeftPanel();
        } else if (surface.refs?.leftDrawer) {
          surface.refs.leftDrawer.hidden = false;
        }
        surface.flashStatus?.(ep18Text("Pages list opened.", "Список страниц открыт."));
      }
    }, true);

    document.addEventListener("input", (event) => {
      const field = event.target?.closest ? event.target.closest('[data-page-mode-field="title"], [data-page-mode-field="slug"]') : null;
      if (!field) return;
      const surface = ep18SurfaceFromEvent(event);
      if (!surface || !surface.currentDraft?.sitePageId) return;
      const titleField = surface.root.querySelector('[data-page-mode-field="title"]');
      const slugField = surface.root.querySelector('[data-page-mode-field="slug"]');
      if (field === titleField && slugField && !slugField.dataset.userEdited) {
        slugField.value = slugify(titleField.value || "") || "";
      }
      if (field === slugField) slugField.dataset.userEdited = "1";
    }, true);

    console.log("[NSEditorV1] Editor Page Mode v1 loaded.");
  })();


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
      // 1.0.0 final: API-level site page creation.
      createSitePageDraft(surfaceType) {
        const preferredSurface = surfaceType
          ? surfaces.find((surface) => surface.surfaceType === surfaceType)
          : null;
        const target = preferredSurface
          || surfaces.find((surface) => surface.surfaceType === "cabinet")
          || surfaces[0];
        if (target && typeof target.createEditorSitePageDraft === "function") {
          return target.createEditorSitePageDraft();
        }
        if (target && typeof target.createSitePageDraft === "function") {
          return target.createSitePageDraft();
        }
        const fallback = this.createDraftFromTemplate(DEFAULT_TEMPLATE_ID, { initialTab: "write" });
        window.dispatchEvent(new CustomEvent("ns-editor-store-updated", { detail: { source: "site-page-fallback" } }));
        return fallback;
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
  // 1.0.0 final: public site page creation bridge.
  createSitePageDraft(surfaceType) {
    if (window.__nsEditorV1Instance && typeof window.__nsEditorV1Instance.createSitePageDraft === "function") {
      return window.__nsEditorV1Instance.createSitePageDraft(surfaceType || "cabinet");
    }
    return this.createDraftFromTemplate(null, { initialTab: "write" });
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

  // 1.0.0 final: document-level site page button bridge.
  // Keeps site-page creation inside Editor and bypasses older fragile click handlers.
  if (!window.__irgeztneEditorSitePageButtonBridgeFinal) {
    window.__irgeztneEditorSitePageButtonBridgeFinal = true;
    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest
        ? event.target.closest('[data-action="new-site-page"], [data-action="create-site-page"], [data-editor-action="new-site-page"]')
        : null;
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      try {
        // 1.0.0 v6: call real Editor surface method for site-page button
        // This capture listener runs before the Editor root handler, so call the active
        // Editor surface method directly instead of routing through older public APIs.
        const editorApp = window.__nsEditorV1Instance || null;
        const surfaces = editorApp && Array.isArray(editorApp.surfaces) ? editorApp.surfaces : [];
        const surface = surfaces.find((item) => item && item.surfaceType === "cabinet") || surfaces.find(Boolean) || null;
        if (surface && typeof surface.createEditorSitePageDraft === "function") {
          surface.createEditorSitePageDraft();
          return;
        }
        if (surface && typeof surface.createSitePageDraft === "function") {
          surface.createSitePageDraft();
          return;
        }
        if (typeof window.IRGEZTNECreateEditorSitePage === "function") {
          window.IRGEZTNECreateEditorSitePage();
          return;
        }
        if (window.NSEditorV1 && typeof window.NSEditorV1.createSitePageDraft === "function") {
          window.NSEditorV1.createSitePageDraft("cabinet");
          return;
        }
        if (window.NSEditorV1 && typeof window.NSEditorV1.createDraftFromTemplate === "function") {
          window.NSEditorV1.createDraftFromTemplate(null, { initialTab: "write" });
        }
      } catch (error) {
        console.error("[NSEditorV1] Site page button bridge failed:", error);
        try {
          alert("Site page button failed: " + (error && error.message ? error.message : String(error)));
        } catch (_) {}
      }
    }, true);
  }



  // 1.0.0 v4: internal Editor site-page bridge
  // This bridge lives inside v82-editor-v1.js so it can use the real Editor store/API.
  // It fixes the + Site page / + Страница сайта button without relying on an external script load.
  if (!window.__irgeztneEditorSitePageInternalBridgeV4) {
    window.__irgeztneEditorSitePageInternalBridgeV4 = true;

    const SITE_PAGES_STATE_KEY_V4 = "irgeztne.sitePages.v0";

    function readBridgeJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : fallback;
      } catch (error) {
        console.warn("[NSEditorV1] Site page bridge could not read", key, error);
        return fallback;
      }
    }

    function writeBridgeJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value, null, 2));
      } catch (error) {
        console.warn("[NSEditorV1] Site page bridge could not write", key, error);
      }
    }

    function getBridgeSitePagesFallback() {
      const time = nowIso();
      return {
        version: 1,
        activePageId: "page_index",
        createdAt: time,
        updatedAt: time,
        publishConfig: { provider: "manual", outputDir: "output/", status: "foundation-only" },
        pages: [
          { id: "page_index", title: "Home", slug: "index", status: "published", type: "home", menu: true, summary: "Main landing page for this local site.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_about", title: "About", slug: "about", status: "draft", type: "page", menu: true, summary: "Project, team, or product description.", draftId: "", createdAt: time, updatedAt: time },
          { id: "page_contact", title: "Contact", slug: "contact", status: "draft", type: "page", menu: true, summary: "Contact and next action page.", draftId: "", createdAt: time, updatedAt: time }
        ]
      };
    }

    function normalizeBridgePagesState(source) {
      const fallback = getBridgeSitePagesFallback();
      const parsed = source && typeof source === "object" ? source : {};
      return {
        ...fallback,
        ...parsed,
        publishConfig: { ...fallback.publishConfig, ...(parsed.publishConfig || {}) },
        pages: Array.isArray(parsed.pages) && parsed.pages.length ? parsed.pages : fallback.pages
      };
    }

    function getBridgeUiLanguage() {
      try {
        return normalizeLocale(getUiLanguage && getUiLanguage());
      } catch (_) {
        return String(document.documentElement.lang || "ru").startsWith("ru") ? "ru" : "en";
      }
    }

    function makeBridgeUniqueSlug(pages, base) {
      const rootSlug = slugify(base || "site-page") || "site-page";
      const used = new Set((pages || []).map((page) => String(page.slug || "")));
      let slug = rootSlug;
      let index = 2;
      while (used.has(slug)) {
        slug = rootSlug + "-" + index;
        index += 1;
      }
      return slug;
    }

    function makeBridgeUniqueTitle(pages, baseTitle) {
      const used = new Set((pages || []).map((page) => String(page.title || "")));
      if (!used.has(baseTitle)) return baseTitle;
      let index = 2;
      let title = baseTitle + " " + index;
      while (used.has(title)) {
        index += 1;
        title = baseTitle + " " + index;
      }
      return title;
    }

    function isBridgeSitePageButton(button) {
      if (!button || !button.closest || !button.closest(".ns-editor-shell")) return false;
      const action = String(button.dataset.action || button.dataset.editorAction || button.dataset.irzAction || "").toLowerCase();
      if (["new-site-page", "create-site-page", "new-site-page-direct", "site-page-new"].includes(action)) return true;
      const text = String(button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      return Boolean(text && (
        text.includes("страница сайта") ||
        text.includes("site page") ||
        text.includes("новая страница")
      ));
    }

    function createBridgeSitePageDraft() {
      const instance = window.__nsEditorV1Instance;
      const locale = getBridgeUiLanguage();
      const time = nowIso();
      const pagesState = normalizeBridgePagesState(readBridgeJson(SITE_PAGES_STATE_KEY_V4, getBridgeSitePagesFallback()));
      const pages = Array.isArray(pagesState.pages) ? pagesState.pages : [];
      const bridgeIsRu = String(locale || "").startsWith("ru");
      const baseTitle = bridgeIsRu ? "Новая страница сайта" : "New site page";
      const title = makeBridgeUniqueTitle(pages, baseTitle);
      const slug = makeBridgeUniqueSlug(pages, title);
      const summary = bridgeIsRu
        ? "Напишите эту страницу в редакторе. Структура сайта хранит slug, меню и данные экспорта."
        : "Write this page in Editor. Site structure keeps slug, menu and export metadata.";
      const pageId = uid("page");

      let draft = createDraft(this.getSafeSitePageTemplateId(), { locale });
      const visualHtml = [
        '<section class="ns-page-section ns-page-hero ns-page-hero--split">',
        '<div class="ns-page-hero__content">',
        '<div class="ns-page-kicker">' + escapeHtml(bridgeIsRu ? "Страница сайта" : "Site page") + '</div>',
        '<h1>' + escapeHtml(title) + '</h1>',
        '<p>' + escapeHtml(summary) + '</p>',
        '</div>',
        '</section>',
        '<section class="ns-page-section">',
        '<h2>' + escapeHtml(bridgeIsRu ? "Контент" : "Content") + '</h2>',
        '<p>' + escapeHtml(bridgeIsRu ? "Начните писать страницу сайта здесь." : "Start writing this site page here.") + '</p>',
        '</section>'
      ].join("");

      draft = {
        ...draft,
        status: "draft",
        updatedAt: time,
        sitePageId: pageId,
        project: { ...(draft.project || {}), name: title, slug },
        meta: {
          ...(draft.meta || {}),
          title,
          slug,
          category: "website",
          kicker: labels ? labels.kicker : t("Site page", "Страница сайта"),
          summary,
          excerpt: summary,
          seoTitle: title,
          seoDescription: summary,
          tags: Array.from(new Set([...(draft.meta && draft.meta.tags || []), "site-page"].filter(Boolean)))
        },
        write: {
          ...(draft.write || {}),
          visualHtml,
          markdown: "# " + title + "\n\n" + summary + "\n",
          activeWorkspaceTab: "draft",
          activeCabinetTab: "write"
        },
        content: {
          ...(draft.content || {}),
          body: visualHtml
        },
        deploy: {
          ...(draft.deploy || {}),
          manual: { ...((draft.deploy && draft.deploy.manual) || {}), fileName: slug + ".html" }
        }
      };

      let saved = draft;
      if (instance && instance.store && typeof instance.store.saveDraft === "function") {
        saved = instance.store.saveDraft(draft);
      } else {
        const editorState = readBridgeJson(STORAGE_KEY, { version: 2, drafts: [], activeDraftId: null });
        const drafts = Array.isArray(editorState.drafts) ? editorState.drafts : [];
        const nextDrafts = [draft, ...drafts.filter((item) => String(item.id || "") !== String(draft.id || ""))];
        writeBridgeJson(STORAGE_KEY, { ...editorState, version: 2, drafts: nextDrafts, activeDraftId: draft.id });
        saved = draft;
      }

      const page = {
        id: pageId,
        title,
        slug,
        status: "draft",
        type: "page",
        menu: true,
        summary,
        draftId: saved.id,
        createdAt: time,
        updatedAt: time
      };
      const nextPages = [page, ...pages.filter((item) => String(item.id || "") !== pageId)];
      const nextPagesState = {
        ...pagesState,
        pages: nextPages,
        activePageId: pageId,
        updatedAt: nowIso()
      };
      writeBridgeJson(SITE_PAGES_STATE_KEY_V4, nextPagesState);

      if (instance && instance.store) {
        try { instance.store.state = instance.store.read ? instance.store.read() : instance.store.state; } catch (_) {}
      }

      const opened = Boolean(instance && Array.isArray(instance.surfaces) && instance.surfaces.length);
      if (opened) {
        instance.surfaces.forEach((surface) => {
          if (surface && typeof surface.openDraft === "function") {
            surface.openDraft(saved.id, true, false, surface.surfaceType === "cabinet" ? "write" : "draft");
          }
        });
      } else if (window.NSEditorV1 && typeof window.NSEditorV1.openDraftById === "function") {
        window.NSEditorV1.openDraftById(saved.id, null, "write");
      }

      window.dispatchEvent(new CustomEvent("irgeztne:site-pages-updated", { detail: { source: "editor-internal-bridge-v4", state: deepClone(nextPagesState), pageId, draftId: saved.id } }));
      window.dispatchEvent(new CustomEvent("ns-editor-store-updated", { detail: { source: "editor-internal-bridge-v4", draftId: saved.id } }));

      const status = document.querySelector('[data-role="status-badge"]');
      if (status) status.textContent = t("Site page:", "Страница сайта:") + " " + title;
      console.log("[NSEditorV1] Site page created from Editor:", { pageId, draftId: saved.id, title, slug });
      return saved;
    }

    window.IRGEZTNECreateEditorSitePage = createBridgeSitePageDraft;

    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("button, [role='button']") : null;
      if (!isBridgeSitePageButton(button)) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      try {
        createBridgeSitePageDraft();
      } catch (error) {
        console.error("[NSEditorV1] Failed to create site page from Editor:", error);
        alert(t("Could not create site page. Please check the terminal/console.", "Не удалось создать страницу сайта. Проверьте терминал/консоль."));
      }
    }, true);

    console.log("[NSEditorV1] Internal site-page bridge v4 loaded.");
  }

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

