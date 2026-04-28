(function (root) {
  const STORAGE_KEY = "ns.browser.v8.site-profile.v1";

  const DEFAULT_PROFILE = {
    siteName: "IRGEZTNE Studio",
    tagline: "Local-first publishing workspace",
    logoPath: "../../../assets/branding/wordmark.svg",
    logoAlt: "IRGEZTNE",
    faviconPath: "../../../assets/branding/favicon.svg",
    contactEmail: "hello@example.com",
    footerText: "Built with IRGEZTNE",
    navItems: ["Overview", "Stories", "Contact"],
    socialLinks: [
      { label: "Email", url: "mailto:hello@example.com" },
      { label: "Contact", url: "#contact" }
    ],
    primaryColor: "#9a6b40",
    accentColor: "#724729"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeColor(value, fallback) {
    const raw = String(value || "").trim();
    return /^#([0-9a-f]{3,8})$/i.test(raw) ? raw : fallback;
  }

  function normalizeLinks(value) {
    return Array.isArray(value)
      ? value
          .map((item) => ({
            label: String(item && item.label ? item.label : "").trim(),
            url: String(item && item.url ? item.url : "").trim()
          }))
          .filter((item) => item.label && item.url)
      : clone(DEFAULT_PROFILE.socialLinks);
  }

  function normalizeNavItems(value) {
    const list = Array.isArray(value)
      ? value.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    return list.length ? list : clone(DEFAULT_PROFILE.navItems);
  }

  function normalizeProfile(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      siteName: String(source.siteName || DEFAULT_PROFILE.siteName),
      tagline: String(source.tagline || DEFAULT_PROFILE.tagline),
      logoPath: String(source.logoPath || DEFAULT_PROFILE.logoPath),
      logoAlt: String(source.logoAlt || DEFAULT_PROFILE.logoAlt),
      faviconPath: String(source.faviconPath || DEFAULT_PROFILE.faviconPath),
      contactEmail: String(source.contactEmail || DEFAULT_PROFILE.contactEmail),
      footerText: String(source.footerText || DEFAULT_PROFILE.footerText),
      navItems: normalizeNavItems(source.navItems),
      socialLinks: normalizeLinks(source.socialLinks),
      primaryColor: sanitizeColor(source.primaryColor, DEFAULT_PROFILE.primaryColor),
      accentColor: sanitizeColor(source.accentColor, DEFAULT_PROFILE.accentColor)
    };
  }

  function readProfile() {
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeProfile(JSON.parse(raw)) : normalizeProfile(DEFAULT_PROFILE);
    } catch (error) {
      console.warn("[NSSiteProfileStore] read failed:", error);
      return normalizeProfile(DEFAULT_PROFILE);
    }
  }

  let currentProfile = readProfile();

  function writeProfile() {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProfile));
    } catch (error) {
      console.warn("[NSSiteProfileStore] write failed:", error);
    }
  }

  function emitChange() {
    root.dispatchEvent(new CustomEvent("ns-site-profile:changed", {
      detail: { profile: clone(currentProfile) }
    }));
  }

  root.NSSiteProfileStore = {
    getProfile() {
      return clone(currentProfile);
    },
    getDefaultProfile() {
      return clone(DEFAULT_PROFILE);
    },
    replaceProfile(nextProfile) {
      currentProfile = normalizeProfile(nextProfile);
      writeProfile();
      emitChange();
      return clone(currentProfile);
    },
    updateProfile(patch) {
      currentProfile = normalizeProfile(Object.assign({}, currentProfile, patch || {}));
      writeProfile();
      emitChange();
      return clone(currentProfile);
    },
    resetProfile() {
      currentProfile = normalizeProfile(DEFAULT_PROFILE);
      writeProfile();
      emitChange();
      return clone(currentProfile);
    }
  };
})(window);
