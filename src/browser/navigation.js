import { SOURCES } from './sources-ui.js';

function looksLikeUrl(value) {
  return /^(https?:\/\/|file:\/\/|about:)/i.test(value) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value);
}
function normalizeUrl(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (/^(https?:\/\/|file:\/\/|about:)/i.test(input)) return input;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) return `https://${input}`;
  return '';
}

export function initNavigation(state, els, tabsApi) {
  function navigateFromInput() {
    const raw = String(els.addressInput?.value || '').trim();
    if (!raw) return;
    const directUrl = looksLikeUrl(raw) ? normalizeUrl(raw) : '';
    if (directUrl) { tabsApi.navigateActiveTab(directUrl); return; }
    const source = SOURCES[state.currentSource] || SOURCES.google;
    tabsApi.navigateActiveTab(source.buildSearchUrl(raw));
  }
  els.goBtn?.addEventListener('click', navigateFromInput);
  els.addressInput?.addEventListener('keydown', (event) => { if (event.key === 'Enter') navigateFromInput(); });
  els.backBtn?.addEventListener('click', () => { const webview = tabsApi.getActiveWebview(); try { if (webview && typeof webview.canGoBack === 'function' && webview.canGoBack()) webview.goBack(); } catch (e) { console.warn('[modular] back failed', e); } });
  els.forwardBtn?.addEventListener('click', () => { const webview = tabsApi.getActiveWebview(); try { if (webview && typeof webview.canGoForward === 'function' && webview.canGoForward()) webview.goForward(); } catch (e) { console.warn('[modular] forward failed', e); } });
  els.reloadBtn?.addEventListener('click', () => { const webview = tabsApi.getActiveWebview(); try { if (webview && typeof webview.reload === 'function') webview.reload(); } catch (e) { console.warn('[modular] reload failed', e); } });
  return { navigateFromInput };
}
