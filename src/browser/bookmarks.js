import { saveBookmarks } from '../services/storage.js';

export function initBookmarks(state, els) {
  function getActiveTab() { return state.tabs.find((item) => item.id === state.activeTabId) || null; }
  function isBookmarked(url) { return Boolean(state.bookmarks.find((item) => item.url === url)); }
  function updateButton() {
    const active = getActiveTab();
    if (!els.bookmarkBtn) return;
    const activeState = Boolean(active && isBookmarked(active.url));
    els.bookmarkBtn.classList.toggle('active', activeState);
    els.bookmarkBtn.setAttribute('aria-pressed', activeState ? 'true' : 'false');
  }
  function emitBookmarks() { document.dispatchEvent(new CustomEvent('irg:bookmarks-updated', { detail: { items: state.bookmarks.slice() } })); }
  function toggleCurrentBookmark() {
    const active = getActiveTab();
    if (!active || !active.url) return;
    const index = state.bookmarks.findIndex((item) => item.url === active.url);
    if (index >= 0) state.bookmarks.splice(index, 1);
    else state.bookmarks.unshift({ id: `bookmark_${Date.now()}`, title: active.title || active.url, url: active.url, savedAt: new Date().toISOString() });
    saveBookmarks(state); updateButton(); emitBookmarks();
  }
  els.bookmarkBtn?.addEventListener('click', toggleCurrentBookmark);
  return { updateButton, emitBookmarks };
}
