import { STORAGE_KEYS } from '../state.js';

function api() {
  return typeof window !== 'undefined' ? window.nsAPI || null : null;
}

function readPreference(key, fallback) {
  const storage = api();
  if (storage && typeof storage.storageGetPreferenceSync === 'function') {
    const value = storage.storageGetPreferenceSync(key, fallback);
    if (value !== undefined && value !== null) return value;
    return fallback;
  }

  // Fallback only for builds without Storage Core API.
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  const storage = api();
  if (storage && typeof storage.storageSetPreference === 'function') {
    storage.storageSetPreference(key, value).catch((error) => console.warn('[modular] failed to save preference', key, error));
    return;
  }

  // Fallback only for builds without Storage Core API.
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (error) {
    console.warn('[modular] failed to save preference fallback', error);
  }
}

export function loadState(state) {
  try {
    const savedSource = readPreference(STORAGE_KEYS.browserSource, '') || '';
    if (savedSource) state.currentSource = savedSource;

    const savedLanguage = readPreference(STORAGE_KEYS.language, '') || '';
    if (savedLanguage === 'ru' || savedLanguage === 'en') {
      state.language = savedLanguage;
    }

    const savedBookmarks = readPreference(STORAGE_KEYS.bookmarks, []);
    state.bookmarks = Array.isArray(savedBookmarks) ? savedBookmarks : [];
  } catch (error) {
    console.warn('[modular] failed to load state', error);
  }
}

export function saveSource(state) {
  writePreference(STORAGE_KEYS.browserSource, state.currentSource || '');
}

export function saveLanguage(state) {
  writePreference(STORAGE_KEYS.language, state.language === 'ru' ? 'ru' : 'en');
}

export function saveBookmarks(state) {
  writePreference(STORAGE_KEYS.bookmarks, state.bookmarks || []);
}
