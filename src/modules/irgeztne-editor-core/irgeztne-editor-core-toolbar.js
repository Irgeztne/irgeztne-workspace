/* IRGEZTNE_EDITOR_CORE_TOOLBAR_ADAPTER_V064J */
(function (window, document) {
  "use strict";

  function createToolbar(options) {
    options = options || {};
    var api = options.api;
    var toolbar = options.toolbar;
    var root = api && api.root;

    if (!api || !root || !toolbar) {
      throw new Error("IRGEZTNEEditorCoreToolbar.create requires api + toolbar");
    }

    var savedRange = null;
    var linkPanel = null;
    var linkRange = null;
    var linkPanelBound = false;
    var symbolsPanel = null;
    var symbolsPanelBound = false;
    var htmlPanel = null;
    var htmlPanelBound = false;
    var pasteMode = "rich";

    // IRGEZTNE_EDITOR_CORE_INTERNAL_HISTORY_V064J
    var historyStack = [];
    var historyIndex = -1;
    var historyTimer = null;
    var restoringHistory = false;
    var historyLimit = 80;


    function targetElement(event) {
      return event && event.target && event.target.closest ? event.target : null;
    }

    function currentHtml() {
      if (api && typeof api.getHtml === "function") return api.getHtml();
      return root.innerHTML || "";
    }

    function updateHistoryButtons() {
      var undoBtn = toolbar.querySelector('[data-command="undo"]');
      var redoBtn = toolbar.querySelector('[data-command="redo"]');

      if (undoBtn) undoBtn.disabled = historyIndex <= 0;
      if (redoBtn) redoBtn.disabled = historyIndex < 0 || historyIndex >= historyStack.length - 1;
    }

    function pushHistory(reason) {
      if (restoringHistory) return;

      var html = currentHtml();

      if (historyIndex >= 0 && historyStack[historyIndex] === html) {
        updateHistoryButtons();
        return;
      }

      historyStack = historyStack.slice(0, historyIndex + 1);
      historyStack.push(html);

      if (historyStack.length > historyLimit) {
        historyStack.shift();
      }

      historyIndex = historyStack.length - 1;
      updateHistoryButtons();

      if (toolbar.dataset) toolbar.dataset.historyReason = reason || "change";
    }

    function scheduleHistory(reason) {
      if (restoringHistory) return;

      clearTimeout(historyTimer);
      historyTimer = window.setTimeout(function () {
        pushHistory(reason || "input");
      }, 350);
    }

    function applyHistory(html, reason) {
      restoringHistory = true;

      if (api && typeof api.setHtml === "function") {
        api.setHtml(html || "", { reason: reason || "history", focus: true });
      } else {
        root.innerHTML = html || "";
        try { root.focus({ preventScroll: true }); } catch (error) { root.focus(); }
      }

      restoringHistory = false;
      updateHistoryButtons();
      saveSelection();
    }

    function undoHistory() {
      if (historyIndex <= 0) {
        updateHistoryButtons();
        return;
      }

      historyIndex -= 1;
      applyHistory(historyStack[historyIndex], "history-undo");
    }

    function redoHistory() {
      if (historyIndex < 0 || historyIndex >= historyStack.length - 1) {
        updateHistoryButtons();
        return;
      }

      historyIndex += 1;
      applyHistory(historyStack[historyIndex], "history-redo");
    }

    function saveSelection() {
      var sel = window.getSelection && window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var r = sel.getRangeAt(0);
      if (!root.contains(r.commonAncestorContainer)) return;
      savedRange = r.cloneRange();
    }

    function restoreSelection() {
      if (!savedRange) return false;
      var sel = window.getSelection && window.getSelection();
      if (!sel) return false;
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return true;
      } catch (error) {
        return false;
      }
    }

    function notify(reason) {
      try {
        root.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (error) {}
      saveSelection();
      if (toolbar.dataset) toolbar.dataset.lastAction = reason || "change";
      pushHistory(reason || "toolbar-change");
    }

    function focusRoot() {
      if (api && typeof api.focus === "function") api.focus();
      restoreSelection();
    }

    function closestBlock(node) {
      var current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      while (current && current !== root) {
        if (/^(P|H1|H2|H3|BLOCKQUOTE|DIV)$/i.test(current.tagName || "")) return current;
        current = current.parentElement;
      }
      return null;
    }

    function getRange() {
      focusRoot();
      var sel = window.getSelection && window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      var r = sel.getRangeAt(0);
      if (!root.contains(r.commonAncestorContainer)) return null;
      return r;
    }

    function setCaretAfter(node) {
      var nr = document.createRange();
      nr.setStartAfter(node);
      nr.collapse(true);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(nr);
      saveSelection();
    }

    function setBlock(tag) {
      tag = String(tag || "p").toLowerCase();
      if (!/^(p|h2|h3|blockquote)$/.test(tag)) tag = "p";

      var r = getRange();
      if (!r) return;

      var block = closestBlock(r.startContainer);
      var next = document.createElement(tag);

      if (block && block !== root) {
        next.innerHTML = block.innerHTML || "<br>";
        block.replaceWith(next);
      } else {
        next.innerHTML = r.toString() || "<br>";
        r.deleteContents();
        r.insertNode(next);
      }

      var nr = document.createRange();
      nr.selectNodeContents(next);
      nr.collapse(false);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(nr);

      notify("block:" + tag);
    }

    function wrapInline(tag) {
      tag = String(tag || "").toLowerCase();
      if (!/^(strong|em|u|s|code)$/.test(tag)) return;

      var r = getRange();
      if (!r || r.collapsed) return;

      var node = document.createElement(tag);
      node.appendChild(r.extractContents());
      r.insertNode(node);

      var nr = document.createRange();
      nr.selectNodeContents(node);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(nr);

      notify("inline:" + tag);
    }

    function exec(command, value) {
      if (!command || typeof document.execCommand !== "function") return;
      focusRoot();
      try {
        document.execCommand(command, false, value || null);
        notify("command:" + command);
      } catch (error) {
        console.warn("[IRGEZTNEEditorCoreToolbar] command failed:", command, error);
      }
    }

    function clearFormat() {
      // IRGEZTNE_EDITOR_CORE_CLEAR_FORMAT_V064B
      // If text is selected, remove inline formatting. If caret is inside a block,
      // convert that block to a clean paragraph with plain text.
      var r = getRange();
      if (!r) return;

      if (!r.collapsed && typeof document.execCommand === "function") {
        try {
          document.execCommand("removeFormat", false, null);
          notify("clear-selection-format");
          return;
        } catch (error) {}
      }

      var block = closestBlock(r.startContainer);
      if (!block || block === root) return;

      var p = document.createElement("p");
      var text = (block.textContent || "").trim();

      if (text) p.textContent = text;
      else p.innerHTML = "<br>";

      block.replaceWith(p);

      var nr = document.createRange();
      nr.selectNodeContents(p);
      nr.collapse(false);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(nr);

      notify("clear-block-format");
    }

    function insertText(text) {
      text = String(text || "");
      if (!text) return;

      var r = getRange();
      if (!r) return;

      var node = document.createTextNode(text);
      r.deleteContents();
      r.insertNode(node);
      setCaretAfter(node);

      notify("insert-text");
    }

    function ensureSymbolsPanel() {
      // IRGEZTNE_EDITOR_CORE_SYMBOLS_PANEL_V064D
      if (symbolsPanel) return symbolsPanel;

      // IRGEZTNE_EDITOR_CORE_DOCUMENT_SYMBOLS_V064E
      // Editor Core symbols are for text/documents, not site/project icons.
      var symbols = [
        ["✓", "Готово"],
        ["✕", "Нет / ошибка"],
        ["✦", "Идея"],
        ["★", "Важное"],
        ["☾", "Ночь / спокойно"],
        ["⚠", "Проверить"],
        ["→", "Дальше"],
        ["←", "Назад"],
        ["↑", "Вверх"],
        ["↓", "Вниз"],
        ["↻", "Обновить"],
        ["◈", "Модуль / блок"],
        ["✎", "Редакция"],
        ["§", "Раздел"],
        ["¶", "Абзац"],
        ["•", "Пункт"],
        ["№", "Номер"],
        ["©", "Copyright"],
        ["®", "Registered"],
        ["™", "Trademark"],
        ["…", "Продолжение"],
        ["—", "Длинное тире"],
        ["«", "Левая кавычка"],
        ["»", "Правая кавычка"],
        ["°", "Градус"]
      ];

      symbolsPanel = document.createElement("div");
      symbolsPanel.className = "ir-editor-symbols-panel";
      symbolsPanel.hidden = true;

      symbolsPanel.innerHTML = ''
        + '<div class="ir-editor-symbols-panel__head">'
        + '  <strong>Document symbols</strong>'
        + '  <button type="button" data-ir-symbols-close>×</button>'
        + '</div>'
        + '<div class="ir-editor-symbols-panel__grid">'
        + symbols.map(function (item) {
            var value = item[0];
            var label = item[1];
            return '<button type="button" data-ir-symbol="' + value + '" title="' + label + '">'
              + '<span>' + value + '</span>'
              + '<small>' + label + '</small>'
              + '</button>';
          }).join('')
        + '</div>';

      toolbar.after(symbolsPanel);

      if (!symbolsPanelBound) {
        symbolsPanel.addEventListener("mousedown", function (event) {
          event.stopPropagation();
        });

        symbolsPanel.addEventListener("click", function (event) {
          var target = event.target;
          if (!target || !target.closest) return;

          var close = target.closest("[data-ir-symbols-close]");
          if (close) {
            event.preventDefault();
            closeSymbolsPanel();
            return;
          }

          var button = target.closest("[data-ir-symbol]");
          if (!button) return;

          event.preventDefault();
          insertText(button.dataset.irSymbol || "");
          closeSymbolsPanel(false);
        });

        symbolsPanelBound = true;
      }

      return symbolsPanel;
    }

    function openSymbolsPanel() {
      saveSelection();
      var panel = ensureSymbolsPanel();
      panel.hidden = !panel.hidden;
    }

    function closeSymbolsPanel(restore) {
      if (symbolsPanel) symbolsPanel.hidden = true;
      if (restore !== false) focusRoot();
    }

    function cleanHtml(html) {
      html = String(html || "");

      return html
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
        .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
        .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
        .replace(/\shref\s*=\s*"javascript:[^"]*"/gi, ' href="#"')
        .replace(/\shref\s*=\s*'javascript:[^']*'/gi, " href='#'");
    }

    function escapeHtml(text) {
      return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function plainTextToHtml(text) {
      text = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      var parts = text.split(/\n{2,}/).map(function (part) {
        return part.trim();
      }).filter(Boolean);

      if (!parts.length) return "";

      return parts.map(function (part) {
        return "<p>" + escapeHtml(part).replace(/\n/g, "<br>") + "</p>";
      }).join("");
    }

    function cleanPastedHtml(html) {
      // IRGEZTNE_EDITOR_CORE_PASTE_CLEANUP_V064G
      html = cleanHtml(html);

      var template = document.createElement("template");
      template.innerHTML = html;

      var allowed = {
        P: true,
        H2: true,
        H3: true,
        BLOCKQUOTE: true,
        STRONG: true,
        EM: true,
        U: true,
        S: true,
        CODE: true,
        A: true,
        UL: true,
        OL: true,
        LI: true,
        BR: true,
        HR: true,
        DIV: true
      };

      function unwrap(node) {
        var parent = node.parentNode;
        if (!parent) return;

        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }

      function walk(node) {
        Array.prototype.slice.call(node.childNodes || []).forEach(function (child) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            var tag = child.tagName;

            if (tag === "B") {
              var strong = document.createElement("strong");
              strong.innerHTML = child.innerHTML;
              child.replaceWith(strong);
              child = strong;
              tag = "STRONG";
            }

            if (tag === "I") {
              var em = document.createElement("em");
              em.innerHTML = child.innerHTML;
              child.replaceWith(em);
              child = em;
              tag = "EM";
            }

            if (!allowed[tag]) {
              walk(child);
              unwrap(child);
              return;
            }

            Array.prototype.slice.call(child.attributes || []).forEach(function (attr) {
              var name = attr.name.toLowerCase();

              if (tag === "A" && (name === "href" || name === "target" || name === "rel")) return;

              child.removeAttribute(attr.name);
            });

            if (tag === "A") {
              var href = child.getAttribute("href") || "#";
              if (/^\s*javascript:/i.test(href)) href = "#";
              child.setAttribute("href", href);
              child.setAttribute("target", "_blank");
              child.setAttribute("rel", "noopener noreferrer");
            }

            walk(child);
          }
        });
      }

      walk(template.content);

      var out = template.innerHTML.trim();

      if (out && !/^<(p|h2|h3|blockquote|ul|ol|hr)\b/i.test(out)) {
        out = "<p>" + out + "</p>";
      }

      return out;
    }

    function insertHtmlAtSelection(html) {
      html = String(html || "");
      if (!html) return;

      focusRoot();

      if (typeof document.execCommand === "function") {
        try {
          document.execCommand("insertHTML", false, html);
          notify("paste-cleanup");
          return;
        } catch (error) {}
      }

      var r = getRange();
      if (!r) return;

      var template = document.createElement("template");
      template.innerHTML = html;

      var fragment = template.content;
      var last = fragment.lastChild;

      r.deleteContents();
      r.insertNode(fragment);

      if (last) setCaretAfter(last);

      notify("paste-cleanup");
    }

    function stripHtmlToText(html) {
      var div = document.createElement("div");
      div.innerHTML = cleanHtml(html || "");
      return div.textContent || div.innerText || "";
    }

    function onPaste(event) {
      var clipboard = event.clipboardData || window.clipboardData;
      if (!clipboard) return;

      var html = clipboard.getData("text/html");
      var text = clipboard.getData("text/plain");

      if (!html && !text) return;

      event.preventDefault();
      saveSelection();

      var clean = "";

      if (pasteMode === "plain") {
        clean = plainTextToHtml(text || stripHtmlToText(html));
      } else {
        clean = html ? cleanPastedHtml(html) : plainTextToHtml(text);
      }

      insertHtmlAtSelection(clean);
    }

    function ensureHtmlPanel() {
      // IRGEZTNE_EDITOR_CORE_HTML_PANEL_V064F
      if (htmlPanel) return htmlPanel;

      htmlPanel = document.createElement("div");
      htmlPanel.className = "ir-editor-html-panel";
      htmlPanel.hidden = true;
      htmlPanel.innerHTML = ''
        + '<div class="ir-editor-html-panel__head">'
        + '  <strong>HTML source</strong>'
        + '  <button type="button" data-ir-html-close>×</button>'
        + '</div>'
        + '<textarea data-ir-html-source spellcheck="false"></textarea>'
        + '<div class="ir-editor-html-panel__hint">Ctrl+Enter — применить. Escape — закрыть.</div>'
        + '<div class="ir-editor-html-panel__actions">'
        + '  <button type="button" data-ir-html-apply>Применить HTML</button>'
        + '  <button type="button" data-ir-html-cancel>Отмена</button>'
        + '</div>';

      toolbar.after(htmlPanel);

      if (!htmlPanelBound) {
        htmlPanel.addEventListener("mousedown", function (event) {
          event.stopPropagation();
        });

        htmlPanel.addEventListener("click", function (event) {
          var target = event.target;
          if (!target || !target.closest) return;

          if (target.closest("[data-ir-html-apply]")) {
            event.preventDefault();
            applyHtmlPanel();
          } else if (target.closest("[data-ir-html-cancel]") || target.closest("[data-ir-html-close]")) {
            event.preventDefault();
            closeHtmlPanel();
          }
        });

        htmlPanel.addEventListener("keydown", function (event) {
          if (event.key === "Escape") {
            event.preventDefault();
            closeHtmlPanel();
          }

          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            applyHtmlPanel();
          }
        });

        htmlPanelBound = true;
      }

      return htmlPanel;
    }

    function openHtmlPanel() {
      var panel = ensureHtmlPanel();
      var textarea = panel.querySelector("[data-ir-html-source]");

      if (textarea) textarea.value = root.innerHTML || "";

      if (linkPanel) linkPanel.hidden = true;
      if (symbolsPanel) symbolsPanel.hidden = true;

      panel.hidden = false;

      window.setTimeout(function () {
        try { textarea.focus(); textarea.setSelectionRange(0, 0); } catch (error) {}
      }, 0);
    }

    function closeHtmlPanel() {
      if (htmlPanel) htmlPanel.hidden = true;
      focusRoot();
    }

    function applyHtmlPanel() {
      var panel = ensureHtmlPanel();
      var textarea = panel.querySelector("[data-ir-html-source]");
      var html = textarea ? textarea.value : "";

      html = cleanHtml(html).trim();

      if (!html) html = "<p><br></p>";

      root.innerHTML = html;

      closeHtmlPanel();
      notify("html-panel");
    }

    function ensureLinkPanel() {
      // IRGEZTNE_EDITOR_CORE_LINK_PANEL_V064C
      if (linkPanel) return linkPanel;

      linkPanel = document.createElement("div");
      linkPanel.className = "ir-editor-link-panel";
      linkPanel.hidden = true;
      linkPanel.innerHTML = ''
        + '<div class="ir-editor-link-panel__row">'
        + '  <label>URL</label>'
        + '  <input type="url" data-ir-link-url placeholder="https://example.com">'
        + '</div>'
        + '<div class="ir-editor-link-panel__row">'
        + '  <label>Текст</label>'
        + '  <input type="text" data-ir-link-text placeholder="Текст ссылки">'
        + '</div>'
        + '<div class="ir-editor-link-panel__actions">'
        + '  <label class="ir-editor-link-panel__check"><input type="checkbox" data-ir-link-blank checked> Новая вкладка</label>'
        + '  <button type="button" data-ir-link-apply>Вставить</button>'
        + '  <button type="button" data-ir-link-cancel>Отмена</button>'
        + '</div>';

      toolbar.after(linkPanel);

      if (!linkPanelBound) {
        linkPanel.addEventListener("mousedown", function (event) {
          event.stopPropagation();
        });

        linkPanel.addEventListener("click", function (event) {
          var target = event.target;
          if (!target || !target.closest) return;

          if (target.closest("[data-ir-link-apply]")) {
            event.preventDefault();
            applyLinkPanel();
          } else if (target.closest("[data-ir-link-cancel]")) {
            event.preventDefault();
            closeLinkPanel();
          }
        });

        linkPanel.addEventListener("keydown", function (event) {
          if (event.key === "Escape") {
            event.preventDefault();
            closeLinkPanel();
          }

          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            applyLinkPanel();
          }
        });

        linkPanelBound = true;
      }

      return linkPanel;
    }

    function normalizeUrl(url) {
      url = String(url || "").trim();
      if (!url) return "";
      if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url;
      return "https://" + url;
    }

    function unwrapNode(node) {
      var parent = node && node.parentNode;
      if (!parent) return;

      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
    }

    function removeLinksIn(scope) {
      if (!scope || !scope.querySelectorAll) return 0;

      var links = Array.prototype.slice.call(scope.querySelectorAll("a"));
      links.forEach(unwrapNode);
      return links.length;
    }

    function clearLinks() {
      // IRGEZTNE_EDITOR_CORE_UNLINK_PLAIN_PASTE_V064H
      var r = getRange();
      if (!r) return;

      var changed = 0;

      if (!r.collapsed && typeof document.execCommand === "function") {
        try {
          document.execCommand("unlink", false, null);
          changed += 1;
        } catch (error) {}
      }

      var block = closestBlock(r.startContainer);
      if (block && block !== root) {
        changed += removeLinksIn(block);
      }

      if (!changed) {
        changed += removeLinksIn(root);
      }

      notify("unlink");
    }

    function setPasteMode(mode) {
      pasteMode = mode === "plain" ? "plain" : "rich";

      if (toolbar && toolbar.dataset) {
        toolbar.dataset.pasteMode = pasteMode;
      }

      var btn = toolbar.querySelector('[data-action="paste-mode"]');
      if (btn) {
        var active = pasteMode === "plain";
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.textContent = active ? "Paste: Plain" : "Paste: Rich";
      }

      notify("paste-mode:" + pasteMode);
    }

    function togglePasteMode() {
      setPasteMode(pasteMode === "plain" ? "rich" : "plain");
    }

    function closeLinkPanel() {
      if (linkPanel) linkPanel.hidden = true;
      linkRange = null;
      focusRoot();
    }

    function openLinkPanel() {
      var r = getRange();

      if (!r) {
        focusRoot();
        r = document.createRange();
        r.selectNodeContents(root);
        r.collapse(false);
      }

      linkRange = r.cloneRange();

      var panel = ensureLinkPanel();
      var urlInput = panel.querySelector("[data-ir-link-url]");
      var textInput = panel.querySelector("[data-ir-link-text]");
      var selectedText = r && !r.collapsed ? String(r.toString() || "").trim() : "";

      if (urlInput) urlInput.value = "";
      if (textInput) textInput.value = selectedText || "";

      panel.hidden = false;

      window.setTimeout(function () {
        try { (urlInput || textInput).focus(); } catch (error) {}
      }, 0);
    }

    function applyLinkPanel() {
      var panel = ensureLinkPanel();
      var urlInput = panel.querySelector("[data-ir-link-url]");
      var textInput = panel.querySelector("[data-ir-link-text]");
      var blankInput = panel.querySelector("[data-ir-link-blank]");

      var url = normalizeUrl(urlInput ? urlInput.value : "");
      var text = String(textInput ? textInput.value : "").trim();

      if (!url) {
        if (urlInput) {
          urlInput.focus();
          urlInput.classList.add("is-error");
          window.setTimeout(function () { urlInput.classList.remove("is-error"); }, 700);
        }
        return;
      }

      var r = linkRange ? linkRange.cloneRange() : getRange();
      if (!r) return;

      var a = document.createElement("a");
      a.href = url;

      if (!blankInput || blankInput.checked) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }

      if (r.collapsed) {
        a.textContent = text || url;
        r.insertNode(a);

        var spacer = document.createTextNode(" ");
        a.after(spacer);
        setCaretAfter(spacer);
      } else {
        if (text) {
          a.textContent = text;
          r.deleteContents();
          r.insertNode(a);
        } else {
          a.appendChild(r.extractContents());
          r.insertNode(a);
        }

        var nr = document.createRange();
        nr.selectNodeContents(a);

        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(nr);
        saveSelection();
      }

      closeLinkPanel();
      notify("link-panel");
    }

    function link() {
      openLinkPanel();
    }

    function line() {
      var r = getRange();
      if (!r) return;

      var hr = document.createElement("hr");
      r.deleteContents();
      r.insertNode(hr);

      var p = document.createElement("p");
      p.innerHTML = "<br>";
      hr.after(p);

      var nr = document.createRange();
      nr.setStart(p, 0);
      nr.collapse(true);

      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(nr);

      notify("line");
    }

    function onMouseDown(event) {
      var el = targetElement(event);
      if (!el) return;

      var button = el.closest("button");
      if (!button || !toolbar.contains(button)) return;

      event.preventDefault();
      saveSelection();
    }

    function onClick(event) {
      var el = targetElement(event);
      if (!el) return;

      var btn = el.closest("button");
      if (!btn || !toolbar.contains(btn)) return;

      event.preventDefault();

      if (btn.dataset.block) setBlock(btn.dataset.block);
      else if (btn.dataset.inline) wrapInline(btn.dataset.inline);
      else if (btn.dataset.command === "undo") undoHistory();
      else if (btn.dataset.command === "redo") redoHistory();
      else if (btn.dataset.command === "removeFormat") clearFormat();
      else if (btn.dataset.command) exec(btn.dataset.command, btn.dataset.value || null);
      else if (btn.dataset.action === "link") link();
      else if (btn.dataset.action === "unlink") clearLinks();
      else if (btn.dataset.action === "line") line();
      else if (btn.dataset.action === "symbols") openSymbolsPanel();
      else if (btn.dataset.action === "html") openHtmlPanel();
      else if (btn.dataset.action === "paste-mode") togglePasteMode();
      else if (btn.dataset.action === "symbol") insertText(btn.dataset.value || "☺");
    }

    function onChange(event) {
      var el = targetElement(event);
      if (!el || !toolbar.contains(el)) return;

      if (el.matches && el.matches("[data-block-select]")) {
        setBlock(el.value || "p");
        el.selectedIndex = 0;
      }
    }

    function onRootInputHistory() {
      scheduleHistory("input");
    }

    ["keyup", "mouseup", "focus", "click", "input"].forEach(function (name) {
      root.addEventListener(name, saveSelection);
    });

    root.addEventListener("input", onRootInputHistory);

    toolbar.addEventListener("mousedown", onMouseDown);
    toolbar.addEventListener("click", onClick);
    toolbar.addEventListener("change", onChange);
    root.addEventListener("paste", onPaste);

    pushHistory("init");

    return {
      version: "v064j",
      destroy: function () {
        clearTimeout(historyTimer);
        root.removeEventListener("input", onRootInputHistory);
        toolbar.removeEventListener("mousedown", onMouseDown);
        toolbar.removeEventListener("click", onClick);
        toolbar.removeEventListener("change", onChange);
        root.removeEventListener("paste", onPaste);
      }
    };
  }

  window.IRGEZTNEEditorCoreToolbar = {
    version: "v064j",
    create: createToolbar
  };
})(window, document);
