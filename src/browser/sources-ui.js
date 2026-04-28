export const SOURCES = {
  google: {
    label: 'Google',
    placeholder: 'Search with Google or enter address',
    home: 'https://www.google.com',
    buildSearchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  yandex: {
    label: 'Yandex',
    placeholder: 'Search with Yandex or enter address',
    home: 'https://yandex.com',
    buildSearchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
  },
  duckduckgo: {
    label: 'DuckDuckGo',
    placeholder: 'Search with DuckDuckGo or enter address',
    home: 'https://duckduckgo.com',
    buildSearchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  wikipedia: {
    label: 'Wikipedia',
    placeholder: 'Search Wikipedia or enter address',
    home: 'https://en.wikipedia.org/wiki/Main_Page',
    buildSearchUrl: (query) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
  },
  ipfs: {
    label: 'IPFS',
    placeholder: 'Search CID, IPNS, gateway path, or enter address',
    home: 'https://ipfs.io',
    buildSearchUrl: (query) => {
      const q = String(query || '').trim();
      if (/^(ipfs|ipns)\//i.test(q)) return `https://ipfs.io/${q}`;
      if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(q) || /^bafy[a-z0-9]+$/i.test(q)) return `https://ipfs.io/ipfs/${q}`;
      return `https://ipfs.tech/search/?q=${encodeURIComponent(q)}`;
    }
  },
  ns: {
    label: 'NS',
    placeholder: 'Search ENS / NS destination or enter address',
    home: 'https://app.ens.domains',
    buildSearchUrl: (query) => `https://app.ens.domains/search/${encodeURIComponent(query)}`
  }
};

export function updateSourceUi(state, els) {
  const source = SOURCES[state.currentSource] || SOURCES.google;
  if (els.sourceTriggerLabel) els.sourceTriggerLabel.textContent = source.label;
  if (els.addressInput) els.addressInput.placeholder = source.placeholder;
  if (els.sourceDropdown) {
    els.sourceDropdown.querySelectorAll('[data-source]').forEach((button) => {
      const active = button.dataset.source === state.currentSource;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
}
export function closeSourceDropdown(els){ if(els.sourceDropdown&&els.sourceTrigger){ els.sourceDropdown.classList.add('hidden'); els.sourceTrigger.setAttribute('aria-expanded','false'); }}
export function toggleSourceDropdown(els){ if(!els.sourceDropdown||!els.sourceTrigger) return; const willOpen = els.sourceDropdown.classList.contains('hidden'); els.sourceDropdown.classList.toggle('hidden', !willOpen); els.sourceTrigger.setAttribute('aria-expanded', willOpen ? 'true':'false'); }
