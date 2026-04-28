export const SOURCES = {
  google: {
    label: "Google",
    placeholder: "Search with Google or enter address",
    buildSearchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
  },
  yandex: {
    label: "Yandex",
    placeholder: "Search with Yandex or enter address",
    buildSearchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
  },
  duckduckgo: {
    label: "DuckDuckGo",
    placeholder: "Search with DuckDuckGo or enter address",
    buildSearchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
  },
  wikipedia: {
    label: "Wikipedia",
    placeholder: "Search Wikipedia or enter address",
    buildSearchUrl: (query) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`
  },
  ipfs: {
    label: "IPFS",
    placeholder: "Search CID, IPNS, gateway path, or enter address",
    buildSearchUrl: (query) => `https://ipfs.io/ipfs/${encodeURIComponent(query)}`
  },
  ns: {
    label: "NS",
    placeholder: "Search ENS / NS destination or enter address",
    buildSearchUrl: (query) => `https://app.ens.domains/search/${encodeURIComponent(query)}`
  }
};
