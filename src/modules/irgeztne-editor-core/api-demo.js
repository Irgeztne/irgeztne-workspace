/* IRGEZTNE_EDITOR_CORE_API_DEMO_V063B_SMALL */
(function () {
  var key = "irgeztne.editor-core-api-demo.v063b-small.html";
  var editor = document.getElementById("apiEditor");
  var preview = document.getElementById("preview");
  var htmlSource = document.getElementById("htmlSource");
  var status = document.getElementById("status");
  var clearBtn = document.getElementById("clearBtn");

  function setStatus(text) {
    if (status) status.textContent = text || "Готово";
  }

  function sync(payload) {
    var html = payload && payload.html ? payload.html : "";
    if (preview) preview.innerHTML = html || "<p style='color:#7f93ad'>Preview пустой.</p>";
    if (htmlSource) htmlSource.value = html;
    try { localStorage.setItem(key, html); } catch (error) {}
    setStatus("Сохранено: " + (payload.reason || "change"));
  }

  var initial = "";
  try { initial = localStorage.getItem(key) || ""; } catch (error) {}
  if (!initial) initial = "<p>API demo: напишите текст здесь.</p>";

  var api = window.IRGEZTNEEditorCoreAPI.create({
    root: editor,
    initialHtml: initial,
    onChange: sync
  });

  window.IRGEZTNEEditorCoreAPIDemo = api;

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!window.confirm("Очистить API demo?")) return;
      api.clear();
    });
  }

  setStatus("Готово");
})();
