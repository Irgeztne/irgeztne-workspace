import { STORAGE_KEYS } from '../state.js';

export function loadState(state) {
  try {
    const savedSource = localStorage.getItem(STORAGE_KEYS.browserSource) || '';
    if (savedSource) state.currentSource = savedSource;

    const savedLanguage = localStorage.getItem(STORAGE_KEYS.language) || '';
    if (savedLanguage === 'ru' || savedLanguage === 'en') {
      state.language = savedLanguage;
    }

    const savedBookmarks = JSON.parse(localStorage.getItem(STORAGE_KEYS.bookmarks) || '[]');
    state.bookmarks = Array.isArray(savedBookmarks) ? savedBookmarks : [];
  } catch (error) {
    console.warn('[modular] failed to load state', error);
  }
}

export function saveSource(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.browserSource, state.currentSource);
  } catch (error) {
    console.warn('[modular] failed to save source', error);
  }
}

export function saveLanguage(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.language, state.language === 'ru' ? 'ru' : 'en');
  } catch (error) {
    console.warn('[modular] failed to save language', error);
  }
}

export function saveBookmarks(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(state.bookmarks || []));
  } catch (error) {
    console.warn('[modular] failed to save bookmarks', error);
  }
}
