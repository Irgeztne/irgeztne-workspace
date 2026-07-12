(function () {
  if (window.__IRGEZTNE_TEMPLATES_WEBSTUDIO_BRIDGE_PREVIEW4_NO_FORCED_DEMO__) return;
  window.__IRGEZTNE_TEMPLATES_WEBSTUDIO_BRIDGE_PREVIEW4_NO_FORCED_DEMO__ = true;

  /*
   * 1.0.0 template handling now belongs to editor-site-studio-safe-v5.
   * This compatibility bridge intentionally does not overwrite the Web Studio
   * preview iframe anymore, because the old bridge injected forced demo blocks
   * such as Hero / Features / Workflow / CTA into generated pages.
   *
   * The selected official template is still stored by preview4-official-templates-v1.js
   * and read by the Web Studio generator. Generated sites stay clean: users add
   * content/pages themselves and choose whether pages appear in the header/footer.
   */

  function cleanupOldTemplateControls() {
    document.querySelectorAll('[data-preview4-template-stablebar], [data-preview4-template-badge], [data-preview4-template-open]').forEach(function (node) {
      node.remove();
    });
  }

  document.addEventListener('DOMContentLoaded', cleanupOldTemplateControls);
  document.addEventListener('irgeztne:preview4-template-selected', cleanupOldTemplateControls);
  window.addEventListener('irgeztne:preview4-template-selected', cleanupOldTemplateControls);
  setTimeout(cleanupOldTemplateControls, 250);
  setTimeout(cleanupOldTemplateControls, 900);
})();
