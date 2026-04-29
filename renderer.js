(() => {
  const SOURCES = {
    google: {
      label: "Google",
      placeholder: "Искать через Google или ввести адрес",
      buildSearchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    yandex: {
      label: "Yandex",
      placeholder: "Искать через Yandex или ввести адрес",
      buildSearchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
    },
    duckduckgo: {
      label: "DuckDuckGo",
      placeholder: "Искать через DuckDuckGo или ввести адрес",
      buildSearchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    },
    wikipedia: {
      label: "Wikipedia",
      placeholder: "Искать в Wikipedia или ввести адрес",
      buildSearchUrl: (query) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
    },
    ipfs: {
      label: "IPFS",
      placeholder: "Искать CID, IPNS, путь шлюза или ввести адрес",
      buildSearchUrl: (query) => `https://ipfs.io/ipfs/${encodeURIComponent(query)}`
    },
    ns: {
      label: "NS",
      placeholder: "Искать ENS / NS-адрес или ввести адрес",
      buildSearchUrl: (query) => `https://app.ens.domains/search/${encodeURIComponent(query)}`
    }
  };

  const WORKSPACE_MIN_PERCENT = 26;
  const WORKSPACE_MAX_PERCENT = 68;
  const DEFAULT_WORKSPACE_PERCENT = 38;

  const STORAGE_KEYS = {
    notes: "nsbrowser.v8.notes",
    editor: "nsbrowser.v8.editor",
    translator: "nsbrowser.v8.translator"
  };

  const els = {
    appShell: document.getElementById("appShell"),
    mainLayout: document.getElementById("mainLayout"),
    browserShell: document.getElementById("browserShell"),
    workspaceShell: document.getElementById("workspaceShell"),
    workspaceDivider: document.getElementById("workspaceDivider"),
    workspaceToggle: document.getElementById("workspaceToggle"),
    workspaceCollapseBtn: document.getElementById("workspaceCollapseBtn"),

    backBtn: document.getElementById("backBtn"),
    forwardBtn: document.getElementById("forwardBtn"),
    reloadBtn: document.getElementById("reloadBtn"),
    bookmarkBtn: document.getElementById("bookmarkBtn"),
    addTabBtn: document.getElementById("addTabBtn"),
    hamburgerBtn: document.getElementById("hamburgerBtn"),

    addressInput: document.getElementById("addressInput"),
    addressWrap: document.getElementById("addressWrap"),

    sourceTrigger: document.getElementById("sourceTrigger"),
    sourceTriggerLabel: document.getElementById("sourceTriggerLabel"),
    sourceDropdown: document.getElementById("sourceDropdown"),

    tabsScroll: document.getElementById("tabsScroll"),
    webviewStack: document.getElementById("webviewStack"),

    cabinetOverlay: document.getElementById("cabinetOverlay"),
    cabinetGridView: document.getElementById("cabinetGridView"),
    cabinetExpandedView: document.getElementById("cabinetExpandedView"),
    cabinetCloseBtn: document.getElementById("cabinetCloseBtn"),
    cabinetCloseBtnExpanded: document.getElementById("cabinetCloseBtnExpanded"),
    cabinetBackBtn: document.getElementById("cabinetBackBtn"),
    cabinetExpandedTitle: document.getElementById("cabinetExpandedTitle"),
    cabinetExpandedSubtitle: document.getElementById("cabinetExpandedSubtitle"),

    workspaceShellNav: document.getElementById("workspaceShellNav"),
    workspaceShellBody: document.getElementById("workspaceShellBody"),
    workspaceNotesCombined: document.getElementById("workspaceNotesCombined")
  };

  const state = {
    currentSource: "google",
    tabs: [],
    activeTabId: null,
    tabCounter: 0,

    workspaceEnabled: false,
    workspaceMode: "normal",
    workspaceWidthPercent: DEFAULT_WORKSPACE_PERCENT,
    isResizingWorkspace: false,

    isCabinetOpen: false,
    cabinetMode: "grid",
    activeCabinetSection: "video",
    activeWorkspaceSection: "workspace",

    notesValue: "",
    editorValue: ""
  };

  const filesStore = [];
  const filesModules = [];
  const libraryObjectUrls = new Map();

  const KNOWN_WORKSPACE_SECTIONS = new Set([
    "workspace",
    "video",
    "chat",
    "files",
    "projects",
    "notes",
    "tools",
    "editor",
    "marketplace",
    "wallet",
    "analytics",
    "codehub"
  ]);

  const KNOWN_CABINET_SECTIONS = new Set([
    "video",
    "chat",
    "files",
    "projects",
    "notes",
    "tools",
    "editor",
    "codehub",
    "workspace",
    "marketplace",
    "wallet",
    "analytics"
  ]);

  function getClipboardBridge() {
    try {
      if (typeof window !== "undefined" && window.nsAPI && typeof window.nsAPI === "object") {
        return window.nsAPI;
      }
    } catch (error) {
      console.warn("Clipboard bridge lookup failed:", error);
    }
    return null;
  }


  function bindIfExists(el, eventName, handler, label) {
    if (!el) {
      console.warn(`[renderer] missing element: ${label}`);
      return false;
    }

    el.addEventListener(eventName, handler);
    return true;
  }

  function containsSafe(el, target) {
    return Boolean(el && target && el.contains(target));
  }

  function init() {
    restoreSavedState();
    registerWorkspaceShellApi();
    bindCoreEvents();
    bindSourceDropdown();
    bindWorkspaceNav();
    bindWorkspaceDivider();
    bindCabinetEvents();
    bindSharedEditors();
    initTranslatorTools();
    bindWorkspaceEditorLauncher();
    initHomeDashboard();
    initFilesModules();
    bindProjectsBridge();
    bindNotesBridge();
    bindLibraryBridge();

    createTab({
      title: "New Tab",
      url: "https://www.google.com"
    });

    updateSourceUI();
    updateWorkspaceUI();
    setWorkspaceSection(state.activeWorkspaceSection);
    syncInputWithActiveTab();
  }

  function restoreSavedState() {
    try {
      state.notesValue = localStorage.getItem(STORAGE_KEYS.notes) || "";
      state.editorValue = localStorage.getItem(STORAGE_KEYS.editor) || "";
    } catch (error) {
      console.warn("Failed to restore local state:", error);
    }
  }

  function isTextEditableTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName ? target.tagName.toLowerCase() : "";
    if (tag === "textarea") return true;
    if (tag === "input") {
      const type = String(target.getAttribute("type") || "text").toLowerCase();
      return !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset"].includes(type);
    }
    return Boolean(target.isContentEditable || target.closest('[contenteditable="true"]'));
  }

  function getSelectedTextFromTarget(target) {
    if (target && target instanceof HTMLTextAreaElement) {
      const start = Number(target.selectionStart || 0);
      const end = Number(target.selectionEnd || 0);
      return start !== end ? target.value.slice(start, end) : "";
    }

    if (target && target instanceof HTMLInputElement) {
      const start = Number(target.selectionStart || 0);
      const end = Number(target.selectionEnd || 0);
      return start !== end ? target.value.slice(start, end) : "";
    }

    const selection = window.getSelection ? window.getSelection() : null;
    return selection ? String(selection.toString() || "") : "";
  }

  async function writeClipboardText(text) {
    if (!text) return false;

    const bridge = getClipboardBridge();
    if (bridge && typeof bridge.writeClipboardText === "function") {
      try {
        await bridge.writeClipboardText(String(text));
        return true;
      } catch (error) {
        console.warn("Clipboard bridge write failed:", error);
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(String(text));
        return true;
      } catch (error) {
        console.warn("Navigator clipboard write failed:", error);
      }
    }

    return false;
  }

  async function readClipboardText() {
    const bridge = getClipboardBridge();
    if (bridge && typeof bridge.readClipboardText === "function") {
      try {
        return String((await bridge.readClipboardText()) || "");
      } catch (error) {
        console.warn("Clipboard bridge read failed:", error);
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
      try {
        return String((await navigator.clipboard.readText()) || "");
      } catch (error) {
        console.warn("Navigator clipboard read failed:", error);
      }
    }

    return "";
  }

  function replaceSelectionInField(field, text) {
    const start = Number(field.selectionStart || 0);
    const end = Number(field.selectionEnd || 0);
    const value = String(field.value || "");
    const next = value.slice(0, start) + text + value.slice(end);
    field.value = next;
    const caret = start + text.length;
    field.setSelectionRange(caret, caret);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function handleClipboardShortcut(event) {
    const isMod = event.ctrlKey || event.metaKey;
    if (!isMod || event.altKey) return false;

    const key = String(event.key || "").toLowerCase();
    const target = event.target;
    const editable = isTextEditableTarget(target);

    if (key === "c") {
      const text = getSelectedTextFromTarget(target);
      if (!text) return false;
      event.preventDefault();
      await writeClipboardText(text);
      return true;
    }

    if (key === "x") {
      if (!editable) return false;
      const text = getSelectedTextFromTarget(target);
      if (!text) return false;
      event.preventDefault();
      await writeClipboardText(text);

      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
        replaceSelectionInField(target, "");
      } else if (document.execCommand) {
        document.execCommand("delete");
      }
      return true;
    }

    if (key === "v") {
      if (!editable) return false;
      event.preventDefault();
      const text = await readClipboardText();
      if (!text) return true;

      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
        replaceSelectionInField(target, text);
      } else if (document.execCommand) {
        document.execCommand("insertText", false, text);
      }
      return true;
    }

    if (key === "a") {
      const selection = window.getSelection ? window.getSelection() : null;

      if (editable && (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) {
        event.preventDefault();
        target.select();
        return true;
      }

      const scope = target && target.closest ? target.closest('.native-file-viewer, .ns-library-preview, [data-notes-root], [data-projects-root], .workspace-panel') : null;
      if (scope && selection) {
        event.preventDefault();
        const range = document.createRange();
        range.selectNodeContents(scope);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
    }

    return false;
  }

  function bindCoreEvents() {
    bindIfExists(
      els.addressInput,
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          navigateFromInput();
        }
      },
      "addressInput"
    );

    bindIfExists(
      els.addTabBtn,
      "click",
      () => {
        createTab({
          title: "New Tab",
          url: "https://www.google.com"
        });
      },
      "addTabBtn"
    );

    bindIfExists(
      els.backBtn,
      "click",
      () => {
        const webview = getActiveWebview();
        if (!webview) return;

        try {
          if (typeof webview.canGoBack === "function" && webview.canGoBack()) {
            webview.goBack();
          }
        } catch (error) {
          console.warn("Back failed:", error);
        }
      },
      "backBtn"
    );

    bindIfExists(
      els.forwardBtn,
      "click",
      () => {
        const webview = getActiveWebview();
        if (!webview) return;

        try {
          if (typeof webview.canGoForward === "function" && webview.canGoForward()) {
            webview.goForward();
          }
        } catch (error) {
          console.warn("Forward failed:", error);
        }
      },
      "forwardBtn"
    );

    bindIfExists(
      els.reloadBtn,
      "click",
      () => {
        const webview = getActiveWebview();
        if (!webview) return;

        try {
          if (typeof webview.reload === "function") {
            webview.reload();
          }
        } catch (error) {
          console.warn("Reload failed:", error);
        }
      },
      "reloadBtn"
    );

    bindIfExists(
      els.bookmarkBtn,
      "click",
      () => {
        els.bookmarkBtn.classList.toggle("active");
      },
      "bookmarkBtn"
    );

    bindIfExists(
      els.workspaceToggle,
      "click",
      toggleWorkspaceMain,
      "workspaceToggle"
    );

    bindIfExists(
      els.workspaceCollapseBtn,
      "click",
      () => {
        setWorkspaceEnabled(false);
        setWorkspaceMode("normal");
      },
      "workspaceCollapseBtn"
    );

    bindIfExists(
      els.hamburgerBtn,
      "click",
      () => {
        if (state.isCabinetOpen) {
          closeCabinet();
        } else {
          openCabinet();
        }
      },
      "hamburgerBtn"
    );

    document.addEventListener("keydown", async (event) => {
      if (await handleClipboardShortcut(event)) {
        return;
      }

      if (event.key === "Escape") {
        handleEscape();
      }

      if (els.workspaceDivider && event.target === els.workspaceDivider) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          adjustWorkspaceWidth(-2);
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          adjustWorkspaceWidth(2);
        }
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;

      const clickedInsideSource = containsSafe(els.addressWrap, target);
      const clickedSourceButton = containsSafe(els.sourceTrigger, target);
      const clickedDropdown = containsSafe(els.sourceDropdown, target);

      if (!clickedInsideSource || (!clickedSourceButton && !clickedDropdown)) {
        closeSourceDropdown();
      }
    });

    window.addEventListener("resize", () => {
      clampWorkspaceWidth();
      applyWorkspaceWidth();
    });
  }



  function initTranslatorTools() {
    const roots = Array.from(document.querySelectorAll("[data-translate-tool-root]"));
    if (!roots.length) return;

    const saved = loadTranslatorPrefs();

    roots.forEach((root) => {
      const providerSelect = root.querySelector("[data-translate-provider]");
      const fromSelect = root.querySelector("[data-translate-from]");
      const toSelect = root.querySelector("[data-translate-to]");
      const input = root.querySelector("[data-translate-input]");
      const result = root.querySelector("[data-translate-result]");
      const status = root.querySelector("[data-translate-status]");
      const useSelectionBtn = root.querySelector("[data-translate-use-selection]");
      const pasteBtn = root.querySelector("[data-translate-paste]");
      const copyBtn = root.querySelector("[data-translate-copy]");
      const copyResultBtn = root.querySelector("[data-translate-copy-result]");
      const swapBtn = root.querySelector("[data-translate-swap]");
      const clearBtn = root.querySelector("[data-translate-clear]");
      const runBtn = root.querySelector("[data-translate-run]");
      const openBtn = root.querySelector("[data-translate-open]");

      if (providerSelect) providerSelect.value = saved.provider || "google";
      if (fromSelect) fromSelect.value = saved.from || "auto";
      if (toSelect) toSelect.value = saved.to || "ru";

      const persistPrefs = () => {
        saveTranslatorPrefs({
          provider: providerSelect ? providerSelect.value : "google",
          from: fromSelect ? fromSelect.value : "auto",
          to: toSelect ? toSelect.value : "ru"
        });
      };

      [providerSelect, fromSelect, toSelect].forEach((el) => {
        if (!el) return;
        el.addEventListener("change", persistPrefs);
      });

      if (useSelectionBtn) {
        useSelectionBtn.addEventListener("click", async () => {
          const text = (await getBestTranslatorInputText()).trim();
          if (!text) {
            setTranslatorStatus(status, "Nothing selected yet. Select text or copy it first.");
            return;
          }
          if (input) input.value = text;
          setTranslatorStatus(status, "Выделение захвачено. Можно переводить здесь.");
        });
      }

      if (pasteBtn) {
        pasteBtn.addEventListener("click", async () => {
          const text = String(await readClipboardText() || "").trim();
          if (!text) {
            setTranslatorStatus(status, "Clipboard is empty.");
            return;
          }
          if (input) input.value = text;
          setTranslatorStatus(status, "Clipboard pasted into Translator.");
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const text = input ? String(input.value || "").trim() : "";
          if (!text) {
            setTranslatorStatus(status, "Nothing to copy.");
            return;
          }
          const ok = await writeClipboardText(text);
          setTranslatorStatus(status, ok ? "Исходный текст скопирован." : "Копирование не удалось.");
        });
      }

      if (copyResultBtn) {
        copyResultBtn.addEventListener("click", async () => {
          const text = result ? String(result.value || "").trim() : "";
          if (!text) {
            setTranslatorStatus(status, "Nothing translated yet.");
            return;
          }
          const ok = await writeClipboardText(text);
          setTranslatorStatus(status, ok ? "Перевод скопирован." : "Копирование не удалось.");
        });
      }

      if (swapBtn) {
        swapBtn.addEventListener("click", () => {
          if (!fromSelect || !toSelect) return;
          const fromValue = fromSelect.value || "auto";
          const toValue = toSelect.value || "ru";
          fromSelect.value = toValue;
          toSelect.value = fromValue === "auto" ? "en" : fromValue;
          persistPrefs();
          setTranslatorStatus(status, "Languages swapped.");
        });
      }

      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          if (input) input.value = "";
          if (result) result.value = "";
          setTranslatorStatus(status, "Translator cleared.");
        });
      }

      if (runBtn) {
        runBtn.addEventListener("click", async () => {
          const text = input ? String(input.value || "").trim() : "";
          if (!text) {
            setTranslatorStatus(status, "Add text before translating.");
            return;
          }

          const provider = providerSelect ? providerSelect.value : "google";
          const from = fromSelect ? fromSelect.value : "auto";
          const to = toSelect ? toSelect.value : "ru";

          if (provider !== "google") {
            setTranslatorStatus(status, "Встроенный перевод сейчас готов для Google. Для Yandex используйте «Открыть переводчик».");
            return;
          }

          if (result) result.value = "Translating...";
          setTranslatorStatus(status, "Requesting translation...");

          try {
            const translated = await translateInlineGoogle(from, to, text);
            if (result) result.value = translated || "";
            setTranslatorStatus(status, translated ? "Переведено в текущей панели." : "Перевод не был получен.");
          } catch (error) {
            console.warn("Inline translation failed:", error);
            if (result) result.value = "";
            setTranslatorStatus(status, "Встроенный перевод не удался. Используйте «Открыть переводчик» как запасной вариант.");
          }
        });
      }

      if (openBtn) {
        openBtn.addEventListener("click", () => {
          const text = input ? String(input.value || "").trim() : "";
          if (!text) {
            setTranslatorStatus(status, "Add text before opening Translate.");
            return;
          }

          const provider = providerSelect ? providerSelect.value : "google";
          const from = fromSelect ? fromSelect.value : "auto";
          const to = toSelect ? toSelect.value : "ru";
          const url = buildTranslatorUrl(provider, from, to, text);
          createTab({ title: makeTranslatorTabTitle(provider, to), url });
          setTranslatorStatus(status, "Translation opened in a new tab.");
        });
      }
    });
  }

  function loadTranslatorPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.translator);
      if (!raw) return { provider: "google", from: "auto", to: "ru" };
      const parsed = JSON.parse(raw);
      return {
        provider: parsed && parsed.provider ? String(parsed.provider) : "google",
        from: parsed && parsed.from ? String(parsed.from) : "auto",
        to: parsed && parsed.to ? String(parsed.to) : "ru"
      };
    } catch (error) {
      console.warn("Failed to load translator prefs:", error);
      return { provider: "google", from: "auto", to: "ru" };
    }
  }

  function saveTranslatorPrefs(value) {
    try {
      localStorage.setItem(STORAGE_KEYS.translator, JSON.stringify(value || {}));
    } catch (error) {
      console.warn("Failed to save translator prefs:", error);
    }
  }

  function setTranslatorStatus(node, message) {
    if (node) node.textContent = message;
  }

  function makeTranslatorTabTitle(provider, to) {
    const providerLabel = provider === "yandex" ? "Yandex" : "Google";
    return `${providerLabel} Translate → ${String(to || "ru").toUpperCase()}`;
  }

  function buildTranslatorUrl(provider, from, to, text) {
    const source = encodeURIComponent(text || "");
    const safeFrom = from || "auto";
    const safeTo = to || "ru";
    if (provider === "yandex") {
      return `https://translate.yandex.com/?source_lang=${encodeURIComponent(safeFrom)}&target_lang=${encodeURIComponent(safeTo)}&text=${source}`;
    }
    return `https://translate.google.com/?sl=${encodeURIComponent(safeFrom)}&tl=${encodeURIComponent(safeTo)}&text=${source}&op=translate`;
  }

  async function getBestTranslatorInputText() {
    const selectionText = String(getSelectedTextFromTarget(document.activeElement) || "").trim();
    if (selectionText) return selectionText;
    return String(await readClipboardText() || "").trim();
  }

  async function translateInlineGoogle(from, to, text) {
    const params = new URLSearchParams();
    params.set("client", "gtx");
    params.set("sl", from || "auto");
    params.set("tl", to || "ru");
    params.set("dt", "t");
    params.set("q", text || "");

    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Google translate request failed: ${response.status}`);
    }

    const data = await response.json();
    return parseGoogleTranslatePayload(data);
  }

  function parseGoogleTranslatePayload(payload) {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return "";
    return payload[0].map((part) => Array.isArray(part) ? String(part[0] || "") : "").join("");
  }
  function bindSourceDropdown() {
    if (!els.sourceTrigger || !els.sourceDropdown) return;

    els.sourceTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const isHidden = els.sourceDropdown.classList.contains("hidden");

      if (isHidden) {
        openSourceDropdown();
      } else {
        closeSourceDropdown();
      }
    });

    els.sourceDropdown.querySelectorAll(".source-option").forEach((button) => {
      button.addEventListener("click", () => {
        const sourceKey = button.dataset.source;
        if (!SOURCES[sourceKey]) return;

        state.currentSource = sourceKey;
        updateSourceUI();
        closeSourceDropdown();
      });
    });
  }

  function bindWorkspaceNav() {
    if (!els.workspaceShellNav) return;

    els.workspaceShellNav.querySelectorAll(".workspace-nav-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.section;
        openWorkspaceSection(section, { enable: true, mode: state.workspaceMode === "focus" ? "focus" : "split" });
      });
    });
  }

  function bindWorkspaceDivider() {
    if (!els.workspaceDivider) return;

    const onPointerMove = (event) => {
      if (!state.isResizingWorkspace || state.workspaceMode !== "split") return;
      resizeWorkspaceFromPointer(event.clientX);
    };

    const stopResize = () => {
      if (!state.isResizingWorkspace) return;

      state.isResizingWorkspace = false;
      els.workspaceDivider.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    els.workspaceDivider.addEventListener("mousedown", (event) => {
      if (state.workspaceMode !== "split") return;

      event.preventDefault();
      state.isResizingWorkspace = true;
      els.workspaceDivider.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    });

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", stopResize);
    window.addEventListener("mouseleave", stopResize);
  }

  function bindCabinetEvents() {
    bindIfExists(els.cabinetCloseBtn, "click", closeCabinet, "cabinetCloseBtn");
    bindIfExists(els.cabinetCloseBtnExpanded, "click", closeCabinet, "cabinetCloseBtnExpanded");
    bindIfExists(els.cabinetBackBtn, "click", showCabinetGrid, "cabinetBackBtn");

    document.querySelectorAll("[data-open-section]").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.openSection;
        openCabinetSection(section);
      });
    });

    document.querySelectorAll(".cabinet-inner-nav-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const section = button.dataset.section;
        openCabinetSection(section);
      });
    });

    if (els.cabinetOverlay) {
      els.cabinetOverlay.addEventListener("click", (event) => {
        if (event.target === els.cabinetOverlay) {
          closeCabinet();
        }
      });
    }
  }

  function bindSharedEditors() {
    if (!els.workspaceNotesCombined) return;

    els.workspaceNotesCombined.value = state.notesValue;
    els.workspaceNotesCombined.addEventListener("input", (event) => {
      state.notesValue = event.target.value;
      saveLocalValue(STORAGE_KEYS.notes, state.notesValue);
    });
  }

  function bindWorkspaceEditorLauncher() {
    document.querySelectorAll("[data-workspace-editor-open]").forEach((button) => {
      if (button.dataset.boundWorkspaceEditor === "true") return;
      button.dataset.boundWorkspaceEditor = "true";

      button.addEventListener("click", () => {
        const section = String(button.dataset.workspaceEditorOpen || "").trim();
        if (!section) return;
        openWorkspaceSection(section, { enable: true, mode: state.workspaceMode === "focus" ? "focus" : "split" });
      });
    });

    document.querySelectorAll("[data-workspace-editor-open-cabinet]").forEach((button) => {
      if (button.dataset.boundWorkspaceEditorCabinet === "true") return;
      button.dataset.boundWorkspaceEditorCabinet = "true";

      button.addEventListener("click", () => {
        const section = String(button.dataset.workspaceEditorOpenCabinet || "").trim() || "editor";
        openCabinetSection(section);
      });
    });
  }

  function initFilesModules() {
    document.querySelectorAll("[data-files-module]").forEach((moduleEl) => {
      const uploadBtn = moduleEl.querySelector("[data-files-upload]");
      const inputEl = moduleEl.querySelector("[data-files-input]");
      const listEl = moduleEl.querySelector("[data-files-list]");
      const previewEl = moduleEl.querySelector("[data-files-preview]");

      if (!uploadBtn || !inputEl || !listEl || !previewEl) return;

      const module = {
        root: moduleEl,
        uploadBtn,
        inputEl,
        listEl,
        previewEl
      };

      uploadBtn.addEventListener("click", () => {
        inputEl.click();
      });

      inputEl.addEventListener("change", (event) => {
        const pickedFiles = Array.from(event.target.files || []);
        addFilesToStore(pickedFiles);
        inputEl.value = "";
      });

      moduleEl.addEventListener("dragenter", (event) => {
        event.preventDefault();
        moduleEl.classList.add("drag-over");
      });

      moduleEl.addEventListener("dragover", (event) => {
        event.preventDefault();
        moduleEl.classList.add("drag-over");
      });

      moduleEl.addEventListener("dragleave", (event) => {
        event.preventDefault();

        const nextTarget = event.relatedTarget;
        if (!nextTarget || !moduleEl.contains(nextTarget)) {
          moduleEl.classList.remove("drag-over");
        }
      });

      moduleEl.addEventListener("drop", (event) => {
        event.preventDefault();
        moduleEl.classList.remove("drag-over");

        const droppedFiles = Array.from(event.dataTransfer?.files || []);
        addFilesToStore(droppedFiles);
      });

      filesModules.push(module);
    });

    renderAllFilesModules();
  }

  function addFilesToStore(fileList) {
    if (!Array.isArray(fileList) || fileList.length === 0) return;

    fileList.forEach((file) => {
      const duplicate = filesStore.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified
      );

      if (!duplicate) {
        filesStore.push(file);
      }
    });

    renderAllFilesModules();
  }

  function renderAllFilesModules() {
    filesModules.forEach((module) => {
      renderFilesListIntoModule(module);
    });
  }

  function renderFilesListIntoModule(module) {
    const { listEl, previewEl } = module;

    listEl.innerHTML = "";

    if (filesStore.length === 0) {
      listEl.innerHTML = `<div class="files-empty">Файлов пока нет</div>`;
      previewEl.innerHTML = `<div class="files-preview-empty">Выберите файл для предпросмотра</div>`;
      delete previewEl.dataset.hasPreview;
      return;
    }

    filesStore.forEach((file, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "files-item";
      item.innerHTML = `
        <div class="files-item-name">${escapeHtml(file.name)}</div>
        <div class="files-item-meta">${formatFileSize(file.size)}</div>
      `;

      item.addEventListener("click", () => {
        showFilePreview(module, index);
      });

      listEl.appendChild(item);
    });

    if (!previewEl.dataset.hasPreview) {
      previewEl.innerHTML = `<div class="files-preview-empty">Выберите файл для предпросмотра</div>`;
    }
  }

  function showFilePreview(module, index) {
    const file = filesStore[index];
    if (!file) return;

    const { previewEl } = module;
    previewEl.dataset.hasPreview = "true";

    previewEl.innerHTML = `
      <div class="files-preview-card">
        <h4>${escapeHtml(file.name)}</h4>
        <p><strong>Type:</strong> ${escapeHtml(file.type || "unknown")}</p>
        <p><strong>Size:</strong> ${formatFileSize(file.size)}</p>
        <p><strong>Modified:</strong> ${new Date(file.lastModified).toLocaleString()}</p>
      </div>
    `;

    if (file.type && file.type.startsWith("text/")) {
      const reader = new FileReader();

      reader.onload = () => {
        previewEl.innerHTML += `
          <div class="files-preview-text">${escapeHtml(String(reader.result).slice(0, 5000))}</div>
        `;
      };

      reader.readAsText(file);
      return;
    }

    if (file.type && file.type.startsWith("image/")) {
      const reader = new FileReader();

      reader.onload = () => {
        previewEl.innerHTML += `
          <div class="files-preview-image-wrap">
            <img class="files-preview-image" src="${reader.result}" alt="${escapeHtml(file.name)}" />
          </div>
        `;
      };

      reader.readAsDataURL(file);
    }
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function isDataLikeUrl(value) {
    return typeof value === "string" && /^data:/i.test(value);
  }

  function getTabDisplayUrl(tab) {
    if (!tab) return "";
    return tab.displayUrl || tab.url || "";
  }

  function makeLibraryDisplayUrl(item) {
    const rawName = item && (item.originalName || item.name || item.id) ? String(item.originalName || item.name || item.id) : "file";
    return `ns://library/${encodeURIComponent(rawName)}`;
  }

  function getLibraryItemKey(item) {
    if (!item) return "";
    if (item.fingerprint) return `fp:${String(item.fingerprint)}`;
    const displayUrl = makeLibraryDisplayUrl(item);
    if (displayUrl) return `name:${displayUrl}`;
    if (item.id) return `id:${String(item.id)}`;
    return "";
  }

  function findLibraryTabByKey(input) {
    const key = typeof input === "string" ? input : getLibraryItemKey(input);
    if (!key) return null;

    return (
      state.tabs.find((tab) => {
        return tab && tab.sourceType === "library" && tab.libraryKey === key;
      }) || null
    );
  }

  function findLibraryTabByFileId(fileId) {
    if (!fileId || !window.NSLibraryStore || typeof window.NSLibraryStore.getItemById !== "function") {
      return null;
    }

    const item = window.NSLibraryStore.getItemById(fileId);
    return item ? findLibraryTabByKey(item) : null;
  }

  function normalizeTabMatchValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function findExistingTabMatch({ url = "", displayUrl = "", fileId = null, sourceType = "web", libraryKey = "", title = "" } = {}) {
    const safeSourceType = sourceType || "web";
    const safeUrl = normalizeTabMatchValue(url);
    const safeDisplayUrl = normalizeTabMatchValue(displayUrl);
    const safeFileId = fileId ? String(fileId) : "";
    const safeLibraryKey = normalizeTabMatchValue(libraryKey);
    const safeTitle = normalizeTabMatchValue(title);

    return (
      state.tabs.find((tab) => {
        if (!tab) return false;

        const tabUrl = normalizeTabMatchValue(tab.url);
        const tabDisplayUrl = normalizeTabMatchValue(tab.displayUrl);
        const tabFileId = tab.fileId ? String(tab.fileId) : "";
        const tabLibraryKey = normalizeTabMatchValue(tab.libraryKey);
        const tabTitle = normalizeTabMatchValue(tab.title);

        if (safeSourceType === "library") {
          if (safeLibraryKey && tabLibraryKey === safeLibraryKey) return true;
          if (safeFileId && tabFileId === safeFileId) return true;
          if (safeDisplayUrl && tabDisplayUrl === safeDisplayUrl) return true;
          if (safeUrl && tabUrl === safeUrl) return true;
          if (safeTitle && tabTitle === safeTitle && tab.sourceType === "library") return true;
          return false;
        }

        return Boolean(safeUrl && tabUrl === safeUrl && (tab.sourceType || "web") === safeSourceType);
      }) || null
    );
  }

  function clearTabCustomLocation(tab) {
    if (!tab) return;
    tab.displayUrl = "";
    tab.fileId = null;
    tab.sourceType = "web";
  }


  function isElectronRuntime() {
    try {
      return Boolean(window && window.process && window.process.versions && window.process.versions.electron);
    } catch (error) {
      return false;
    }
  }

  function getLibraryItemForTab(tab) {
    if (!tab || tab.sourceType !== "library" || !tab.fileId) return null;
    if (!window.NSLibraryStore || typeof window.NSLibraryStore.getItemById !== "function") return null;
    return window.NSLibraryStore.getItemById(tab.fileId);
  }

  function cleanupPaneResources(pane) {
    if (!pane || !Array.isArray(pane._cleanupFns)) return;
    pane._cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn("Pane cleanup failed:", error);
      }
    });
    pane._cleanupFns = [];
  }

  function registerPaneCleanup(pane, fn) {
    if (!pane || typeof fn !== "function") return;
    if (!Array.isArray(pane._cleanupFns)) {
      pane._cleanupFns = [];
    }
    pane._cleanupFns.push(fn);
  }

  function dataUrlToBlob(dataUrl) {
    if (!isDataLikeUrl(dataUrl)) return null;

    try {
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex === -1) return null;

      const header = dataUrl.slice(0, commaIndex);
      const payload = dataUrl.slice(commaIndex + 1);
      const mimeMatch = header.match(/^data:([^;]+)(;base64)?/i);
      const mimeType = mimeMatch && mimeMatch[1] ? mimeMatch[1] : "application/octet-stream";
      const isBase64 = /;base64/i.test(header);

      if (isBase64) {
        const binary = atob(payload);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: mimeType });
      }

      return new Blob([decodeURIComponent(payload)], { type: mimeType });
    } catch (error) {
      console.warn("Failed to convert data URL to Blob:", error);
      return null;
    }
  }


  function getDataUrlMimeType(dataUrl) {
    if (!isDataLikeUrl(dataUrl)) return "";

    try {
      const commaIndex = dataUrl.indexOf(",");
      const header = commaIndex === -1 ? dataUrl : dataUrl.slice(0, commaIndex);
      const mimeMatch = header.match(/^data:([^;]+)/i);
      return mimeMatch && mimeMatch[1] ? String(mimeMatch[1]).toLowerCase() : "";
    } catch (error) {
      return "";
    }
  }

  function decodeDataUrlText(dataUrl) {
    if (!isDataLikeUrl(dataUrl)) return "";

    try {
      const commaIndex = dataUrl.indexOf(",");
      if (commaIndex === -1) return "";

      const header = dataUrl.slice(0, commaIndex);
      const payload = dataUrl.slice(commaIndex + 1);
      const isBase64 = /;base64/i.test(header);

      if (isBase64) {
        return decodeURIComponent(escape(atob(payload)));
      }

      return decodeURIComponent(payload);
    } catch (error) {
      console.warn("Failed to decode data URL text:", error);
      return "";
    }
  }

  function getLibraryItemExtension(item) {
    if (!item) return "";
    const ext = typeof item.ext === "string" ? item.ext.trim().toLowerCase() : "";
    if (ext) return ext;

    const name = typeof item.name === "string" ? item.name : typeof item.originalName === "string" ? item.originalName : "";
    const dotIndex = name.lastIndexOf(".");
    return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
  }

  function getTextContentForLibraryItem(item) {
    if (!item) return "";

    const previewText = item.preview && typeof item.preview.textContent === "string" ? item.preview.textContent : "";
    if (previewText) return previewText;

    const excerptText = item.preview && typeof item.preview.excerpt === "string" ? item.preview.excerpt : "";
    if (excerptText) return excerptText;

    const dataUrl = item.storage && typeof item.storage.dataUrl === "string" ? item.storage.dataUrl : "";
    return decodeDataUrlText(dataUrl);
  }

  function isProbablyTextLibraryItem(item) {
    if (!item) return false;

    const previewKind = item.preview && typeof item.preview.kind === "string" ? item.preview.kind.toLowerCase() : "";
    if (previewKind === "text") return true;

    const textType = item.preview && typeof item.preview.textType === "string" ? item.preview.textType.toLowerCase() : "";
    if (textType) return true;

    const mimeType = typeof item.type === "string" ? item.type.toLowerCase() : "";
    const dataMimeType = getDataUrlMimeType(item.storage && item.storage.dataUrl ? item.storage.dataUrl : "");
    const effectiveMimeType = mimeType || dataMimeType;

    if (effectiveMimeType.startsWith("text/")) return true;

    if ([
      "application/json",
      "application/ld+json",
      "application/javascript",
      "application/xml",
      "application/xhtml+xml",
      "application/rdf+xml",
      "application/owl+xml",
      "application/n-triples",
      "application/n-quads",
      "application/trig",
      "application/trix"
    ].includes(effectiveMimeType)) {
      return true;
    }

    const ext = getLibraryItemExtension(item);
    return [
      "txt", "md", "markdown", "json", "jsonld", "js", "mjs", "cjs", "ts", "jsx", "tsx",
      "css", "html", "htm", "xml", "svg", "rdf", "ttl", "n3", "nt", "nq", "trig", "owl",
      "csv", "yml", "yaml", "log"
    ].includes(ext);
  }

  function getLibraryObjectUrl(tab, item) {
    if (!tab || !item || !item.storage || !item.storage.dataUrl) return "";

    const key = item.id || tab.fileId || tab.id;
    const existing = libraryObjectUrls.get(key);
    if (existing) return existing;

    const blob = dataUrlToBlob(item.storage.dataUrl);
    if (!blob) return "";

    const objectUrl = URL.createObjectURL(blob);
    libraryObjectUrls.set(key, objectUrl);
    return objectUrl;
  }

  function revokeLibraryObjectUrlForTab(tab) {
    if (!tab) return;
    const key = tab.fileId || tab.id;
    const objectUrl = libraryObjectUrls.get(key);
    if (!objectUrl) return;

    try {
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.warn("Failed to revoke object URL:", error);
    }

    libraryObjectUrls.delete(key);
  }

  function shouldUseNativeViewer(tab) {
    if (!tab) return false;

    // Library files should use the native in-app viewer in both browser mode
    // and Electron. Webview is still kept for real web pages/tabs.
    if (tab.sourceType === "library") return true;

    if (isElectronRuntime()) return false;
    return isDataLikeUrl(tab.url);
  }

  function createNativeViewerPane(tab, pane) {
    const wrapper = document.createElement("div");
    wrapper.className = "native-file-viewer";
    wrapper.style.cssText = [
      "position:absolute",
      "inset:0",
      "display:flex",
      "flex-direction:column",
      "gap:12px",
      "padding:16px",
      "overflow:auto",
      "background:linear-gradient(180deg, rgba(9,18,35,0.96), rgba(6,13,24,0.98))",
      "color:#eaf2ff",
      "user-select:text"
    ].join(";");

    const item = getLibraryItemForTab(tab);
    const title = document.createElement("div");
    title.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;";
    title.innerHTML = `
      <div>
        <div style="font-size:20px;font-weight:700;line-height:1.15;">${escapeHtml(tab.title || "File")}</div>
        <div style="font-size:12px;color:#b6cae8;line-height:1.35;word-break:break-all;">${escapeHtml(getTabDisplayUrl(tab) || tab.url || "")}</div>
      </div>
    `;
    wrapper.appendChild(title);

    const stage = document.createElement("div");
    stage.style.cssText = [
      "flex:1 1 auto",
      "min-height:0",
      "border-radius:16px",
      "border:1px solid rgba(120,180,255,0.18)",
      "background:rgba(10,20,39,0.7)",
      "overflow:auto",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:16px"
    ].join(";");
    wrapper.appendChild(stage);

    const actionRow = document.createElement("div");
    actionRow.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:center;";

    function makeActionButton(label, onClick) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.style.cssText = [
        "padding:10px 14px",
        "border-radius:12px",
        "border:1px solid rgba(120,180,255,0.18)",
        "background:linear-gradient(180deg, rgba(27, 50, 93, 0.96), rgba(17, 34, 66, 0.96))",
        "color:#eaf2ff",
        "cursor:pointer"
      ].join(";");
      button.addEventListener("click", onClick);
      return button;
    }

    function appendDownloadButtons(targetUrl, downloadName) {
      if (!targetUrl) return;

      actionRow.appendChild(
        makeActionButton("Открыть оригинал", () => {
          try {
            window.open(targetUrl, "_blank", "noopener,noreferrer");
          } catch (error) {
            console.warn("Failed to open raw file:", error);
          }
        })
      );

      actionRow.appendChild(
        makeActionButton("Download", () => {
          const link = document.createElement("a");
          link.href = targetUrl;
          if (downloadName) {
            link.download = downloadName;
          }
          document.body.appendChild(link);
          link.click();
          link.remove();
        })
      );
    }

    if (item && item.preview && item.preview.kind === "image" && item.storage && item.storage.dataUrl) {
      const img = document.createElement("img");
      img.alt = item.name || tab.title || "image";
      img.src = item.storage.dataUrl;
      img.style.cssText = "max-width:100%;max-height:100%;display:block;object-fit:contain;border-radius:12px;background:#0b1730;";
      img.addEventListener("error", () => {
        stage.innerHTML = `<div style="max-width:720px;color:#b6cae8;line-height:1.5;user-select:text;">Image could not be rendered in browser mode for this file.</div>`;
      });
      stage.appendChild(img);
      return wrapper;
    }

    if (item && item.preview && (item.preview.kind === "pdf" || item.preview.kind === "pdf-preview") && item.storage && item.storage.dataUrl) {
      const objectUrl = getLibraryObjectUrl(tab, item);
      stage.style.display = "block";
      stage.style.padding = "0";
      stage.style.background = "#f3f4f6";

      const objectEl = document.createElement("object");
      objectEl.data = objectUrl || item.storage.dataUrl;
      objectEl.type = "application/pdf";
      objectEl.style.cssText = "width:100%;height:100%;min-height:720px;border:0;border-radius:12px;background:white;display:block;";

      const fallbackCard = document.createElement("div");
      fallbackCard.style.cssText = "padding:22px;max-width:760px;margin:24px auto;border-radius:16px;border:1px solid rgba(120,180,255,0.18);background:rgba(13,24,46,0.96);color:#eaf2ff;line-height:1.55;user-select:text;";
      fallbackCard.innerHTML = `
        <div style="font-size:20px;font-weight:700;margin-bottom:10px;">Резервный режим предпросмотра PDF</div>
        <div style="color:#b6cae8;">This browser tab could not embed the PDF inline. You can still open or download the file below.</div>
      `;

      const fallbackActions = document.createElement("div");
      fallbackActions.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;";
      fallbackCard.appendChild(fallbackActions);

      const rawTarget = objectUrl || item.storage.dataUrl;
      const openBtn = makeActionButton("Открыть PDF", () => {
        try {
          window.open(rawTarget, "_blank", "noopener,noreferrer");
        } catch (error) {
          console.warn("Failed to open PDF:", error);
        }
      });
      const downloadBtn = makeActionButton("Download PDF", () => {
        const link = document.createElement("a");
        link.href = rawTarget;
        link.download = item.name || "document.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
      });
      fallbackActions.appendChild(openBtn);
      fallbackActions.appendChild(downloadBtn);

      objectEl.appendChild(fallbackCard);
      stage.appendChild(objectEl);
      appendDownloadButtons(rawTarget, item.name || "document.pdf");
      wrapper.appendChild(actionRow);
      return wrapper;
    }

    if (item && isProbablyTextLibraryItem(item)) {
      const textContent = getTextContentForLibraryItem(item);
      const pre = document.createElement("pre");
      pre.textContent = textContent || "Текстовый предпросмотр для этого файла пуст в текущей сборке.";
      pre.style.cssText = "margin:0;width:100%;min-height:100%;white-space:pre-wrap;word-break:break-word;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#eaf2ff;user-select:text;padding:18px;";
      stage.style.display = "block";
      stage.style.alignItems = "stretch";
      stage.style.justifyContent = "stretch";
      stage.style.padding = "0";
      stage.appendChild(pre);
      appendDownloadButtons(item.storage && item.storage.dataUrl ? item.storage.dataUrl : "", item.name || "document.txt");
      wrapper.appendChild(actionRow);
      return wrapper;
    }

    if (item && item.storage && item.storage.dataUrl) {
      const objectUrl = getLibraryObjectUrl(tab, item);
      const frame = document.createElement("iframe");
      frame.src = objectUrl || item.storage.dataUrl;
      frame.title = item.name || tab.title || "file";
      frame.style.cssText = "width:100%;height:100%;min-height:640px;border:0;border-radius:12px;background:white;";
      stage.style.display = "block";
      stage.style.padding = "0";
      stage.appendChild(frame);
      appendDownloadButtons(objectUrl || item.storage.dataUrl, item.name || "file");
      wrapper.appendChild(actionRow);
      return wrapper;
    }

    const card = document.createElement("div");
    card.style.cssText = "max-width:720px;padding:18px 20px;border-radius:14px;border:1px solid rgba(120,180,255,0.18);background:rgba(13,24,46,0.92);line-height:1.55;color:#b6cae8;user-select:text;";
    card.innerHTML = `
      <div style="font-size:18px;font-weight:700;color:#eaf2ff;margin-bottom:8px;">Предпросмотр недоступен в режиме браузера</div>
      <div>File tab opened, but this file type does not have a native browser viewer in the current build.</div>
      <div style="margin-top:10px;word-break:break-all;"><strong>Target:</strong> ${escapeHtml(getTabDisplayUrl(tab) || tab.url || "")}</div>
    `;
    stage.appendChild(card);
    return wrapper;
  }

  function renderPaneContent(tab, pane) {
    if (!tab || !pane) return null;

    cleanupPaneResources(pane);
    pane.innerHTML = "";
    pane.classList.remove("fallback-visible");

    if (shouldUseNativeViewer(tab)) {
      const nativeViewer = createNativeViewerPane(tab, pane);
      pane.appendChild(nativeViewer);
      return { mode: "native", node: nativeViewer };
    }

    const webview = document.createElement("webview");
    webview.className = "browser-webview";
    webview.dataset.tabId = tab.id;
    webview.setAttribute("src", tab.url);
    webview.removeAttribute("allowpopups");
    webview.setAttribute("webpreferences", "contextIsolation=yes");

    const fallback = document.createElement("div");
    fallback.className = "webview-fallback";
    fallback.innerHTML = `
      <div class="fallback-card">
        <h2>${escapeHtml(tab.title)}</h2>
        <p>This area is prepared for a dedicated Electron webview per tab.</p>
        <p>If the webview does not render in this environment, the architecture is still preserved and ready for Electron runtime.</p>
        <p><strong>Target URL:</strong> <span class="fallback-url">${escapeHtml(tab.url)}</span></p>
      </div>
    `;

    pane.appendChild(webview);
    pane.appendChild(fallback);
    attachWebviewEvents(webview, tab, pane);
    return { mode: "webview", node: webview };
  }

  function openLibraryItemInTab(fileId) {
    if (!fileId || !window.NSLibraryStore || typeof window.NSLibraryStore.getItemById !== "function") {
      return false;
    }

    const item = window.NSLibraryStore.getItemById(fileId);
    if (!item || !item.storage || !item.storage.dataUrl) {
      return false;
    }

    const existingTab = findExistingTabMatch({
      title: item.name || item.originalName || "Library File",
      url: item.storage.dataUrl,
      displayUrl: makeLibraryDisplayUrl(item),
      fileId: item.id,
      sourceType: "library",
      libraryKey: getLibraryItemKey(item)
    }) || findLibraryTabByKey(item) || findLibraryTabByFileId(fileId);

    if (existingTab) {
      activateTab(existingTab.id);
      return true;
    }

    createTab({
      title: item.name || item.originalName || "Library File",
      url: item.storage.dataUrl,
      displayUrl: makeLibraryDisplayUrl(item),
      fileId: item.id,
      sourceType: "library",
      libraryKey: getLibraryItemKey(item)
    });

    return true;
  }

  function createTab({ title, url, displayUrl = "", fileId = null, sourceType = "web", libraryKey = "" }) {
    const existingTab = findExistingTabMatch({
      title,
      url,
      displayUrl,
      fileId,
      sourceType,
      libraryKey
    });

    if (existingTab) {
      activateTab(existingTab.id);
      return existingTab;
    }

    state.tabCounter += 1;
    const id = `tab-${state.tabCounter}`;

    const tab = {
      id,
      title: title || "New Tab",
      url: url || "https://www.google.com",
      displayUrl: displayUrl || "",
      fileId: fileId || null,
      sourceType: sourceType || "web",
      libraryKey: libraryKey || ""
    };

    state.tabs.push(tab);

    if (!els.tabsScroll || !els.webviewStack) {
      console.warn("[renderer] tabsScroll or webviewStack not found");
      state.activeTabId = id;
      return;
    }

    const tabButton = document.createElement("button");
    tabButton.className = "tab-btn";
    tabButton.dataset.tabId = id;
    tabButton.type = "button";
    tabButton.innerHTML = `
      <span class="tab-title">${escapeHtml(tab.title)}</span>
      <span class="tab-close" data-close-tab="${id}" title="Close tab">✕</span>
    `;

    tabButton.addEventListener("click", (event) => {
      const closeTarget = event.target.closest("[data-close-tab]");
      if (closeTarget) {
        event.stopPropagation();
        removeTab(closeTarget.dataset.closeTab);
        return;
      }

      activateTab(id);
    });

    const pane = document.createElement("section");
    pane.className = "tab-pane";
    pane.dataset.tabId = id;

    els.tabsScroll.appendChild(tabButton);
    els.webviewStack.appendChild(pane);

    renderPaneContent(tab, pane);
    activateTab(id);
    return tab;
  }

  function attachWebviewEvents(webview, tab, pane) {
    const setFallbackVisible = (visible) => {
      pane.classList.toggle("fallback-visible", visible);
    };

    setFallbackVisible(false);

    webview.addEventListener("did-start-loading", () => {
      setFallbackVisible(false);
    });

    webview.addEventListener("did-stop-loading", () => {
      updateAddressFromWebview(webview);
    });

    webview.addEventListener("did-finish-load", () => {
      updateAddressFromWebview(webview);
      updateTabTitleFromWebview(webview, tab.id);
    });

    webview.addEventListener("page-title-updated", (event) => {
      const nextTitle = event.title || "New Tab";
      updateTabTitle(tab.id, nextTitle);
    });

    webview.addEventListener("did-navigate", () => {
      updateAddressFromWebview(webview);
      updateTabMetaUrl(tab.id, safeGetWebviewUrl(webview));
    });

    webview.addEventListener("did-navigate-in-page", () => {
      updateAddressFromWebview(webview);
      updateTabMetaUrl(tab.id, safeGetWebviewUrl(webview));
    });

    webview.addEventListener("did-fail-load", () => {
      setFallbackVisible(true);
      updateFallbackUrl(tab.id);
    });

    webview.addEventListener("dom-ready", () => {
      updateAddressFromWebview(webview);
      updateTabTitleFromWebview(webview, tab.id);
    });

    try {
      setTimeout(() => {
        const currentUrl = safeGetWebviewUrl(webview);
        if (!currentUrl || currentUrl === "about:blank") {
          updateFallbackUrl(tab.id);
        }
      }, 1200);
    } catch (error) {
      console.warn("Initial webview check failed:", error);
    }
  }

  function activateTab(tabId) {
    state.activeTabId = tabId;

    if (els.tabsScroll) {
      els.tabsScroll.querySelectorAll(".tab-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.tabId === tabId);
      });
    }

    if (els.webviewStack) {
      els.webviewStack.querySelectorAll(".tab-pane").forEach((pane) => {
        pane.classList.toggle("active", pane.dataset.tabId === tabId);
      });
    }

    syncInputWithActiveTab();
  }

  function removeTab(tabId) {
    if (state.tabs.length === 1) {
      return;
    }

    const index = state.tabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) return;

    const removedTab = state.tabs[index];
    state.tabs.splice(index, 1);

    const safeSelector = cssEscape(tabId);

    if (els.tabsScroll) {
      const tabButton = els.tabsScroll.querySelector(`.tab-btn[data-tab-id="${safeSelector}"]`);
      if (tabButton) tabButton.remove();
    }

    if (els.webviewStack) {
      const pane = els.webviewStack.querySelector(`.tab-pane[data-tab-id="${safeSelector}"]`);
      if (pane) {
        cleanupPaneResources(pane);
        pane.remove();
      }
    }

    revokeLibraryObjectUrlForTab(removedTab);

    if (state.activeTabId === tabId) {
      const nextTab = state.tabs[index] || state.tabs[index - 1] || state.tabs[0];
      if (nextTab) {
        activateTab(nextTab.id);
      }
    }
  }

  function navigateFromInput() {
    if (!els.addressInput) return;

    const raw = els.addressInput.value.trim();
    if (!raw) return;

    const targetUrl = resolveInputToUrl(raw, state.currentSource);
    const activePane = getActivePane();
    const activeWebview = getActiveWebview();
    const activeTab = getActiveTab();

    if (!activePane || !activeTab) return;

    clearTabCustomLocation(activeTab);
    activeTab.url = targetUrl;
    updateTabTitle(activeTab.id, deriveTitleFromInput(raw));
    updateFallbackUrl(activeTab.id);

    if (activeWebview && typeof activeWebview.loadURL === "function") {
      try {
        activeWebview.loadURL(targetUrl);
        activePane.classList.remove("fallback-visible");
      } catch (error) {
        console.warn("Navigation failed:", error);
        activePane.classList.add("fallback-visible");
      }
    } else {
      renderPaneContent(activeTab, activePane);
    }

    els.addressInput.value = raw;
  }

  function resolveInputToUrl(input, sourceKey) {
    const trimmed = input.trim();

    if (isLikelyUrl(trimmed)) {
      return normalizeUrl(trimmed);
    }

    const source = SOURCES[sourceKey] || SOURCES.google;
    return source.buildSearchUrl(trimmed);
  }

  function isLikelyUrl(value) {
    const hasProtocol = /^(https?:\/\/|file:\/\/|about:)/i.test(value);
    const looksLikeLocalhost = /^localhost(:\d+)?(\/.*)?$/i.test(value);
    const looksLikeDomain = /^[^\s]+\.[^\s]{2,}(\/.*)?$/i.test(value);
    const looksLikeIp = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(\/.*)?$/.test(value);
    const looksLikeOnion = /^[a-z2-7]{16,56}\.onion(\/.*)?$/i.test(value);

    return hasProtocol || looksLikeLocalhost || looksLikeDomain || looksLikeIp || looksLikeOnion;
  }

  function normalizeUrl(value) {
    if (/^(https?:\/\/|file:\/\/|about:)/i.test(value)) {
      return value;
    }

    return `https://${value}`;
  }

  function deriveTitleFromInput(value) {
    const cleaned = value.trim();
    if (!cleaned) return "New Tab";
    if (cleaned.length <= 42) return cleaned;
    return `${cleaned.slice(0, 39)}...`;
  }

  function updateTabTitle(tabId, title) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    tab.title = title || "New Tab";

    if (!els.tabsScroll) return;

    const titleNode = els.tabsScroll.querySelector(`.tab-btn[data-tab-id="${cssEscape(tabId)}"] .tab-title`);
    if (titleNode) {
      titleNode.textContent = tab.title;
    }
  }

  function updateTabMetaUrl(tabId, url) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || !url) return;

    tab.url = url;

    if (tab.sourceType === "library" && !isDataLikeUrl(url)) {
      clearTabCustomLocation(tab);
    }

    if (state.activeTabId === tabId && els.addressInput) {
      els.addressInput.value = getTabDisplayUrl(tab);
    }

    updateFallbackUrl(tabId);
  }

  function updateFallbackUrl(tabId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab || !els.webviewStack) return;

    const pane = els.webviewStack.querySelector(`.tab-pane[data-tab-id="${cssEscape(tabId)}"]`);
    if (!pane) return;

    const urlNode = pane.querySelector(".fallback-url");
    if (urlNode) {
      urlNode.textContent = getTabDisplayUrl(tab);
    }
  }

  function updateAddressFromWebview(webview) {
    const activeTab = getActiveTab();
    if (!webview || !activeTab || webview.dataset.tabId !== state.activeTabId || !els.addressInput) return;

    if (activeTab.displayUrl) {
      els.addressInput.value = activeTab.displayUrl;
      return;
    }

    const url = safeGetWebviewUrl(webview);
    if (url) {
      els.addressInput.value = url;
    }
  }

  function updateTabTitleFromWebview(webview, tabId) {
    try {
      let title = "";
      if (typeof webview.getTitle === "function") {
        title = webview.getTitle();
      }

      if (title) {
        updateTabTitle(tabId, title);
      }
    } catch (error) {
      console.warn("Failed to get page title:", error);
    }
  }

  function safeGetWebviewUrl(webview) {
    try {
      if (typeof webview.getURL === "function") {
        return webview.getURL();
      }

      return webview.getAttribute("src") || "";
    } catch (error) {
      console.warn("Failed to get webview URL:", error);
      return webview.getAttribute("src") || "";
    }
  }

  function getActiveTab() {
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
  }

  function getActivePane() {
    if (!state.activeTabId || !els.webviewStack) return null;
    return els.webviewStack.querySelector(`.tab-pane[data-tab-id="${cssEscape(state.activeTabId)}"]`);
  }

  function getActiveWebview() {
    const pane = getActivePane();
    return pane ? pane.querySelector("webview") : null;
  }

  function syncInputWithActiveTab() {
    const activeTab = getActiveTab();
    if (!activeTab || !els.addressInput) return;
    els.addressInput.value = getTabDisplayUrl(activeTab);
  }

  function openSourceDropdown() {
    if (!els.sourceDropdown || !els.sourceTrigger) return;
    els.sourceDropdown.classList.remove("hidden");
    els.sourceTrigger.setAttribute("aria-expanded", "true");
  }

  function closeSourceDropdown() {
    if (els.sourceDropdown) {
      els.sourceDropdown.classList.add("hidden");
    }

    if (els.sourceTrigger) {
      els.sourceTrigger.setAttribute("aria-expanded", "false");
    }
  }

  function updateSourceUI() {
    const source = SOURCES[state.currentSource] || SOURCES.google;

    if (els.sourceTriggerLabel) {
      els.sourceTriggerLabel.textContent = source.label;
    }

    if (els.addressInput) {
      els.addressInput.placeholder = source.placeholder;
    }

    if (els.sourceDropdown) {
      els.sourceDropdown.querySelectorAll(".source-option").forEach((button) => {
        const isActive = button.dataset.source === state.currentSource;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
      });
    }
  }

  function resolveWorkspaceSection(section) {
    const normalized = String(section || "").trim();
    if (!normalized) return "workspace";

    if (KNOWN_WORKSPACE_SECTIONS.has(normalized)) {
      return normalized;
    }

    const panel = document.querySelector(`.workspace-panel[data-panel="${cssEscape(normalized)}"]`);
    return panel ? normalized : "workspace";
  }

  function resolveCabinetSection(section) {
    const normalized = String(section || "").trim();
    if (!normalized) return "video";

    if (KNOWN_CABINET_SECTIONS.has(normalized)) {
      return normalized;
    }

    const panel = document.querySelector(`.cabinet-section-panel[data-cabinet-panel="${cssEscape(normalized)}"]`);
    return panel ? normalized : "video";
  }

  function ensureCabinetVisible() {
    state.isCabinetOpen = true;

    if (els.cabinetOverlay) {
      els.cabinetOverlay.classList.remove("hidden");
      els.cabinetOverlay.setAttribute("aria-hidden", "false");
    }
  }

  function openWorkspaceSection(section, options = {}) {
    const nextSection = resolveWorkspaceSection(section);
    const desiredMode = options.mode || "split";

    if (options.enable !== false) {
      setWorkspaceEnabled(true);
      if (desiredMode !== "normal" && state.workspaceMode === "normal") {
        setWorkspaceMode(desiredMode);
      }
    }

    setWorkspaceSection(nextSection);
    return nextSection;
  }

  function openCabinetSection(section) {
    const nextSection = resolveCabinetSection(section);
    ensureCabinetVisible();
    showCabinetSection(nextSection);
    return nextSection;
  }

  function registerWorkspaceShellApi() {
    window.NSWorkspaceShell = {
      getState() {
        return {
          workspaceEnabled: state.workspaceEnabled,
          workspaceMode: state.workspaceMode,
          workspaceSection: state.activeWorkspaceSection,
          cabinetOpen: state.isCabinetOpen,
          cabinetMode: state.cabinetMode,
          cabinetSection: state.activeCabinetSection
        };
      },
      openWorkspaceSection,
      openCabinetSection,
      closeCabinet,
      openPreviewTab(target, options = {}) {
        const payload = typeof target === 'string' ? { url: target } : (target || {});
        const url = String(payload.url || '').trim();
        if (!url) return false;
        const title = String(payload.title || options.title || 'Предпросмотр сайта').trim() || 'Предпросмотр сайта';
        const displayUrl = String(payload.displayUrl || url);
        createTab({ title, url, displayUrl, sourceType: 'web' });
        return true;
      },
      openHome() {
        return openWorkspaceSection("workspace");
      }
    };
  }

  function toggleWorkspaceMain() {
    if (!state.workspaceEnabled || state.workspaceMode === "normal") {
      setWorkspaceEnabled(true);
      setWorkspaceMode("split");
      return;
    }

    setWorkspaceEnabled(false);
    setWorkspaceMode("normal");
  }

  function setWorkspaceEnabled(enabled) {
    state.workspaceEnabled = Boolean(enabled);

    if (!state.workspaceEnabled && state.workspaceMode !== "normal") {
      state.workspaceMode = "normal";
    }

    updateWorkspaceUI();
  }

  function setWorkspaceMode(mode) {
    const allowed = ["normal", "split", "focus"];
    if (!allowed.includes(mode)) return;

    state.workspaceMode = mode;
    state.workspaceEnabled = mode !== "normal";

    if (state.workspaceMode === "split") {
      clampWorkspaceWidth();
      applyWorkspaceWidth();
    }

    updateWorkspaceUI();
  }

  function updateWorkspaceUI() {
    if (els.mainLayout) {
      els.mainLayout.classList.remove("mode-normal", "mode-split", "mode-focus");
      els.mainLayout.classList.add(`mode-${state.workspaceMode}`);
      els.mainLayout.dataset.workspaceMode = state.workspaceMode;
      els.mainLayout.dataset.workspaceSection = state.activeWorkspaceSection || "workspace";
    }

    const shellVisible = state.workspaceMode !== "normal";
    const dividerVisible = state.workspaceMode === "split";

    if (els.workspaceShell) {
      els.workspaceShell.classList.toggle("hidden", !shellVisible);
      els.workspaceShell.setAttribute("aria-hidden", String(!shellVisible));
      els.workspaceShell.dataset.workspaceMode = state.workspaceMode;
      els.workspaceShell.dataset.workspaceSection = state.activeWorkspaceSection || "workspace";
    }

    if (els.workspaceDivider) {
      els.workspaceDivider.classList.toggle("hidden", !dividerVisible);
      els.workspaceDivider.setAttribute("aria-hidden", String(!dividerVisible));
      els.workspaceDivider.tabIndex = dividerVisible ? 0 : -1;
    }

    if (els.workspaceToggle) {
      els.workspaceToggle.classList.toggle("active", state.workspaceEnabled);
      els.workspaceToggle.setAttribute("aria-pressed", String(state.workspaceEnabled));
    }

    clampWorkspaceWidth();
    applyWorkspaceWidth();
  }

  function setWorkspaceSection(section) {
    const resolvedSection = resolveWorkspaceSection(section);
    state.activeWorkspaceSection = resolvedSection;

    if (els.workspaceShellNav) {
      els.workspaceShellNav.querySelectorAll(".workspace-nav-btn").forEach((button) => {
        const isActive = button.dataset.section === resolvedSection;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    if (els.workspaceShellBody) {
      els.workspaceShellBody.querySelectorAll(".workspace-panel").forEach((panel) => {
        const isActive = panel.dataset.panel === resolvedSection;

        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
        panel.setAttribute("aria-hidden", String(!isActive));
        panel.style.display = isActive ? "" : "none";
        panel.style.pointerEvents = isActive ? "auto" : "none";
      });
    }

    if (els.mainLayout) {
      els.mainLayout.dataset.workspaceSection = resolvedSection;
    }

    if (els.workspaceShell) {
      els.workspaceShell.dataset.workspaceSection = resolvedSection;
    }

    if (resolvedSection === "workspace") {
      renderHomeDashboard();
    }
  }

  function resizeWorkspaceFromPointer(clientX) {
    if (!els.mainLayout) return;

    const rect = els.mainLayout.getBoundingClientRect();
    if (!rect.width) return;

    const workspacePx = rect.right - clientX;
    const percent = (workspacePx / rect.width) * 100;

    state.workspaceWidthPercent = clamp(percent, WORKSPACE_MIN_PERCENT, WORKSPACE_MAX_PERCENT);
    applyWorkspaceWidth();
  }

  function adjustWorkspaceWidth(deltaPercent) {
    if (state.workspaceMode !== "split") return;

    state.workspaceWidthPercent = clamp(
      state.workspaceWidthPercent + deltaPercent,
      WORKSPACE_MIN_PERCENT,
      WORKSPACE_MAX_PERCENT
    );

    applyWorkspaceWidth();
  }

  function clampWorkspaceWidth() {
    state.workspaceWidthPercent = clamp(
      state.workspaceWidthPercent,
      WORKSPACE_MIN_PERCENT,
      WORKSPACE_MAX_PERCENT
    );
  }

  function applyWorkspaceWidth() {
    if (els.mainLayout) {
      els.mainLayout.style.setProperty("--workspace-width", `${state.workspaceWidthPercent}%`);
    }
  }

  function openCabinet() {
    ensureCabinetVisible();
    showCabinetGrid();
  }

  function closeCabinet() {
    state.isCabinetOpen = false;

    if (els.cabinetOverlay) {
      els.cabinetOverlay.classList.add("hidden");
      els.cabinetOverlay.setAttribute("aria-hidden", "true");
    }
  }

  function showCabinetGrid() {
    state.cabinetMode = "grid";

    if (els.cabinetGridView) {
      els.cabinetGridView.classList.remove("hidden");
    }

    if (els.cabinetExpandedView) {
      els.cabinetExpandedView.classList.add("hidden");
    }
  }

  function showCabinetSection(section) {
    const resolvedSection = resolveCabinetSection(section);
    ensureCabinetVisible();
    state.cabinetMode = "expanded";
    state.activeCabinetSection = resolvedSection;

    if (els.cabinetGridView) {
      els.cabinetGridView.classList.add("hidden");
    }

    if (els.cabinetExpandedView) {
      els.cabinetExpandedView.classList.remove("hidden");
    }

    const titleMap = {
      video: ["Comm", "Объединённая оболочка общения для видео и чата"],
      files: ["Файлы", "Источники, загрузки и документы"],
      projects: ["Проекты", "Контейнеры, связывающие файлы, заметки, черновики и контекст пространства"],
      notes: ["Заметки", "Быстрый захват и связанный проектный блокнот"],
      tools: ["Tools", "Служебные модули и рабочие действия"],
      editor: ["Editor", "Быстрая авторская панель и лёгкое разделённое пространство черновика"],
      codehub: ["CodeHub", "Реальное направление кода и публикации"],
      workspace: ["Workspace", "Главная точка запуска для файлов, заметок, проектов, редактора и закладок"],
      chat: ["Chat", "Исследовательский и помощнический поток рядом с активной сессией браузера"],
      marketplace: ["Marketplace", "Будущий модуль, оставленный на месте"],
      wallet: ["Wallet", "Будущий модуль, оставленный на месте"],
      analytics: ["Analytics", "Будущий модуль, оставленный на месте"]
    };

    const [title, subtitle] = titleMap[resolvedSection] || ["Раздел", "Раздел пространства"];

    if (els.cabinetExpandedTitle) {
      els.cabinetExpandedTitle.textContent = title;
    }

    if (els.cabinetExpandedSubtitle) {
      els.cabinetExpandedSubtitle.textContent = subtitle;
    }

    document.querySelectorAll(".cabinet-inner-nav-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.section === resolvedSection);
    });

    document.querySelectorAll(".cabinet-section-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.cabinetPanel === resolvedSection);
    });

    const expandedBody = document.getElementById("cabinetExpandedBody");
    if (expandedBody) {
      expandedBody.scrollTop = 0;
    }

    if (resolvedSection === "workspace") {
      setWorkspaceEnabled(true);

      if (state.workspaceMode === "normal") {
        setWorkspaceMode("split");
      }

      setWorkspaceSection("workspace");
    }
  }

  function bindProjectsBridge() {
    function openProjectTarget(section) {
      if (state.isCabinetOpen) {
        openCabinetSection(section);
        return "cabinet";
      }
      openWorkspaceSection(section, {
        enable: true,
        mode: state.workspaceMode === "focus" ? "focus" : "split"
      });
      return "workspace";
    }

    function pushTextIntoTools(payload) {
      const text = payload && payload.text ? String(payload.text) : "";
      if (!text) return;

      const translatorRoots = Array.from(document.querySelectorAll("[data-translate-tool-root]"));
      translatorRoots.forEach((root) => {
        const input = root.querySelector("[data-translate-input]");
        const result = root.querySelector("[data-translate-result]");
        const status = root.querySelector("[data-translate-status]");
        if (input) {
          input.value = text;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (result) {
          result.value = "";
        }
        if (status) {
          status.textContent = "Текст проекта захвачен. Готово к переводу.";
        }
      });
    }

    document.addEventListener("ns-projects:open-workspace", function () {
      if (state.isCabinetOpen) {
        openCabinetSection("workspace");
        return;
      }
      openWorkspaceSection("workspace", {
        enable: true,
        mode: state.workspaceMode === "focus" ? "focus" : "split"
      });
    });

    document.addEventListener("ns-projects:new-draft", function (event) {
      const projectId = event && event.detail ? String(event.detail.projectId || "") : "";
      const surfaceType = openProjectTarget("editor");

      if (window.NSEditorV1 && typeof window.NSEditorV1.createDraftFromTemplate === "function") {
        let draft = window.NSEditorV1.createDraftFromTemplate(null);

        if (draft && projectId && window.__nsEditorV1Instance && window.__nsEditorV1Instance.store && typeof window.__nsEditorV1Instance.store.saveDraft === "function") {
          draft = window.__nsEditorV1Instance.store.saveDraft(Object.assign({}, draft, { projectId }));
        }

        if (draft && draft.id && typeof window.NSEditorV1.openDraftById === "function") {
          window.NSEditorV1.openDraftById(draft.id, surfaceType);
        }
      }
    });

    document.addEventListener("ns-projects:new-note", function (event) {
      const projectId = event && event.detail ? String(event.detail.projectId || "") : "";
      openProjectTarget("notes");

      if (window.NSNotesStore && typeof window.NSNotesStore.createNote === "function") {
        const note = window.NSNotesStore.createNote({
          title: "Заметка без названия",
          type: "note",
          text: "",
          projectId: projectId
        });

        if (note && note.id && typeof window.NSNotesStore.setLastOpenedNoteId === "function") {
          window.NSNotesStore.setLastOpenedNoteId(note.id);
        }
      }
    });

    document.addEventListener("ns-projects:open-files", function () {
      openProjectTarget("files");
    });

    document.addEventListener("ns-projects:open-note", function () {
      openProjectTarget("notes");
    });

    document.addEventListener("ns-tools:use-text", function (event) {
      const detail = event && event.detail ? event.detail : {};
      openProjectTarget("tools");
      setTimeout(function () {
        pushTextIntoTools(detail);
      }, 60);
    });
  }

  function bindNotesBridge() {
    document.addEventListener("ns-notes:open-project", function () {
      openWorkspaceSection("projects");
    });

    document.addEventListener("ns-notes:open-files", function () {
      openWorkspaceSection("files");
    });
  }

  function bindLibraryBridge() {
    document.addEventListener("ns-library:open-file-tab", function (event) {
      const fileId = event && event.detail ? String(event.detail.fileId || "") : "";
      if (!fileId) return;

      const opened = openLibraryItemInTab(fileId);
      if (!opened) return;

      if (state.isCabinetOpen) {
        closeCabinet();
      }
    });
  }


  let homeDashboardBound = false;
  let homeDashboardSubscribed = false;

  function initHomeDashboard() {
    bindHomeDashboard();
    subscribeHomeDashboard();
    renderHomeDashboard();
  }

  function bindHomeDashboard() {
    if (homeDashboardBound) return;
    homeDashboardBound = true;

    document.addEventListener("click", function (event) {
      const openBtn = event.target.closest("[data-home-open]");
      if (openBtn) {
        const section = String(openBtn.dataset.homeOpen || "");
        if (!section) return;

        openWorkspaceSection(section, {
          enable: true,
          mode: state.workspaceMode === "normal" ? "split" : state.workspaceMode
        });
        return;
      }

      const cabinetBtn = event.target.closest("[data-home-open-cabinet]");
      if (cabinetBtn) {
        const section = String(cabinetBtn.dataset.homeOpenCabinet || "");
        if (!section) return;
        openCabinetSection(section);
        return;
      }

      const fileBtn = event.target.closest("[data-home-open-file]");
      if (fileBtn) {
        const fileId = String(fileBtn.dataset.homeOpenFile || "");
        if (!fileId || !window.NSLibraryStore) return;

        if (typeof window.NSLibraryStore.setActiveItem === "function") {
          window.NSLibraryStore.setActiveItem(fileId);
        }

        openWorkspaceSection("files");
        return;
      }

      const fileTabBtn = event.target.closest("[data-home-open-file-tab]");
      if (fileTabBtn) {
        const fileId = String(fileTabBtn.dataset.homeOpenFileTab || "");
        if (!fileId) return;

        const opened = openLibraryItemInTab(fileId);
        if (!opened) return;

        if (state.isCabinetOpen) {
          closeCabinet();
        }
        return;
      }

      const projectBtn = event.target.closest("[data-home-open-project]");
      if (projectBtn) {
        const projectId = String(projectBtn.dataset.homeOpenProject || "");
        if (!projectId || !window.NSProjectStore) return;

        if (typeof window.NSProjectStore.setLastOpenedProjectId === "function") {
          window.NSProjectStore.setLastOpenedProjectId(projectId);
        }

        openWorkspaceSection("projects");
        return;
      }

      const noteBtn = event.target.closest("[data-home-open-note]");
      if (noteBtn) {
        const noteId = String(noteBtn.dataset.homeOpenNote || "");
        if (!noteId || !window.NSNotesStore) return;

        if (typeof window.NSNotesStore.setLastOpenedNoteId === "function") {
          window.NSNotesStore.setLastOpenedNoteId(noteId);
        }

        openWorkspaceSection("notes");
      }
    });
  }

  function subscribeHomeDashboard() {
    if (homeDashboardSubscribed) return;
    homeDashboardSubscribed = true;

    const rerender = function () {
      renderHomeDashboard();
    };

    if (window.NSLibraryStore && typeof window.NSLibraryStore.subscribe === "function") {
      window.NSLibraryStore.subscribe(rerender);
    } else {
      window.addEventListener("ns:library-store-changed", rerender);
    }

    if (window.NSProjectStore && typeof window.NSProjectStore.subscribe === "function") {
      window.NSProjectStore.subscribe(rerender);
    }

    if (window.NSNotesStore && typeof window.NSNotesStore.subscribe === "function") {
      window.NSNotesStore.subscribe(rerender);
    }
  }

  function renderHomeDashboard() {
    const root = document.getElementById("workspaceCombinedLayout");
    if (!root || !root.classList.contains("workspace-home-dashboard")) return;

    const isCompactHome = Boolean(root.closest(".workspace-shell"));
    const listLimit = isCompactHome ? 3 : 5;
    const compactEmpty = {
      files: 'Файлов пока нет.',
      projects: 'Проектов пока нет.',
      notes: 'Заметок пока нет.'
    };

    const fileState = window.NSLibraryStore && typeof window.NSLibraryStore.getState === "function"
      ? window.NSLibraryStore.getState()
      : { items: [], activeId: null };
    const fileItems = Array.isArray(fileState.items) ? fileState.items.slice() : [];
    const fileItemsSorted = fileItems.slice().sort(compareUpdatedDesc);
    const activeFile = fileState.activeId && window.NSLibraryStore && typeof window.NSLibraryStore.getItemById === "function"
      ? window.NSLibraryStore.getItemById(fileState.activeId)
      : null;
    const fileFavoritesCount = fileItems.filter(function (item) {
      return item && (item.favorite || item.pinned);
    }).length;

    const projectItems = window.NSProjectStore && typeof window.NSProjectStore.getAll === "function"
      ? window.NSProjectStore.getAll()
      : [];
    const activeProjectId = window.NSProjectStore && typeof window.NSProjectStore.getLastOpenedProjectId === "function"
      ? window.NSProjectStore.getLastOpenedProjectId()
      : "";
    const activeProject = activeProjectId && window.NSProjectStore && typeof window.NSProjectStore.getById === "function"
      ? window.NSProjectStore.getById(activeProjectId)
      : null;

    const noteItems = window.NSNotesStore && typeof window.NSNotesStore.getAll === "function"
      ? window.NSNotesStore.getAll()
      : [];
    const projectPinnedCount = projectItems.filter(function (project) {
      return project && project.pinned;
    }).length;
    const notePinnedCount = noteItems.filter(function (note) {
      return note && note.pinned;
    }).length;
    const favoritesCount = fileFavoritesCount + projectPinnedCount + notePinnedCount;
    const activeNoteId = window.NSNotesStore && typeof window.NSNotesStore.getLastOpenedNoteId === "function"
      ? window.NSNotesStore.getLastOpenedNoteId()
      : "";
    const activeNote = activeNoteId && window.NSNotesStore && typeof window.NSNotesStore.getById === "function"
      ? window.NSNotesStore.getById(activeNoteId)
      : null;

    setTextContent("homeStatFiles", String(fileItems.length));
    setTextContent("homeStatProjects", String(projectItems.length));
    setTextContent("homeStatNotes", String(noteItems.length));
    setTextContent("homeStatFavorites", String(favoritesCount));

    setTextContent("homeFilesMeta", fileItems.length ? (isCompactHome ? fileItems.length + " элементов" : fileItems.length + " элементов библиотеки источников") : "Библиотека источников пуста");
    setTextContent("homeProjectsMeta", projectItems.length ? (isCompactHome ? projectItems.length + " проектов" : projectItems.length + " связанных проектов") : "Проектов пока нет");
    setTextContent("homeNotesMeta", noteItems.length ? (isCompactHome ? noteItems.length + " сохранено" : noteItems.length + " заметок сохранено") : "Заметок пока нет");
    setTextContent(
      "homeFavoritesMeta",
      favoritesCount
        ? (isCompactHome
            ? favoritesCount + " сохранено"
            : fileFavoritesCount + " файлов · " + projectPinnedCount + " проектов · " + notePinnedCount + " заметок")
        : "Избранного пока нет"
    );

    const focusStrip = document.getElementById("homeFocusStrip");
    if (focusStrip) {
      focusStrip.innerHTML = (isCompactHome
        ? [
            '<span class="workspace-home-focus-chip">Файл: ' + escapeHtml(activeFile ? activeFile.name : 'нет') + '</span>',
            '<span class="workspace-home-focus-chip">Проект: ' + escapeHtml(activeProject ? activeProject.title : 'нет') + '</span>'
          ]
        : [
            '<span class="workspace-home-focus-chip">Активный файл: ' + escapeHtml(activeFile ? activeFile.name : 'нет') + '</span>',
            '<span class="workspace-home-focus-chip">Проект: ' + escapeHtml(activeProject ? activeProject.title : 'нет') + '</span>',
            '<span class="workspace-home-focus-chip">Заметка: ' + escapeHtml(activeNote ? activeNote.title : 'нет') + '</span>'
          ]).join("");
    }

    renderHomeList(
      "homeFilesList",
      fileItemsSorted.slice(0, listLimit).map(function (item) {
        const kind = item && item.preview && item.preview.kind ? String(item.preview.kind) : "file";
        const updated = formatHomeDate(item && item.updatedAt);
        return {
          title: item && item.name ? item.name : "Файл без названия",
          meta: (isCompactHome
            ? [item && item.category ? item.category : "другое"].filter(Boolean).join(" · ")
            : [item && item.category ? item.category : "другое", kind, updated].filter(Boolean).join(" · ")),
          primaryAction: '<button type="button" class="workspace-home-row-btn" data-home-open-file="' + escapeHtml(item.id) + '">Открыть</button>',
          secondaryAction: isCompactHome ? '' : '<button type="button" class="workspace-home-row-btn secondary" data-home-open-file-tab="' + escapeHtml(item.id) + '">Во вкладке</button>'
        };
      }),
      isCompactHome ? compactEmpty.files : "Файлов пока нет. Загрузите файлы, чтобы начать наполнять библиотеку источников."
    );

    renderHomeList(
      "homeProjectsList",
      projectItems.slice(0, listLimit).map(function (project) {
        const counts = window.NSProjectStore && typeof window.NSProjectStore.getCounts === "function"
          ? window.NSProjectStore.getCounts(project.id)
          : { files: 0, notes: 0, drafts: 0 };
        return {
          title: project.title || "Проект без названия",
          meta: (isCompactHome
            ? [project.type || 'проект'].filter(Boolean).join(" · ")
            : [project.type, project.status, 'Файлы ' + counts.files, 'Заметки ' + counts.notes].filter(Boolean).join(" · ")),
          primaryAction: '<button type="button" class="workspace-home-row-btn" data-home-open-project="' + escapeHtml(project.id) + '">Открыть</button>'
        };
      }),
      isCompactHome ? compactEmpty.projects : "Проектов пока нет. Создайте проект, чтобы связать файлы, заметки и черновики."
    );

    renderHomeList(
      "homeNotesList",
      noteItems.slice(0, listLimit).map(function (note) {
        const preview = String(note && note.text ? note.text : "").replace(/\s+/g, " ").trim();
        const previewLimit = isCompactHome ? 18 : 72;
        const compactPreview = preview ? preview.slice(0, previewLimit) + (preview.length > previewLimit ? "…" : "") : "Пустая заметка";
        return {
          title: note.title || "Заметка без названия",
          meta: isCompactHome ? (note.type || 'заметка') : [note.type, compactPreview].filter(Boolean).join(" · "),
          primaryAction: '<button type="button" class="workspace-home-row-btn" data-home-open-note="' + escapeHtml(note.id) + '">Открыть</button>'
        };
      }),
      isCompactHome ? compactEmpty.notes : "Заметок пока нет. Используйте быстрый захват или откройте модуль заметок."
    );
  }

  function renderHomeList(containerId, items, emptyText) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = '<div class="workspace-home-empty">' + escapeHtml(emptyText) + '</div>';
      return;
    }

    container.innerHTML = items.map(function (item) {
      return [
        '<div class="workspace-home-row">',
        '  <div class="workspace-home-row-copy">',
        '    <div class="workspace-home-row-title">' + escapeHtml(item.title || 'Без названия') + '</div>',
        '    <div class="workspace-home-row-meta">' + escapeHtml(item.meta || '') + '</div>',
        '  </div>',
        '  <div class="workspace-home-row-actions">' + (item.primaryAction || '') + (item.secondaryAction || '') + '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function setTextContent(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function compareUpdatedDesc(a, b) {
    return getTimeValue(b && b.updatedAt) - getTimeValue(a && a.updatedAt);
  }

  function getTimeValue(value) {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function formatHomeDate(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return String(value);
    }
  }

  function handleEscape() {
    if (state.isCabinetOpen) {
      if (state.cabinetMode === "expanded") {
        showCabinetGrid();
        return;
      }

      if (state.cabinetMode === "grid") {
        closeCabinet();
      }
    }
  }

  function saveLocalValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Failed to save local value:", error);
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }

    return String(value).replace(/"/g, '\\"');
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
