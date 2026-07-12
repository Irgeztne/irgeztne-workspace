/* IRGEZTNE_EDITOR_CORE_API_V064I_CONTRACT */
(function (window, document) {
  "use strict";

  function cleanHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
      .replace(/\shref\s*=\s*"javascript:[^"]*"/gi, ' href="#"')
      .replace(/\shref\s*=\s*'javascript:[^']*'/gi, " href='#'")
      .replace(/\shref\s*=\s*javascript:[^\s>]+/gi, ' href="#"');
  }

  function textFromHtml(html) {
    var div = document.createElement("div");
    div.innerHTML = cleanHtml(html || "");
    return (div.textContent || div.innerText || "").trim();
  }

  /* IRGEZTNE_EDITOR_CORE_STABILITY_V074A */
  function isTopLevelBlockNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return /^(P|H1|H2|H3|H4|H5|H6|BLOCKQUOTE|UL|OL|LI|HR|TABLE|THEAD|TBODY|TFOOT|TR|TD|TH|DIV|SECTION|ARTICLE|FIGURE|PRE)$/i.test(node.tagName || "");
  }

  function inlineRunHasMeaning(nodes) {
    return (nodes || []).some(function (node) {
      if (!node) return false;
      if (node.nodeType === Node.TEXT_NODE) return /\S/.test(node.nodeValue || "");
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      if (/^(BR|IMG|VIDEO|IFRAME|AUDIO)$/i.test(node.tagName || "")) return true;
      return /\S/.test(node.textContent || "");
    });
  }

  function appendInlineParagraph(fragment, nodes) {
    if (!inlineRunHasMeaning(nodes)) return false;
    var p = document.createElement("p");
    nodes.forEach(function (node) { p.appendChild(node); });
    fragment.appendChild(p);
    return true;
  }

  function normalizeTopLevelEditorHtml(html) {
    html = cleanHtml(html || "").trim();
    if (!html) return "";

    var template = document.createElement("template");
    template.innerHTML = html;

    var fragment = document.createDocumentFragment();
    var inlineNodes = [];
    var changed = false;

    Array.prototype.slice.call(template.content.childNodes || []).forEach(function (node) {
      var clone = node.cloneNode(true);
      if (clone.nodeType === Node.TEXT_NODE && !/\S/.test(clone.nodeValue || "") && !inlineNodes.length) return;

      if (clone.nodeType === Node.ELEMENT_NODE && /^(SCRIPT|STYLE|LINK|META)$/i.test(clone.tagName || "")) {
        changed = true;
        return;
      }

      if (clone.nodeType === Node.ELEMENT_NODE && /^BR$/i.test(clone.tagName || "")) {
        if (appendInlineParagraph(fragment, inlineNodes)) changed = true;
        inlineNodes = [];
        return;
      }

      if (isTopLevelBlockNode(clone)) {
        if (appendInlineParagraph(fragment, inlineNodes)) changed = true;
        inlineNodes = [];
        fragment.appendChild(clone);
        return;
      }

      inlineNodes.push(clone);
      changed = true;
    });

    if (appendInlineParagraph(fragment, inlineNodes)) changed = true;
    if (!changed) return html;

    var out = document.createElement("template");
    out.content.appendChild(fragment);
    return out.innerHTML.trim();
  }

  function normalizeHtml(html) {
    return normalizeTopLevelEditorHtml(html);
  }

  function nodeTextLength(node) {
    if (!node) return 0;
    if (node.nodeType === Node.TEXT_NODE) return String(node.nodeValue || "").length;
    return String(node.textContent || "").length;
  }

  function rootContainsSelection(root) {
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || !sel.rangeCount) return false;

    var range = sel.getRangeAt(0);
    return root.contains(range.startContainer) && root.contains(range.endContainer);
  }

  function getCaretSnapshot(root) {
    // IRGEZTNE_EDITOR_CORE_CARET_RESTORE_V065F
    var sel = window.getSelection ? window.getSelection() : null;
    if (!sel || !sel.rangeCount || !rootContainsSelection(root)) return null;

    var range = sel.getRangeAt(0);
    var startRange = document.createRange();
    var endRange = document.createRange();

    try {
      startRange.selectNodeContents(root);
      startRange.setEnd(range.startContainer, range.startOffset);

      endRange.selectNodeContents(root);
      endRange.setEnd(range.endContainer, range.endOffset);

      return {
        start: String(startRange.toString() || "").length,
        end: String(endRange.toString() || "").length,
        collapsed: range.collapsed
      };
    } catch (error) {
      return null;
    }
  }

  function rangeFromTextOffsets(root, snapshot) {
    if (!snapshot) return null;

    var start = Math.max(0, Number(snapshot.start) || 0);
    var end = Math.max(start, Number(snapshot.end) || start);
    var range = document.createRange();
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node = null;
    var pos = 0;
    var startSet = false;
    var endSet = false;

    while ((node = walker.nextNode())) {
      var len = nodeTextLength(node);
      var next = pos + len;

      if (!startSet && start <= next) {
        range.setStart(node, Math.max(0, Math.min(len, start - pos)));
        startSet = true;
      }

      if (!endSet && end <= next) {
        range.setEnd(node, Math.max(0, Math.min(len, end - pos)));
        endSet = true;
        break;
      }

      pos = next;
    }

    if (!startSet || !endSet) {
      try {
        range.selectNodeContents(root);
        range.collapse(false);
      } catch (error) {
        return null;
      }
    }

    return range;
  }

  function restoreCaretSnapshot(root, snapshot) {
    if (!snapshot || !root || document.activeElement !== root) return;

    var range = rangeFromTextOffsets(root, snapshot);
    if (!range) return;

    try {
      var sel = window.getSelection ? window.getSelection() : null;
      if (!sel) return;

      sel.removeAllRanges();
      sel.addRange(range);
    } catch (error) {}
  }

  function create(options) {
    options = options || {};

    var root = options.root || options.editor || null;
    var onChange = typeof options.onChange === "function" ? options.onChange : function () {};
    var delay = Number.isFinite(Number(options.delay)) ? Number(options.delay) : 120;
    var timer = null;
    var destroyed = false;
    var lastHtml = "";

    if (!root) {
      throw new Error("IRGEZTNEEditorCoreAPI.create: root/editor element is required");
    }

    function getHtml() {
      return normalizeHtml(root.innerHTML || "");
    }

    function getText() {
      return (root.textContent || "").trim();
    }

    function isEmpty() {
      var html = getHtml();
      var text = getText();
      return !html || !text;
    }

    function emit(reason) {
      if (destroyed) return;

      // IRGEZTNE_EDITOR_CORE_NO_DELAYED_CARET_RESTORE_V065G
      // Normal onChange does not rewrite the editor DOM, so delayed restore can fight native caret placement.
      var snapshot = null;
      var html = getHtml();
      lastHtml = html;

      onChange({
        html: html,
        text: getText(),
        isEmpty: isEmpty(),
        reason: reason || "change",
        root: root,
        api: instance
      });

      // v065g: delayed caret restore disabled for ordinary input/change emits.
      // Keep snapshot helpers above for future DOM-rewrite operations only.
    }

    function schedule(reason) {
      if (destroyed) return;

      clearTimeout(timer);
      timer = window.setTimeout(function () {
        emit(reason || "input");
      }, delay);
    }

    function setHtml(html, opts) {
      opts = opts || {};

      root.innerHTML = normalizeHtml(html || "");
      lastHtml = getHtml();

      if (opts.focus === true) focus();
      if (opts.emit !== false) emit(opts.reason || "setHtml");
    }

    function replaceHtml(html, opts) {
      setHtml(html, opts || { reason: "replaceHtml" });
    }

    function focus() {
      try {
        root.focus({ preventScroll: true });
      } catch (error) {
        try { root.focus(); } catch (focusError) {}
      }
    }

    function clear(opts) {
      opts = opts || {};
      setHtml("", { reason: opts.reason || "clear", emit: opts.emit, focus: opts.focus !== false });
    }

    function refresh(reason) {
      emit(reason || "refresh");
    }

    function handleInput() {
      schedule("input");
    }

    function handleBlur() {
      emit("blur");
    }

    root.addEventListener("input", handleInput);
    root.addEventListener("blur", handleBlur);

    setHtml(options.initialHtml || "", { emit: false });
    emit("init");

    var instance = {
      version: "v065g-no-delayed-caret-restore",
      root: root,

      getHtml: getHtml,
      getText: getText,
      isEmpty: isEmpty,

      setHtml: setHtml,
      replaceHtml: replaceHtml,
      cleanHtml: cleanHtml,

      focus: focus,
      clear: clear,
      refresh: refresh,

      getLastHtml: function () {
        return lastHtml;
      },

      destroy: function () {
        destroyed = true;
        clearTimeout(timer);
        root.removeEventListener("input", handleInput);
        root.removeEventListener("blur", handleBlur);
      }
    };

    return instance;
  }

  window.IRGEZTNEEditorCoreAPI = {
    version: "v065g-no-delayed-caret-restore",
    create: create,
    cleanHtml: cleanHtml,
    normalizeHtml: normalizeHtml,
    textFromHtml: textFromHtml
  };
})(window, document);
