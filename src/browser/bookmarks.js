import { saveBookmarks } from '../services/storage.js';

export function initBookmarks(state, els) {
  function normalizeUrl(url) {
    return String(url || '').trim();
  }

  function getActiveTab() {
    return state.tabs.find((item) => item.id === state.activeTabId) || null;
  }

  function findBookmarkIndex(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return -1;
    return state.bookmarks.findIndex((item) => normalizeUrl(item.url) === normalized);
  }

  function isBookmarked(url) {
    return findBookmarkIndex(url) >= 0;
  }

  function getBookmarks() {
    return Array.isArray(state.bookmarks) ? state.bookmarks.slice() : [];
  }

  function updateButton() {
    const active = getActiveTab();
    if (!els.bookmarkBtn) return;
    const activeState = Boolean(active && isBookmarked(active.url));
    els.bookmarkBtn.classList.toggle('active', activeState);
    els.bookmarkBtn.setAttribute('aria-pressed', activeState ? 'true' : 'false');
  }

  function emitBookmarks() {
    const items = getBookmarks();
    window.__IRG_BROWSER_BOOKMARKS__ = items;
    document.dispatchEvent(new CustomEvent('irg:bookmarks-updated', {
      detail: { items }
    }));
  }

  function persistBookmarks() {
    saveBookmarks(state);
    updateButton();
    emitBookmarks();
  }

  function removeBookmark(urlOrId) {
    const value = normalizeUrl(urlOrId);
    if (!value) return false;
    const index = state.bookmarks.findIndex((item) => item && (normalizeUrl(item.url) === value || String(item.id || '') === value));
    if (index < 0) return false;
    state.bookmarks.splice(index, 1);
    persistBookmarks();
    return true;
  }

  function toggleCurrentBookmark() {
    const active = getActiveTab();
    if (!active || !active.url) return false;
    const url = normalizeUrl(active.url);
    const index = findBookmarkIndex(url);
    if (index >= 0) {
      state.bookmarks.splice(index, 1);
      persistBookmarks();
      return false;
    }

    state.bookmarks.unshift({
      id: `bookmark_${Date.now()}`,
      title: active.title || active.url,
      url,
      savedAt: new Date().toISOString()
    });
    persistBookmarks();
    return true;
  }

  els.bookmarkBtn?.addEventListener('click', toggleCurrentBookmark);

  return {
    updateButton,
    emitBookmarks,
    getBookmarks,
    isBookmarked,
    removeBookmark,
    toggleCurrentBookmark
  };
}
