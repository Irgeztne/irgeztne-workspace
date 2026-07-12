(function () {
  const STORAGE_KEY = "irgeztne.editor-core-v1.demo.html";

  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const htmlSource = document.getElementById("htmlSource");
  const status = document.getElementById("status");
  const clearBtn = document.getElementById("clearBtn");

  let savedRange = null;
  let saveTimer = null;

  function setStatus(text) {
    status.textContent = text;
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    savedRange = range.cloneRange();
  }

  function restoreSelection() {
    if (!savedRange) return false;

    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  function normalizeHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  }

  function readHtml() {
    return normalizeHtml(editor.innerHTML);
  }

  function writeHtml(html) {
    editor.innerHTML = normalizeHtml(html);
    syncPreview();
  }

  function syncPreview() {
    const html = readHtml();
    preview.innerHTML = html || "<p style='color:#7f93ad'>Preview пустой.</p>";
    htmlSource.value = html;
  }

  function saveNow() {
    const html = readHtml();
    localStorage.setItem(STORAGE_KEY, html);
    syncPreview();
    setStatus("Сохранено локально");
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 120);
  }

  function currentRange() {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range;
  }

  function closestBlock(node) {
    let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (current && current !== editor) {
      if (/^(P|H1|H2|H3|BLOCKQUOTE|DIV)$/i.test(current.tagName || "")) return current;
      current = current.parentElement;
    }
    return null;
  }

  function ensureParagraphIfEmpty() {
    if (editor.innerHTML.trim()) return;
    editor.innerHTML = "<p><br></p>";
    const p = editor.querySelector("p");
    const range = document.createRange();
    range.setStart(p, 0);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    saveSelection();
  }

  function setBlock(tagName) {
    editor.focus();
    ensureParagraphIfEmpty();

    const range = currentRange();
    if (!range) return;

    const block = closestBlock(range.startContainer);
    const next = document.createElement(tagName);

    if (block && block !== editor) {
      next.innerHTML = block.innerHTML || "<br>";
      block.replaceWith(next);
    } else {
      next.innerHTML = range.toString() || "<br>";
      range.deleteContents();
      range.insertNode(next);
    }

    const nextRange = document.createRange();
    nextRange.selectNodeContents(next);
    nextRange.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(nextRange);
    saveSelection();
    saveNow();
  }

  function wrapInline(tagName) {
    editor.focus();
    const range = currentRange();
    if (!range || range.collapsed) {
      setStatus("Сначала выдели текст");
      return;
    }

    const wrapper = document.createElement(tagName);
    try {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);

      const nextRange = document.createRange();
      nextRange.selectNodeContents(wrapper);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(nextRange);
      saveSelection();
      saveNow();
    } catch (error) {
      setStatus("Не удалось применить форматирование");
    }
  }

  function insertLink() {
    editor.focus();
    const range = currentRange();
    if (!range || range.collapsed) {
      setStatus("Сначала выдели текст для ссылки");
      return;
    }

    const url = window.prompt("URL ссылки", "https://");
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.appendChild(range.extractContents());
    range.insertNode(a);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(a);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(nextRange);
    saveSelection();
    saveNow();
  }

  function insertHr() {
    editor.focus();
    const range = currentRange();
    if (!range) return;

    const hr = document.createElement("hr");
    range.deleteContents();
    range.insertNode(hr);

    const p = document.createElement("p");
    p.innerHTML = "<br>";
    hr.after(p);

    const nextRange = document.createRange();
    nextRange.setStart(p, 0);
    nextRange.collapse(true);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(nextRange);
    saveSelection();
    saveNow();
  }

  document.querySelector(".ir-editor-toolbar").addEventListener("mousedown", function (event) {
    if (event.target.closest("button")) {
      event.preventDefault();
      saveSelection();
    }
  });

  document.querySelector(".ir-editor-toolbar").addEventListener("click", function (event) {
    const button = event.target.closest("button");
    if (!button) return;

    const block = button.dataset.block;
    const inline = button.dataset.inline;
    const action = button.dataset.action;

    if (block) setBlock(block);
    if (inline) wrapInline(inline);
    if (action === "link") insertLink();
    if (action === "hr") insertHr();
  });

  editor.addEventListener("input", function () {
    saveSelection();
    scheduleSave();
  });

  ["keyup", "mouseup", "focus", "click"].forEach(function (eventName) {
    editor.addEventListener(eventName, saveSelection);
  });

  clearBtn.addEventListener("click", function () {
    if (!window.confirm("Очистить текст редактора?")) return;
    writeHtml("");
    saveNow();
    editor.focus();
  });

  const initial = localStorage.getItem(STORAGE_KEY);
  writeHtml(initial || "<p>Напиши здесь первый текст IRGEZTNE Editor Core.</p>");
  setStatus("Готово");
})();
