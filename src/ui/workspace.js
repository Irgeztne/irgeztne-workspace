export function initWorkspace(state, els, saveState) {
  function sync() {
    document.querySelectorAll(".workspace-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.section === state.activeWorkspaceSection);
    });
    document.querySelectorAll(".workspace-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === state.activeWorkspaceSection);
    });
  }

  els.workspaceToggle?.addEventListener("click", () => {
    state.workspaceEnabled = !state.workspaceEnabled;
    els.appShell?.classList.toggle("workspace-open", state.workspaceEnabled);
    saveState(state);
  });

  els.workspaceCollapseBtn?.addEventListener("click", () => {
    state.workspaceEnabled = false;
    els.appShell?.classList.remove("workspace-open");
    saveState(state);
  });

  document.querySelectorAll(".workspace-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeWorkspaceSection = btn.dataset.section;
      sync();
      saveState(state);
    });
  });

  if (state.workspaceEnabled) {
    els.appShell?.classList.add("workspace-open");
  }
  sync();
}
