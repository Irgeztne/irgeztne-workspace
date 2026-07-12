export function initEditor(state, els, saveState) {
  function syncNotes(value) {
    state.notesValue = value;
    if (els.workspaceNotes && els.workspaceNotes.value !== value) els.workspaceNotes.value = value;
    if (els.workspaceNotesCombined && els.workspaceNotesCombined.value !== value) els.workspaceNotesCombined.value = value;
    if (els.cabinetNotes && els.cabinetNotes.value !== value) els.cabinetNotes.value = value;
    saveState(state);
  }

  function syncEditor(value) {
    state.editorValue = value;
    if (els.workspaceEditor && els.workspaceEditor.value !== value) els.workspaceEditor.value = value;
    if (els.cabinetEditor && els.cabinetEditor.value !== value) els.cabinetEditor.value = value;
    saveState(state);
  }

  els.workspaceNotes?.addEventListener("input", e => syncNotes(e.target.value));
  els.workspaceNotesCombined?.addEventListener("input", e => syncNotes(e.target.value));
  els.cabinetNotes?.addEventListener("input", e => syncNotes(e.target.value));

  els.workspaceEditor?.addEventListener("input", e => syncEditor(e.target.value));
  els.cabinetEditor?.addEventListener("input", e => syncEditor(e.target.value));

  if (state.notesValue) syncNotes(state.notesValue);
  if (state.editorValue) syncEditor(state.editorValue);
}
