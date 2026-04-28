import { SOURCES } from './sources-ui.js';

function makeTabId(state) {
  state.tabCounter += 1;
  return `tab_${Date.now()}_${state.tabCounter}`;
}

function getSourceHomeUrl(state) {
  return (SOURCES[state.currentSource] || SOURCES.google).home;
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLibraryItem(fileId) {
  if (!fileId || !window.NSLibraryStore || typeof window.NSLibraryStore.getItemById !== 'function') {
    return null;
  }
  return window.NSLibraryStore.getItemById(fileId);
}

function getLibraryPreviewKind(item) {
  return String(item && item.preview && item.preview.kind ? item.preview.kind : '').toLowerCase();
}

function renderLibraryInlinePane(tab) {
  const item = getLibraryItem(tab.fileId);
  const pane = document.createElement('div');
  pane.className = 'tab-pane-library-file';
  pane.dataset.tabId = tab.id;

  const viewer = document.createElement('div');
  viewer.className = 'native-file-viewer';

  if (!item) {
    viewer.innerHTML = `
      <div style="padding:20px;color:#eaf2ff;">
        <h3 style="margin:0 0 8px;">Library item not found</h3>
        <p style="margin:0;opacity:.8;">The file is no longer available in Source Library.</p>
      </div>
    `;
    pane.appendChild(viewer);
    return pane;
  }

  const kind = getLibraryPreviewKind(item);
  const mime = String(item && item.mime ? item.mime : '').toLowerCase();
  const dataUrl = item && item.storage ? item.storage.dataUrl : '';

  if ((kind === 'image' || mime.startsWith('image/')) && dataUrl) {
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.placeItems = 'center';
    wrap.style.minHeight = '100%';
    wrap.style.padding = '20px';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = item.name || item.originalName || 'Library image';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '12px';

    wrap.appendChild(img);
    viewer.appendChild(wrap);
    pane.appendChild(viewer);
    return pane;
  }

  if (kind === 'text' || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) {
    const pre = document.createElement('pre');
    pre.className = 'native-file-viewer-pre';
    pre.textContent = String(
      (item && item.preview && (item.preview.textContent || item.preview.excerpt)) || ''
    );
    pre.style.margin = '0';
    pre.style.padding = '18px';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    pre.style.color = '#eaf2ff';
    pre.style.background = 'transparent';

    viewer.appendChild(pre);
    pane.appendChild(viewer);
    return pane;
  }

  viewer.innerHTML = `
    <div style="padding:20px;color:#eaf2ff;display:grid;gap:10px;">
      <h3 style="margin:0;">${esc(item.name || item.originalName || 'Library File')}</h3>
      <div style="opacity:.8;">This file opens as a library preview in the tab layer.</div>
      <div style="opacity:.7;">Type: ${esc(item.mime || item.category || 'file')}</div>
    </div>
  `;

  pane.appendChild(viewer);
  return pane;
}

export function initTabs(state, els) {
  function normalizeCreateTabArgs(input, maybeTitle) {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      return {
        url: typeof input.url === 'string' && input.url.trim()
          ? input.url.trim()
          : getSourceHomeUrl(state),
        title: typeof input.title === 'string' && input.title.trim()
          ? input.title.trim()
          : 'New Tab',
        displayUrl: typeof input.displayUrl === 'string' ? input.displayUrl : '',
        fileId: input.fileId || null,
        sourceType: typeof input.sourceType === 'string' && input.sourceType.trim()
          ? input.sourceType.trim()
          : 'web',
        libraryKey: typeof input.libraryKey === 'string' ? input.libraryKey : '',
        kind: typeof input.kind === 'string' ? input.kind : ''
      };
    }

    return {
      url: typeof input === 'string' && input.trim()
        ? input.trim()
        : getSourceHomeUrl(state),
      title: typeof maybeTitle === 'string' && maybeTitle.trim()
        ? maybeTitle.trim()
        : 'New Tab',
      displayUrl: '',
      fileId: null,
      sourceType: 'web',
      libraryKey: '',
      kind: ''
    };
  }

  function renderTabs() {
    if (!els.tabsScroll) return;

    els.tabsScroll.innerHTML = '';
    els.tabsScroll.dataset.tabCount = String(state.tabs.length || 0);

    state.tabs.forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tab-btn${tab.id === state.activeTabId ? ' active' : ''}`;
      button.dataset.tabId = tab.id;
      button.innerHTML =
        `<span class="tab-title">${esc(tab.title || 'New Tab')}</span>` +
        `<span class="tab-close" data-close-tab="${tab.id}" title="Close tab">✕</span>`;
      els.tabsScroll.appendChild(button);
    });

    if (els.addTabBtn) {
      els.addTabBtn.dataset.addTab = 'true';
      els.addTabBtn.setAttribute('title', 'New tab');
      els.addTabBtn.setAttribute('aria-label', 'New tab');
      els.addTabBtn.classList.add('tabs-add-btn');
      els.tabsScroll.appendChild(els.addTabBtn);
    }
  }

  function scrollElementIntoView(node) {
    if (!node || typeof node.scrollIntoView !== 'function') return;

    requestAnimationFrame(() => {
      try {
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (error) {
        node.scrollIntoView();
      }
    });
  }

  function scrollActiveTabIntoView() {
    if (!els.tabsScroll || !state.activeTabId) return;

    const activeButton = els.tabsScroll.querySelector(
      `[data-tab-id="${CSS.escape(state.activeTabId)}"]`
    );

    if (!activeButton) return;
    scrollElementIntoView(activeButton);
  }

  function scrollAddButtonIntoView() {
    if (!els.addTabBtn) return;
    scrollElementIntoView(els.addTabBtn);
  }

  function renderWebviews() {
    if (!els.webviewStack) return;

    els.webviewStack.innerHTML = '';

    state.tabs.forEach((tab) => {
      const pane = document.createElement('div');
      pane.className = `tab-pane${tab.id === state.activeTabId ? ' active' : ''}`;
      pane.dataset.tabId = tab.id;

      if (tab.kind === 'library-file') {
        const libraryPane = renderLibraryInlinePane(tab);
        if (libraryPane.firstChild) {
          pane.appendChild(libraryPane.firstChild);
        }
      } else {
        const webview = document.createElement('webview');
        webview.className = 'browser-webview';
        webview.dataset.tabId = tab.id;
        webview.src = tab.url;
        webview.setAttribute('allowpopups', 'false');

        webview.addEventListener('did-navigate', () => syncFromWebview(tab.id, webview));
        webview.addEventListener('did-navigate-in-page', () => syncFromWebview(tab.id, webview));
        webview.addEventListener('page-title-updated', () => syncFromWebview(tab.id, webview));

        pane.appendChild(webview);
      }

      els.webviewStack.appendChild(pane);
    });
  }

  function syncFromWebview(tabId, webview) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    try {
      tab.url = typeof webview.getURL === 'function' ? webview.getURL() : tab.url;
      tab.title = typeof webview.getTitle === 'function'
        ? (webview.getTitle() || tab.title)
        : tab.title;
    } catch (error) {
      console.warn('[modular] sync webview failed', error);
    }

    renderTabs();
    scrollActiveTabIntoView();
    updateAddressFromActiveTab();

    document.dispatchEvent(new CustomEvent('irg:tab-changed', {
      detail: { tabId }
    }));
  }

  function updateAddressFromActiveTab() {
    const active = state.tabs.find((item) => item.id === state.activeTabId);
    if (!active || !els.addressInput) return;
    els.addressInput.value = active.url || '';
  }

  function activateTab(tabId) {
    state.activeTabId = tabId;
    renderTabs();
    renderWebviews();
    scrollActiveTabIntoView();
    updateAddressFromActiveTab();

    document.dispatchEvent(new CustomEvent('irg:tab-changed', {
      detail: { tabId }
    }));
  }

  function createTab(input = getSourceHomeUrl(state), maybeTitle = 'New Tab') {
    const normalized = normalizeCreateTabArgs(input, maybeTitle);

    const tab = {
      id: makeTabId(state),
      url: normalized.url,
      title: normalized.title,
      displayUrl: normalized.displayUrl,
      fileId: normalized.fileId,
      sourceType: normalized.sourceType,
      libraryKey: normalized.libraryKey
    };

    if (normalized.kind) {
      tab.kind = normalized.kind;
    }

    state.tabs.push(tab);
    activateTab(tab.id);
    scrollAddButtonIntoView();
    return tab;
  }

  function closeTab(tabId) {
    const index = state.tabs.findIndex((item) => item.id === tabId);
    if (index === -1) return;

    const wasActive = state.tabs[index].id === state.activeTabId;
    state.tabs.splice(index, 1);

    if (!state.tabs.length) {
      createTab();
      return;
    }

    if (wasActive) {
      const fallback = state.tabs[Math.max(0, index - 1)] || state.tabs[0];
      state.activeTabId = fallback.id;
    }

    renderTabs();
    renderWebviews();
    scrollActiveTabIntoView();
    updateAddressFromActiveTab();

    document.dispatchEvent(new CustomEvent('irg:tab-changed', {
      detail: { tabId: state.activeTabId }
    }));
  }

  function navigateActiveTab(url) {
    const active = state.tabs.find((item) => item.id === state.activeTabId);
    if (!active) return;

    active.url = url;

    if (active.kind === 'library-file') {
      delete active.kind;
      delete active.fileId;
      renderWebviews();
      renderTabs();
      updateAddressFromActiveTab();
      return;
    }

    const webview = getActiveWebview();
    if (webview) {
      webview.src = url;
    } else {
      renderWebviews();
    }

    updateAddressFromActiveTab();
  }

  function getActiveWebview() {
    if (!els.webviewStack || !state.activeTabId) return null;
    return els.webviewStack.querySelector(
      `webview[data-tab-id="${CSS.escape(state.activeTabId)}"]`
    );
  }

  function openLibraryFileInTab(fileId) {
    const item = getLibraryItem(fileId);
    if (!item || !item.storage || !item.storage.dataUrl) return false;

    const existing = state.tabs.find((tab) => tab.fileId === item.id);
    if (existing) {
      activateTab(existing.id);
      return true;
    }

    const tab = {
      id: makeTabId(state),
      url: item.storage.dataUrl,
      title: item.name || item.originalName || 'Library File',
      fileId: item.id,
      kind: 'library-file'
    };

    state.tabs.push(tab);
    activateTab(tab.id);
    scrollAddButtonIntoView();
    return true;
  }

  function bindAddTabButton() {
    if (!els.addTabBtn || els.addTabBtn.dataset.boundClick === 'true') return;

    els.addTabBtn.dataset.boundClick = 'true';
    els.addTabBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      createTab();
    });
  }

  els.tabsScroll?.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-close-tab]');
    if (closeTarget) {
      event.stopPropagation();
      closeTab(closeTarget.dataset.closeTab);
      return;
    }

    const addTarget = event.target.closest('#addTabBtn, [data-add-tab="true"]');
    if (addTarget) {
      event.preventDefault();
      event.stopPropagation();
      createTab();
      return;
    }

    const tabButton = event.target.closest('[data-tab-id]');
    if (tabButton) {
      activateTab(tabButton.dataset.tabId);
    }
  });

  bindAddTabButton();
  createTab();

  return {
    createTab,
    closeTab,
    activateTab,
    navigateActiveTab,
    getActiveWebview,
    updateAddressFromActiveTab,
    openLibraryFileInTab,
    getSourceHomeUrl: () => getSourceHomeUrl(state)
  };
}
