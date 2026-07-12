export const STORAGE_KEYS = {
  browserSource: 'nsbrowser.v8.browser.source',
  bookmarks: 'nsbrowser.v8.bookmarks',
  language: 'nsbrowser.v8.language'
};

export function createState() {
  return {
    currentSource: 'google',
    language: 'en',
    tabs: [],
    activeTabId: null,
    tabCounter: 0,
    bookmarks: []
  };
}
