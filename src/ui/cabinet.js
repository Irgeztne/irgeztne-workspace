export function initCabinet(state, els, saveState) {
  els.hamburgerBtn?.addEventListener("click", () => {
    state.isCabinetOpen = !state.isCabinetOpen;
    els.cabinetRoot?.classList.toggle("open", state.isCabinetOpen);
    saveState(state);
  });

  document.querySelectorAll("[data-open-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.isCabinetOpen = true;
      state.activeCabinetSection = btn.dataset.openSection;
      els.cabinetRoot?.classList.add("open");
      document.querySelectorAll(".cabinet-section-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.cabinetPanel === state.activeCabinetSection);
      });
      saveState(state);
    });
  });
}
