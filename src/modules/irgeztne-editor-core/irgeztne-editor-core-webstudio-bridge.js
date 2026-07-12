/* IRGEZTNE_EDITOR_CORE_WEBSTUDIO_BRIDGE_V065E */
(function (window, document) {
  "use strict";

  function createToolbarHtml() {
    return ''
      + '<div class="ir-editor-toolbar ir-editor-toolbar--v064" data-ir-toolbar-version="v065a-bridge">'
      + '  <div class="ir-editor-toolbar-group">'
      + '    <button data-inline="strong" type="button" title="Жирный"><b>B</b></button>'
      + '    <button data-inline="em" type="button" title="Курсив"><i>I</i></button>'
      + '    <button data-inline="u" type="button" title="Подчёркивание"><u>U</u></button>'
      + '    <button data-inline="s" type="button" title="Зачёркивание"><s>S</s></button>'
      + '    <button data-inline="code" type="button" title="Code">{ }</button>'
      + '  </div>'
      + '  <div class="ir-editor-toolbar-group">'
      + '    <select data-block-select title="Стиль блока">'
      + '      <option value="p">Paragraph</option>'
      + '      <option value="h2">Heading 2</option>'
      + '      <option value="h3">Heading 3</option>'
      + '      <option value="blockquote">Quote</option>'
      + '    </select>'
      + '  </div>'
      + '  <div class="ir-editor-toolbar-group">'
      + '    <button data-action="link" type="button" title="Ссылка">Link</button>'
      + '    <button data-action="unlink" type="button" title="Убрать ссылки">Unlink</button>'
      + '    <button data-action="line" type="button" title="Линия">Line</button>'
      + '    <button data-action="symbols" type="button" title="Символы">☺</button>'
      + '  </div>'
      + '  <div class="ir-editor-toolbar-group">'
      + '    <button data-command="justifyLeft" type="button" title="По левому краю">≡</button>'
      + '    <button data-command="justifyCenter" type="button" title="По центру">≣</button>'
      + '    <button data-command="justifyRight" type="button" title="По правому краю">≡</button>'
      + '    <button data-command="insertUnorderedList" type="button" title="Маркированный список">• List</button>'
      + '    <button data-command="insertOrderedList" type="button" title="Нумерованный список">1. List</button>'
      + '  </div>'
      + '  <div class="ir-editor-toolbar-group">'
      + '    <button data-command="undo" type="button" title="Отменить">↶</button>'
      + '    <button data-command="redo" type="button" title="Повторить">↷</button>'
      + '    <button data-command="removeFormat" type="button" title="Очистить формат">Clear</button>'
      + '    <button data-action="paste-mode" type="button" title="Режим вставки" aria-pressed="false">Paste: Rich</button>'
      + '    <button data-action="html" type="button" title="HTML source">&lt;&gt; HTML</button>'
      + '  </div>'
      + '</div>';
  }

  function dispatchTextareaChange(textarea) {
    if (!textarea) return;

    try {
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {}
  }

  function create(options) {
    options = options || {};

    var host = options.host || null;
    var textarea = options.textarea || null;
    var hint = options.hint || null;
    var onChange = typeof options.onChange === "function" ? options.onChange : function () {};
    var initialHtml = String(options.initialHtml || (textarea ? textarea.value : "") || "");
    var dispatchTextareaEvents = options.dispatchTextareaEvents !== false;

    if (!host) {
      throw new Error("IRGEZTNEEditorCoreWebStudioBridge.create: host is required");
    }

    if (!textarea) {
      textarea = host.querySelector && host.querySelector("textarea");
    }

    if (!window.IRGEZTNEEditorCoreAPI || !window.IRGEZTNEEditorCoreToolbar) {
      throw new Error("IRGEZTNEEditorCoreWebStudioBridge.create: Editor Core API and Toolbar are required");
    }

    var shell = document.createElement("div");
    shell.className = "ir-editor-core-webstudio-bridge";
    shell.dataset.irEditorCoreBridge = "v065e";
    shell.innerHTML = ''
      + '<div class="ir-editor-surface ir-editor-core-webstudio-surface" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" data-placeholder="Напишите текст..."></div>';

    if (textarea) {
      textarea.style.display = "none";
      textarea.dataset.irEditorCoreBridgeSource = "1";
    }

    if (hint) {
      hint.textContent = "";
      hint.hidden = true;
      hint.dataset.irEditorCoreBridgeHint = "1";
    }

    host.appendChild(shell);

    var toolbarEl = shell.querySelector(".ir-editor-toolbar");
    var editorEl = shell.querySelector(".ir-editor-core-webstudio-surface");
    var statusEl = shell.querySelector(".ir-editor-core-webstudio-status");

    var api = window.IRGEZTNEEditorCoreAPI.create({
      root: editorEl,
      initialHtml: initialHtml,
      onChange: function (payload) {
        var html = payload && payload.html ? payload.html : "";

        if (textarea) {
          textarea.value = html;
          if (dispatchTextareaEvents) dispatchTextareaChange(textarea);
        }

        if (statusEl) {
          statusEl.textContent = "Saved: " + (payload && payload.reason ? payload.reason : "change");
        }

        onChange({
          html: html,
          text: payload && payload.text ? payload.text : "",
          reason: payload && payload.reason ? payload.reason : "change",
          api: api,
          textarea: textarea,
          host: host
        });
      }
    });

    var toolbarApi = window.IRGEZTNEEditorCoreToolbar.create({
      api: api,
      toolbar: toolbarEl
    });

    if (textarea) textarea.value = api.getHtml();

    return {
      version: "v065e-bridge",
      host: host,
      textarea: textarea,
      shell: shell,
      api: api,
      toolbar: toolbarApi,

      getHtml: function () {
        return api.getHtml();
      },

      setHtml: function (html) {
        api.setHtml(html || "", { reason: "bridge-setHtml" });
      },

      focus: function () {
        api.focus();
      },

      destroy: function () {
        try { toolbarApi.destroy(); } catch (error) {}
        try { api.destroy(); } catch (error2) {}

        if (textarea) {
          textarea.style.display = "";
          delete textarea.dataset.irEditorCoreBridgeSource;
        }

        if (shell && shell.parentNode) shell.parentNode.removeChild(shell);

        if (hint) {
          hint.textContent = "";
          delete hint.dataset.irEditorCoreBridgeHint;
        }
      }
    };
  }

  window.IRGEZTNEEditorCoreWebStudioBridge = {
    version: "v065e-bridge",
    create: create
  };
})(window, document);
