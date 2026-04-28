import { createState } from './state.js';
import { getEls } from './dom.js';
import { loadState, saveLanguage, saveSource } from './services/storage.js';
import { initTabs } from './browser/tabs.js';
import { initNavigation } from './browser/navigation.js';
import { SOURCES, closeSourceDropdown, toggleSourceDropdown, updateSourceUi } from './browser/sources-ui.js';
import { initBookmarks } from './browser/bookmarks.js';
import { applyLanguage, ensureLanguageToggle } from './i18n.js';

window.__IRGEZTNE_MODULAR_BROWSER__ = true;

document.addEventListener('DOMContentLoaded', () => {
  const state = createState();
  const els = getEls();
  loadState(state);
  if (!SOURCES[state.currentSource]) {
    state.currentSource = 'duckduckgo';
  }

  const tabsApi = initTabs(state, els);
  initNavigation(state, els, tabsApi);
  const bookmarksApi = initBookmarks(state, els);

  function syncLanguageUi() {
    applyLanguage(state, els);
    document.dispatchEvent(new CustomEvent('irg:language-changed', {
      detail: { language: state.language }
    }));
  }

  function setLanguage(language) {
    const next = String(language || '').toLowerCase() === 'ru' ? 'ru' : 'en';
    if (state.language === next) {
      syncLanguageUi();
      return;
    }
    state.language = next;
    saveLanguage(state);
    syncLanguageUi();
  }

  function retargetIfOnSourceHome() {
    const active = state.tabs.find((item) => item.id === state.activeTabId);
    if (!active) return;
    const currentHome = Object.values(SOURCES).find((source) => active.url && active.url.startsWith(source.home));
    if (!currentHome) return;
    active.url = (SOURCES[state.currentSource] || SOURCES.google).home;
    tabsApi.navigateActiveTab(active.url);
  }

  function getInitialHomeUrl() {
    const current = SOURCES[state.currentSource] || SOURCES.duckduckgo || SOURCES.google;
    if (current && current.home) return current.home;
    if (current && typeof current.buildSearchUrl === 'function') {
      const built = current.buildSearchUrl('');
      if (built) return built;
    }
    return 'https://duckduckgo.com/';
  }

  function ensureInitialTab() {
    if (Array.isArray(state.tabs) && state.tabs.length) return;
    const url = getInitialHomeUrl();
    const label = (SOURCES[state.currentSource] || SOURCES.duckduckgo || SOURCES.google || {}).label || 'New Tab';
    tabsApi.createTab({
      title: label,
      url
    });
  }

  function setSource(sourceKey) {
    if (!SOURCES[sourceKey]) return;
    state.currentSource = sourceKey;
    saveSource(state);
    updateSourceUi(state, els);
    retargetIfOnSourceHome();
    syncLanguageUi();
  }

  els.sourceTrigger?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSourceDropdown(els);
  });

  els.sourceDropdown?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-source]');
    if (!option) return;
    setSource(option.dataset.source);
    closeSourceDropdown(els);
  });

  document.addEventListener('click', (event) => {
    if (!els.addressWrap?.contains(event.target)) closeSourceDropdown(els);
  });

  window.__IRG_BROWSER_SHELL_API = {
    openLibraryFileInTab: tabsApi.openLibraryFileInTab,
    navigateActiveTab: tabsApi.navigateActiveTab,
    createTab: tabsApi.createTab,
    updateAddressFromActiveTab: tabsApi.updateAddressFromActiveTab,
    getLanguage: () => state.language,
    setLanguage
  };

  document.addEventListener('ns-library:open-file-tab', (event) => {
    const fileId = event?.detail ? String(event.detail.fileId || '') : '';
    if (fileId) tabsApi.openLibraryFileInTab(fileId);
  });

  ensureLanguageToggle(state, setLanguage);
  updateSourceUi(state, els);
  ensureInitialTab();
  tabsApi.updateAddressFromActiveTab();
  bookmarksApi.updateButton();
  bookmarksApi.emitBookmarks();
  document.addEventListener('irg:tab-changed', () => bookmarksApi.updateButton());
  syncLanguageUi();
  setTimeout(syncLanguageUi, 80);
  document.dispatchEvent(new CustomEvent('irg:browser-shell-ready'));
});
