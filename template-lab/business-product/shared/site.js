(() => {
  const storageKey = "irgeztne-business-canon-theme";
  const root = document.documentElement;
  const body = document.body;
  const themeButton = document.querySelector("[data-theme-toggle]");
  const menuButton = document.querySelector("[data-menu-toggle]");

  function preferredTheme() {
    const themeFromUrl = new URLSearchParams(location.search).get("theme");
    if (themeFromUrl === "light" || themeFromUrl === "dark") {
      return themeFromUrl;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // The site remains usable when browser storage is unavailable.
    }
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function syncOfflineLinks(theme) {
    if (location.protocol !== "file:") return;
    document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach((link) => {
      const target = new URL(link.getAttribute("href"), location.href);
      target.searchParams.set("theme", theme);
      link.setAttribute("href", `${target.pathname.split("/").pop()}${target.search}${target.hash}`);
    });
  }

  function applyTheme(theme, persist = true) {
    root.dataset.theme = theme;
    if (themeButton) {
      themeButton.textContent = theme === "dark" ? "☀" : "☾";
      themeButton.setAttribute(
        "aria-label",
        theme === "dark"
          ? themeButton.dataset.labelLight
          : themeButton.dataset.labelDark,
      );
    }
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch {
        // Theme still works for the current page.
      }
    }
    syncOfflineLinks(theme);
  }

  applyTheme(preferredTheme(), false);

  themeButton?.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  menuButton?.addEventListener("click", () => {
    const willOpen = body.dataset.navOpen !== "true";
    body.dataset.navOpen = String(willOpen);
    menuButton.setAttribute("aria-expanded", String(willOpen));
  });

  document.querySelectorAll(".site-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      body.dataset.navOpen = "false";
      menuButton?.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      body.dataset.navOpen = "false";
      menuButton?.setAttribute("aria-expanded", "false");
    }
  });

  const demoForm = document.querySelector("[data-demo-form]");
  demoForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = demoForm.querySelector("[data-form-status]");
    if (status) {
      status.textContent = demoForm.dataset.demoMessage || "";
      status.focus();
    }
  });
})();
