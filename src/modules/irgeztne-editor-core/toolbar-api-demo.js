/* IRGEZTNE_EDITOR_CORE_TOOLBAR_API_DEMO_V063C */
(function () {
  var key = "irgeztne.editor-core-toolbar-api-demo.v063c.html";
  var editor = document.getElementById("apiEditor");
  var toolbar = document.getElementById("toolbar");
  var preview = document.getElementById("preview");
  var htmlSource = document.getElementById("htmlSource");
  var status = document.getElementById("status");
  var clearBtn = document.getElementById("clearBtn");

  function statusText(text) {
    if (status) status.textContent = text || "Готово";
  }

  function sync(payload) {
    var html = payload && payload.html ? payload.html : "";
    if (preview) preview.innerHTML = html || "<p style='color:#7f93ad'>Preview пустой.</p>";
    if (htmlSource) htmlSource.value = html;
    try { localStorage.setItem(key, html); } catch (error) {}
    statusText("Сохранено: " + (payload.reason || "change"));
  }

  var initial = "";
  try { initial = localStorage.getItem(key) || ""; } catch (error) {}
  if (!initial) initial = "<p>Toolbar API demo: выделите текст и примените форматирование.</p>";

  var api = window.IRGEZTNEEditorCoreAPI.create({
    root: editor,
    initialHtml: initial,
    onChange: sync
  });

  var toolbarApi = window.IRGEZTNEEditorCoreToolbar.create({
    api: api,
    toolbar: toolbar
  });

  window.IRGEZTNEEditorCoreToolbarDemo = { editor: api, toolbar: toolbarApi };

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Очистить toolbar demo?")) return;
      api.clear();
    });
  }

  statusText("Готово");
})();
